// Scoreboard 3.0 - Enhanced Dashboard with Year-over-Year Comparison
let globalData = [];
let filteredData = [];
let analyticsSettings = {
  showTrends: false,
  showPredictions: false,
  showAnomalies: false,
  comparisonPeriod: '',
  compareYearOverYear: false  // NEW: Year-over-year toggle
};

// Utility Functions with Safe DOM Access
function safeGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id '${id}' not found`);
  }
  return element;
}

function getFacilityName(facilityId) {
  const facilityMap = {
    'OGDEN': 'Ogden',
    'SOMA': 'SOMA',
    'SLC': 'Salt Lake City',
    'SLP': 'Pottery',
    '': 'Online/Virtual'
  };
  return facilityMap[facilityId] || `Facility ${facilityId}`;
}

function showLoading() {
  const loading = safeGetElement('loading');
  if (loading) loading.style.display = 'flex';
}

function hideLoading() {
  const loading = safeGetElement('loading');
  if (loading) loading.style.display = 'none';
}

function showError(message) {
  const errorDiv = safeGetElement('error_display');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
  } else {
    console.error('Error:', message);
    alert('Error: ' + message);
  }
}

function showSuccess(message) {
  const successDiv = safeGetElement('success_display');
  if (successDiv) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => successDiv.style.display = 'none', 3000);
  } else {
    console.log('Success:', message);
  }
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr)).filter(x => x).sort();
}

function formatNumber(num, decimals = 0) {
  if (typeof num !== 'number') return num;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

function formatCurrency(num) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(num);
}

// CRITICAL FIX: Deduplicate data by session_guid to fix SOMA inflation
function deduplicateData(data) {
  const seen = new Set();
  const deduplicated = [];
  
  data.forEach(record => {
    const guid = record.session_guid;
    if (guid && !seen.has(guid)) {
      seen.add(guid);
      deduplicated.push(record);
    } else if (!guid) {
      // Keep records without guid (shouldn't happen but just in case)
      deduplicated.push(record);
    }
  });
  
  console.log(`Deduplication: ${data.length} → ${deduplicated.length} records (removed ${data.length - deduplicated.length} duplicates)`);
  return deduplicated;
}

// Data Loading with Deduplication
async function loadData() {
  showLoading();
  try {
    // Check if data is already embedded (Streamlit deployment)
    if (typeof window.dashboardData !== 'undefined' && window.dashboardData) {
      console.log('Using embedded data:', window.dashboardData.length, 'records');
      const rawData = window.dashboardData;
      
      // CRITICAL: Deduplicate data to fix inflated numbers
      globalData = deduplicateData(rawData);
      filteredData = [...globalData];
    } else {
      // Fallback to fetch for local development
      const resp = await fetch('data.json');
      if (!resp.ok) throw new Error(`Failed to load data.json: ${resp.status}`);
      const rawData = await resp.json();
      
      // CRITICAL: Deduplicate data
      globalData = deduplicateData(rawData);
      filteredData = [...globalData];
    }

    if (!globalData.length) {
      throw new Error('No data found');
    }

    initializeDashboard();
    showSuccess(`Loaded ${globalData.length} unique records successfully`);
  } catch (error) {
    showError(error.message);
    console.error('Data loading error:', error);
  } finally {
    hideLoading();
  }
}

// Date Utilities
function isoWeekStart(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().split('T')[0];
}

function parseDate(dateStr) {
  let d = (dateStr || '').toString();
  if (d.indexOf('T') > -1) d = d.split('T')[0];
  if (d.indexOf(' ') > -1) d = d.split(' ')[0];
  return d;
}

function getMonthStart(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().split('T')[0];
}

// Date Range Helpers
function getCurrentDateRange() {
  const dateFromEl = safeGetElement('date_from');
  const dateToEl = safeGetElement('date_to');

  if (dateFromEl && dateToEl && dateFromEl.value && dateToEl.value) {
    return {
      start: dateFromEl.value,
      end: dateToEl.value,
      hasSelection: true
    };
  }

  return {
    start: null,
    end: null,
    hasSelection: false
  };
}

// NEW: Year-over-year comparison
function getYearAgoRange(currentStartDate, currentEndDate) {
  if (!currentStartDate || !currentEndDate) {
    return { start: null, end: null };
  }

  const startDate = new Date(currentStartDate);
  const endDate = new Date(currentEndDate);

  // Go back exactly one year
  const yearAgoStart = new Date(startDate);
  yearAgoStart.setFullYear(yearAgoStart.getFullYear() - 1);
  
  const yearAgoEnd = new Date(endDate);
  yearAgoEnd.setFullYear(yearAgoEnd.getFullYear() - 1);

  const formatDate = (date) => date.toISOString().split('T')[0];

  return {
    start: formatDate(yearAgoStart),
    end: formatDate(yearAgoEnd)
  };
}

function getPreviousMonthRange(currentStartDate, currentEndDate) {
  if (!currentStartDate || !currentEndDate) {
    return { start: null, end: null };
  }

  const startDate = new Date(currentStartDate);
  const endDate = new Date(currentEndDate);

  const durationMs = endDate - startDate;
  const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - durationDays);

  const formatDate = (date) => date.toISOString().split('T')[0];

  return {
    start: formatDate(prevStart),
    end: formatDate(prevEnd)
  };
}

// Data Processing - FIXED: Always use correct groupBy parameter
function aggregate(rows, groupBy = 'week') {
  console.log('Aggregate function called with:', rows.length, 'rows, groupBy:', groupBy);
  const by_date = {}, by_book = {}, by_instr = {}, by_fac = {}, by_class = {};

  rows.forEach(r => {
    let d = parseDate(r['class_date']);
    if (!d) return;

    // FIXED: Properly handle different groupBy options
    let key;
    if (groupBy === 'week') {
      key = isoWeekStart(d);
    } else if (groupBy === 'month') {
      key = getMonthStart(d);
    } else {
      key = d; // day
    }

    const at = parseInt(r['total_attendees'] || 0) || 0;
    const bk = parseInt(r['total_bookings'] || 0) || 0;

    by_date[key] = (by_date[key] || 0) + at;
    by_book[key] = (by_book[key] || 0) + bk;

    const instr = r['instructor_name'] || '';
    if (instr.trim()) {
      if (!by_instr[instr]) by_instr[instr] = { att: 0, count: 0 };
      by_instr[instr].att += at;
      by_instr[instr].count += 1;
    }

    const className = r['class_name'] || '';
    if (className.trim()) {
      if (!by_class[className]) by_class[className] = { att: 0, count: 0 };
      by_class[className].att += at;
      by_class[className].count += 1;
    }

    const fac = r['facility'] || '';
    if (!by_fac[fac]) by_fac[fac] = { att: 0, count: 0 };
    by_fac[fac].att += at;
    by_fac[fac].count += 1;
  });

  const dates = Object.keys(by_date).filter(x => x).sort();
  const date_vals = dates.map(d => by_date[d]);
  const book_vals = dates.map(d => by_book[d]);

  const instr_list = Object.entries(by_instr)
    .filter(([name, stats]) => stats.count >= 3 && name.trim() !== '')
    .map(([name, stats]) => [name, stats.att, stats.count, stats.count > 0 ? stats.att / stats.count : 0])
    .sort((a, b) => b[3] - a[3])
    .slice(0, 20);

  const instr_names = instr_list.map(x => x[0]);
  const instr_vals = instr_list.map(x => Math.round(x[3] * 10) / 10);

  const class_list = Object.entries(by_class)
    .filter(([name, stats]) => stats.count >= 3 && name.trim() !== '')
    .map(([name, stats]) => [name, stats.att, stats.count, stats.count > 0 ? stats.att / stats.count : 0])
    .sort((a, b) => b[3] - a[3])
    .slice(0, 20);

  const class_names = class_list.map(x => x[0]);
  const class_vals = class_list.map(x => Math.round(x[3] * 10) / 10);

  const fac_list = Object.entries(by_fac).map(([k, v]) => [k, v.att, v.count]).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const fac_names = fac_list.map(x => getFacilityName(x[0]));
  const fac_vals = fac_list.map(x => x[1]);
  const fac_avg = fac_list.map(x => x[2] > 0 ? x[1] / x[2] : 0);

  return { dates, date_vals, book_vals, instr_names, instr_vals, fac_names, fac_vals, fac_avg, class_names, class_vals };
}

// KPI Calculations with Year-over-Year Support
function updateKPIs() {
  const total_attendees = filteredData.reduce((sum, r) => sum + (parseInt(r['total_attendees']) || 0), 0);
  const total_bookings = filteredData.reduce((sum, r) => sum + (parseInt(r['total_bookings']) || 0), 0);
  const total_classes = filteredData.length;
  const avg_attendance = total_classes > 0 ? total_attendees / total_classes : 0;

  const unique_classes = new Set(
    filteredData.map(r => r['session_guid']).filter(Boolean)
  ).size;

  const unique_participants = Math.round(total_attendees * 0.7);

  const currentPeriod = getCurrentDateRange();
  const compareYearOverYear = safeGetElement('compare_year_over_year')?.checked || false;

  let comparisonData = [];
  let comparisonLabel = '';
  
  if (currentPeriod.hasSelection && currentPeriod.start && currentPeriod.end) {
    let comparisonPeriod;
    
    if (compareYearOverYear) {
      comparisonPeriod = getYearAgoRange(currentPeriod.start, currentPeriod.end);
      comparisonLabel = 'vs same period last year';
    } else {
      comparisonPeriod = getPreviousMonthRange(currentPeriod.start, currentPeriod.end);
      comparisonLabel = 'vs prior period';
    }

    console.log('Current period:', currentPeriod);
    console.log('Comparison period:', comparisonPeriod);
    console.log('Comparison type:', compareYearOverYear ? 'Year-over-Year' : 'Sequential');

    comparisonData = globalData.filter(row => {
      const rowDate = parseDate(row['class_date']);

      if (rowDate < comparisonPeriod.start || rowDate > comparisonPeriod.end) return false;

      const facilityToggles = document.querySelectorAll('.facility-toggle input[type="checkbox"]:checked');
      const selectedFacilities = Array.from(facilityToggles).map(checkbox => checkbox.value);
      if (selectedFacilities.length > 0 && !selectedFacilities.includes(row['facility'])) return false;

      const instructor = safeGetElement('instr_select')?.value;
      if (instructor && row['instructor_name'] !== instructor) return false;

      const category = safeGetElement('cat_level1')?.value;
      if (category && row['greatgrandparent_category'] !== category) return false;

      return true;
    });

    console.log('Comparison data count:', comparisonData.length);
  }

  const prev_total_attendees = comparisonData.reduce((sum, r) => sum + (parseInt(r['total_attendees']) || 0), 0);
  const prev_total_bookings = comparisonData.reduce((sum, r) => sum + (parseInt(r['total_bookings']) || 0), 0);
  const prev_total_classes = comparisonData.length;
  const prev_avg_attendance = prev_total_classes > 0 ? prev_total_attendees / prev_total_classes : 0;
  const prev_unique_classes = new Set(comparisonData.map(r => r['session_guid']).filter(Boolean)).size;
  const prev_unique_participants = Math.round(prev_total_attendees * 0.7);

  const getPercentageChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const attendees_change = getPercentageChange(total_attendees, prev_total_attendees);
  const bookings_change = getPercentageChange(total_bookings, prev_total_bookings);
  const avg_attendance_change = getPercentageChange(avg_attendance, prev_avg_attendance);
  const unique_classes_change = getPercentageChange(unique_classes, prev_unique_classes);
  const unique_participants_change = getPercentageChange(unique_participants, prev_unique_participants);

  console.log('Percentage changes:', {
    attendees: `${total_attendees} vs ${prev_total_attendees} = ${attendees_change.toFixed(1)}%`,
    bookings: `${total_bookings} vs ${prev_total_bookings} = ${bookings_change.toFixed(1)}%`
  });

  const getChangeArrow = (change, hasDateSelection = true) => {
    if (!hasDateSelection) return '';
    if (change > 0) return '<span class="trend-arrow trend-up">📈</span>';
    if (change < 0) return '<span class="trend-arrow trend-down">📉</span>';
    return '<span class="trend-arrow trend-neutral">➡️</span>';
  };

  const getChangeText = (change, hasData = true, hasDateSelection = true, label = 'vs prior period') => {
    if (!hasDateSelection) {
      return `<span class="trend-percentage trend-neutral" style="font-size: 0.75rem;">Select date range for comparison</span>`;
    }
    if (!hasData) {
      return `<span class="trend-percentage trend-neutral">No comparison data</span>`;
    }
    const absChange = Math.abs(change);
    if (change > 0) {
      return `<span class="trend-percentage trend-up">+${absChange.toFixed(1)}% ${label}</span>`;
    } else if (change < 0) {
      return `<span class="trend-percentage trend-down">-${absChange.toFixed(1)}% ${label}</span>`;
    } else {
      return `<span class="trend-percentage trend-neutral">0.0% ${label}</span>`;
    }
  };

  const getTrendClass = (value, target) => {
    if (value >= target * 1.1) return 'trend-up';
    if (value <= target * 0.9) return 'trend-down';
    return 'trend-neutral';
  };

  const hasPreviousData = comparisonData.length > 0;
  const hasDateSelection = currentPeriod.hasSelection;
  const kpiContainer = safeGetElement('kpis');
  if (kpiContainer) {
    kpiContainer.innerHTML = `
      <div class="kpi ${getTrendClass(total_attendees, 1000)}">
        <div class="kpi_val">${formatNumber(total_attendees)}</div>
        <div class="kpi_title">Total Participants</div>
        ${hasDateSelection ? `<div class="kpi_change">${getChangeArrow(attendees_change, hasDateSelection)} ${getChangeText(attendees_change, hasPreviousData, hasDateSelection, comparisonLabel)}</div>` : ''}
        <div class="kpi_small">All attendance in period</div>
      </div>
      <div class="kpi ${getTrendClass(total_bookings, 1200)}">
        <div class="kpi_val">${formatNumber(total_bookings)}</div>
        <div class="kpi_title">Total Bookings</div>
        ${hasDateSelection ? `<div class="kpi_change">${getChangeArrow(bookings_change, hasDateSelection)} ${getChangeText(bookings_change, hasPreviousData, hasDateSelection, comparisonLabel)}</div>` : ''}
        <div class="kpi_small">All bookings made</div>
      </div>
      <div class="kpi ${getTrendClass(avg_attendance, 8)}">
        <div class="kpi_val">${formatNumber(avg_attendance, 1)}</div>
        <div class="kpi_title">Average Attendance</div>
        ${hasDateSelection ? `<div class="kpi_change">${getChangeArrow(avg_attendance_change, hasDateSelection)} ${getChangeText(avg_attendance_change, hasPreviousData, hasDateSelection, comparisonLabel)}</div>` : ''}
        <div class="kpi_small">Target: 8 per class</div>
      </div>
      <div class="kpi trend-neutral">
        <div class="kpi_val">${unique_classes.toLocaleString()}</div>
        <div class="kpi_title">Unique Classes</div>
        ${hasDateSelection ? `<div class="kpi_change">${getChangeArrow(unique_classes_change, hasDateSelection)} ${getChangeText(unique_classes_change, hasPreviousData, hasDateSelection, comparisonLabel)}</div>` : ''}
        <div class="kpi_small">Distinct class sessions</div>
      </div>
      <div class="kpi trend-neutral">
        <div class="kpi_val">${unique_participants.toLocaleString()}</div>
        <div class="kpi_title">Unique Participants</div>
        ${hasDateSelection ? `<div class="kpi_change">${getChangeArrow(unique_participants_change, hasDateSelection)} ${getChangeText(unique_participants_change, hasPreviousData, hasDateSelection, comparisonLabel)}</div>` : ''}
        <div class="kpi_small">Estimated individual people</div>
      </div>
    `;
  }
}

// Chart Creation
function createChart(elementId, data, title) {
  const element = safeGetElement(elementId);
  if (!element || !window.Plotly) {
    console.warn(`Cannot create chart for ${elementId}`);
    return;
  }

  try {
    const trace = {
      x: data.x,
      y: data.y,
      type: data.type || 'scatter',
      mode: data.mode || 'lines+markers',
      name: title,
      line: { color: '#cf2e2e', width: 3 },
      marker: { size: 8, color: '#cf2e2e' }
    };

    const layout = {
      title: { text: title, font: { color: '#f0f6fc', size: 18 } },
      paper_bgcolor: '#161b22',
      plot_bgcolor: '#161b22',
      font: { color: '#8b949e', size: 12 },
      xaxis: {
        gridcolor: '#30363d',
        tickfont: { size: 11 },
        tickangle: -45,
        automargin: true
      },
      yaxis: {
        gridcolor: '#30363d',
        tickfont: { size: 11 },
        title: { text: 'Total Attendees', font: { size: 12 } }
      },
      margin: { l: 60, r: 30, t: 80, b: 100 },
      height: 500,
      showlegend: false
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d','select2d','lasso2d','resetScale2d','zoomScale2d']
    };

    Plotly.newPlot(elementId, [trace], layout, config);
  } catch (error) {
    console.error(`Error creating chart for ${elementId}:`, error);
    element.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 20px;">Chart loading error</p>`;
  }
}

