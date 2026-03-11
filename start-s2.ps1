#Requires -Version 5.1
<#
.SYNOPSIS
    Uruchamia wszystkie usługi Stanowiska 2 — ThinFilmLab 2 (GasLab)
    Przeznaczony do wywołania automatycznie przy starcie/logowaniu (bez interakcji).

.DESCRIPTION
    Kolejność uruchamiania:
      1. InfluxDB v2      (Docker Compose)         → http://localhost:8086  [opcjonalne]
      2. Backend Express  (node server/server.js)  → http://localhost:3005  [baza: sobkow2]
      3. Frontend Vite                             → http://localhost:3002

    Logi sesji: E:\BasiaLab1\logs\startup_s2_YYYY-MM-DD.log
    Logi backendu: E:\BasiaLab1\logs\backend_s2_YYYY-MM-DD.log

.NOTES
    ── Rejestracja autostartu przy logowaniu ──────────────────────────────────
    Uruchom raz jako Administrator w PowerShell:

        $action  = New-ScheduledTaskAction `
                     -Execute   "powershell.exe" `
                     -Argument  "-NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File E:\BasiaLab1\start-s2.ps1"
        $trigger  = New-ScheduledTaskTrigger -AtLogon
        $settings = New-ScheduledTaskSettingsSet -RunOnlyIfNetworkAvailable:$false `
                      -ExecutionTimeLimit (New-TimeSpan -Hours 0)
        Register-ScheduledTask `
          -TaskName "ThinFilmLab-S2-Autostart" `
          -Action   $action `
          -Trigger  $trigger `
          -RunLevel Highest `
          -Settings $settings `
          -Description "Autostart Stanowisko 2 (ThinFilmLab 2 / GasLab)" `
          -Force

    Zarządzanie zadaniem:
        Start-ScheduledTask   -TaskName "ThinFilmLab-S2-Autostart"   # uruchom ręcznie
        Stop-ScheduledTask    -TaskName "ThinFilmLab-S2-Autostart"   # zatrzymaj zadanie
        Unregister-ScheduledTask -TaskName "ThinFilmLab-S2-Autostart" -Confirm:$false  # usuń

    Sprawdzenie polityki wykonywania skryptów:
        Get-ExecutionPolicy -Scope CurrentUser
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#>

$ErrorActionPreference = "Continue"

# ── Konfiguracja ──────────────────────────────────────────────────────────────
$S2_DIR        = "E:\BasiaLab1"
$BACKEND_PORT  = 3005
$FRONTEND_PORT = 3002
$LOG_DIR       = "$S2_DIR\logs"
$DATE_STAMP    = Get-Date -Format "yyyy-MM-dd"
$LOG_FILE      = "$LOG_DIR\startup_s2_$DATE_STAMP.log"
$BACKEND_LOG   = "$LOG_DIR\backend_s2_$DATE_STAMP.log"

# Dodaj Node.js do PATH (potrzebne gdy skrypt uruchamiany przez Task Scheduler)
$env:PATH = "C:\Program Files\nodejs;$env:PATH"

# ── Funkcje ───────────────────────────────────────────────────────────────────
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}

function Write-Log {
    param([string]$Msg, [string]$Level = "INFO")
    $ts   = Get-Date -Format "HH:mm:ss"
    $line = "[$ts][$Level] $Msg"
    $color = switch ($Level) {
        "OK"    { "Green"  }
        "WARN"  { "Yellow" }
        "ERR"   { "Red"    }
        default { "Gray"   }
    }
    Write-Host $line -ForegroundColor $color
    Add-Content -Path $LOG_FILE -Value $line -Encoding UTF8
}

function Test-Port {
    param([int]$Port)
    try {
        $tcp = [System.Net.Sockets.TcpClient]::new()
        $result = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne(500)
        $tcp.Dispose()
        return $success
    } catch { return $false }
}

function Wait-ForPort {
    param([int]$Port, [int]$TimeoutSec = 40, [string]$Name = "usługa")
    $elapsed = 0
    while (-not (Test-Port -Port $Port) -and $elapsed -lt $TimeoutSec) {
        Start-Sleep -Seconds 2
        $elapsed += 2
        Write-Log "  Czekam na $Name (:$Port)... ${elapsed}s/${TimeoutSec}s"
    }
    return (Test-Port -Port $Port)
}

