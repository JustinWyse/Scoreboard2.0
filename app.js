// Fixed Enhanced KPI Dashboard with Safe DOM Access
let globalData = [];
let filteredData = [];
let analyticsSettings = {
  showTrends: false,
  showPredictions: false,
  showAnomalies: false,
  comparisonPeriod: ''
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

// Data Loading
async function loadData() {
  showLoading();
  try {
    // Check if data is already embedded (Streamlit deployment)
    if (typeof window.dashboardData !== 'undefined' && window.dashboardData) {
      console.log('Using embedded data:', window.dashboardData.length, 'records');
      globalData = window.dashboardData;
      filteredData = [...globalData];
    } else {
      // Fallback to fetch for local development
      const resp = await fetch('data.json');
      if (!resp.ok) throw new Error(`Failed to load data.json: ${resp.status}`);
      globalData = await resp.json();
      filteredData = [...globalData];
    }

    if (!globalData.length) {
      throw new Error('No data found');
    }

    initializeDashboard();
    showSuccess(`Loaded ${globalData.length} records successfully`);
  } catch (error) {
    showError(error.message);
    console.error('Data loading error:', error);
  } finally {
    hideLoading();
  }
}

// Date Utilities (from original, keeping these the same)
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

// Date Range Helpers
function getCurrentDateRange() {
  const dateFromEl = safeGetElement('date_from');
  const dateToEl = safeGetElement('date_to');

  // Only return a range if BOTH dates are explicitly set
  if (dateFromEl && dateToEl && dateFromEl.value && dateToEl.value) {
    return {
      start: dateFromEl.value,
      end: dateToEl.value,
      hasSelection: true
    };
  }

  // No date selection - return null to indicate no comparison should be made
  return {
    start: null,
    end: null,
    hasSelection: false
  };
}

function getPreviousMonthRange(currentStartDate, currentEndDate) {
  if (!currentStartDate || !currentEndDate) {
    return { start: null, end: null };
  }

  const startDate = new Date(currentStartDate);
  const endDate = new Date(currentEndDate);

  // Calculate the duration in days
  const durationMs = endDate - startDate;
  const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

  // Go back the same number of days BEFORE the start date
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1); // Day before start

  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - durationDays); // Go back same duration

  const formatDate = (date) => date.toISOString().split('T')[0];

  return {
    start: formatDate(prevStart),
    end: formatDate(prevEnd)
  };
}

