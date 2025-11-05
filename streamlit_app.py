"""
The Front Climbing Club - Scoreboard Dashboard
FINAL VERSION - Improved UI, Fresh Data, Local Testing Ready
"""

import streamlit as st
import json
import gzip
from pathlib import Path
from datetime import datetime

# Page configuration
st.set_page_config(
    page_title="The Front - Scoreboard",
    page_icon="🧗",
    layout="wide",
    initial_sidebar_state="auto"
)

# Access codes
AUTHORIZED_ACCESS_CODES = ["FRONT2024", "SCOREBOARD2024"]

def check_access():
    """Access control"""
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
    
    if not st.session_state.authenticated:
        # Login page styling
        st.markdown("""
        <style>
        .main {background-color: #0d1117;}
        .stTextInput > div > div > input {
            background-color: #21262d;
            color: #f0f6fc;
            border: 1px solid #30363d;
        }
        </style>
        """, unsafe_allow_html=True)
        
        st.title("🧗 The Front - Scoreboard Access")
        st.write("Enter access code to view the dashboard:")
        
        access_code = st.text_input("Access Code", type="password", key="access_input")
        
        col1, col2, col3 = st.columns([1, 1, 2])
        with col1:
            if st.button("🔓 Access Dashboard", use_container_width=True):
                if access_code in AUTHORIZED_ACCESS_CODES:
                    st.session_state.authenticated = True
                    st.rerun()
                else:
                    st.error("❌ Invalid access code")
        
        st.info("💡 Hint: Check with The Front IT team for access")
        st.stop()

@st.cache_data(ttl=60)  # Cache for 1 minute to allow easy refresh
def load_dashboard_data():
    """Load data from available locations"""
    possible_paths = [
        "data.json.gz",
        "data_json.gz", 
        "local_dashboard/data.json.gz",
        "data.json",
        "local_dashboard/data.json"
    ]
    
    for path in possible_paths:
        file_path = Path(path)
        if file_path.exists():
            try:
                if path.endswith('.gz'):
                    with gzip.open(file_path, 'rt', encoding='utf-8') as f:
                        data = json.load(f)
                else:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                
                return data, path
            except Exception as e:
                continue
    
    return [], None

def load_file_content(filename):
    """Load HTML/CSS/JS files"""
    possible_locations = [filename, f"local_dashboard/{filename}"]
    
    for location in possible_locations:
        if Path(location).exists():
            with open(location, 'r', encoding='utf-8') as f:
                return f.read()
    return ""