function Start-Minimized {
    param([string]$Title, [string]$Command)
    Start-Process powershell.exe `
        -ArgumentList "-NoExit", "-NonInteractive", "-Command",
            "`$host.UI.RawUI.WindowTitle = '$Title'; $Command" `
        -WindowStyle Minimized
}

# ── START ─────────────────────────────────────────────────────────────────────
Write-Log "════════════════════════════════════════════════"
Write-Log " START  Stanowisko 2 — ThinFilmLab 2 (GasLab)"
Write-Log " $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Log "════════════════════════════════════════════════"

# 1. ─ InfluxDB (Docker Compose) ─────────────────────────────────────────────
Write-Log "[1/3] InfluxDB (Docker Compose)..."
if (Test-Port -Port 8086) {
    Write-Log "  InfluxDB już działa na :8086 — pomijam" "OK"
} else {
    try {
        Push-Location $S2_DIR
        $out = docker compose up -d 2>&1
        $out | ForEach-Object { Write-Log "  $_" }
        Pop-Location
        Write-Log "  InfluxDB uruchomiony → http://localhost:8086" "OK"
    } catch {
        Pop-Location
        Write-Log "  Docker niedostępny — kontynuuję bez InfluxDB: $_" "WARN"
    }
}

# 2. ─ Backend Express :3005 ───────────────────────────────────────────────────
Write-Log "[2/3] Backend S2 (Express :$BACKEND_PORT, baza: sobkow2)..."
if (Test-Port -Port $BACKEND_PORT) {
    Write-Log "  Backend już nasłuchuje na :$BACKEND_PORT — pomijam" "OK"
} else {
    $backendCmd = "Set-Location '$S2_DIR'; " +
        "node server\server.js *>&1 | " +
        "ForEach-Object { `$_ | Tee-Object -FilePath '$BACKEND_LOG' -Append; Write-Host `$_ }"
    Start-Minimized -Title "TFL S2 — Backend :$BACKEND_PORT" -Command $backendCmd

    if (Wait-ForPort -Port $BACKEND_PORT -TimeoutSec 40 -Name "backend S2") {
        Write-Log "  Backend S2 gotowy → http://localhost:$BACKEND_PORT/api/health" "OK"
    } else {
        Write-Log "  Backend S2 nie odpowiada po 40s — sprawdź: $BACKEND_LOG" "WARN"
    }
}

# 3. ─ Frontend Vite :3002 ─────────────────────────────────────────────────────
Write-Log "[3/3] Frontend S2 (Vite :$FRONTEND_PORT)..."
if (Test-Port -Port $FRONTEND_PORT) {
    Write-Log "  Frontend już nasłuchuje na :$FRONTEND_PORT — pomijam" "OK"
} else {
    $frontendCmd = "Set-Location '$S2_DIR'; node_modules\.bin\vite --port $FRONTEND_PORT"
    Start-Minimized -Title "TFL S2 — Frontend :$FRONTEND_PORT" -Command $frontendCmd

    if (Wait-ForPort -Port $FRONTEND_PORT -TimeoutSec 20 -Name "frontend S2") {
        Write-Log "  Frontend S2 gotowy → http://localhost:$FRONTEND_PORT" "OK"
    } else {
        Write-Log "  Frontend S2 startuje — otwórz http://localhost:$FRONTEND_PORT za chwilę" "INFO"
    }
}

# ── PODSUMOWANIE ──────────────────────────────────────────────────────────────
Write-Log "════════════════════════════════════════════════"
Write-Log " Stanowisko 2 uruchomione                    "
Write-Log "  Dashboard : http://localhost:$FRONTEND_PORT"
Write-Log "  API health: http://localhost:$BACKEND_PORT/api/health"
Write-Log "  InfluxDB  : http://localhost:8086"
Write-Log "  Logi      : $LOG_DIR"
Write-Log "════════════════════════════════════════════════"
