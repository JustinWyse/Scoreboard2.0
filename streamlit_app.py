"""
Scoreboard 3.0 Dashboard
✨ Major Release Features:
- Multi-category comparison (up to 3 categories side-by-side)
- Year-over-year visualization in ALL charts (line graphs + pie charts)
- Side-by-side YoY pie charts for instructors, classes, and facilities
- Verified YoY math (exact same date range comparisons)
- Collapsible sections for focused analysis
- Improved data quality and filter responsiveness
- BigQuery integration for live data (new in 3.1)
"""

import streamlit as st
import json
import gzip
from pathlib import Path
from datetime import datetime, timedelta
import os

# BigQuery integration
try:
    from bigquery_client import BigQueryClient, get_client_from_streamlit_secrets, get_client_from_file
    BIGQUERY_AVAILABLE = True
except ImportError:
    BIGQUERY_AVAILABLE = False

# Page configuration
st.set_page_config(
    page_title="Scoreboard - Version 3.0",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="auto"
)

# Access codes
AUTHORIZED_ACCESS_CODES = ["FRONT2024", "SCOREBOARD2024"]
ADMIN_ACCESS_CODE = "A9!tX#4pQv7$Lm2z"

def check_access():
    """Access control with admin level detection"""
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
        st.session_state.is_admin = False
    
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
        
        st.title("📊 Scoreboard - Version 3.0 Access")
        st.write("Enter access code to view the dashboard:")
        
        # Version info
        st.info(
            "✨ **New in Version 3.0**\n\n"
            "• Year-over-year comparisons with side-by-side pie charts\n"
            "• Multi-category analysis (compare up to 3)\n"
            "• Collapsible sections for focused analysis\n"
            "• Improved data quality and verified math\n\n"
            "⚠️ Please verify data in RGP when possible. "
            "Notify Chief of Staff of any issues."
        )
        
        access_code = st.text_input("Access Code", type="password", key="access_input")
        
        col1, col2, col3 = st.columns([1, 1, 2])
        with col1:
            if st.button("🔓 Access Dashboard", use_container_width=True):
                if access_code == ADMIN_ACCESS_CODE:
                    st.session_state.authenticated = True
                    st.session_state.is_admin = True
                    st.rerun()
                elif access_code in AUTHORIZED_ACCESS_CODES:
                    st.session_state.authenticated = True
                    st.session_state.is_admin = False
                    st.rerun()
                else:
                    st.error("❌ Invalid access code")
        
        st.info("💡 Hint: Check with your administrator for access")
        st.stop()

@st.cache_data(ttl=86400)  # Cache for 24 hours
def load_data_from_bigquery():
    """Load data from BigQuery with 24-hour cache."""
    try:
        # Try Streamlit secrets first (for Streamlit Cloud)
        if hasattr(st, 'secrets') and 'gcp_service_account' in st.secrets:
            client = get_client_from_streamlit_secrets(st.secrets)
        else:
            # Try local credentials file
            local_creds_paths = [
                "credentials/bigquery-service-account copy.json",
                "credentials/bigquery-service-account.json",
                "bigquery-service-account.json"
            ]
            client = None
            for creds_path in local_creds_paths:
                if Path(creds_path).exists():
                    client = get_client_from_file(creds_path)
                    break

            if client is None:
                return None, "No BigQuery credentials found", None

        # Fetch data from instructor_view
        data = client.fetch_instructor_view()

        if data:
            return data, "bigquery:analytics_raw.instructor_view", datetime.now()
        else:
            return None, "BigQuery returned no data", None

    except Exception as e:
        return None, f"BigQuery error: {str(e)}", None


@st.cache_data(ttl=60)  # Cache for 1 minute (file-based fallback)
def load_data_from_file():
    """Load data from local files (fallback)."""
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

                # Get file modification timestamp
                file_mtime = os.path.getmtime(file_path)
                file_timestamp = datetime.fromtimestamp(file_mtime)

                return data, f"file:{path}", file_timestamp
            except Exception as e:
                continue

    return None, "No data files found", None


def load_dashboard_data(use_bigquery=True, force_refresh=False):
    """
    Load data from BigQuery or file fallback.

    Args:
        use_bigquery: Whether to try BigQuery first
        force_refresh: Force cache clear and reload

    Returns:
        Tuple of (data, source, timestamp)
    """
    if force_refresh:
        # Clear caches
        load_data_from_bigquery.clear()
        load_data_from_file.clear()

    # Try BigQuery first if available and requested
    if use_bigquery and BIGQUERY_AVAILABLE:
        data, source, timestamp = load_data_from_bigquery()
        if data:
            return data, source, timestamp
        # BigQuery failed, log the error
        st.session_state['bigquery_error'] = source

    # Fallback to file
    data, source, timestamp = load_data_from_file()
    return data, source, timestamp

def load_file_content(filename):
    """Load HTML/CSS/JS files"""
    possible_locations = [filename, f"local_dashboard/{filename}"]
    
    for location in possible_locations:
        if Path(location).exists():
            with open(location, 'r', encoding='utf-8') as f:
                return f.read()
    return ""

def deduplicate_data(data):
    """Deduplicate data by session_guid - critical fix for SOMA inflation"""
    seen = set()
    deduplicated = []
    
    for record in data:
        guid = record.get('session_guid')
        if guid and guid not in seen:
            seen.add(guid)
            deduplicated.append(record)
        elif not guid:
            deduplicated.append(record)
    
    return deduplicated

