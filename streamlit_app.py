"""
The Front Climbing Club - Scoreboard Dashboard
Clean version with automatic data refresh
"""

import streamlit as st
import json
import gzip
from pathlib import Path
from datetime import datetime

# Page config
st.set_page_config(
    page_title="The Front - Scoreboard",
    page_icon="🧗",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Access codes
AUTHORIZED_ACCESS_CODES = ["FRONT2024", "SCOREBOARD2024"]

def check_access():
    """Simple access control"""
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
    
    if not st.session_state.authenticated:
        st.title("🧗 The Front - Scoreboard Access")
        st.write("Please enter the access code to view the dashboard:")
        
        access_code = st.text_input("Access Code", type="password")
        
        if st.button("Access Dashboard"):
            if access_code in AUTHORIZED_ACCESS_CODES:
                st.session_state.authenticated = True
                st.rerun()
            else:
                st.error("Invalid access code. Please contact The Front for access.")
        st.stop()

def load_dashboard_data():
    """Load data from any available location"""
    # Try all possible locations
    possible_paths = [
        "data.json.gz",           # Streamlit Cloud root
        "data_json.gz",           # Alternative naming
        "local_dashboard/data.json.gz",  # Local dev folder
        "data.json",              # Uncompressed fallback
        "local_dashboard/data.json"      # Uncompressed in folder
    ]
    
    for path in possible_paths:
        file_path = Path(path)
        if file_path.exists():
            try:
                # Try compressed first
                if path.endswith('.gz'):
                    with gzip.open(file_path, 'rt', encoding='utf-8') as f:
                        data = json.load(f)
                        st.sidebar.success(f"✅ Loaded from: {path}")
                        st.sidebar.info(f"📊 Records: {len(data):,}")
                        return data
                else:
                    # Try regular JSON
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        st.sidebar.success(f"✅ Loaded from: {path}")
                        st.sidebar.info(f"📊 Records: {len(data):,}")
                        return data
            except Exception as e:
                st.sidebar.warning(f"⚠️ Failed to load {path}: {str(e)}")
                continue
    
    st.error(f"❌ Data file not found. Searched: {', '.join(possible_paths)}")
    return []

def load_file_content(filename):
    """Load HTML/CSS/JS files from available locations"""
    possible_locations = [
        filename,                        # Root directory
        f"local_dashboard/{filename}"    # Subfolder
    ]
    
    for location in possible_locations:
        if Path(location).exists():
            with open(location, 'r', encoding='utf-8') as f:
                return f.read()
    
    return ""

def main():
    """Main application"""
    check_access()
    
    # Hide Streamlit branding
    st.markdown("""
    <style>
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    .main .block-container {
        padding: 0;
        max-width: none;
    }
    iframe {
        border: none;
    }
    </style>
    """, unsafe_allow_html=True)
    
    # Load dashboard files
    html_content = load_file_content("index.html")
    css_content = load_file_content("styles.css")
    js_content = load_file_content("app.js")
    category_js = load_file_content("category_analysis.js")
    
    if not html_content:
        st.error("❌ Dashboard files not found. Make sure index.html is in the repository.")
        st.info("Looking for: index.html, styles.css, app.js")
        return
    
    # Load data with caching disabled for fresh data
    data = load_dashboard_data()
    
    if not data:
        st.warning("⚠️ No data loaded. Dashboard will not display correctly.")
    
    # Extract body content from HTML
    if '<body>' in html_content and '</body>' in html_content:
        body_content = html_content.split('<body>')[1].split('</body>')[0]
    else:
        body_content = html_content
    
    # Build complete dashboard
    complete_dashboard = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>The Front - Scoreboard</title>
        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
        <style>
        {css_content}
        html, body {{
            margin: 0;
            padding: 0;
            width: 100%;
            overflow-x: hidden;
        }}
        </style>
    </head>
    <body>
        {body_content}
        
        <script>
        // Inject data into window
        window.dashboardData = {json.dumps(data)};
        
        // Category analysis functions
        {category_js}
        
        // Main dashboard JavaScript
        {js_content}
        
        // Auto-initialize on load
        if (typeof loadData === 'function') {{
            document.addEventListener('DOMContentLoaded', function() {{
                console.log('Dashboard initializing with', window.dashboardData.length, 'records');
                loadData();
            }});
        }}
        </script>
    </body>
    </html>
    """
    
    # Display dashboard
    st.components.v1.html(complete_dashboard, height=2500, scrolling=True)
    
    # Sidebar info
    st.sidebar.markdown("---")
    st.sidebar.text(f"Last updated: {datetime.now().strftime('%I:%M:%S %p')}")
    
    # Logout button
    if st.sidebar.button("🚪 Logout"):
        st.session_state.authenticated = False
        st.rerun()
    
    # Refresh button to reload data
    if st.sidebar.button("🔄 Refresh Data"):
        st.rerun()

if __name__ == "__main__":
    main()