function createBarChart(elementId, data, title, colorScheme = 'neutral') {
  const element = safeGetElement(elementId);
  if (!element || !window.Plotly) {
    console.warn(`Cannot create bar chart for ${elementId}`);
    return;
  }

  try {
    const isPerformanceChart = elementId.includes('bar_chart') || elementId.includes('low_performing_chart') ||
                              elementId.includes('top_classes_chart') || elementId.includes('low_performing_classes_chart');

    let colors;
    switch(colorScheme) {
      case 'performance':
        colors = data.values.map((val, idx) => {
          const intensity = (idx / data.values.length) * 0.6 + 0.4;
          return `rgba(35, 134, 54, ${intensity})`;
        });
        break;
      case 'warning':
        colors = data.values.map((val, idx) => {
          const intensity = (1 - idx / data.values.length) * 0.6 + 0.4;
          return `rgba(218, 54, 51, ${intensity})`;
        });
        break;
      case 'facility':
        const facilityColors = [
          'rgba(207, 46, 46, 0.9)',
          'rgba(35, 134, 54, 0.9)',
          'rgba(245, 158, 11, 0.9)',
          'rgba(139, 92, 246, 0.9)',
          'rgba(6, 182, 212, 0.9)',
        ];

        if (data.selectedFacilities && data.selectedFacilities.length > 0) {
          colors = data.labels.map((label) => {
            if (data.selectedFacilities.includes(label)) {
              const colorIndex = data.selectedFacilities.indexOf(label) % facilityColors.length;
              return facilityColors[colorIndex];
            }
            return 'rgba(139, 148, 158, 0.4)';
          });
        } else {
          colors = data.values.map((val, idx) => {
            const intensity = (idx / data.values.length) * 0.4 + 0.6;
            return `rgba(6, 182, 212, ${intensity})`;
          });
        }
        break;
      case 'neutral':
        colors = data.values.map((val, idx) => {
          const intensity = (idx / data.values.length) * 0.4 + 0.6;
          return `rgba(6, 182, 212, ${intensity})`;
        });
        break;
      default:
        colors = '#06b6d4';
    }

    const trace = {
      x: data.values,
      y: data.labels,
      type: 'bar',
      orientation: 'h',
      marker: {
        color: colors,
        line: { width: 1, color: 'rgba(255,255,255,0.1)' }
      },
      hovertemplate: '<b>%{y}</b><br>Average: %{x:.1f}<br><extra></extra>'
    };

    const isFacilityChart = elementId.includes('fac_chart') || elementId.includes('fac_avg_chart');
    const isInstructorChart = elementId.includes('bar_chart') || elementId.includes('low_performing_chart');

    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1200;

    const labelFontSize = isMobile ? (isInstructorChart ? 12 : 11) :
                         isTablet ? (isInstructorChart ? 13 : 12) :
                         (isInstructorChart ? 14 : (isFacilityChart ? 13 : 12));

    const titleFontSize = isMobile ? 14 : (isTablet ? 15 : 16);

    const leftMargin = isMobile ? (isPerformanceChart ? 180 : (isFacilityChart ? 160 : 120)) :
                      isTablet ? (isPerformanceChart ? 200 : (isFacilityChart ? 180 : 140)) :
                      (isPerformanceChart ? 220 : (isFacilityChart ? 200 : 160));

    const chartHeight = isMobile ? (isInstructorChart ? 500 : (isPerformanceChart ? 450 : 350)) :
                       isTablet ? (isInstructorChart ? 600 : (isPerformanceChart ? 500 : 400)) :
                       (isInstructorChart ? 700 : (isPerformanceChart ? 550 : 450));

    const layout = {
      title: { text: title, font: { color: '#f0f6fc', size: titleFontSize } },
      paper_bgcolor: '#161b22',
      plot_bgcolor: '#161b22',
      font: { color: '#8b949e', size: 13 },
      xaxis: { gridcolor: '#30363d' },
      yaxis: {
        gridcolor: '#30363d',
        tickfont: { size: labelFontSize },
        automargin: true,
        tickmode: 'linear'
      },
      margin: {
        l: leftMargin,
        r: 20,
        t: 60,
        b: isInstructorChart ? 60 : 40
      },
      height: chartHeight
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d','select2d','lasso2d','resetScale2d','zoomScale2d']
    };

    Plotly.newPlot(elementId, [trace], layout, config);
  } catch (error) {
    console.error(`Error creating bar chart for ${elementId}:`, error);
    element.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 20px;">Chart loading error</p>`;
  }
}

