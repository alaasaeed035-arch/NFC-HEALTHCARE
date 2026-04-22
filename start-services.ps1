# PowerShell script to start both Node.js and Python services
# Usage: .\start-services.ps1

Write-Host "🚀 Starting NFC Healthcare Card System..." -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "   Please copy .env.example to .env and configure your API keys" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        exit
    }
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "   Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if Python is installed
try {
    $pythonVersion = python --version
    Write-Host "✅ Python detected: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python is not installed!" -ForegroundColor Red
    Write-Host "   Please install Python from https://www.python.org/" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan

# Install Node.js dependencies
if (Test-Path "package.json") {
    Write-Host "   Installing Node.js packages..." -ForegroundColor Gray
    npm install --silent
}

# Install Python dependencies
if (Test-Path "requirements.txt") {
    Write-Host "   Installing Python packages..." -ForegroundColor Gray
    pip install -r requirements.txt --quiet
}

Write-Host ""
Write-Host "🎯 Starting services..." -ForegroundColor Cyan
Write-Host ""

# Start Node.js backend in a new window
Write-Host "   🟢 Starting Node.js backend (port 3000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '🟢 Node.js Backend Running' -ForegroundColor Green; node index.js"

# Wait a moment before starting the second service
Start-Sleep -Seconds 2

# Start Python AI service in a new window
Write-Host "   🤖 Starting Python AI service (port 8000)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '🤖 AI Service Running' -ForegroundColor Magenta; python main.py"

Write-Host ""
Write-Host "✅ Both services are starting!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Access points:" -ForegroundColor Cyan
Write-Host "   - Frontend:        http://localhost:3000" -ForegroundColor White
Write-Host "   - Node.js API:     http://localhost:3000/api" -ForegroundColor White
Write-Host "   - AI Service:      http://localhost:8000" -ForegroundColor White
Write-Host "   - AI Service Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: Check the new PowerShell windows for service logs" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C in each window to stop the services" -ForegroundColor Gray
