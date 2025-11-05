"""
Small helper script to copy the binary data file into this folder.
Run this from the repo_2.0 folder (or provide the path to the original repo) to copy the `local_dashboard/data.json.gz` file here so you can upload it to GitHub.
"""
import shutil
import os

SRC = os.path.abspath(os.path.join('..', 'local_dashboard', 'data.json.gz'))
DST = os.path.abspath('data.json.gz')

if not os.path.exists(SRC):
    print('Source data file not found:', SRC)
else:
    shutil.copy2(SRC, DST)
    print('Copied', SRC, '->', DST)
