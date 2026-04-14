Write-Host "`n Starting MindfulChat..." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor DarkGray

# ── Ensure clean slate ───────────────────────────────────────────────────
Write-Host " Cleaning up old background jobs..." -ForegroundColor DarkGray
Get-Job | Stop-Job -ErrorAction SilentlyContinue
Get-Job | Remove-Job -ErrorAction SilentlyContinue

$envPath = Join-Path $PSScriptRoot "backend\.env"
$sentimentPort = 5000
if (Test-Path $envPath) {
    Get-Content $envPath | Foreach-Object {
        if ($_ -match '^SENTIMENT_SERVICE_PORT=(.*)$') {
            $sentimentPort = $matches[1].Trim()
        }
    }
}

$port_pid = (Get-NetTCPConnection -LocalPort $sentimentPort -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($port_pid) {
    Write-Host " Killing lingering process on port $sentimentPort (PID $port_pid)..." -ForegroundColor Yellow
    Stop-Process -Id $port_pid -Force -ErrorAction SilentlyContinue
}

# ── Step 1: Start Sentiment Service ──────────────────────────────────────
Write-Host "`n[1/2] Starting BERT Sentiment Service..." -ForegroundColor Yellow
$sentimentJob = Start-Job -ScriptBlock {
    Set-Location "$using:PWD\sentiment_service"
    python app.py 2>&1
}

# ── Step 2: Wait for BERT model to fully load ────────────────────────────
$maxRetries = 15
$retryCount = 0
$serviceReady = $false

while ($retryCount -lt $maxRetries -and -not $serviceReady) {
    Start-Sleep -Seconds 2
    $retryCount++

    # Check if the job crashed
    if ($sentimentJob.State -eq 'Failed' -or $sentimentJob.State -eq 'Completed') {
        Write-Host "`n BERT service crashed!" -ForegroundColor Red
        $output = Receive-Job -Job $sentimentJob 2>&1
        Write-Host $output -ForegroundColor Red
        Remove-Job -Job $sentimentJob -Force
        Write-Host "`n Cannot start without BERT model. Exiting.`n" -ForegroundColor Red
        exit 1
    }

    try {
        $health = Invoke-RestMethod -Uri "http://localhost:$sentimentPort/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
        if ($health.model_loaded -eq $true) {
            $serviceReady = $true
            Write-Host " BERT model loaded successfully on [$($health.device)]" -ForegroundColor Green
        } else {
            Write-Host "  Model not loaded yet... (attempt $retryCount/$maxRetries)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  Service starting up... (attempt $retryCount/$maxRetries)" -ForegroundColor DarkGray
    }
}

# ── Hard fail if BERT did not load ────────────────────────────────────────
if (-not $serviceReady) {
    Write-Host "`n BERT model failed to load after $maxRetries attempts!" -ForegroundColor Red
    
    # Print any error output from the sentiment service
    $output = Receive-Job -Job $sentimentJob 2>&1
    if ($output) {
        Write-Host "`nSentiment service output:" -ForegroundColor Yellow
        Write-Host $output
    }
    
    Stop-Job -Job $sentimentJob -ErrorAction SilentlyContinue
    Remove-Job -Job $sentimentJob -Force -ErrorAction SilentlyContinue
    Write-Host "`n Cannot start without BERT model. Exiting.`n" -ForegroundColor Red
    exit 1
}

# ── Step 3: Start Node.js Backend ─────────────────────────────────────────
try {
    Write-Host "`n[2/2] Starting Node.js Backend..." -ForegroundColor Cyan
    Set-Location "$PSScriptRoot\backend"
    npm run dev
}
finally {
    Write-Host "`n Stopping all services..." -ForegroundColor Yellow
    Stop-Job -Job $sentimentJob -ErrorAction SilentlyContinue
    Remove-Job -Job $sentimentJob -Force -ErrorAction SilentlyContinue
    Write-Host " Done." -ForegroundColor Green
}