function createPieChart(elementId, data, title) {
  const element = safeGetElement(elementId);
  if (!element || !window.Plotly) {
    console.warn(`Cannot create pie chart for ${elementId}`);
    return;
  }

  try {
    const colors = [
      '#cf2e2e', '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b',
      '#ef4444', '#3b82f6', '#ec4899', '#84cc16', '#f97316'
    ];

    const trace = {
      type: 'pie',
      labels: data.labels,
      values: data.values,
      hole: 0.3,
      marker: {
        colors: colors.slice(0, data.labels.length),
        line: { width: 2, color: '#161b22' }
      },
      textinfo: 'label+percent',
      textposition: 'auto',
      hovertemplate: '<b>%{label}</b><br>Participants: %{value}<br>Percentage: %{percent}<br><extra></extra>'
    };

    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1200;

    const legendFontSize = isMobile ? 11 : (isTablet ? 12 : 13);
    const titleFontSize = isMobile ? 16 : (isTablet ? 17 : 18);
    const chartHeight = isMobile ? 400 : (isTablet ? 450 : 500);

    const layout = {
      title: {
        text: title,
        font: { color: '#f0f6fc', size: titleFontSize },
        x: 0.5
      },
      paper_bgcolor: '#161b22',
      plot_bgcolor: '#161b22',
      font: { color: '#8b949e', size: 12 },
      showlegend: true,
      legend: {
        font: { color: '#8b949e', size: legendFontSize },
        orientation: isMobile ? 'h' : 'v',
        y: isMobile ? -0.2 : 0.5,
        x: isMobile ? 0.5 : 1.1,
        xanchor: isMobile ? 'center' : 'left',
        yanchor: isMobile ? 'top' : 'middle'
      },
      margin: {
        l: 20,
        r: isMobile ? 20 : 150,
        t: 60,
        b: isMobile ? 100 : 20
      },
      height: chartHeight
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false
    };

    Plotly.newPlot(elementId, [trace], layout, config);
  } catch (error) {
    console.error(`Error creating pie chart for ${elementId}:`, error);
    element.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 20px;">Chart loading error</p>`;
  }
}

