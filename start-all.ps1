# NFC Healthcare - Start All Services Script

Write-Host "ðŸ§¹ Cleaning up old processes..."
$ports = 3000, 3002, 8000
foreach ($port in $ports) {
    $processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($processes) {
        foreach ($proc in $processes) {
            try {
                Stop-Process -Id $proc.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Host "   - Killed process on port $port (PID: $($proc.OwningProcess))"
            } catch {
                Write-Host "   - Could not kill process on port $port"
            }
        }
    }
}
Start-Sleep -Seconds 2

Write-Host "ðŸš€ Starting NFC Healthcare Services..."

# Start Node.js Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start" -WorkingDirectory "c:\Users\IT STORE\Desktop\Nfc-healthcare-card-main"

# Start Python AI Service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python main.py" -WorkingDirectory "c:\Users\IT STORE\Desktop\Nfc-healthcare-card-main"

# Start Next.js Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WorkingDirectory "c:\Users\IT STORE\Desktop\Nfc-healthcare-card-main\nfc-healthcare-frontend"

Write-Host "ðŸš€ All services started!"
Write-Host "Frontend: http://localhost:3002"
Write-Host "Backend: http://localhost:3000"
Write-Host "AI Service: http://localhost:8000"
