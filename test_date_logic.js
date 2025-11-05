// Test the date comparison logic

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

// Test cases
console.log("Test 1: Nov 1-7, 2024 (7 days)");
let result = getPreviousMonthRange('2024-11-01', '2024-11-07');
console.log("Current: 2024-11-01 to 2024-11-07");
console.log("Previous:", result.start, "to", result.end);
console.log("Expected: 2024-10-25 to 2024-10-31");
console.log("");

console.log("Test 2: Oct 15-31, 2024 (17 days)");
result = getPreviousMonthRange('2024-10-15', '2024-10-31');
console.log("Current: 2024-10-15 to 2024-10-31");
console.log("Previous:", result.start, "to", result.end);
console.log("Expected: 2024-09-28 to 2024-10-14");
console.log("");

console.log("Test 3: Jan 1-31, 2024 (31 days)");
result = getPreviousMonthRange('2024-01-01', '2024-01-31');
console.log("Current: 2024-01-01 to 2024-01-31");
console.log("Previous:", result.start, "to", result.end);
console.log("Expected: 2023-12-01 to 2023-12-31");