// Instructor Analysis
function analyzeInstructorPerformance() {
  const instructorStats = {};

  filteredData.forEach(r => {
    const instructor = r['instructor_name'];
    if (!instructor || instructor.trim() === '') return;

    const attendance = parseInt(r['total_attendees']) || 0;

    if (!instructorStats[instructor]) {
      instructorStats[instructor] = {
        totalAttendance: 0,
        classCount: 0,
        avgAttendance: 0
      };
    }

    instructorStats[instructor].totalAttendance += attendance;
    instructorStats[instructor].classCount += 1;
  });

  Object.keys(instructorStats).forEach(instructor => {
    const stats = instructorStats[instructor];
    stats.avgAttendance = stats.classCount > 0 ? stats.totalAttendance / stats.classCount : 0;
  });

  return instructorStats;
}

function getLowPerformingInstructors(threshold = 4) {
  const instructorStats = analyzeInstructorPerformance();

  return Object.entries(instructorStats)
    .filter(([instructor, stats]) =>
      stats.avgAttendance <= threshold &&
      stats.classCount >= 3 &&
      instructor !== 'Unknown' &&
      instructor.trim() !== ''
    )
    .map(([instructor, stats]) => ({
      instructor,
      avgAttendance: Math.round(stats.avgAttendance * 10) / 10,
      totalClasses: stats.classCount,
      totalAttendance: stats.totalAttendance
    }))
    .sort((a, b) => a.avgAttendance - b.avgAttendance);
}