// Data Processing (enhanced for average performance)
function aggregate(rows, groupBy = 'week') {
  console.log('Aggregate function called with:', rows.length, 'rows');
  const by_date = {}, by_book = {}, by_instr = {}, by_fac = {}, by_class = {};

  rows.forEach(r => {
    let d = parseDate(r['class_date']);
    if (!d) return;

    const key = groupBy === 'week' ? isoWeekStart(d) : d;
    const at = parseInt(r['total_attendees'] || 0) || 0;
    const bk = parseInt(r['total_bookings'] || 0) || 0;

    by_date[key] = (by_date[key] || 0) + at;
    by_book[key] = (by_book[key] || 0) + bk;

    // Track instructors with average performance
    const instr = r['instructor_name'] || '';
    if (instr.trim()) {
      if (!by_instr[instr]) by_instr[instr] = { att: 0, count: 0 };
      by_instr[instr].att += at;
      by_instr[instr].count += 1;
    }

    // Track classes with average performance
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

  // Calculate instructor averages and sort by average (minimum 3 classes)
  const instr_list = Object.entries(by_instr)
    .filter(([name, stats]) => stats.count >= 3 && name.trim() !== '')
    .map(([name, stats]) => [name, stats.att, stats.count, stats.count > 0 ? stats.att / stats.count : 0])
    .sort((a, b) => b[3] - a[3]) // Sort by average attendance
    .slice(0, 20);

  const instr_names = instr_list.map(x => x[0]);
  const instr_vals = instr_list.map(x => Math.round(x[3] * 10) / 10); // Average attendance rounded to 1 decimal

  // Calculate class averages and sort by average (minimum 3 classes)
  const class_list = Object.entries(by_class)
    .filter(([name, stats]) => stats.count >= 3 && name.trim() !== '')
    .map(([name, stats]) => [name, stats.att, stats.count, stats.count > 0 ? stats.att / stats.count : 0])
    .sort((a, b) => b[3] - a[3]) // Sort by average attendance
    .slice(0, 20);

  const class_names = class_list.map(x => x[0]);
  const class_vals = class_list.map(x => Math.round(x[3] * 10) / 10); // Average attendance rounded to 1 decimal

  const fac_list = Object.entries(by_fac).map(([k, v]) => [k, v.att, v.count]).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const fac_names = fac_list.map(x => getFacilityName(x[0]));
  const fac_vals = fac_list.map(x => x[1]);
  const fac_avg = fac_list.map(x => x[2] > 0 ? x[1] / x[2] : 0);

  return { dates, date_vals, book_vals, instr_names, instr_vals, fac_names, fac_vals, fac_avg, class_names, class_vals };
}

// KPI Calculations (Focused on Key Metrics)
function updateKPIs() {
  const total_attendees = filteredData.reduce((sum, r) => sum + (parseInt(r['total_attendees']) || 0), 0);
  const total_bookings = filteredData.reduce((sum, r) => sum + (parseInt(r['total_bookings']) || 0), 0);
  const total_classes = filteredData.length;
  const avg_attendance = total_classes > 0 ? total_attendees / total_classes : 0;
  const show_rate = total_bookings > 0 ? (total_attendees / total_bookings * 100) : 0;

  // Calculate unique sessions (classes)
  const unique_classes = new Set(
    filteredData.map(r => r['session_guid']).filter(Boolean)
  ).size;

  // Calculate estimated unique participants (conservative estimate: total_attendees * 0.7 for repeat customers)
  const unique_participants = Math.round(total_attendees * 0.7);

  // Calculate previous month data for comparison
  const currentPeriod = getCurrentDateRange();
  
  // If no date selection, skip comparison calculations
  let previousMonthData = [];
  if (!currentPeriod.hasSelection || !currentPeriod.start || !currentPeriod.end) {
    console.log('No date range selected - skipping comparison');
  } else {
    const previousPeriod = getPreviousMonthRange(currentPeriod.start, currentPeriod.end);

  console.log('Current period:', currentPeriod);
  console.log('Previous period:', previousPeriod);
  console.log('Current filtered data count:', filteredData.length);

  // Apply same filters as current data but for previous month period
  previousMonthData = globalData.filter(row => {
    const rowDate = parseDate(row['class_date']);

    // Must be in previous month date range
    if (rowDate < previousPeriod.start || rowDate > previousPeriod.end) return false;

    // Apply same facility filter
    const facilityToggles = document.querySelectorAll('.facility-toggle input[type="checkbox"]:checked');
    const selectedFacilities = Array.from(facilityToggles).map(checkbox => checkbox.value);
    if (selectedFacilities.length > 0 && !selectedFacilities.includes(row['facility'])) return false;

    // Apply same instructor filter
    const instructor = safeGetElement('instr_select')?.value;
    if (instructor && row['instructor_name'] !== instructor) return false;

    // Apply same category filter
    const category = safeGetElement('cat_level1')?.value;
    if (category && row['greatgrandparent_category'] !== category) return false;

    return true;
  });

  console.log('Previous month data count:', previousMonthData.length);
  console.log('Sample previous month data:', previousMonthData.slice(0, 3).map(r => ({date: r.class_date, attendees: r.total_attendees})));
  console.log('Current filtered data sample:', filteredData.slice(0, 3).map(r => ({date: r.class_date, attendees: r.total_attendees})));
  }  // Close the else block for date selection check

  // Previous month metrics
  const prev_total_attendees = previousMonthData.reduce((sum, r) => sum + (parseInt(r['total_attendees']) || 0), 0);
  const prev_total_bookings = previousMonthData.reduce((sum, r) => sum + (parseInt(r['total_bookings']) || 0), 0);
  const prev_total_classes = previousMonthData.length;
  const prev_avg_attendance = prev_total_classes > 0 ? prev_total_attendees / prev_total_classes : 0;
  const prev_unique_classes = new Set(previousMonthData.map(r => r['session_guid']).filter(Boolean)).size;
  const prev_unique_participants = Math.round(prev_total_attendees * 0.7);

  // Calculate percentage changes
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
    bookings: `${total_bookings} vs ${prev_total_bookings} = ${bookings_change.toFixed(1)}%`,
    avg_attendance: `${avg_attendance.toFixed(1)} vs ${prev_avg_attendance.toFixed(1)} = ${avg_attendance_change.toFixed(1)}%`,
    unique_classes: `${unique_classes} vs ${prev_unique_classes} = ${unique_classes_change.toFixed(1)}%`,
    unique_participants: `${unique_participants} vs ${prev_unique_participants} = ${unique_participants_change.toFixed(1)}%`
  });

  // Enhanced change arrows and colors with modern styling
  const getChangeArrow = (change, hasDateSelection = true) => {
    if (!hasDateSelection) return ''; // No arrow when no date selection
    if (change > 0) return '<span class="trend-arrow trend-up">📈</span>';
    if (change < 0) return '<span class="trend-arrow trend-down">📉</span>';
    return '<span class="trend-arrow trend-neutral">➡️</span>';
  };

  const getChangeText = (change, hasData = true, hasDateSelection = true) => {
    if (!hasDateSelection) {
      return `<span class="trend-percentage trend-neutral" style="font-size: 0.75rem;">Select date range for comparison</span>`;
    }
    if (!hasData) {
      return `<span class="trend-percentage trend-neutral">No comparison data</span>`;
    }
    const absChange = Math.abs(change);
    if (change > 0) {
      return `<span class="trend-percentage trend-up">+${absChange.toFixed(1)}% vs prior period</span>`;
    } else if (change < 0) {
      return `<span class="trend-percentage trend-down">-${absChange.toFixed(1)}% vs prior period</span>`;
    } else {
      return `<span class="trend-percentage trend-neutral">0.0% vs prior period</span>`;
    }
  };

  // Benchmarks and targets
  const target_avg_attendance = 8;
  const target_show_rate = 85;

  // Trend indicators
  const getTrendClass = (value, target) => {
    if (value >= target * 1.1) return 'trend-up';
    if (value <= target * 0.9) return 'trend-down';
    return 'trend-neutral';
  };

  const getTrendIcon = (value, target) => {
    if (value >= target * 1.1) return '📈';
    if (value <= target * 0.9) return '📉';
    return '➡️';
  };

  const hasPreviousData = previousMonthData.length > 0;
  const hasDateSelection = currentPeriod.hasSelection;
  const kpiContainer = safeGetElement('kpis');
  if (kpiContainer) {
    kpiContainer.innerHTML = `
      <div class="kpi ${getTrendClass(total_attendees, 1000)}">
        <div class="kpi_val">${formatNumber(total_attendees)}</div>
        <div class="kpi_title">Total Participants</div>
        ${hasDateSelection ? `<div class="kpi_change">${getChangeArrow(attendees_change, hasDateSelection)} ${getChangeText(attendees_change, hasPreviousData, hasDateSelection)}</div>` : ''}
        <div class="kpi_small">All attendance in period</div>
      </div>
      <div class="kpi ${getTrendClass(total_bookings, 1200)}">
        <div class="kpi_val">${formatNumber(total_bookings)}</div>
        <div class="kpi_title">Total Bookings</div>
        ${hasDateSelection ? `<div class="kpi_change">${getChangeArrow(bookings_change, hasDateSelection)} ${getChangeText(bookings_change, hasPreviousData, hasDateSelection)}</div>` : ''}
        <div class="kpi_small">All bookings made</div>
      </div>
      <div class="kpi ${getTrendClass(avg_attendance, target_avg_attendance)}">
        <div class="kpi_val">${formatNumber(avg_attendance, 1)}</div>
        <div class="kpi_title">Average Attendance</div>
        ${hasDateSelection ? `<div class="kpi_change">${getChangeArrow(avg_attendance_change, hasDateSelection)} ${getChangeText(avg_attendance_change, hasPreviousData, hasDateSelection)}</div>` : ''}
        <div class="kpi_small">Target: ${target_avg_attendance} per class</div>
      </div>
      <div class="kpi trend-neutral">
        <div class="kpi_val">${unique_classes.toLocaleString()}</div>
        <div class="kpi_title">Unique Classes</div>
        ${hasDateSelection ? `<div class="kpi_change">${getChangeArrow(unique_classes_change, hasDateSelection)} ${getChangeText(unique_classes_change, hasPreviousData, hasDateSelection)}</div>` : ''}
        <div class="kpi_small">Distinct class sessions</div>
      </div>
      <div class="kpi trend-neutral">
        <div class="kpi_val">${unique_participants.toLocaleString()}</div>
        <div class="kpi_title">Unique Participants</div>
        ${hasDateSelection ? `<div class="kpi_change">${getChangeArrow(unique_participants_change, hasDateSelection)} ${getChangeText(unique_participants_change, hasPreviousData, hasDateSelection)}</div>` : ''}
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
      title: { text: title, font: { color: '#f0f6fc', size: 14 } },
      paper_bgcolor: '#161b22',
      plot_bgcolor: '#161b22',
      font: { color: '#8b949e', size: 11 },
      xaxis: {
        gridcolor: '#30363d',
        tickangle: -45,
        automargin: true,
        tickfont: { size: 10 }
      },
      yaxis: { gridcolor: '#30363d', tickfont: { size: 10 } },
      margin: { l: 40, r: 20, t: 40, b: 80 },
      height: 300,
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

function createBarChart(elementId, data, title, colorScheme = 'default') {
  const element = safeGetElement(elementId);
  if (!element || !window.Plotly) {
    console.warn(`Cannot create bar chart for ${elementId}`);
    return;
  }

  try {
    // Determine if this is a performance chart for special sizing
    const isPerformanceChart = elementId.includes('bar_chart') || elementId.includes('low_performing_chart') ||
                              elementId.includes('top_classes_chart') || elementId.includes('low_performing_classes_chart');

    // Color schemes for consistent visual language
    let colors;
    switch(colorScheme) {
      case 'performance':
        // Green gradient for high performers - darker for dark mode
        colors = data.values.map((val, idx) => {
          const intensity = (idx / data.values.length) * 0.6 + 0.4;
          return `rgba(35, 134, 54, ${intensity})`;
        });
        break;
      case 'warning':
        // Red gradient for low performers - darker for dark mode
        colors = data.values.map((val, idx) => {
          const intensity = (1 - idx / data.values.length) * 0.6 + 0.4;
          return `rgba(218, 54, 51, ${intensity})`;
        });
        break;
      case 'facility':
        // Multi-facility coloring - Front red and complementary colors for dark mode
        const facilityColors = [
          'rgba(207, 46, 46, 0.9)',    // Front Red
          'rgba(35, 134, 54, 0.9)',    // Green
          'rgba(245, 158, 11, 0.9)',   // Orange
          'rgba(139, 92, 246, 0.9)',   // Purple
          'rgba(6, 182, 212, 0.9)',    // Cyan
        ];

        if (data.selectedFacilities && data.selectedFacilities.length > 0) {
          // Color selected facilities distinctly
          colors = data.labels.map((label) => {
            if (data.selectedFacilities.includes(label)) {
              const colorIndex = data.selectedFacilities.indexOf(label) % facilityColors.length;
              return facilityColors[colorIndex];
            }
            return 'rgba(139, 148, 158, 0.4)'; // Muted for unselected
          });
        } else {
          // Default facility coloring
          colors = data.values.map((val, idx) => {
            const intensity = (idx / data.values.length) * 0.4 + 0.6;
            return `rgba(6, 182, 212, ${intensity})`;
          });
        }
        break;
      case 'neutral':
        // Blue gradient for general metrics
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

    // Determine styling based on chart type - make everything larger
    const isFacilityChart = elementId.includes('fac_chart') || elementId.includes('fac_avg_chart');
    const isInstructorChart = elementId.includes('bar_chart') || elementId.includes('low_performing_chart');

    // Responsive font sizes and margins
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1200;

    const labelFontSize = isMobile ? (isInstructorChart ? 12 : 11) :
                         isTablet ? (isInstructorChart ? 13 : 12) :
                         (isInstructorChart ? 14 : (isFacilityChart ? 13 : 12));

    const titleFontSize = isMobile ? 14 : (isTablet ? 15 : 16);

    const leftMargin = isMobile ? (isPerformanceChart ? 180 : (isFacilityChart ? 160 : 120)) :
                      isTablet ? (isPerformanceChart ? 200 : (isFacilityChart ? 180 : 140)) :
                      (isPerformanceChart ? 220 : (isFacilityChart ? 200 : 160));

    // Responsive chart heights - increased for better visibility
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
      '#cf2e2e', // Front red
      '#06b6d4', // Cyan
      '#10b981', // Green
      '#8b5cf6', // Purple
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#3b82f6', // Blue
      '#ec4899', // Pink
      '#84cc16', // Lime
      '#f97316'  // Orange
    ];

    const trace = {
      type: 'pie',
      labels: data.labels,
      values: data.values,
      hole: 0.3,  // Donut style
      marker: {
        colors: colors.slice(0, data.labels.length),
        line: { width: 2, color: '#161b22' }
      },
      textinfo: 'label+percent',
      textposition: 'auto',
      hovertemplate: '<b>%{label}</b><br>Participants: %{value}<br>Percentage: %{percent}<br><extra></extra>'
    };

    // Responsive sizing for pie charts
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
      font: { color: '#8b949e', size: 14 },
      margin: {
        l: isMobile ? 10 : 5,
        r: isMobile ? 10 : 5,
        t: 70,
        b: isMobile ? 60 : 20
      },
      height: chartHeight,
      showlegend: true,
      legend: {
        orientation: isMobile ? 'h' : 'v',
        x: isMobile ? 0.5 : 1.08,
        y: isMobile ? -0.1 : 0.5,
        xanchor: isMobile ? 'center' : 'left',
        font: { color: '#8b949e', size: legendFontSize }
      }
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d','select2d','lasso2d','resetScale2d','zoomScale2d']
    };

    Plotly.newPlot(elementId, [trace], layout, config);
  } catch (error) {
    console.error(`Error creating pie chart for ${elementId}:`, error);
    element.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 20px;">Chart loading error</p>`;
  }
}

