Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   🚀 BIZBOT AI SYSTEM IS STARTING..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Backend Setup
if (!(Test-Path "venv")) {
    Write-Host "[!] Virtual environment not found. Creating and installing requirements..." -ForegroundColor Yellow
    python -m venv venv
    & venv/Scripts/pip install -r requirements.txt
}

if (!(Test-Path ".env")) {
    Write-Host "[!] .env not found. Creating from example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
}

# 2. Start Backend
Write-Host "📦 Launching Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"`$Host.UI.RawUI.WindowTitle='BIZBOT Backend (Port 8000)'; . venv/Scripts/activate; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`""

# 3. Start Frontend
Write-Host "🎨 Launching Frontend... (Checking NPM packages)" -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"`$Host.UI.RawUI.WindowTitle='BIZBOT Frontend (Port 5173)'; cd frontend; npm install; npm run dev`""

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ BIZBOT IS INITIALIZING!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Wait for the new windows to finish loading."
Write-Host "🌐 UI: http://localhost:5173"
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit this launcher..."