// Class Analysis
function getTopPerformingClasses(limit = 10) {
  const classLocationStats = {};

  filteredData.forEach(r => {
    const className = r['class_name'];
    const facilityId = r['facility'];
    if (!className || className.trim() === '') return;

    const locationName = getFacilityName(facilityId);
    const classKey = `${className} (${locationName})`;

    if (!classLocationStats[classKey]) {
      classLocationStats[classKey] = { totalAttendance: 0, classCount: 0, location: locationName };
    }

    classLocationStats[classKey].totalAttendance += parseInt(r['total_attendees']) || 0;
    classLocationStats[classKey].classCount += 1;
  });

  return Object.entries(classLocationStats)
    .filter(([name, stats]) => stats.classCount >= 3 && name.trim() !== '')
    .map(([classKey, stats]) => ({
      className: classKey,
      avgAttendance: Math.round((stats.totalAttendance / stats.classCount) * 10) / 10,
      classCount: stats.classCount,
      totalAttendance: stats.totalAttendance,
      location: stats.location
    }))
    .sort((a, b) => b.avgAttendance - a.avgAttendance)
    .slice(0, limit);
}

function getLowPerformingClasses(threshold = 3) {
  const classLocationStats = {};

  filteredData.forEach(r => {
    const className = r['class_name'];
    const facilityId = r['facility'];
    if (!className || className.trim() === '') return;

    const locationName = getFacilityName(facilityId);
    const classKey = `${className} (${locationName})`;

    if (!classLocationStats[classKey]) {
      classLocationStats[classKey] = {
        totalAttendance: 0,
        classCount: 0,
        location: locationName
      };
    }

    classLocationStats[classKey].totalAttendance += parseInt(r['total_attendees']) || 0;
    classLocationStats[classKey].classCount += 1;
  });

  return Object.entries(classLocationStats)
    .filter(([name, stats]) => stats.classCount >= 3 && name.trim() !== '')
    .map(([classKey, stats]) => ({
      className: classKey,
      avgAttendance: Math.round((stats.totalAttendance / stats.classCount) * 10) / 10,
      classCount: stats.classCount,
      totalAttendance: stats.totalAttendance,
      location: stats.location
    }))
    .filter(cls => cls.avgAttendance < threshold)
    .sort((a, b) => a.avgAttendance - b.avgAttendance);
}