def main():
    """Main application"""
    check_access()

    # Initialize session state
    if 'use_bigquery' not in st.session_state:
        st.session_state.use_bigquery = True
    if 'force_refresh' not in st.session_state:
        st.session_state.force_refresh = False

    # Sidebar - FIRST
    st.sidebar.title("📊 Scoreboard")
    st.sidebar.markdown("### Version 3.1")
    st.sidebar.markdown("---")

    # Data source toggle
    st.sidebar.markdown("### Data Source")

    if BIGQUERY_AVAILABLE:
        use_bigquery = st.sidebar.toggle(
            "Use BigQuery (Live)",
            value=st.session_state.use_bigquery,
            help="Toggle between live BigQuery data and local file"
        )
        st.session_state.use_bigquery = use_bigquery
    else:
        st.sidebar.warning("BigQuery not available")
        use_bigquery = False

    # Refresh button
    col1, col2 = st.sidebar.columns(2)
    with col1:
        if st.button("🔄 Refresh", use_container_width=True, help="Clear cache and reload data"):
            st.session_state.force_refresh = True
            st.rerun()

    # Load data
    force_refresh = st.session_state.get('force_refresh', False)
    if force_refresh:
        st.session_state.force_refresh = False

    raw_data, data_source, data_timestamp = load_dashboard_data(
        use_bigquery=use_bigquery,
        force_refresh=force_refresh
    )

    # Deduplicate data
    if raw_data:
        data = deduplicate_data(raw_data)
    else:
        data = []

    # Data info in sidebar
    st.sidebar.markdown("---")
    st.sidebar.markdown("### Data Status")

    if data:
        # Show source indicator
        if data_source and data_source.startswith("bigquery:"):
            st.sidebar.success("🔗 Connected to BigQuery")
            source_display = data_source.replace("bigquery:", "")
        elif data_source and data_source.startswith("file:"):
            st.sidebar.info("📁 Using Local File")
            source_display = data_source.replace("file:", "")
        else:
            source_display = data_source or "Unknown"

        # Show metrics
        col1, col2 = st.sidebar.columns(2)
        with col1:
            st.metric("Raw Records", f"{len(raw_data):,}")
        with col2:
            st.metric("Unique", f"{len(data):,}")

        # Show source info
        st.sidebar.caption(f"📊 {source_display}")

        # Show timestamp
        if data_timestamp:
            st.sidebar.caption(f"📅 Updated: {data_timestamp.strftime('%Y-%m-%d %I:%M %p')}")

        # Show BigQuery error if any
        if 'bigquery_error' in st.session_state and not data_source.startswith("bigquery:"):
            with st.sidebar.expander("⚠️ BigQuery Status", expanded=False):
                st.warning(st.session_state['bigquery_error'])
    else:
        st.sidebar.error("❌ No Data Found")
        if 'bigquery_error' in st.session_state:
            st.error(f"BigQuery: {st.session_state['bigquery_error']}")
        st.error("No data available. Check BigQuery connection or run UPDATE_DATA.bat for local file.")
        st.stop()

    # Control buttons
    st.sidebar.markdown("---")
    
    if st.sidebar.button("🚪 Logout", use_container_width=True):
        st.session_state.authenticated = False
        st.rerun()
    
    # Info section
    st.sidebar.markdown("---")
    st.sidebar.markdown("### ℹ️ Quick Guide")
    with st.sidebar.expander("📖 How to Use", expanded=False):
        st.markdown("""
        **Getting Started:**
        1. Select date range (optional)
        2. Toggle "Compare Year-over-Year" for annual comparisons
        3. Choose filters (instructor, facility, category)
        4. Click "Apply Filters"
        
        **New in 3.0:**
        - ✨ Year-over-year comparison toggle
        - 🔧 Fixed SOMA data duplicates
        - 📊 Improved filter responsiveness
        - 📅 Real data file timestamps
        
        **Tips:**
        - Leave dates blank to see all data
        - Select dates to enable comparisons
        - Use facility toggles for multi-location view
        - Export data via buttons below KPIs
        
        **Need Help?**
        Contact Chief of Staff for assistance.
        """)
    
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
    
    # Build complete dashboard
    complete_dashboard = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Scoreboard - Version 3.0</title>
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
        
        /* Year-over-year toggle styling */
        .comparison-toggle {{
            background: rgba(207, 46, 46, 0.1);
            border: 2px solid var(--front-red);
            border-radius: 8px;
            padding: 0.75rem 1rem;
            cursor: pointer;
            transition: all 0.2s;
        }}
        
        .comparison-toggle:hover {{
            background: rgba(207, 46, 46, 0.2);
        }}
        
        .comparison-toggle input[type="checkbox"] {{
            accent-color: var(--front-red);
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
            min-height: 38px;
        }}
        
        #controls input[type="date"] {{
            position: relative;
            padding-right: 2.5rem;
            cursor: pointer;
            color-scheme: dark;
        }}
        
        #controls input[type="date"]::-webkit-calendar-picker-indicator {{
            cursor: pointer;
            opacity: 1;
            filter: invert(0.8);
            position: absolute;
            right: 0.5rem;
            width: 1.25rem;
            height: 1.25rem;
        }}
        
        #controls input[type="date"]::-webkit-datetime-edit {{
            padding: 0;
            color: var(--front-text-primary, #f0f6fc);
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
        // Inject deduplicated data
        window.dashboardData = {json.dumps(data)};
        
        // Inject admin access status
        window.isAdmin = {str(st.session_state.get('is_admin', False)).lower()};
        
        // Category analysis
        {category_js}
        
        // Main dashboard JavaScript
        {js_content}
        
        // Auto-initialize
        if (typeof loadData === 'function') {{
            document.addEventListener('DOMContentLoaded', function() {{
                console.log('📊 Scoreboard 3.0 loaded with', window.dashboardData.length, 'unique records');
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
