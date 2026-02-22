# Quick Start Script for Hybrid Detection Backend
# Run this script to start the FastAPI backend with hybrid detection

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MeetGuide Backend - Starting..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if virtual environment exists
if (Test-Path "venv") {
    Write-Host "✓ Virtual environment found" -ForegroundColor Green
    .\venv\Scripts\Activate.ps1
} else {
    Write-Host "! Virtual environment not found. Creating one..." -ForegroundColor Yellow
    python -m venv venv
    .\venv\Scripts\Activate.ps1
    Write-Host "✓ Virtual environment created" -ForegroundColor Green
}

# Check if requirements are installed
Write-Host "`nChecking dependencies..." -ForegroundColor Cyan
$needsInstall = $false

try {
    python -c "import fastapi" 2>&1 | Out-Null
} catch {
    $needsInstall = $true
}

if ($needsInstall) {
    Write-Host "! Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
}

# Check for spacy model
Write-Host "`nChecking Spacy model..." -ForegroundColor Cyan
try {
    python -c "import spacy; spacy.load('en_core_web_sm')" 2>&1 | Out-Null
    Write-Host "✓ Spacy model found" -ForegroundColor Green
} catch {
    Write-Host "! Spacy model not found. Downloading..." -ForegroundColor Yellow
    python -m spacy download en_core_web_sm
    Write-Host "✓ Spacy model downloaded" -ForegroundColor Green
}

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "`n! Warning: .env file not found" -ForegroundColor Yellow
    Write-Host "  Create a .env file from .env.example" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Starting FastAPI Server..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "API will be available at: http://localhost:8000" -ForegroundColor Green
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the server
python main.py