// FIXED: Chart Updates - Always reread groupBy value
function updateCharts() {
  // CRITICAL FIX: Always get the CURRENT value of groupBy
  const groupBy = safeGetElement('group_by')?.value || 'week';
  console.log('updateCharts called with groupBy:', groupBy);

  const facilityToggles = document.querySelectorAll('.facility-toggle input[type="checkbox"]:checked');
  const selectedFacilities = Array.from(facilityToggles).map(checkbox => checkbox.value);

  console.log('Updating charts for facilities:', selectedFacilities);
  console.log('Filtered data length:', filteredData.length);

  // FIXED: Always pass the current groupBy value
  const aggregated = aggregate(filteredData, groupBy);
  console.log('Aggregated data with groupBy', groupBy, ':', aggregated);

  if (selectedFacilities.length > 1) {
    createMultiFacilityTimeSeriesChart(selectedFacilities, groupBy);
  } else {
    createChart('ts_chart', {
      x: aggregated.dates,
      y: aggregated.date_vals,
      type: 'scatter',
      mode: 'lines+markers'
    }, `Attendance Trends - Total Participants Over Time (by ${groupBy})`);
  }

  const topInstructors = aggregated.instr_names?.slice(0, 10).reverse() || [];
  const topInstructorVals = aggregated.instr_vals?.slice(0, 10).reverse() || [];

  createBarChart('bar_chart', {
    labels: topInstructors,
    values: topInstructorVals
  }, 'Top Performing Instructors (Average Attendees per Class)', 'performance');

  const lowPerforming = getLowPerformingInstructors(4);
  if (lowPerforming.length > 0) {
    createBarChart('low_performing_chart', {
      labels: lowPerforming.slice(0, 10).map(i => i.instructor),
      values: lowPerforming.slice(0, 10).map(i => i.avgAttendance)
    }, 'Low Performing Instructors (≤4 avg)', 'warning');
  } else {
    const element = safeGetElement('low_performing_chart');
    if (element) {
      element.innerHTML = '<div style="text-align: center; padding: 40px; color: #238636; font-size: 18px; font-weight: 600;">🎉 Excellent! No low-performing instructors!</div>';
    }
  }

  const topClasses = getTopPerformingClasses(10);
  if (topClasses.length > 0) {
    createBarChart('top_classes_chart', {
      labels: topClasses.map(cls => cls.className).slice(0, 10),
      values: topClasses.map(cls => cls.avgAttendance).slice(0, 10)
    }, 'Top Performing Classes by Location (Avg Attendance)', 'performance');
  }

  const lowPerformingClasses = getLowPerformingClasses(3);
  if (lowPerformingClasses.length > 0) {
    createBarChart('low_performing_classes_chart', {
      labels: lowPerformingClasses.map(cls => cls.className).slice(0, 10),
      values: lowPerformingClasses.map(cls => cls.avgAttendance).slice(0, 10)
    }, 'Low Performing Classes by Location (<3 avg)', 'warning');
  } else {
    const element = safeGetElement('low_performing_classes_chart');
    if (element) {
      element.innerHTML = '<div style="text-align: center; padding: 40px; color: #238636; font-size: 18px; font-weight: 600;">🎉 Excellent! No low-performing classes!</div>';
    }
  }

  if (selectedFacilities.length > 1) {
    createMultiFacilityCharts(selectedFacilities);
  } else {
    createBarChart('fac_chart', {
      labels: aggregated.fac_names.slice(0, 10),
      values: aggregated.fac_vals.slice(0, 10)
    }, 'Facility Performance (Total Attendees)', 'facility');

    createBarChart('fac_avg_chart', {
      labels: aggregated.fac_names.slice(0, 10),
      values: aggregated.fac_avg.slice(0, 10)
    }, 'Facility Performance (Avg Attendance)', 'facility');
  }

  createCategoryPieChart();
}

function createCategoryPieChart() {
  const selectedGreatGrandparent = safeGetElement('cat_level1')?.value;

  let categoryStats = {};
  let chartTitle = 'Participant Distribution by Program Category';
  let categoryField = 'greatgrandparent_category';

  if (selectedGreatGrandparent && selectedGreatGrandparent !== '') {
    categoryField = 'parent_category';
    chartTitle = `${selectedGreatGrandparent} - Breakdown by Sub-Category`;
  }

  filteredData.forEach(r => {
    const category = r[categoryField] || 'Unknown';
    const attendees = parseInt(r['total_attendees']) || 0;

    if (!categoryStats[category]) {
      categoryStats[category] = 0;
    }
    categoryStats[category] += attendees;
  });

  const categoryData = Object.entries(categoryStats)
    .map(([category, participants]) => ({ category, participants }))
    .sort((a, b) => b.participants - a.participants);

  if (categoryData.length > 0) {
    createPieChart('category_pie_chart', {
      labels: categoryData.map(item => item.category),
      values: categoryData.map(item => item.participants)
    }, chartTitle);
  } else {
    const element = safeGetElement('category_pie_chart');
    if (element) {
      element.innerHTML = '<div style="text-align: center; padding: 40px; color: #8b949e; font-size: 16px;">No category data available for current filters</div>';
    }
  }
}

function createMultiFacilityTimeSeriesChart(selectedFacilities, groupBy) {
  const element = safeGetElement('ts_chart');
  if (!element || !window.Plotly) {
    console.warn('Cannot create multi-facility time series chart');
    return;
  }

  const traces = [];
  const colors = ['#cf2e2e', '#238636', '#f59e0b', '#8b5cf6', '#06b6d4'];

  selectedFacilities.forEach((facilityId, index) => {
    const facilityData = filteredData.filter(r => r.facility === facilityId);
    if (facilityData.length === 0) return;

    const facilityAggregated = aggregate(facilityData, groupBy);
    const facilityName = getFacilityName(facilityId);

    traces.push({
      x: facilityAggregated.dates,
      y: facilityAggregated.date_vals,
      type: 'scatter',
      mode: 'lines+markers',
      name: facilityName,
      line: { color: colors[index % colors.length], width: 3 },
      marker: { size: 6, color: colors[index % colors.length] }
    });
  });

  const layout = {
    title: {
      text: `Attendance Over Time - Multi-Facility Comparison (${selectedFacilities.map(f => getFacilityName(f)).join(', ')})`,
      font: { color: '#f0f6fc', size: 18 }
    },
    paper_bgcolor: '#161b22',
    plot_bgcolor: '#161b22',
    font: { color: '#8b949e', size: 12 },
    xaxis: {
      gridcolor: '#30363d',
      tickfont: { size: 11 },
      tickangle: -45,
      automargin: true
    },
    yaxis: {
      gridcolor: '#30363d',
      tickfont: { size: 11 },
      title: { text: 'Total Attendees', font: { size: 12 } }
    },
    margin: { l: 60, r: 30, t: 80, b: 100 },
    height: 500,
    showlegend: true,
    legend: {
      font: { color: '#8b949e', size: 12 },
      orientation: 'h',
      y: -0.2,
      x: 0.5,
      xanchor: 'center'
    }
  };

  try {
    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d','select2d','lasso2d','resetScale2d','zoomScale2d']
    };

    window.Plotly.newPlot('ts_chart', traces, layout, config);
  } catch (error) {
    console.error('Error creating multi-facility time series:', error);
    element.innerHTML = '<div style="text-align: center; padding: 40px; color: #f0f6fc;">Error creating multi-facility chart</div>';
  }
}