def main():
    """Main application"""
    check_access()
    
    # Sidebar - FIRST
    st.sidebar.title("🧗 The Front")
    st.sidebar.markdown("### Scoreboard Dashboard")
    st.sidebar.markdown("---")
    
    # Load data
    data, data_path = load_dashboard_data()
    
    # Data info in sidebar
    if data:
        st.sidebar.success("✅ Data Loaded")
        st.sidebar.metric("📊 Total Records", f"{len(data):,}")
        if data_path:
            st.sidebar.caption(f"Source: `{data_path}`")
    else:
        st.sidebar.error("❌ No Data Found")
        st.error("Data file not found. Run UPDATE_DATA.bat to generate data.json.gz")
        st.stop()
    
    st.sidebar.text(f"Updated:\n{datetime.now().strftime('%I:%M:%S %p')}")
    
    # Control buttons
    st.sidebar.markdown("---")
    if st.sidebar.button("🔄 Refresh Dashboard", use_container_width=True, type="primary"):
        st.cache_data.clear()
        st.rerun()
    
    if st.sidebar.button("🚪 Logout", use_container_width=True):
        st.session_state.authenticated = False
        st.rerun()
    
    # Info section
    st.sidebar.markdown("---")
    st.sidebar.markdown("### ℹ️ Quick Guide")
    st.sidebar.info(
        "**Filters:** Use controls in dashboard\n\n"
        "**Update Data:** Run UPDATE_DATA.bat\n\n"
        "**Refresh:** Click button above"
    )
    
    # Hide Streamlit branding
    st.markdown("""
    <style>
    /* Hide Streamlit elements */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header[data-testid="stHeader"] {background-color: transparent;}
    
    /* Main container */
    .main .block-container {
        padding-top: 1rem;
        padding-bottom: 1rem;
        max-width: none;
    }
    
    /* Sidebar */
    section[data-testid="stSidebar"] > div {
        padding-top: 2rem;
    }
    
    /* Dashboard iframe */
    iframe {
        border: none;
        display: block;
    }
    </style>
    """, unsafe_allow_html=True)
    
    # Load dashboard files
    html_content = load_file_content("index.html")
    css_content = load_file_content("styles.css")
    js_content = load_file_content("app.js")
    category_js = load_file_content("category_analysis.js")
    
    if not html_content:
        st.error("❌ Dashboard files not found")
        st.info("Expected: index.html, styles.css, app.js")
        return
    
    # Extract body content
    if '<body>' in html_content and '</body>' in html_content:
        body_content = html_content.split('<body>')[1].split('</body>')[0]
    else:
        body_content = html_content
    
    # Build complete dashboard with improved styling
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
        
        /* Additional UI improvements */
        html, body {{
            margin: 0;
            padding: 0;
            width: 100%;
            overflow-x: hidden;
        }}
        
        /* Improved filter section */
        .filter-group {{
            background: var(--front-bg-secondary, #161b22);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            border: 1px solid var(--front-border, #30363d);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }}
        
        .filter-group h3 {{
            margin: 0 0 1rem 0;
            color: var(--front-text-primary, #f0f6fc);
            font-size: 1.125rem;
            font-weight: 600;
        }}
        
        /* Better control layout */
        #controls {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1rem;
            align-items: end;
        }}
        
        #controls label {{
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            color: var(--front-text-secondary, #8b949e);
            font-size: 0.875rem;
            font-weight: 500;
        }}
        
        #controls input,
        #controls select {{
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            border: 1px solid var(--front-border, #30363d);
            background: var(--front-bg-primary, #0d1117);
            color: var(--front-text-primary, #f0f6fc);
            font-size: 0.875rem;
            transition: border-color 0.2s;
        }}
        
        #controls input:focus,
        #controls select:focus {{
            outline: none;
            border-color: var(--front-red, #cf2e2e);
        }}
        
        #controls button {{
            padding: 0.625rem 1.25rem;
            border-radius: 6px;
            border: none;
            background: var(--front-red, #cf2e2e);
            color: white;
            font-weight: 600;
            font-size: 0.875rem;
            cursor: pointer;
            transition: all 0.2s;
        }}
        
        #controls button:hover {{
            background: #b52828;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(207, 46, 46, 0.3);
        }}
        
        #controls button:active {{
            transform: translateY(0);
        }}
        
        #controls button#reset,
        #controls button#show_all_cats {{
            background: var(--front-light-gray, #374151);
        }}
        
        #controls button#reset:hover,
        #controls button#show_all_cats:hover {{
            background: var(--front-gray, #6b7280);
        }}
        
        /* Facility toggles - improved */
        .facility-toggles {{
            grid-column: 1 / -1;
            margin-top: 0.5rem;
        }}
        
        .facility-toggles > label {{
            display: block;
            margin-bottom: 0.75rem;
            color: var(--front-text-secondary, #8b949e);
            font-size: 0.875rem;
            font-weight: 600;
        }}
        
        .toggle-group {{
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
        }}
        
        .toggle-group label {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: var(--front-bg-tertiary, #21262d);
            border-radius: 6px;
            border: 2px solid var(--front-border, #30363d);
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.875rem;
            color: var(--front-text-primary, #f0f6fc);
        }}
        
        .toggle-group label:hover {{
            background: var(--front-light-gray, #374151);
            border-color: var(--front-red, #cf2e2e);
        }}
        
        .toggle-group input[type="checkbox"] {{
            cursor: pointer;
            width: 16px;
            height: 16px;
        }}
        
        .toggle-group input[type="checkbox"]:checked + span {{
            font-weight: 600;
        }}
        </style>
    </head>
    <body>
        {body_content}
        
        <script>
        // Inject data
        window.dashboardData = {json.dumps(data)};
        
        // Category analysis
        {category_js}
        
        // Main dashboard JavaScript
        {js_content}
        
        // Auto-initialize
        if (typeof loadData === 'function') {{
            document.addEventListener('DOMContentLoaded', function() {{
                console.log('📊 Dashboard loaded with', window.dashboardData.length, 'records');
                loadData();
            }});
        }}
        </script>
    </body>
    </html>
    """
    
    # Display dashboard
    st.components.v1.html(complete_dashboard, height=3000, scrolling=True)

if __name__ == "__main__":
    main()
