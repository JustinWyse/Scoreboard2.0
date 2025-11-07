"""
The Front Dashboard - Excel to JSON Converter
Automatically converts data_02_FromConfig.xlsx to data.json.gz
"""

import pandas as pd
import json
import gzip
from pathlib import Path
from datetime import datetime
import sys

def main():
    excel_file = "data_02_FromConfig.xlsx"
    sheet_name = "data_02_FromConfig"
    output_file = "data.json.gz"
    
    print("=" * 60)
    print("The Front Dashboard - Data Converter")
    print("=" * 60)
    print()
    
    # Check if Excel file exists
    if not Path(excel_file).exists():
        print(f"❌ ERROR: Excel file not found: {excel_file}")
        print(f"📂 Current directory: {Path.cwd()}")
        print()
        print("Please ensure the Excel file is in the same folder as this script.")
        return 1
    
    try:
        # Read Excel
        print(f"📂 Reading: {excel_file}")
        print(f"📄 Sheet: {sheet_name}")
        
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        
        print(f"✅ Loaded {len(df):,} rows")
        print(f"📊 Columns: {', '.join(list(df.columns)[:6])}...")
        print()
        
        # Convert date columns to strings for JSON
        date_columns = ['class_date', 'class_end_date']
        for col in date_columns:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce').dt.strftime('%Y-%m-%d')
        
        # Fill NaN values
        df = df.fillna('')
        
        # Convert to list of dictionaries
        data = df.to_dict('records')
        
        # Write compressed JSON
        print(f"💾 Writing: {output_file}")
        with gzip.open(output_file, 'wt', encoding='utf-8') as f:
            json.dump(data, f)
        
        # Get file size
        file_size = Path(output_file).stat().st_size / (1024 * 1024)  # MB
        
        print(f"✅ Success!")
        print()
        print(f"📦 Output file: {output_file}")
        print(f"📏 File size: {file_size:.2f} MB")
        print(f"📊 Records: {len(data):,}")
        print(f"📅 Updated: {datetime.now().strftime('%Y-%m-%d %I:%M:%S %p')}")
        print()
        print("=" * 60)
        
        return 0
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        print()
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
