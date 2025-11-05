Scoreboard - Minimal upload (repo_2.0)

This folder contains the minimal set of files needed to run the KPI visualizer / scoreboard in Streamlit.

Files included:
- streamlit_app.py        - Streamlit wrapper that embeds the original dashboard and injects data
- requirements.txt       - Python dependencies
- index.html             - Dashboard HTML template
- styles.css             - Dashboard CSS (trimmed copy)
- app.js                 - Main dashboard JS (trimmed note; full file available in original local_dashboard/app.js)
- category_analysis.js   - Category helper functions
- category_aliases.json  - Small mapping JSON used by the dashboard
- copy_data.py           - Helper to copy `local_dashboard/data.json.gz` from the original repo into this folder

Important:
- The processed dataset `data.json.gz` is NOT included here by default to avoid large binary files being accidentally committed.
  To include it for upload, either:
  1) Run `python copy_data.py` from this folder (Windows: double-click or `python copy_data.py` in CMD/PowerShell) to copy the binary `local_dashboard/data.json.gz` from the original repo into this folder.
  2) Manually copy `local_dashboard/data.json.gz` into this folder before uploading.

- Do NOT commit your Excel source files or any secrets.

How to deploy to Streamlit Cloud:
1. Create a new GitHub repo and upload the contents of this folder (after copying `data.json.gz` if you choose to include data).
2. In Streamlit Cloud, point the app to `streamlit_app.py` (root) and ensure the branch is set correctly.
3. Streamlit will install the dependencies from `requirements.txt` and run the app.

If you'd like, I can prepare the full `app.js` (1.4k lines) in this folder as well so the folder is complete. Tell me if you want the full JS included (it will increase file count and size).