// Enhanced instructor analysis
function analyzeInstructorPerformance() {
  const instructorStats = {};

  filteredData.forEach(r => {
    const instructor = r['instructor_name'] || 'Unknown';
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

  // Calculate averages
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
      stats.classCount >= 3 && // Only include instructors with at least 3 classes
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

// Top Performing Classes Analysis with Location Info
function getTopPerformingClasses(limit = 10) {
  const classLocationStats = {};

  filteredData.forEach(r => {
    const className = r['class_name'];
    const facilityId = r['facility'];
    if (!className || className.trim() === '') return;

    // Create unique key for class + location combination
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

// Low Performing Classes Analysis with Location Info
function getLowPerformingClasses(threshold = 3) {
  const classLocationStats = {};

  filteredData.forEach(r => {
    const className = r['class_name'];
    const facilityId = r['facility'];
    if (!className || className.trim() === '') return;

    // Create unique key for class + location combination
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

// Chart Updates with Multi-Facility Support
function updateCharts() {
  const groupBy = safeGetElement('group_by')?.value || 'week';

  // Get selected facilities
  const facilityToggles = document.querySelectorAll('.facility-toggle input[type="checkbox"]:checked');
  const selectedFacilities = Array.from(facilityToggles).map(checkbox => checkbox.value);

  console.log('Updating charts for facilities:', selectedFacilities);

  // Debug data
  console.log('Filtered data sample:', filteredData.slice(0, 3));
  console.log('Filtered data length:', filteredData.length);

  // Always aggregate all filtered data for instructor and class charts
  const aggregated = aggregate(filteredData, groupBy);
  console.log('Aggregated data:', aggregated);

  // Time series with proper multi-facility support
  if (selectedFacilities.length > 1) {
    createMultiFacilityTimeSeriesChart(selectedFacilities, groupBy);
  } else {
    // Single facility or all data
    createChart('ts_chart', {
      x: aggregated.dates,
      y: aggregated.date_vals,
      type: 'scatter',
      mode: 'lines+markers'
    }, 'Attendance Trends - Total Participants Over Time');
  }

  // Top performing instructors
  console.log('Instructor names:', aggregated.instr_names?.slice(0, 5));
  console.log('Instructor values:', aggregated.instr_vals?.slice(0, 5));

  const topInstructors = aggregated.instr_names?.slice(0, 10).reverse() || [];
  const topInstructorVals = aggregated.instr_vals?.slice(0, 10).reverse() || [];

  createBarChart('bar_chart', {
    labels: topInstructors,
    values: topInstructorVals
  }, 'Top Performing Instructors (Average Attendees per Class)', 'performance');

  // Low performing instructors
  const lowPerforming = getLowPerformingInstructors(4);
  console.log('Low performing instructors:', lowPerforming);
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

  // Top performing classes
  const topClasses = getTopPerformingClasses(10);
  if (topClasses.length > 0) {
    createBarChart('top_classes_chart', {
      labels: topClasses.map(cls => cls.className).slice(0, 10),
      values: topClasses.map(cls => cls.avgAttendance).slice(0, 10)
    }, 'Top Performing Classes by Location (Avg Attendance)', 'performance');
  }

  // Low performing classes
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

  // Multi-facility comparison charts
  if (selectedFacilities.length > 1) {
    createMultiFacilityCharts(selectedFacilities);
  } else {
    // Single facility charts
    createBarChart('fac_chart', {
      labels: aggregated.fac_names.slice(0, 10),
      values: aggregated.fac_vals.slice(0, 10)
    }, 'Facility Performance (Total Attendees)', 'facility');

    createBarChart('fac_avg_chart', {
      labels: aggregated.fac_names.slice(0, 10),
      values: aggregated.fac_avg.slice(0, 10)
    }, 'Facility Performance (Avg Attendance)', 'facility');
  }

  // Category breakdown pie chart
  createCategoryPieChart();
}

function createCategoryPieChart() {
  // Check if a specific great grandparent category is selected
  const selectedGreatGrandparent = safeGetElement('cat_level1')?.value;

  let categoryStats = {};
  let chartTitle = 'Participant Distribution by Program Category';
  let categoryField = 'greatgrandparent_category';

  // If a great grandparent category is selected, show breakdown by parent category
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

  // Convert to arrays and sort by participant count
  const categoryData = Object.entries(categoryStats)
    .map(([category, participants]) => ({ category, participants }))
    .sort((a, b) => b.participants - a.participants);

  if (categoryData.length > 0) {
    // Create pie chart (existing)
    createPieChart('category_pie_chart', {
      labels: categoryData.map(item => item.category),
      values: categoryData.map(item => item.participants)
    }, chartTitle);
    
    // Create bar chart for better readability - NEW!
    createCategoryBarChart(categoryData, chartTitle);
  } else {
    const pieElement = safeGetElement('category_pie_chart');
    if (pieElement) {
      pieElement.innerHTML = '<div style="text-align: center; padding: 40px; color: #8b949e; font-size: 16px;">No category data available for current filters</div>';
    }
    const barElement = safeGetElement('category_bar_chart');
    if (barElement) {
      barElement.innerHTML = '<div style="text-align: center; padding: 40px; color: #8b949e; font-size: 16px;">No category data available for current filters</div>';
    }
  }
}

// NEW FUNCTION: Create vertical bar chart for category breakdown
function createCategoryBarChart(categoryData, chartTitle) {
  const element = safeGetElement('category_bar_chart');
  if (!element || !window.Plotly) {
    console.warn('Cannot create category bar chart');
    return;
  }

  const trace = {
    x: categoryData.map(item => item.category),
    y: categoryData.map(item => item.participants),
    type: 'bar',
    marker: {
      color: '#cf2e2e',
      opacity: 0.8,
      line: {
        color: '#b52828',
        width: 2
      }
    },
    text: categoryData.map(item => formatNumber(item.participants)),
    textposition: 'outside',
    textfont: {
      size: 12,
      color: '#f0f6fc',
      weight: 'bold'
    },
    hovertemplate: '<b>%{x}</b><br>' +
                   'Participants: %{y:,}<br>' +
                   '<extra></extra>'
  };

  const layout = {
    title: {
      text: chartTitle + ' (Bar View)',
      font: { color: '#f0f6fc', size: 18, weight: 600 }
    },
    paper_bgcolor: '#161b22',
    plot_bgcolor: '#161b22',
    font: { color: '#8b949e', size: 12 },
    xaxis: {
      gridcolor: '#30363d',
      tickfont: { size: 11, color: '#f0f6fc' },
      tickangle: -45,
      automargin: true,
      title: {
        text: 'Category',
        font: { size: 13, color: '#8b949e' }
      }
    },
    yaxis: {
      gridcolor: '#30363d',
      tickfont: { size: 11, color: '#f0f6fc' },
      title: {
        text: 'Total Participants',
        font: { size: 13, color: '#8b949e' }
      }
    },
    margin: { l: 60, r: 30, t: 80, b: 120 },
    height: 450,
    showlegend: false,
    bargap: 0.3
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d', 'autoScale2d']
  };

  Plotly.newPlot(element, [trace], layout, config);
}

function createMultiFacilityTimeSeriesChart(selectedFacilities, groupBy) {
  const element = safeGetElement('ts_chart');
  if (!element || !window.Plotly) {
    console.warn('Cannot create multi-facility time series chart');
    return;
  }

  const traces = [];
  const colors = ['#cf2e2e', '#238636', '#f59e0b', '#8b5cf6', '#06b6d4'];

  // Create a separate trace for each facility
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
  // Create side-by-side facility comparison
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

  // Total attendees comparison
  createBarChart('fac_chart', {
    labels: facilityStats.map(f => f.name),
    values: facilityStats.map(f => f.totalAttendees)
  }, `Facility Comparison - Total Attendees`, 'facility');

  // Average attendance comparison
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

  // Update KPIs
  updateKPIs();

  // Update charts
  updateCharts();

  // Update data table
  updateTable();

  // Generate AI insights
  generateInsights();
}

// Filter functions
function applyFilters() {
  const dateFrom = safeGetElement('date_from')?.value;
  const dateTo = safeGetElement('date_to')?.value;
  const instructor = safeGetElement('instr_select')?.value;
  const category = safeGetElement('cat_level1')?.value;

  // Handle facility toggles
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

    // Multi-facility filtering
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

  filteredData = [...globalData];
  updateDashboard();
  showSuccess('Filters reset');
}

// Dashboard initialization
function initializeDashboard() {
  // Populate filter dropdowns
  const instructors = uniqueSorted(globalData.map(r => r['instructor_name']).filter(Boolean));
  const facilities = uniqueSorted(globalData.map(r => r['facility']).filter(Boolean));
  const categories = uniqueSorted(globalData.map(r => r['greatgrandparent_category']).filter(Boolean));

  console.log('Available categories:', categories);

  populateSelect('instr_select', instructors);
  populateFacilityToggles(facilities);
  populateSelect('cat_level1', categories);

  // Set default date range to most recent full month prior
  const dates = globalData.map(r => parseDate(r['class_date'])).filter(Boolean).sort();
  console.log('Available date range:', dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : 'No dates');

  if (dates.length > 0) {
    const dateFromEl = safeGetElement('date_from');
    const dateToEl = safeGetElement('date_to');
    if (dateFromEl && dateToEl) {
      // Get the most recent full month from the actual data
      const latestDate = new Date(dates[dates.length - 1]);
      const mostRecentFullMonth = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);
      const mostRecentFullMonthEnd = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 0);

      // Format dates as YYYY-MM-DD
      const formatDate = (date) => date.toISOString().split('T')[0];

      dateFromEl.value = formatDate(mostRecentFullMonth);
      dateToEl.value = formatDate(mostRecentFullMonthEnd);

      console.log('Set date range:', formatDate(mostRecentFullMonth), 'to', formatDate(mostRecentFullMonthEnd));
    }
  }

  // Select all facilities by default and then update dashboard
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

    // Now update the dashboard after facilities are selected
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

// Main dashboard update function moved earlier in file

// AI Insights (enhanced, revenue removed)
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

  // Low performing instructor insights
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

// Export functions (simplified)
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
  a.download = `kpi_data_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showSuccess('Data exported to CSV');
}

function exportToJson() {
  try {
    if (!filteredData || filteredData.length === 0) {
      showError('No data to export');
      return;
    }

    const json = JSON.stringify(filteredData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `front_dashboard_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    // Clean up
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

// Force white calendar icons with JavaScript
function fixCalendarIcons() {
  // Ultimate fallback: replace with custom calendar emoji if all else fails
  setTimeout(() => {
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
      // Test if the calendar icon is still dark by checking computed styles
      const computedStyle = getComputedStyle(input, '::-webkit-calendar-picker-indicator');

      // Add custom calendar class as fallback
      input.classList.add('custom-calendar');
      input.style.position = 'relative';

      // Create a custom white calendar icon overlay
      const existingIcon = input.nextElementSibling;
      if (!existingIcon || !existingIcon.classList.contains('custom-cal-icon')) {
        const customIcon = document.createElement('span');
        customIcon.innerHTML = '📅';
        customIcon.className = 'custom-cal-icon';
        customIcon.style.cssText = `
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          color: white;
          font-size: 16px;
          pointer-events: none;
          z-index: 10;
          filter: invert(1) brightness(100%);
        `;
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(customIcon);
      }

      input.style.colorScheme = 'dark';
    });
  }, 2000); // Wait 2 seconds to see if CSS worked

  // Method 1: Inject even more aggressive CSS
  const existingStyle = document.getElementById('calendar-icon-fix');
  if (existingStyle) existingStyle.remove();

  const style = document.createElement('style');
  style.id = 'calendar-icon-fix';
  style.innerHTML = `
    /* Nuclear option for calendar icons */
    input[type="date"]::-webkit-calendar-picker-indicator {
      filter: invert(1) brightness(2) contrast(200%) !important;
      -webkit-filter: invert(1) brightness(2) contrast(200%) !important;
      opacity: 1 !important;
      background: transparent !important;
      color: white !important;
    }

    /* Backup custom calendar approach */
    input[type="date"].custom-calendar {
      color-scheme: dark !important;
    }
  `;
  document.head.appendChild(style);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  // Fix calendar icons
  setTimeout(fixCalendarIcons, 100);

  // Filter controls
  addEventListenerSafe('apply_filter', 'click', applyFilters);
  addEventListenerSafe('reset', 'click', resetFilters);
  
  // NEW: Update charts immediately when group_by changes
  addEventListenerSafe('group_by', 'change', function() {
    console.log('Group by changed, updating charts...');
    updateCharts();
    showSuccess('Chart grouping updated');
  });

  // Analytics controls (optional elements)
  addEventListenerSafe('show_trends', 'change', function(e) {
    analyticsSettings.showTrends = e.target.checked;
    updateCharts();
  });

  addEventListenerSafe('show_predictions', 'change', function(e) {
    analyticsSettings.showPredictions = e.target.checked;
    updateCharts();
  });

  // Export controls
  addEventListenerSafe('export_csv', 'click', exportToCsv);
  addEventListenerSafe('export_json', 'click', exportToJson);

  // Show all categories - IMPROVED
  addEventListenerSafe('show_all_cats', 'click', function() {
    try {
      if (typeof window.analyzeCategoryHierarchy === 'function' && typeof window.generateCategoryReport === 'function') {
        const report = window.generateCategoryReport(filteredData);

        // Create a modal-like display for better readability
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.9);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', monospace;
          animation: fadeIn 0.2s ease-in;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
          background: linear-gradient(135deg, #1a1a1a 0%, #161b22 100%);
          color: #e6eef8;
          padding: 30px;
          border-radius: 12px;
          max-width: 85%;
          max-height: 85%;
          overflow: auto;
          white-space: pre-line;
          font-size: 13px;
          line-height: 1.6;
          border: 2px solid #cf2e2e;
          box-shadow: 0 10px 50px rgba(0,0,0,0.5);
          position: relative;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕ Close';
        closeBtn.style.cssText = `
          position: sticky;
          top: 0;
          right: 0;
          float: right;
          background: #cf2e2e;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
          margin-bottom: 15px;
          z-index: 1;
        `;
        closeBtn.onmouseover = () => closeBtn.style.background = '#b52828';
        closeBtn.onmouseout = () => closeBtn.style.background = '#cf2e2e';
        closeBtn.onclick = () => {
          modal.style.animation = 'fadeOut 0.2s ease-out';
          setTimeout(() => document.body.removeChild(modal), 200);
        };

        const reportText = document.createElement('div');
        reportText.textContent = report;
        reportText.style.cssText = 'clear: both; margin-top: 10px;';

        content.appendChild(closeBtn);
        content.appendChild(reportText);
        modal.appendChild(content);
        
        // Add fade animations
        const style = document.createElement('style');
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(modal);
        
        // Allow closing with Escape key
        const escapeHandler = (e) => {
          if (e.key === 'Escape') {
            closeBtn.click();
            document.removeEventListener('keydown', escapeHandler);
          }
        };
        document.addEventListener('keydown', escapeHandler);
      } else {
        showError('Category analysis functions not available. Please refresh the page.');
        console.error('Category analysis functions missing:', {
          analyzeCategoryHierarchy: typeof window.analyzeCategoryHierarchy,
          generateCategoryReport: typeof window.generateCategoryReport
        });
      }
    } catch (error) {
      showError('Failed to generate category report: ' + error.message);
      console.error('Show all categories error:', error);
    }
  });

  // Load data
  loadData();
});
// === UX ENHANCEMENTS ===

// Add visual feedback when buttons are clicked
document.addEventListener('DOMContentLoaded', function() {
  // Add click feedback to all buttons
  document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', function() {
      this.style.transform = 'scale(0.95)';
      setTimeout(() => {
        this.style.transform = '';
      }, 100);
    });
  });

  // Auto-focus search input when typing
  const searchInput = safeGetElement('table_search');
  if (searchInput) {
    document.addEventListener('keydown', function(e) {
      // If user types and search is visible, focus it
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && 
          document.activeElement.tagName !== 'INPUT' && 
          document.activeElement.tagName !== 'SELECT') {
        searchInput.focus();
        searchInput.value = e.key;
      }
    });
  }

  // Add tooltip for facility toggles
  setTimeout(() => {
    const facilityToggles = document.querySelectorAll('.facility-toggle');
    facilityToggles.forEach(toggle => {
      toggle.title = 'Click to toggle this facility filter';
    });
  }, 1000);
  
  // Smooth scroll to sections when filters are applied
  const applyButton = safeGetElement('apply_filter');
  if (applyButton) {
    applyButton.addEventListener('click', function() {
      setTimeout(() => {
        const kpisSection = safeGetElement('kpis');
        if (kpisSection) {
          kpisSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 300);
    });
  }
});

// Add loading state to buttons
function addLoadingState(buttonId) {
  const button = safeGetElement(buttonId);
  if (button) {
    const originalText = button.textContent;
    button.textContent = '⏳ Processing...';
    button.disabled = true;
    
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 500);
  }
}

// Enhance apply filter button
const originalApplyFilter = document.getElementById('apply_filter');
if (originalApplyFilter) {
  originalApplyFilter.addEventListener('click', function() {
    addLoadingState('apply_filter');
  });
}

console.log('✨ UX enhancements loaded');
