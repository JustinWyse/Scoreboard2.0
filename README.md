# The Front Climbing Club - Scoreboard Dashboard

A beautiful, interactive dashboard for visualizing class performance metrics at The Front Climbing Club.

## 🚀 Quick Start

### Local Testing

1. **Install Streamlit:**
   ```bash
   pip install streamlit
   ```

2. **Run the dashboard:**
   ```bash
   streamlit run streamlit_app.py
   ```

3. **Access code:** Use `FRONT2024` or `SCOREBOARD2024`

### Deploy to Streamlit Cloud

1. Push this repository to GitHub
2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Connect your GitHub repository
4. Set main file: `streamlit_app.py`
5. Deploy!

## 📁 Project Structure

```
front_dashboard_clean/
├── streamlit_app.py          # Main Streamlit app (handles data loading & auth)
├── index.html                # Dashboard HTML structure
├── styles.css                # Dashboard styling
├── app.js                    # Dashboard JavaScript logic
├── category_analysis.js      # Category analysis functions
├── category_aliases.json     # Category name mappings
├── data.json.gz              # Your dashboard data (compressed)
├── requirements.txt          # Python dependencies
└── README.md                 # This file
```

## 🔄 Updating Data

### Method 1: Replace the data file
1. Generate new `data.json` or `data.json.gz` from your source
2. Replace the existing `data.json.gz` in this folder
3. If running locally, just refresh the browser
4. If on Streamlit Cloud, push to GitHub (auto-redeploys)

### Method 2: Automated refresh (optional)
Create a script that:
1. Processes your Excel file
2. Generates `data.json.gz`
3. Commits and pushes to GitHub
4. Streamlit Cloud auto-updates

## 🎨 Features

- **Interactive filters**: Date range, instructor, facility, category
- **KPI cards**: Quick metrics at a glance
- **Time series charts**: Track trends over time
- **Performance rankings**: Top/bottom performers
- **Category breakdowns**: Analyze by program type
- **Data export**: Download filtered data as CSV/JSON

## 🔐 Access Control

Dashboard requires an access code. Default codes:
- `FRONT2024`
- `SCOREBOARD2024`

To add/change codes, edit the `AUTHORIZED_ACCESS_CODES` list in `streamlit_app.py`.

## ⚙️ Configuration

The dashboard automatically looks for data in these locations (in order):
1. `data.json.gz` (root directory)
2. `data_json.gz` (alternative naming)
3. `local_dashboard/data.json.gz`
4. `data.json` (uncompressed)
5. `local_dashboard/data.json`

## 🐛 Troubleshooting

**Dashboard won't load:**
- Check that all files are present
- Verify `data.json.gz` exists and is not corrupted
- Check browser console for JavaScript errors

**Data not refreshing:**
- Clear Streamlit cache (click ⋮ menu > Clear cache)
- Click the "🔄 Refresh Data" button in sidebar
- Restart the Streamlit app

**Styling issues:**
- Ensure `styles.css` is present
- Check browser console for CSS loading errors
- Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

## 📊 Data Format

Your data should be JSON with these fields:
- `facility`: Facility ID or name
- `class_name`: Name of the class
- `class_date`: Date of the class
- `total_bookings`: Number of bookings
- `total_attendees`: Number of attendees
- `instructor_name`: Instructor name
- `parent_category`, `grandparent_category`, etc.: Category hierarchy

## 📝 License

Proprietary - The Front Climbing Club
