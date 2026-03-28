@echo off
setlocal
title BIZBOT AI System Runner

echo ==========================================
echo    🚀 BIZBOT AI SYSTEM IS STARTING...
echo ==========================================
echo.

:: 1. Backend Auto-Setup
echo 📦 Checking Backend Environment...

:: Ensure Python is available
where python >nul 2>&1
if errorlevel 1 (
    echo [X] Python not found in PATH. Please install Python 3 and try again.
    pause
    exit /b 1
)

:: Create virtual environment if it does not exist
if not exist venv (
    echo [!] Virtual environment not found. Creating one now...
    python -m venv venv
    if errorlevel 1 (
        echo [X] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

:: Activate virtual environment
call venv\Scripts\activate
if errorlevel 1 (
    echo [X] Failed to activate virtual environment.
    pause
    exit /b 1
)

:: Install requirements if not already installed marker exists
if not exist venv\.requirements_installed (
    echo [!] Installing requirements. This may take a minute...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [X] Failed to install Python dependencies.
        pause
        exit /b 1
    )
    > venv\.requirements_installed echo Requirements installed on %DATE% %TIME%
) else (
    echo [=] Requirements already installed. Skipping pip install.
)

if not exist .env (
    echo [!] .env file not found. Creating from example...
    copy .env.example .env
    echo [!] IMPORTANT: Please add your OpenAI Key to the new .env file!
)

:: 2. Launch Backend
echo 🚀 Launching Backend...
start "BIZBOT Backend (Port 8000)" cmd /k "echo Activating venv... && venv\Scripts\activate && echo Starting Uvicorn... && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: 3. Launch Frontend
timeout /t 3 >nul
echo 🎨 Launching Frontend...
start "BIZBOT Frontend (Port 5173)" cmd /k "cd frontend && echo Checking packages... && npm install && echo Starting Vite... && npm run dev"

echo.
echo ==========================================
echo ✅ BIZBOT IS INITIALIZING!
echo.
echo 🔧 If this is the first run, wait for 'pip' and 'npm' to finish.
echo 🌐 UI will be ready at: http://localhost:5173
echo ==========================================
echo.
pause
