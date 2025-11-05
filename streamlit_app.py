import streamlit as st
import json
from pathlib import Path
import gzip
from datetime import datetime

st.set_page_config(
    page_title="The Front - Scoreboard",
    layout="wide",
    initial_sidebar_state="collapsed"
)

AUTHORIZED_ACCESS_CODES = ["FRONT2024", "SCOREBOARD2024"]

def check_access():
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
    if not st.session_state.authenticated:
        st.title("The Front - Scoreboard Access")
        st.write("Please enter the access code to view the dashboard:")
        access_code = st.text_input("Access Code", type="password")
        if st.button("Access Dashboard"):
            if access_code in AUTHORIZED_ACCESS_CODES:
                st.session_state.authenticated = True
                st.rerun()
            else:
                st.error("Invalid access code. Please contact The Front for access.")
        st.stop()

@st.cache_data(ttl=10)  # Cache data for only 10 seconds
def load_dashboard_data():
    # Force reload from disk each time
    try:
        st.cache_data.clear()
    except Exception:
        pass
    
    # Try multiple possible locations for the data file
    possible_paths = ["data_json.gz", "data.json.gz", "local_dashboard/data.json.gz"]
    
    for path in possible_paths:
        if Path(path).exists():
            try:
                with gzip.open(path, 'rt') as f:
                    data = json.load(f)
                    return data
            except Exception as e:
                st.error(f"Error loading dashboard data from {path}: {e}")
                continue
    
    st.error(f"Data file not found. Tried: {', '.join(possible_paths)}")
    return []


def get_file_content(filename):
    for path in [filename, f"local_dashboard/{filename}"]:
        if Path(path).exists():
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
    return ""


def main():
    check_access()

    # Hide Streamlit UI for full immersion
    st.markdown("""
    <style>
    .main .block-container {
        padding: 0rem 0rem 0rem 0rem;
        max-width: none;
    }
    header {visibility: hidden;}
    .stDeployButton {display:none;}
    footer {visibility: hidden;}
    #stDecoration {display:none;}
    </style>
    """, unsafe_allow_html=True)

    # Load your ORIGINAL dashboard files
    html_content = get_file_content("index.html")
    css_content = get_file_content("styles.css")
    js_content = get_file_content("app.js")
    category_js = get_file_content("category_analysis.js")

    if not html_content:
        st.error("Original dashboard files not found. Make sure index.html is uploaded.")
        return

    # Load your data
    data = load_dashboard_data()

    # Create the COMPLETE original dashboard
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
        html, body {{ margin: 0; padding: 0; width: 100%; height: 100vh; }}
        </style>
    </head>
    <body>
        {html_content.split('<body>')[1].split('</body>')[0] if '<body>' in html_content else html_content}

        <script>
        // Inject your data
        window.dashboardData = {json.dumps(data)};

        // Your original JavaScript
        {js_content}

        // Category analysis
        {category_js}

        // Auto-load the dashboard
        document.addEventListener('DOMContentLoaded', function() {{
            loadData();
        }});
        </script>
    </body>
    </html>
    """

    # Show record count
    data_count = len(data)
    st.sidebar.info(f"📊 Current Records: {data_count:,}")
    st.sidebar.text(f"Last Updated: {datetime.now().strftime('%I:%M:%S %p')}")

    # Display your ORIGINAL dashboard - FULL SCREEN
    st.components.v1.html(complete_dashboard, height=3000, scrolling=True)

    # Logout button (minimal)
    if st.button("🚪 Logout", key="logout_btn"):
        st.session_state.authenticated = False
        st.rerun()


if __name__ == "__main__":
    main()