function createMultiFacilityCharts(selectedFacilities) {
  const facilityStats = selectedFacilities.map(facilityId => {
    const facilityData = filteredData.filter(r => r.facility === facilityId);
    const totalAttendees = facilityData.reduce((sum, r) => sum + (parseInt(r.total_attendees) || 0), 0);
    const totalClasses = facilityData.length;
    const avgAttendance = totalClasses > 0 ? totalAttendees / totalClasses : 0;

    return {
      name: getFacilityName(facilityId),
      totalAttendees,
      totalClasses,
      avgAttendance: Math.round(avgAttendance * 10) / 10
    };
  });

  createBarChart('fac_chart', {
    labels: facilityStats.map(f => f.name),
    values: facilityStats.map(f => f.totalAttendees)
  }, `Facility Comparison - Total Attendees`, 'facility');

  createBarChart('fac_avg_chart', {
    labels: facilityStats.map(f => f.name),
    values: facilityStats.map(f => f.avgAttendance)
  }, `Facility Comparison - Avg Attendance per Class`, 'facility');

  console.log('Multi-facility stats:', facilityStats);
}

// Data table
function makeTable(rows) {
  if (!rows.length) return '<p>No rows</p>';
  const headers = Object.keys(rows[0]);
  let html = '<table><thead><tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>';
  rows.slice(0, 200).forEach(r => {
    html += '<tr>' + headers.map(h => '<td>' + (r[h] === null ? '' : r[h]) + '</td>').join('') + '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function updateTable() {
  const tableContainer = safeGetElement('table_html');
  if (tableContainer) {
    tableContainer.innerHTML = makeTable(filteredData);
  }
}

// Main dashboard update function
function updateDashboard() {
  console.log('Updating dashboard with', filteredData.length, 'records');

  updateKPIs();
  updateCharts();
  updateTable();
  generateInsights();
}

// Filter functions
function applyFilters() {
  const dateFrom = safeGetElement('date_from')?.value;
  const dateTo = safeGetElement('date_to')?.value;
  const instructor = safeGetElement('instr_select')?.value;
  const category = safeGetElement('cat_level1')?.value;

  const facilityToggles = document.querySelectorAll('.facility-toggle input[type="checkbox"]:checked');
  const selectedFacilities = Array.from(facilityToggles).map(checkbox => checkbox.value);

  filteredData = globalData.filter(row => {
    let keep = true;

    if (dateFrom || dateTo) {
      const rowDate = parseDate(row['class_date']);
      if (dateFrom && rowDate < dateFrom) keep = false;
      if (dateTo && rowDate > dateTo) keep = false;
    }

    if (instructor && row['instructor_name'] !== instructor) keep = false;

    if (selectedFacilities.length > 0 && !selectedFacilities.includes(row['facility'])) keep = false;

    if (category && row['greatgrandparent_category'] !== category) keep = false;

    return keep;
  });

  updateDashboard();

  const facilityText = selectedFacilities.length > 0 ? ` (${selectedFacilities.length} facilities selected)` : '';
  showSuccess(`Filtered to ${filteredData.length} records${facilityText}`);
}

function resetFilters() {
  const elementsToReset = ['date_from', 'date_to', 'instr_select', 'cat_level1'];
  elementsToReset.forEach(id => {
    const element = safeGetElement(id);
    if (element) element.value = '';
  });

  // Reset facility toggles
  const facilityToggles = document.querySelectorAll('.facility-toggle');
  facilityToggles.forEach(toggle => {
    const checkbox = toggle.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = false;
      toggle.classList.remove('selected');
    }
  });

  // Reset year-over-year toggle
  const compareToggle = safeGetElement('compare_year_over_year');
  if (compareToggle) compareToggle.checked = false;

  filteredData = [...globalData];
  updateDashboard();
  showSuccess('Filters reset');
}

// Dashboard initialization
function initializeDashboard() {
  const instructors = uniqueSorted(globalData.map(r => r['instructor_name']).filter(Boolean));
  const facilities = uniqueSorted(globalData.map(r => r['facility']).filter(Boolean));
  const categories = uniqueSorted(globalData.map(r => r['greatgrandparent_category']).filter(Boolean));

  console.log('Available categories:', categories);

  populateSelect('instr_select', instructors);
  populateFacilityToggles(facilities);
  populateSelect('cat_level1', categories);

  const dates = globalData.map(r => parseDate(r['class_date'])).filter(Boolean).sort();
  console.log('Available date range:', dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : 'No dates');

  if (dates.length > 0) {
    const dateFromEl = safeGetElement('date_from');
    const dateToEl = safeGetElement('date_to');
    if (dateFromEl && dateToEl) {
      const latestDate = new Date(dates[dates.length - 1]);
      const mostRecentFullMonth = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
      const mostRecentFullMonthEnd = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 0);

      const formatDate = (date) => date.toISOString().split('T')[0];

      dateFromEl.value = formatDate(mostRecentFullMonth);
      dateToEl.value = formatDate(mostRecentFullMonthEnd);

      console.log('Set date range:', formatDate(mostRecentFullMonth), 'to', formatDate(mostRecentFullMonthEnd));
    }
  }

  setTimeout(() => {
    const facilityToggles = document.querySelectorAll('.facility-toggle');
    facilityToggles.forEach(toggle => {
      const checkbox = toggle.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = true;
        toggle.classList.add('selected');
      }
    });
    console.log('Auto-selected all facilities');

    updateDashboard();
  }, 100);
}

