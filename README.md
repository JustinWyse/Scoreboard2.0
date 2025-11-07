# The Front Climbing Club - Scoreboard Dashboard

🧗 Interactive dashboard for analyzing class performance metrics with **43,087+ records**

## ✨ Features

- 📊 **Real-time KPIs** - Attendance, bookings, performance metrics
- 📈 **Time Series Analysis** - Track trends over time
- 👥 **Instructor Performance** - Top performers and insights
- 🏢 **Facility Breakdown** - Compare locations
- 📑 **Category Analysis** - Program type breakdowns
- 🔍 **Advanced Filtering** - Date ranges, instructors, facilities, categories
- 📤 **Data Export** - Download filtered data (CSV/JSON)

## 🚀 Quick Start

### Local Testing (3 minutes)
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run dashboard
streamlit run streamlit_app.py

# 3. Open browser (auto-opens)
# Access code: FRONT2024
```

### Update Data (30 seconds)
**Windows:** Double-click `UPDATE_DATA.bat`

**Mac/Linux:**
```bash
python update_data.py
```

## 📊 Data Pipeline

```
Excel File (data_02_FromConfig.xlsx)
    ↓
UPDATE_DATA.bat (or update_data.py)
    ↓
data.json.gz (compressed JSON)
    ↓
Streamlit Dashboard
    ↓
Interactive Web App
```

## 🎨 UI Improvements

### Sidebar Controls
- 📊 Data metrics (record count, last updated)
- 🔄 Refresh button (instant reload)
- 🚪 Logout button
- ℹ️ Quick guide

### Filter Section
- Grid-based layout (responsive)
- Date range pickers
- Instructor dropdown
- Category selector
- Facility toggle buttons (with hover effects)
- Apply/Reset buttons

### Dashboard Features
- KPI cards with metrics
- Interactive Plotly charts
- Time series graphs
- Top/bottom performer rankings
- Category pie charts
- Facility comparisons
- Searchable data table

## 📁 Project Structure

```
front_dashboard_final/
├── streamlit_app.py              # Main Streamlit app
├── UPDATE_DATA.bat               # Windows batch file (double-click)
├── update_data.py                # Python conversion script
├── data.json.gz                  # Dashboard data (generated)
├── data_02_FromConfig.xlsx       # Excel source file
├── index.html                    # Dashboard HTML template
├── styles.css                    # Dashboard CSS (Front brand)
├── app.js                        # Dashboard JavaScript
├── category_analysis.js          # Category helper functions
├── category_aliases.json         # Category name mappings
├── requirements.txt              # Python dependencies
├── .gitignore                    # Git ignore rules
├── QUICK_START.md                # Quick start guide
└── README.md                     # This file
```

## 🔄 Updating Dashboard Data

### Method 1: Batch File (Windows)
1. Place new `data_02_FromConfig.xlsx` in folder
2. Double-click `UPDATE_DATA.bat`
3. Click "Refresh Dashboard" in sidebar (or refresh browser)

### Method 2: Python Script (All platforms)
```bash
python update_data.py
```

### Method 3: Manual
```python
import pandas as pd
import json
import gzip

df = pd.read_excel('data_02_FromConfig.xlsx', sheet_name='data_02_FromConfig')
data = df.to_dict('records')

with gzip.open('data.json.gz', 'wt') as f:
    json.dump(data, f)
```

## 🚀 Deployment

### Deploy to Streamlit Cloud
1. **Prepare repository**
   ```bash
   git init
   git add .
   git commit -m "Dashboard setup"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Deploy on Streamlit**
   - Go to [share.streamlit.io](https://share.streamlit.io)
   - Click "New app"
   - Select your GitHub repository
   - Set main file: `streamlit_app.py`
   - Click "Deploy"

3. **Update data on cloud**
   - Run `UPDATE_DATA.bat` locally
   - Commit and push `data.json.gz`
   - Streamlit auto-redeploys

## 🔐 Access Control

Dashboard requires access codes (configurable in `streamlit_app.py`):
- `FRONT2024`
- `SCOREBOARD2024`

To add/modify codes, edit the `AUTHORIZED_ACCESS_CODES` list in `streamlit_app.py`.

## ⚙️ Configuration

### Change Excel Sheet Name
Edit `update_data.py`:
```python
sheet_name = "data_02_FromConfig"  # Change this
```

### Change Access Codes
Edit `streamlit_app.py`:
```python
AUTHORIZED_ACCESS_CODES = ["FRONT2024", "YOUR_CODE_HERE"]
```

### Adjust Cache Duration
Edit `streamlit_app.py`:
```python
@st.cache_data(ttl=60)  # Cache for 60 seconds
```

## 📊 Data Format

Your Excel file should include these columns:
- `facility` - Facility identifier
- `class_name` - Name of the class
- `class_date` - Date of class session
- `class_end_date` - End date
- `total_bookings` - Number of bookings
- `total_attendees` - Number of attendees
- `instructor_name` - Instructor name
- `instructor_id` - Instructor ID
- `parent_category` - Parent category
- `grandparent_category` - Grandparent category
- `greatgrandparent_category` - Great-grandparent category
- `guid` - Unique identifier
- `session_guid` - Session identifier

## 🐛 Troubleshooting

### Dashboard won't load
- Check that `data.json.gz` exists
- Run `UPDATE_DATA.bat` to regenerate
- Verify all HTML/CSS/JS files are present

### Data not refreshing
- Click "Refresh Dashboard" button in sidebar
- Or restart: `Ctrl+C` then `streamlit run streamlit_app.py`

### Python errors
```bash
pip install --upgrade -r requirements.txt
```

### Excel file not found
- Ensure `data_02_FromConfig.xlsx` is in project folder
- Check filename exactly matches

### Styling issues
- Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Clear browser cache

### Port already in use
```bash
streamlit run streamlit_app.py --server.port 8502
```

## 💡 Tips & Tricks

### Faster Updates
Create a desktop shortcut to `UPDATE_DATA.bat` for one-click updates.

### Scheduled Updates
Use Windows Task Scheduler (or cron on Mac/Linux) to run `update_data.py` automatically.

### Multiple Data Sources
Modify `update_data.py` to combine multiple Excel sheets or files.

### Custom Filters
Edit `index.html` and `app.js` to add custom filtering logic.

### Performance
- Data is compressed (2.2MB vs 16MB Excel)
- Caching enabled (1-minute TTL)
- Lazy loading for large datasets

## 📈 Dashboard Metrics

**Current dataset:**
- 43,087 class records
- Multiple facilities
- 100+ instructors
- Various class categories
- Full historical data

## 🤝 Contributing

This dashboard is maintained by The Front Climbing Club IT team.

For issues or feature requests, contact the IT team.

## 📝 Version History

- **v1.0** - Initial release with improved UI and data pipeline
- Fresh data sync (43,087 records)
- Batch file for easy updates
- Improved filter controls
- Sidebar with metrics
- Local testing support

## 📄 License

Proprietary - The Front Climbing Club

---

**Last Updated:** November 2024
**Data Records:** 43,087
**Status:** ✅ Production Ready
