@echo off
title The Front Dashboard - Data Update
color 0A

echo.
echo  ███████╗██████╗  ██████╗ ███╗   ██╗████████╗
echo  ██╔════╝██╔══██╗██╔═══██╗████╗  ██║╚══██╔══╝
echo  █████╗  ██████╔╝██║   ██║██╔██╗ ██║   ██║
echo  ██╔══╝  ██╔══██╗██║   ██║██║╚██╗██║   ██║
echo  ██║     ██║  ██║╚██████╔╝██║ ╚████║   ██║
echo  ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝
echo.
echo  The Front Climbing Club - Dashboard Data Update
echo  ================================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Python is not installed or not in PATH
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

echo ✅ Python found
echo.

REM Check if Excel file exists
if not exist "data_02_FromConfig.xlsx" (
    echo ❌ Error: data_02_FromConfig.xlsx not found
    echo.
    echo Please place your Excel file in the same folder as this script.
    echo Expected filename: data_02_FromConfig.xlsx
    echo.
    pause
    exit /b 1
)

echo ✅ Excel file found
echo.
echo 🔄 Converting Excel to JSON...
echo.

REM Run the conversion
python update_data.py

if errorlevel 1 (
    echo.
    echo ❌ Conversion failed! Check error messages above.
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ SUCCESS! Dashboard data has been updated.
echo.
echo 📊 Your data.json.gz file is now ready.
echo 🌐 If your dashboard is running, refresh your browser to see new data.
echo.
echo Press any key to exit...
pause >nul
