# Start both Node.js backend and Python summarization service

Write-Host "Starting MeetGuide Services..." -ForegroundColor Green

# Start Python summarization service in background
Write-Host "`n1. Starting Python Summarization Service on port 8001..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\Final_MeetGuide\meet-guide-components\meeting-summarization-system; .\venv\Scripts\activate; python web_server.py --port 8001"

# Wait a bit for Python service to start
Start-Sleep -Seconds 3

# Start Node.js backend
Write-Host "`n2. Starting Node.js Backend..." -ForegroundColor Cyan
cd D:\Final_MeetGuide\meet-guide-backend
npm start
