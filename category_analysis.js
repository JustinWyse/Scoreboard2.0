// Category Analysis Helper Functions
// NOTE: copied from root `category_analysis.js`

// (Full content available in the original repository) 
function analyzeCategoryHierarchy(data) {
  const hierarchy = {
    greatgrandparent: {},
    grandparent: {},
    parent: {},
    class_names: {}
  };

  data.forEach(record => {
    const ggp = record.greatgrandparent_category;
    const gp = record.grandparent_category;
    const p = record.parent_category;
    const cn = record.class_name;

    if (ggp) {
      if (!hierarchy.greatgrandparent[ggp]) {
        hierarchy.greatgrandparent[ggp] = {
          count: 0,
          grandparents: new Set(),
          attendance: 0
        };
      }
      hierarchy.greatgrandparent[ggp].count++;
      hierarchy.greatgrandparent[ggp].attendance += parseInt(record.total_attendees) || 0;

      if (gp) {
        hierarchy.greatgrandparent[ggp].grandparents.add(gp);

        if (!hierarchy.grandparent[gp]) {
          hierarchy.grandparent[gp] = {
            count: 0,
            parents: new Set(),
            greatgrandparent: ggp,
            attendance: 0
          };
        }
        hierarchy.grandparent[gp].count++;
        hierarchy.grandparent[gp].attendance += parseInt(record.total_attendees) || 0;

        if (p) {
          hierarchy.grandparent[gp].parents.add(p);

          if (!hierarchy.parent[p]) {
            hierarchy.parent[p] = {
              count: 0,
              classes: new Set(),
              grandparent: gp,
              greatgrandparent: ggp,
              attendance: 0
            };
          }
          hierarchy.parent[p].count++;
          hierarchy.parent[p].attendance += parseInt(record.total_attendees) || 0;

          if (cn) {
            hierarchy.parent[p].classes.add(cn);

            if (!hierarchy.class_names[cn]) {
              hierarchy.class_names[cn] = {
                count: 0,
                parent: p,
                grandparent: gp,
                greatgrandparent: ggp,
                attendance: 0,
                facilities: new Set()
              };
            }
            hierarchy.class_names[cn].count++;
            hierarchy.class_names[cn].attendance += parseInt(record.total_attendees) || 0;
            if (record.facility) hierarchy.class_names[cn].facilities.add(record.facility);
          }
        }
      }
    }
  });

  Object.values(hierarchy.greatgrandparent).forEach(ggp => {
    ggp.grandparents = Array.from(ggp.grandparents);
  });
  Object.values(hierarchy.grandparent).forEach(gp => {
    gp.parents = Array.from(gp.parents);
  });
  Object.values(hierarchy.parent).forEach(p => {
    p.classes = Array.from(p.classes);
  });
  Object.values(hierarchy.class_names).forEach(cn => {
    cn.facilities = Array.from(cn.facilities);
  });

  return hierarchy;
}

function generateCategoryReport(data) {
  const hierarchy = analyzeCategoryHierarchy(data);

  let report = "=== CATEGORY HIERARCHY ANALYSIS ===\n\n";

  report += "GREAT GRANDPARENT CATEGORIES:\n";
  Object.entries(hierarchy.greatgrandparent)
    .sort((a, b) => b[1].attendance - a[1].attendance)
    .forEach(([name, data]) => {
      report += `📊 ${name}: ${data.count} classes, ${data.attendance.toLocaleString()} total attendance\n`;
      report += `   └─ ${data.grandparents.length} grandparent categories\n`;
    });

  return report;
}

if (typeof window !== 'undefined') {
  window.analyzeCategoryHierarchy = analyzeCategoryHierarchy;
  window.generateCategoryReport = generateCategoryReport;
}
