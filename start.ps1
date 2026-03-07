Write-Host " Starting MindfulChat Sentiment Service..." -ForegroundColor Green
$sentimentJob = Start-Job -ScriptBlock {
    Set-Location "$using:PWD\sentiment_service"
    python app.py
}

Start-Sleep -Seconds 5  # reduced wait time since we can check job status

# Check if sentiment service started successfully
$jobOutput = Receive-Job -Job $sentimentJob
if ($sentimentJob.State -eq 'Failed') {
    Write-Host " Error starting sentiment service!" -ForegroundColor Red
    Remove-Job -Job $sentimentJob
    exit 1
}

try {
    Write-Host " Starting Node.js MindfulChat Backend..." -ForegroundColor Cyan
    Set-Location "$PSScriptRoot\backend"
    npm run dev
}
finally {
    # Cleanup
    Write-Host " Stopping Background Services..." -ForegroundColor Yellow
    Stop-Job -Job $sentimentJob
    Remove-Job -Job $sentimentJob
}
