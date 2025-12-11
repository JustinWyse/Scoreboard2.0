// Scoreboard 3.0 - Enhanced with Multi-Category Comparison & YoY Visualization
let globalData = [];
let filteredData = [];
let analyticsSettings = {
  showTrends: false,
  showPredictions: false,
  showAnomalies: false,
  comparisonPeriod: '',
  compareYearOverYear: false,
  compareTwoYearsAgo: false,
  selectedCategories: []  // NEW: Up to 3 categories for comparison
};

// Utility Functions
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

// Deduplication - Critical fix for SOMA inflation
function deduplicateData(data) {
  const seen = new Set();
  const deduplicated = [];
  
  data.forEach(record => {
    const guid = record.session_guid;
    if (guid && !seen.has(guid)) {
      seen.add(guid);
      deduplicated.push(record);
    } else if (!guid) {
      deduplicated.push(record);
    }
  });
  
  console.log(`Deduplication: ${data.length} → ${deduplicated.length} records (removed ${data.length - deduplicated.length} duplicates)`);
  return deduplicated;
}

// Data Loading
async function loadData() {
  showLoading();
  try {
    if (typeof window.dashboardData !== 'undefined' && window.dashboardData) {
      console.log('Using embedded data:', window.dashboardData.length, 'records');
      const rawData = window.dashboardData;
      globalData = deduplicateData(rawData);
      filteredData = [...globalData];
    } else {
      const resp = await fetch('data.json');
      if (!resp.ok) throw new Error(`Failed to load data.json: ${resp.status}`);
      const rawData = await resp.json();
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

// FIXED & VERIFIED: Year-over-year comparison - exact same date range
function getYearAgoRange(currentStartDate, currentEndDate, yearsBack = 1) {
  if (!currentStartDate || !currentEndDate) {
    return { start: null, end: null };
  }

  const startDate = new Date(currentStartDate + 'T00:00:00');
  const endDate = new Date(currentEndDate + 'T00:00:00');

  // VERIFIED: Go back exactly N years, same dates
  const yearAgoStart = new Date(startDate);
  yearAgoStart.setFullYear(yearAgoStart.getFullYear() - yearsBack);
  
  const yearAgoEnd = new Date(endDate);
  yearAgoEnd.setFullYear(yearAgoEnd.getFullYear() - yearsBack);

  const formatDate = (date) => date.toISOString().split('T')[0];

  console.log(`${yearsBack} year(s) ago range: ${formatDate(yearAgoStart)} to ${formatDate(yearAgoEnd)}`);

  return {
    start: formatDate(yearAgoStart),
    end: formatDate(yearAgoEnd)
  };
}

// Data Processing
function aggregate(rows, groupBy = 'week') {
  console.log('Aggregate function called with:', rows.length, 'rows, groupBy:', groupBy);
  const by_date = {}, by_date_count = {}, by_book = {}, by_instr = {}, by_fac = {}, by_class = {};

  rows.forEach(r => {
    let d = parseDate(r['class_date']);
    if (!d) return;

    let key;
    if (groupBy === 'week') {
      key = isoWeekStart(d);
    } else if (groupBy === 'month') {
      key = getMonthStart(d);
    } else {
      key = d;
    }

    const at = parseInt(r['total_attendees'] || 0) || 0;
    const bk = parseInt(r['total_bookings'] || 0) || 0;

    by_date[key] = (by_date[key] || 0) + at;
    by_date_count[key] = (by_date_count[key] || 0) + 1; // Track class count per date
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
  const avg_attendance_vals = dates.map(d => by_date_count[d] > 0 ? by_date[d] / by_date_count[d] : 0);
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

  return { dates, date_vals, avg_attendance_vals, book_vals, instr_names, instr_vals, fac_names, fac_vals, fac_avg, class_names, class_vals };
}

// NEW: Get comparison data for YoY with category filter
function getComparisonData(yearsBack = 1) {
  const currentPeriod = getCurrentDateRange();
  
  if (!currentPeriod.hasSelection || !currentPeriod.start || !currentPeriod.end) {
    return [];
  }

  const comparisonPeriod = getYearAgoRange(currentPeriod.start, currentPeriod.end, yearsBack);
  
  console.log(`Getting ${yearsBack} year(s) ago data:`, comparisonPeriod);

  const comparisonData = globalData.filter(row => {
    const rowDate = parseDate(row['class_date']);

    // Must be in comparison period
    if (rowDate < comparisonPeriod.start || rowDate > comparisonPeriod.end) return false;

    // Apply same filters as current data
    const facilityToggles = document.querySelectorAll('.facility-toggle input[type="checkbox"]:checked');
    const selectedFacilities = Array.from(facilityToggles).map(checkbox => checkbox.value);
    if (selectedFacilities.length > 0 && !selectedFacilities.includes(row['facility'])) return false;

    const instructor = safeGetElement('instr_select')?.value;
    if (instructor && row['instructor_name'] !== instructor) return false;

    // NEW: Apply category filter if single category selected
    const selectedCategories = getSelectedCategories();
    if (selectedCategories.length === 1 && row['greatgrandparent_category'] !== selectedCategories[0]) {
      return false;
    }

    return true;
  });

  console.log(`${yearsBack} year(s) ago data count:`, comparisonData.length);
  return comparisonData;
}

// NEW: Get selected categories for multi-category comparison
function getSelectedCategories() {
  const cat1 = safeGetElement('category_compare_1')?.value;
  const cat2 = safeGetElement('category_compare_2')?.value;
  const cat3 = safeGetElement('category_compare_3')?.value;
  
  return [cat1, cat2, cat3].filter(Boolean);
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
  const compareTwoYearsAgo = safeGetElement('compare_two_years_ago')?.checked || false;

  let comparisonData = [];
  let comparisonLabel = '';
  
  if (currentPeriod.hasSelection && currentPeriod.start && currentPeriod.end) {
    if (compareTwoYearsAgo) {
      comparisonData = getComparisonData(2);
      comparisonLabel = 'vs 2 years ago';
    } else if (compareYearOverYear) {
      comparisonData = getComparisonData(1);
      comparisonLabel = 'vs 1 year ago';
    }

    console.log('Comparison type:', compareTwoYearsAgo ? '2 years' : compareYearOverYear ? '1 year' : 'none');
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
        ${hasDateSelection && (compareYearOverYear || compareTwoYearsAgo) ? `<div class="kpi_change">${getChangeArrow(attendees_change, hasDateSelection)} ${getChangeText(attendees_change, hasPreviousData, hasDateSelection, comparisonLabel)}</div>` : ''}
        <div class="kpi_small">All attendance in period</div>
      </div>
      <div class="kpi ${getTrendClass(total_bookings, 1200)}">
        <div class="kpi_val">${formatNumber(total_bookings)}</div>
        <div class="kpi_title">Total Bookings</div>
        ${hasDateSelection && (compareYearOverYear || compareTwoYearsAgo) ? `<div class="kpi_change">${getChangeArrow(bookings_change, hasDateSelection)} ${getChangeText(bookings_change, hasPreviousData, hasDateSelection, comparisonLabel)}</div>` : ''}
        <div class="kpi_small">All bookings made</div>
      </div>
      <div class="kpi ${getTrendClass(avg_attendance, 8)}">
        <div class="kpi_val">${formatNumber(avg_attendance, 1)}</div>
        <div class="kpi_title">Average Attendance</div>
        ${hasDateSelection && (compareYearOverYear || compareTwoYearsAgo) ? `<div class="kpi_change">${getChangeArrow(avg_attendance_change, hasDateSelection)} ${getChangeText(avg_attendance_change, hasPreviousData, hasDateSelection, comparisonLabel)}</div>` : ''}
        <div class="kpi_small">Target: 8 per class</div>
      </div>
      <div class="kpi trend-neutral">
        <div class="kpi_val">${unique_classes.toLocaleString()}</div>
        <div class="kpi_title">Unique Classes</div>
        ${hasDateSelection && (compareYearOverYear || compareTwoYearsAgo) ? `<div class="kpi_change">${getChangeArrow(unique_classes_change, hasDateSelection)} ${getChangeText(unique_classes_change, hasPreviousData, hasDateSelection, comparisonLabel)}</div>` : ''}
        <div class="kpi_small">Distinct class sessions</div>
      </div>
      <div class="kpi trend-neutral">
        <div class="kpi_val">${unique_participants.toLocaleString()}</div>
        <div class="kpi_title">Unique Participants</div>
        ${hasDateSelection && (compareYearOverYear || compareTwoYearsAgo) ? `<div class="kpi_change">${getChangeArrow(unique_participants_change, hasDateSelection)} ${getChangeText(unique_participants_change, hasPreviousData, hasDateSelection, comparisonLabel)}</div>` : ''}
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

// NEW: Create time series with YoY comparison overlay
function createTimeSeriesWithYoY(elementId, currentData, comparisonData, groupBy, comparisonLabel) {
  const element = safeGetElement(elementId);
  if (!element || !window.Plotly) {
    console.warn(`Cannot create YoY time series for ${elementId}`);
    return;
  }

  try {
    const traces = [];

    // Current period trace
    traces.push({
      x: currentData.dates,
      y: currentData.date_vals,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Current Period',
      line: { color: '#cf2e2e', width: 3 },
      marker: { size: 8, color: '#cf2e2e' }
    });

    // Comparison period trace (if data exists)
    if (comparisonData && comparisonData.dates && comparisonData.dates.length > 0) {
      // Truncate comparison data to match current period length
      const maxLength = currentData.dates.length;
      const truncatedComparisonDates = comparisonData.dates.slice(0, maxLength);
      const truncatedComparisonVals = comparisonData.date_vals.slice(0, maxLength);
      
      // Adjust dates to overlay on same x-axis
      const adjustedDates = truncatedComparisonDates.map((date, idx) => {
        return currentData.dates[idx] || date;
      });

      traces.push({
        x: adjustedDates,
        y: truncatedComparisonVals,
        type: 'scatter',
        mode: 'lines+markers',
        name: comparisonLabel,
        line: { color: '#8b949e', width: 2, dash: 'dash' },
        marker: { size: 6, color: '#8b949e' }
      });
    }

    const layout = {
      title: { 
        text: `Attendance Trends - Current vs ${comparisonLabel}`,
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

    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false
    };

    Plotly.newPlot(elementId, traces, layout, config);
  } catch (error) {
    console.error('Error creating YoY time series:', error);
    element.innerHTML = '<div style="text-align: center; padding: 40px; color: #f0f6fc;">Error creating comparison chart</div>';
  }
}

// Average Attendance Time Series with YoY comparison
function createAvgTimeSeriesWithYoY(elementId, currentData, comparisonData, groupBy, comparisonLabel) {
  const element = safeGetElement(elementId);
  if (!element || !window.Plotly) {
    console.warn(`Cannot create average YoY time series for ${elementId}`);
    return;
  }

  try {
    const traces = [];

    // Current period trace
    traces.push({
      x: currentData.dates,
      y: currentData.avg_attendance_vals,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Current Period',
      line: { color: '#cf2e2e', width: 3 },
      marker: { size: 8, color: '#cf2e2e' }
    });

    // Comparison period trace (if data exists)
    if (comparisonData && comparisonData.dates && comparisonData.dates.length > 0) {
      // Truncate comparison data to match current period length
      const maxLength = currentData.dates.length;
      const truncatedComparisonDates = comparisonData.dates.slice(0, maxLength);
      const truncatedComparisonVals = comparisonData.avg_attendance_vals.slice(0, maxLength);
      
      // Adjust dates to overlay on same x-axis
      const adjustedDates = truncatedComparisonDates.map((date, idx) => {
        return currentData.dates[idx] || date;
      });

      traces.push({
        x: adjustedDates,
        y: truncatedComparisonVals,
        type: 'scatter',
        mode: 'lines+markers',
        name: comparisonLabel,
        line: { color: '#8b949e', width: 2, dash: 'dash' },
        marker: { size: 6, color: '#8b949e' }
      });
    }

    const layout = {
      title: { 
        text: `Average Attendance Trends - Current vs ${comparisonLabel}`,
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
        title: { text: 'Average Attendees per Class', font: { size: 12 } }
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

    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false
    };

    Plotly.newPlot(elementId, traces, layout, config);
  } catch (error) {
    console.error('Error creating average YoY time series:', error);
    element.innerHTML = '<div style="text-align: center; padding: 40px; color: #f0f6fc;">Error creating comparison chart</div>';
  }
}

// NEW: Create multi-category comparison time series
function createMultiCategoryTimeSeries(elementId, categories, groupBy, includeYoY = false) {
  const element = safeGetElement(elementId);
  if (!element || !window.Plotly || categories.length === 0) {
    console.warn(`Cannot create multi-category chart for ${elementId}`);
    return;
  }

  try {
    const traces = [];
    const colors = ['#cf2e2e', '#06b6d4', '#10b981', '#8b5cf6'];

    categories.forEach((category, index) => {
      const categoryData = filteredData.filter(r => r.greatgrandparent_category === category);
      if (categoryData.length === 0) return;

      const aggregated = aggregate(categoryData, groupBy);
      const color = colors[index % colors.length];

      // Current period trace (solid line)
      traces.push({
        x: aggregated.dates,
        y: aggregated.date_vals,
        type: 'scatter',
        mode: 'lines+markers',
        name: category,
        line: { color: color, width: 3 },
        marker: { size: 6, color: color }
      });

      // Prior year trace (dashed line, same color) if YoY is enabled
      if (includeYoY) {
        const comparisonData = getComparisonData(1);
        const categoryComparisonData = comparisonData.filter(r => r.greatgrandparent_category === category);
        
        if (categoryComparisonData.length > 0) {
          const comparisonAggregated = aggregate(categoryComparisonData, groupBy);
          
          // Truncate comparison data to match current period length
          const maxLength = aggregated.dates.length;
          const truncatedComparisonDates = comparisonAggregated.dates.slice(0, maxLength);
          const truncatedComparisonVals = comparisonAggregated.date_vals.slice(0, maxLength);
          
          // Align dates with current period for proper overlay
          const adjustedDates = truncatedComparisonDates.map((date, idx) => aggregated.dates[idx] || date);

          traces.push({
            x: adjustedDates,
            y: truncatedComparisonVals,
            type: 'scatter',
            mode: 'lines+markers',
            name: `${category} (1 year ago)`,
            line: { color: color, width: 2, dash: 'dash' },
            marker: { size: 4, color: color },
            opacity: 0.7
          });
        }
      }
    });

    const titleText = includeYoY 
      ? `Category Comparison: ${categories.join(' vs ')} (with 1 Year Ago)`
      : `Category Comparison: ${categories.join(' vs ')}`;

    const layout = {
      title: {
        text: titleText,
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
        font: { color: '#8b949e', size: 11 },
        orientation: 'v',
        y: 1,
        x: 1.02,
        xanchor: 'left'
      }
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false
    };

    Plotly.newPlot(elementId, traces, layout, config);
  } catch (error) {
    console.error('Error creating multi-category chart:', error);
    element.innerHTML = '<div style="text-align: center; padding: 40px; color: #f0f6fc;">Error creating comparison chart</div>';
  }
}

// Multi-category Average Attendance Time Series with optional YoY
function createMultiCategoryAvgTimeSeries(elementId, categories, groupBy, includeYoY = false) {
  const element = safeGetElement(elementId);
  if (!element || !window.Plotly || categories.length === 0) {
    console.warn(`Cannot create multi-category average chart for ${elementId}`);
    return;
  }

  try {
    const traces = [];
    const colors = ['#cf2e2e', '#06b6d4', '#10b981', '#8b5cf6'];

    categories.forEach((category, index) => {
      const categoryData = filteredData.filter(r => r.greatgrandparent_category === category);
      if (categoryData.length === 0) return;

      const aggregated = aggregate(categoryData, groupBy);
      const color = colors[index % colors.length];

      // Current period trace (solid line)
      traces.push({
        x: aggregated.dates,
        y: aggregated.avg_attendance_vals,
        type: 'scatter',
        mode: 'lines+markers',
        name: category,
        line: { color: color, width: 3 },
        marker: { size: 6, color: color }
      });

      // Prior year trace (dashed line, same color) if YoY is enabled
      if (includeYoY) {
        const comparisonData = getComparisonData(1);
        const categoryComparisonData = comparisonData.filter(r => r.greatgrandparent_category === category);
        
        if (categoryComparisonData.length > 0) {
          const comparisonAggregated = aggregate(categoryComparisonData, groupBy);
          
          // Truncate comparison data to match current period length
          const maxLength = aggregated.dates.length;
          const truncatedComparisonDates = comparisonAggregated.dates.slice(0, maxLength);
          const truncatedComparisonVals = comparisonAggregated.avg_attendance_vals.slice(0, maxLength);
          
          // Align dates with current period for proper overlay
          const adjustedDates = truncatedComparisonDates.map((date, idx) => aggregated.dates[idx] || date);

          traces.push({
            x: adjustedDates,
            y: truncatedComparisonVals,
            type: 'scatter',
            mode: 'lines+markers',
            name: `${category} (1 year ago)`,
            line: { color: color, width: 2, dash: 'dash' },
            marker: { size: 4, color: color },
            opacity: 0.7
          });
        }
      }
    });

    const titleText = includeYoY 
      ? `Category Average Attendance: ${categories.join(' vs ')} (with 1 Year Ago)`
      : `Category Average Attendance: ${categories.join(' vs ')}`;

    const layout = {
      title: {
        text: titleText,
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
        title: { text: 'Average Attendees per Class', font: { size: 12 } }
      },
      margin: { l: 60, r: 30, t: 80, b: 100 },
      height: 500,
      showlegend: true,
      legend: {
        font: { color: '#8b949e', size: 11 },
        orientation: 'v',
        y: 1,
        x: 1.02,
        xanchor: 'left'
      }
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false
    };

    Plotly.newPlot(elementId, traces, layout, config);
  } catch (error) {
    console.error('Error creating multi-category average chart:', error);
    element.innerHTML = '<div style="text-align: center; padding: 40px; color: #f0f6fc;">Error creating comparison chart</div>';
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
        colors = data.values.map((val, idx) => {
          const intensity = (idx / data.values.length) * 0.4 + 0.6;
          return `rgba(6, 182, 212, ${intensity})`;
        });
        break;
      default:
        colors = data.values.map((val, idx) => {
          const intensity = (idx / data.values.length) * 0.4 + 0.6;
          return `rgba(6, 182, 212, ${intensity})`;
        });
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

    const isMobile = window.innerWidth < 768;
    const labelFontSize = isMobile ? 12 : 14;
    const leftMargin = isMobile ? 180 : (isPerformanceChart ? 220 : 160);
    const chartHeight = isMobile ? 500 : (isPerformanceChart ? 550 : 450);

    const layout = {
      title: { text: title, font: { color: '#f0f6fc', size: 16 } },
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
      margin: { l: leftMargin, r: 20, t: 60, b: 40 },
      height: chartHeight
    };

    const config = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false
    };

    Plotly.newPlot(elementId, [trace], layout, config);
  } catch (error) {
    console.error(`Error creating bar chart for ${elementId}:`, error);
    element.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 20px;">Chart loading error</p>`;
  }
}

// Side-by-side bar charts for YoY comparison
function createSideBySideBarCharts(elementId, currentData, comparisonData, mainTitle) {
  const element = safeGetElement(elementId);
  if (!element || !window.Plotly) {
    console.warn(`Cannot create side-by-side charts for ${elementId}`);
    return;
  }

  try {
    // Show the element
    element.style.display = 'block';
    
    // Create side-by-side layout
    element.innerHTML = `
      <div style="margin: 2rem 0;">
        <h3 style="text-align: center; color: #f0f6fc; margin-bottom: 1.5rem;">${mainTitle}</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          <div id="${elementId}_current" style="height: 500px;"></div>
          <div id="${elementId}_comparison" style="height: 500px;"></div>
        </div>
      </div>
    `;

    // Create current period chart
    const currentTrace = {
      x: currentData.values,
      y: currentData.labels,
      type: 'bar',
      orientation: 'h',
      marker: {
        color: currentData.values.map((val, idx) => {
          const intensity = (idx / currentData.values.length) * 0.4 + 0.6;
          return `rgba(6, 182, 212, ${intensity})`;
        }),
        line: { width: 1, color: 'rgba(255,255,255,0.1)' }
      },
      hovertemplate: '<b>%{y}</b><br>Value: %{x:.1f}<br><extra></extra>'
    };

    // Create comparison period chart
    const comparisonTrace = {
      x: comparisonData.values,
      y: comparisonData.labels,
      type: 'bar',
      orientation: 'h',
      marker: {
        color: comparisonData.values.map((val, idx) => {
          const intensity = (idx / comparisonData.values.length) * 0.4 + 0.6;
          return `rgba(139, 92, 246, ${intensity})`;
        }),
        line: { width: 1, color: 'rgba(255,255,255,0.1)' }
      },
      hovertemplate: '<b>%{y}</b><br>Value: %{x:.1f}<br><extra></extra>'
    };

    const baseLayout = {
      paper_bgcolor: '#161b22',
      plot_bgcolor: '#161b22',
      font: { color: '#8b949e', size: 12 },
      xaxis: { gridcolor: '#30363d' },
      yaxis: {
        gridcolor: '#30363d',
        tickfont: { size: 11 },
        automargin: true
      },
      margin: { l: 160, r: 20, t: 60, b: 40 },
      height: 500,
      showlegend: false
    };

    setTimeout(() => {
      Plotly.newPlot(`${elementId}_current`, [currentTrace], {
        ...baseLayout,
        title: { text: currentData.title, font: { color: '#f0f6fc', size: 14 } }
      }, { responsive: true, displayModeBar: false });

      Plotly.newPlot(`${elementId}_comparison`, [comparisonTrace], {
        ...baseLayout,
        title: { text: comparisonData.title, font: { color: '#f0f6fc', size: 14 } }
      }, { responsive: true, displayModeBar: false });
    }, 100);
  } catch (error) {
    console.error(`Error creating side-by-side charts for ${elementId}:`, error);
    element.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 20px;">Chart loading error</p>`;
  }
}

// NEW: Create pie chart with optional YoY comparison
function createPieChart(elementId, data, title, comparisonData = null, comparisonLabel = '') {
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

    // If we have comparison data, create side-by-side pie charts
    if (comparisonData && comparisonData.labels && comparisonData.labels.length > 0) {
      // Clear the element
      element.innerHTML = '';
      
      // Create container for side-by-side charts
      element.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          <div id="${elementId}_current" style="height: 500px;"></div>
          <div id="${elementId}_comparison" style="height: 500px;"></div>
        </div>
      `;

      // Current period pie chart
      const currentTrace = {
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
        domain: {column: 0}
      };

      const currentLayout = {
        title: {
          text: 'Current Period',
          font: { color: '#f0f6fc', size: 16 },
          x: 0.5
        },
        paper_bgcolor: '#161b22',
        plot_bgcolor: '#161b22',
        font: { color: '#8b949e', size: 11 },
        showlegend: true,
        legend: {
          font: { color: '#8b949e', size: 11 },
          orientation: 'v',
          y: 0.5,
          x: 1.1
        },
        height: 500,
        margin: { l: 20, r: 150, t: 60, b: 20 }
      };

      // Comparison period pie chart
      const comparisonTrace = {
        type: 'pie',
        labels: comparisonData.labels,
        values: comparisonData.values,
        hole: 0.3,
        marker: {
          colors: colors.slice(0, comparisonData.labels.length),
          line: { width: 2, color: '#161b22' }
        },
        textinfo: 'label+percent',
        textposition: 'auto',
        domain: {column: 1}
      };

      const comparisonLayout = {
        title: {
          text: comparisonLabel,
          font: { color: '#f0f6fc', size: 16 },
          x: 0.5
        },
        paper_bgcolor: '#161b22',
        plot_bgcolor: '#161b22',
        font: { color: '#8b949e', size: 11 },
        showlegend: true,
        legend: {
          font: { color: '#8b949e', size: 11 },
          orientation: 'v',
          y: 0.5,
          x: 1.1
        },
        height: 500,
        margin: { l: 20, r: 150, t: 60, b: 20 }
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        displaylogo: false
      };

      setTimeout(() => {
        Plotly.newPlot(`${elementId}_current`, [currentTrace], currentLayout, config);
        Plotly.newPlot(`${elementId}_comparison`, [comparisonTrace], comparisonLayout, config);
      }, 100);

    } else {
      // Single pie chart (no comparison)
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

      const layout = {
        title: {
          text: title,
          font: { color: '#f0f6fc', size: 18 },
          x: 0.5
        },
        paper_bgcolor: '#161b22',
        plot_bgcolor: '#161b22',
        font: { color: '#8b949e', size: 12 },
        showlegend: true,
        legend: {
          font: { color: '#8b949e', size: 13 },
          orientation: 'v',
          y: 0.5,
          x: 1.1
        },
        margin: { l: 20, r: 150, t: 60, b: 20 },
        height: 500
      };

      const config = {
        responsive: true,
        displayModeBar: false,
        displaylogo: false
      };

      Plotly.newPlot(elementId, [trace], layout, config);
    }
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
function getTopPerformingClasses(limit = 10, data = null) {
  const classLocationStats = {};
  const dataToUse = data || filteredData;

  dataToUse.forEach(r => {
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

// Helper function for class comparison with YoY
function getTopPerformingClassesFromData(data, limit) {
  const classLocationStats = {};
  data.forEach(r => {
    const className = r['class_name'];
    const facilityId = r['facility'];
    if (!className || className.trim() === '') return;
    const locationName = getFacilityName(facilityId);
    const classKey = `${className} (${locationName})`;
    if (!classLocationStats[classKey]) classLocationStats[classKey] = { totalAttendance: 0, classCount: 0 };
    classLocationStats[classKey].totalAttendance += parseInt(r['total_attendees']) || 0;
    classLocationStats[classKey].classCount += 1;
  });
  return Object.entries(classLocationStats)
    .filter(([name, stats]) => stats.classCount >= 3 && name.trim() !== '')
    .map(([classKey, stats]) => ({ className: classKey, avgAttendance: Math.round((stats.totalAttendance / stats.classCount) * 10) / 10, totalAttendance: stats.totalAttendance }))
    .sort((a, b) => b.avgAttendance - a.avgAttendance)
    .slice(0, limit);
}

function getLowPerformingClasses(threshold = 3, data = null) {
  const classLocationStats = {};
  const dataToUse = data || filteredData;

  dataToUse.forEach(r => {
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

// Chart Updates - Enhanced with YoY and Multi-Category
function updateCharts() {
  const groupBy = safeGetElement('group_by')?.value || 'week';
  const compareYearOverYear = safeGetElement('compare_year_over_year')?.checked || false;
  const compareTwoYearsAgo = safeGetElement('compare_two_years_ago')?.checked || false;
  const selectedCategories = getSelectedCategories();

  console.log('updateCharts:', { groupBy, compareYearOverYear, compareTwoYearsAgo, selectedCategories });

  const aggregated = aggregate(filteredData, groupBy);

  // Time series chart - with YoY or multi-category comparison
  if (selectedCategories.length > 1) {
    // Multi-category comparison - include YoY if enabled
    const includeYoY = (compareYearOverYear || compareTwoYearsAgo) && getCurrentDateRange().hasSelection;
    createMultiCategoryTimeSeries('ts_chart', selectedCategories, groupBy, includeYoY);
  } else if ((compareYearOverYear || compareTwoYearsAgo) && getCurrentDateRange().hasSelection) {
    // YoY comparison
    const yearsBack = compareTwoYearsAgo ? 2 : 1;
    const comparisonData = getComparisonData(yearsBack);
    const comparisonAggregated = aggregate(comparisonData, groupBy);
    const comparisonLabel = compareTwoYearsAgo ? '2 Years Ago' : '1 Year Ago';
    
    createTimeSeriesWithYoY('ts_chart', aggregated, comparisonAggregated, groupBy, comparisonLabel);
  } else {
    // Standard single time series
    createChart('ts_chart', {
      x: aggregated.dates,
      y: aggregated.date_vals,
      type: 'scatter',
      mode: 'lines+markers'
    }, `Attendance Trends - Total Participants Over Time (by ${groupBy})`);
  }

  // Average Attendance Chart - with YoY or multi-category comparison
  if (selectedCategories.length > 1) {
    // Multi-category comparison - include YoY if enabled
    const includeYoY = (compareYearOverYear || compareTwoYearsAgo) && getCurrentDateRange().hasSelection;
    createMultiCategoryAvgTimeSeries('avg_attendance_chart', selectedCategories, groupBy, includeYoY);
  } else if ((compareYearOverYear || compareTwoYearsAgo) && getCurrentDateRange().hasSelection) {
    // YoY comparison
    const yearsBack = compareTwoYearsAgo ? 2 : 1;
    const comparisonData = getComparisonData(yearsBack);
    const comparisonAggregated = aggregate(comparisonData, groupBy);
    const comparisonLabel = compareTwoYearsAgo ? '2 Years Ago' : '1 Year Ago';
    
    createAvgTimeSeriesWithYoY('avg_attendance_chart', aggregated, comparisonAggregated, groupBy, comparisonLabel);
  } else {
    // Standard single average time series
    createChart('avg_attendance_chart', {
      x: aggregated.dates,
      y: aggregated.avg_attendance_vals,
      type: 'scatter',
      mode: 'lines+markers'
    }, `Average Attendance Trends - Per Class Average Over Time (by ${groupBy})`);
  }

  // Instructor charts - filter by selected categories if applicable
  let instructorData = filteredData;
  let instructorComparisonData = null;
  
  if (selectedCategories.length > 0) {
    // Filter instructor data by selected categories
    instructorData = filteredData.filter(r => selectedCategories.includes(r.greatgrandparent_category));
  }
  
  const instructorAggregated = aggregate(instructorData, groupBy);
  const topInstructors = instructorAggregated.instr_names?.slice(0, 10).reverse() || [];
  const topInstructorVals = instructorAggregated.instr_vals?.slice(0, 10).reverse() || [];

  createBarChart('bar_chart', {
    labels: topInstructors,
    values: topInstructorVals
  }, 'Top Performing Instructors (Average Attendees per Class)', 'performance');

  // Side-by-side YoY comparison for instructors
  const instructorCompareElement = safeGetElement('instructor_pie_chart');
  if ((compareYearOverYear || compareTwoYearsAgo) && getCurrentDateRange().hasSelection) {
    const yearsBack = compareTwoYearsAgo ? 2 : 1;
    let comparisonData = getComparisonData(yearsBack);
    
    // Filter comparison data by selected categories too
    if (selectedCategories.length > 0) {
      comparisonData = comparisonData.filter(r => selectedCategories.includes(r.greatgrandparent_category));
    }
    
    const comparisonAggregated = aggregate(comparisonData, groupBy);
    const comparisonLabel = compareTwoYearsAgo ? '2 Years Ago' : '1 Year Ago';
    
    const comparisonInstructors = comparisonAggregated.instr_names?.slice(0, 10).reverse() || [];
    const comparisonInstructorVals = comparisonAggregated.instr_vals?.slice(0, 10).reverse() || [];
    
    createSideBySideBarCharts('instructor_pie_chart', 
      { labels: topInstructors, values: topInstructorVals, title: 'Current Period' },
      { labels: comparisonInstructors, values: comparisonInstructorVals, title: comparisonLabel },
      'Top Instructors Comparison'
    );
  } else {
    if (instructorCompareElement) {
      instructorCompareElement.style.display = 'none';
    }
  }

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

  // Class charts - filter by selected categories if applicable
  let classData = filteredData;
  
  if (selectedCategories.length > 0) {
    // Filter class data by selected categories
    classData = filteredData.filter(r => selectedCategories.includes(r.greatgrandparent_category));
  }
  
  const topClasses = getTopPerformingClasses(10, classData);
  if (topClasses.length > 0) {
    createBarChart('top_classes_chart', {
      labels: topClasses.map(cls => cls.className).slice(0, 10),
      values: topClasses.map(cls => cls.avgAttendance).slice(0, 10)
    }, 'Top Performing Classes by Location (Avg Attendance)', 'performance');

    // Side-by-side YoY comparison for classes
    const classCompareElement = safeGetElement('class_pie_chart');
    if ((compareYearOverYear || compareTwoYearsAgo) && getCurrentDateRange().hasSelection) {
      const yearsBack = compareTwoYearsAgo ? 2 : 1;
      let comparisonData = getComparisonData(yearsBack);
      
      // Filter comparison data by selected categories too
      if (selectedCategories.length > 0) {
        comparisonData = comparisonData.filter(r => selectedCategories.includes(r.greatgrandparent_category));
      }
      
      const comparisonTopClasses = getTopPerformingClassesFromData(comparisonData, 10);
      const comparisonLabel = compareTwoYearsAgo ? '2 Years Ago' : '1 Year Ago';
      
      createSideBySideBarCharts('class_pie_chart',
        { labels: topClasses.map(cls => cls.className).slice(0, 10), values: topClasses.map(cls => cls.avgAttendance).slice(0, 10), title: 'Current Period' },
        { labels: comparisonTopClasses.map(cls => cls.className), values: comparisonTopClasses.map(cls => cls.avgAttendance), title: comparisonLabel },
        'Top Classes Comparison'
      );
    } else {
      if (classCompareElement) {
        classCompareElement.style.display = 'none';
      }
    }
  }

  const lowPerformingClasses = getLowPerformingClasses(3, classData);
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

  // Facility charts - filter by selected categories if applicable
  let facilityData = filteredData;
  
  if (selectedCategories.length > 0) {
    // Filter facility data by selected categories
    facilityData = filteredData.filter(r => selectedCategories.includes(r.greatgrandparent_category));
  }
  
  const facilityAggregated = aggregate(facilityData, groupBy);
  
  createBarChart('fac_chart', {
    labels: facilityAggregated.fac_names.slice(0, 10),
    values: facilityAggregated.fac_vals.slice(0, 10)
  }, 'Facility Performance (Total Attendees)', 'facility');

  // Side-by-side YoY comparison for facilities
  const facilityCompareElement = safeGetElement('facility_pie_chart');
  if ((compareYearOverYear || compareTwoYearsAgo) && getCurrentDateRange().hasSelection) {
    const yearsBack = compareTwoYearsAgo ? 2 : 1;
    let comparisonData = getComparisonData(yearsBack);
    
    // Filter comparison data by selected categories too
    if (selectedCategories.length > 0) {
      comparisonData = comparisonData.filter(r => selectedCategories.includes(r.greatgrandparent_category));
    }
    
    const comparisonAggregated = aggregate(comparisonData, groupBy);
    const comparisonLabel = compareTwoYearsAgo ? '2 Years Ago' : '1 Year Ago';
    
    createSideBySideBarCharts('facility_pie_chart',
      { labels: facilityAggregated.fac_names.slice(0, 10), values: facilityAggregated.fac_vals.slice(0, 10), title: 'Current Period' },
      { labels: comparisonAggregated.fac_names.slice(0, 10), values: comparisonAggregated.fac_vals.slice(0, 10), title: comparisonLabel },
      'Facilities Comparison (Total Attendees)'
    );
  } else {
    if (facilityCompareElement) {
      facilityCompareElement.style.display = 'none';
    }
  }

  createBarChart('fac_avg_chart', {
    labels: facilityAggregated.fac_names.slice(0, 10),
    values: facilityAggregated.fac_avg.slice(0, 10)
  }, 'Facility Performance (Avg Attendance)', 'facility');

  // Category pie chart - with YoY comparison if enabled
  createCategoryPieChart();
}

// Category pie chart with YoY comparison
function createCategoryPieChart() {
  const compareYearOverYear = safeGetElement('compare_year_over_year')?.checked || false;
  const compareTwoYearsAgo = safeGetElement('compare_two_years_ago')?.checked || false;
  const hasYoYEnabled = (compareYearOverYear || compareTwoYearsAgo) && getCurrentDateRange().hasSelection;

  let categoryStats = {};
  let chartTitle = 'Participant Distribution by Program Subcategory';

  filteredData.forEach(r => {
    // Use parent_category for specific class types (e.g., Vinyasa), fall back to broader categories if not available
    const category = r['parent_category'] || r['grandparent_category'] || r['greatgrandparent_category'] || 'Unknown';
    const attendees = parseInt(r['total_attendees']) || 0;

    if (!categoryStats[category]) {
      categoryStats[category] = 0;
    }
    categoryStats[category] += attendees;
  });

  const categoryData = Object.entries(categoryStats)
    .map(([category, participants]) => ({ category, participants }))
    .sort((a, b) => b.participants - a.participants);

  // Get comparison data if YoY is enabled
  let comparisonCategoryData = null;
  let comparisonLabel = '';
  
  if (hasYoYEnabled) {
    const yearsBack = compareTwoYearsAgo ? 2 : 1;
    let comparisonData = getComparisonData(yearsBack);
    comparisonLabel = compareTwoYearsAgo ? '2 Years Ago' : '1 Year Ago';
    
    // Filter comparison data by selected categories
    const selectedCategories = getSelectedCategories();
    if (selectedCategories.length > 0) {
      comparisonData = comparisonData.filter(r => selectedCategories.includes(r.greatgrandparent_category));
    }
    
    const comparisonCategoryStats = {};
    comparisonData.forEach(r => {
      const category = r['parent_category'] || r['grandparent_category'] || r['greatgrandparent_category'] || 'Unknown';
      const attendees = parseInt(r['total_attendees']) || 0;

      if (!comparisonCategoryStats[category]) {
        comparisonCategoryStats[category] = 0;
      }
      comparisonCategoryStats[category] += attendees;
    });

    comparisonCategoryData = {
      labels: Object.keys(comparisonCategoryStats),
      values: Object.values(comparisonCategoryStats)
    };
  }

  if (categoryData.length > 0) {
    createPieChart('category_pie_chart', {
      labels: categoryData.map(item => item.category),
      values: categoryData.map(item => item.participants)
    }, chartTitle, comparisonCategoryData, comparisonLabel);
  } else {
    const element = safeGetElement('category_pie_chart');
    if (element) {
      element.innerHTML = '<div style="text-align: center; padding: 40px; color: #8b949e; font-size: 16px;">No category data available for current filters</div>';
    }
  }
}

// Main dashboard update function
function updateDashboard() {
  console.log('Updating dashboard with', filteredData.length, 'records');
  updateKPIs();
  updateCharts();
  generateInsights();
}

// Filter functions
function applyFilters() {
  const dateFrom = safeGetElement('date_from')?.value;
  const dateTo = safeGetElement('date_to')?.value;
  const instructor = safeGetElement('instr_select')?.value;
  const selectedCategories = getSelectedCategories();

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

    // NEW: Multi-category filter
    if (selectedCategories.length > 0 && !selectedCategories.includes(row['greatgrandparent_category'])) {
      keep = false;
    }

    return keep;
  });

  updateDashboard();

  const facilityText = selectedFacilities.length > 0 ? ` (${selectedFacilities.length} facilities)` : '';
  const categoryText = selectedCategories.length > 0 ? ` (${selectedCategories.length} categories)` : '';
  showSuccess(`Filtered to ${filteredData.length} records${facilityText}${categoryText}`);
}

function resetFilters() {
  const elementsToReset = ['date_from', 'date_to', 'instr_select', 'category_compare_1', 'category_compare_2', 'category_compare_3'];
  elementsToReset.forEach(id => {
    const element = safeGetElement(id);
    if (element) element.value = '';
  });

  const facilityToggles = document.querySelectorAll('.facility-toggle');
  facilityToggles.forEach(toggle => {
    const checkbox = toggle.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = false;
      toggle.classList.remove('selected');
    }
  });

  const compareToggle = safeGetElement('compare_year_over_year');
  if (compareToggle) compareToggle.checked = false;

  const compareTwoToggle = safeGetElement('compare_two_years_ago');
  if (compareTwoToggle) compareTwoToggle.checked = false;

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
  
  // Populate all 3 category dropdowns
  populateSelect('category_compare_1', categories);
  populateSelect('category_compare_2', categories);
  populateSelect('category_compare_3', categories);

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
    
    // Initialize collapsible sections
    initializeCollapsibleSections();
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
  if (!container) return;

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
  });
}

// NEW: Collapsible sections
function initializeCollapsibleSections() {
  console.log('Initializing collapsible sections...');
  const sections = document.querySelectorAll('.dashboard-section');
  console.log('Found', sections.length, 'sections');
  
  sections.forEach((section, index) => {
    const header = section.querySelector('.section-header');
    if (!header) {
      console.warn(`Section ${index} has no header`);
      return;
    }

    // Check if button already exists
    if (header.querySelector('.collapse-btn')) {
      console.log(`Section ${index} already has collapse button`);
      return;
    }

    // Add collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-btn';
    collapseBtn.innerHTML = '▼';
    collapseBtn.title = 'Collapse section';
    collapseBtn.setAttribute('type', 'button');
    
    // Style the header
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.cursor = 'pointer';
    header.appendChild(collapseBtn);

    // Find the content element
    const content = section.querySelector('.section-content') || 
                   section.querySelector('.kpis') ||
                   section.querySelector('#charts') ||
                   section.querySelector('#charts-section2') ||
                   section.querySelector('#charts-section3');
    
    if (!content) {
      console.warn(`Section ${index} has no content element`);
      return;
    }

    console.log(`Section ${index} initialized with content`);

    // Add click handler with preventDefault
    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isCurrentlyVisible = content.style.display !== 'none';
      content.style.display = isCurrentlyVisible ? 'none' : 'block';
      collapseBtn.innerHTML = isCurrentlyVisible ? '▶' : '▼';
      collapseBtn.title = isCurrentlyVisible ? 'Expand section' : 'Collapse section';
      
      console.log(`Toggled section ${index}: Now ${content.style.display}`);
    });
  });
  
  console.log('Collapsible sections initialized');
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

  // Year-over-year comparison toggles
  addEventListenerSafe('compare_year_over_year', 'change', function() {
    // Uncheck 2-year comparison if 1-year is checked
    const twoYearToggle = safeGetElement('compare_two_years_ago');
    if (this.checked && twoYearToggle) {
      twoYearToggle.checked = false;
    }
    updateKPIs();
    updateCharts();
  });

  addEventListenerSafe('compare_two_years_ago', 'change', function() {
    // Uncheck 1-year comparison if 2-year is checked
    const oneYearToggle = safeGetElement('compare_year_over_year');
    if (this.checked && oneYearToggle) {
      oneYearToggle.checked = false;
    }
    updateKPIs();
    updateCharts();
  });

  // Export controls
  addEventListenerSafe('export_csv', 'click', exportToCsv);
  addEventListenerSafe('export_json', 'click', exportToJson);

  // Load data
  loadData();
});

console.log('✨ Scoreboard 3.0 loaded - Multi-category comparison, YoY chart visualization, verified math, collapsible sections');