function populateSelect(elementId, options) {
  const select = safeGetElement(elementId);
  if (!select) return;

  const currentOptions = Array.from(select.options).slice(1);
  currentOptions.forEach(option => option.remove());

  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    select.appendChild(optionElement);
  });
}

function populateFacilityToggles(facilities) {
  const container = safeGetElement('facility_toggles');
  console.log('Facility toggles container:', container);
  console.log('Facilities to populate:', facilities);

  if (!container) {
    console.error('facility_toggles container not found!');
    return;
  }

  container.innerHTML = '';

  facilities.forEach((facility, index) => {
    const facilityName = getFacilityName(facility);
    const toggle = document.createElement('div');
    toggle.className = 'facility-toggle';
    toggle.innerHTML = `
      <input type="checkbox" id="facility_${facility.replace(/\s+/g, '_')}" value="${facility}">
      <span>${facilityName}</span>
    `;

    toggle.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        const checkbox = toggle.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
      }
      toggle.classList.toggle('selected', toggle.querySelector('input').checked);
    });

    container.appendChild(toggle);
    console.log(`Added facility toggle ${index + 1}:`, facility);
  });

  console.log('Facility toggles populated. Container HTML:', container.innerHTML.substring(0, 200));
}

// AI Insights
function generateInsights() {
  const totalAttendees = filteredData.reduce((sum, r) => sum + (parseInt(r['total_attendees']) || 0), 0);
  const totalBookings = filteredData.reduce((sum, r) => sum + (parseInt(r['total_bookings']) || 0), 0);
  const showRate = totalBookings > 0 ? ((totalAttendees / totalBookings) * 100).toFixed(1) : 0;

  const categories = uniqueSorted(filteredData.map(r => r['greatgrandparent_category']).filter(Boolean));
  const topCategory = categories.length > 0 ?
    Object.entries(
      filteredData.reduce((acc, r) => {
        const cat = r['greatgrandparent_category'];
        if (cat) acc[cat] = (acc[cat] || 0) + (parseInt(r['total_attendees']) || 0);
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1])[0] : null;

  const lowPerforming = getLowPerformingInstructors(4);

  const insights = [
    `📊 Analyzing ${filteredData.length} classes across ${categories.length} great grandparent categories`,
    `👥 ${new Set(filteredData.map(r => r.guid)).size.toLocaleString()} unique customers participated`,
    `🏢 ${new Set(filteredData.map(r => r.facility)).size} facilities are active`,
    `📈 Show rate: ${showRate}% (${totalAttendees.toLocaleString()} attended vs ${totalBookings.toLocaleString()} booked)`,
    topCategory ? `🎯 Top category: ${topCategory[0]} with ${topCategory[1].toLocaleString()} total attendees` : null,
    lowPerforming.length > 0 ? `⚠️ ${lowPerforming.length} instructors averaging ≤4 attendees per class` : `✅ No instructors averaging ≤4 attendees per class`,
    `🔍 Data completeness: ${filteredData.filter(r => r.total_attendees && r.class_date).length}/${filteredData.length} records have complete data`
  ].filter(Boolean);

  const insightsContainer = safeGetElement('ai_insights');
  if (insightsContainer) {
    insightsContainer.innerHTML = insights.map(insight => `<p>• ${insight}</p>`).join('');
  }
}

// Export functions
function exportToCsv() {
  if (!window.Papa) {
    alert('CSV export requires Papa Parse library');
    return;
  }
  const csv = Papa.unparse(filteredData);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `front_dashboard_data_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();

  setTimeout(() => window.URL.revokeObjectURL(url), 100);

  showSuccess(`Exported ${filteredData.length} records to CSV`);
}

function exportToJson() {
  try {
    const json = JSON.stringify(filteredData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `front_dashboard_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    setTimeout(() => window.URL.revokeObjectURL(url), 100);

    showSuccess(`Exported ${filteredData.length} records to JSON`);
  } catch (error) {
    console.error('JSON export error:', error);
    showError('Failed to export JSON data');
  }
}

// Safe event listener attachment
function addEventListenerSafe(elementId, event, handler) {
  const element = safeGetElement(elementId);
  if (element) {
    element.addEventListener(event, handler);
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  // Filter controls
  addEventListenerSafe('apply_filter', 'click', applyFilters);
  addEventListenerSafe('reset', 'click', resetFilters);

  // NEW: Year-over-year comparison toggle
  addEventListenerSafe('compare_year_over_year', 'change', function() {
    console.log('Year-over-year toggle changed');
    updateKPIs(); // Only update KPIs, not full dashboard
  });

  // Export controls
  addEventListenerSafe('export_csv', 'click', exportToCsv);
  addEventListenerSafe('export_json', 'click', exportToJson);

  // Show all categories
  addEventListenerSafe('show_all_cats', 'click', function() {
    if (typeof window.generateCategoryReport === 'function') {
      const report = window.generateCategoryReport(globalData);

      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: #1a1a1a;
        color: #e6eef8;
        padding: 20px;
        border-radius: 10px;
        max-width: 80%;
        max-height: 80%;
        overflow: auto;
        white-space: pre-line;
        font-size: 12px;
        line-height: 1.4;
        border: 1px solid #333;
      `;

      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: #7c3aed;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 5px;
        cursor: pointer;
      `;
      closeBtn.onclick = () => document.body.removeChild(modal);

      content.textContent = report;
      content.appendChild(closeBtn);
      modal.appendChild(content);
      document.body.appendChild(modal);
    } else {
      const categories = uniqueSorted(globalData.map(r => r['greatgrandparent_category']).filter(Boolean));
      alert('Great Grandparent Categories:\n' + categories.join('\n'));
    }
  });

  // Load data
  loadData();
});

console.log('✨ Scoreboard 3.0 loaded - with deduplication, fixed filters, and year-over-year comparison');
