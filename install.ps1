<#
.SYNOPSIS
  Loom Installer — Windows PowerShell
.DESCRIPTION
  Installs Loom, a local-first AI coding agent CLI.
  Prefers npm install if Node.js is available.
.PARAMETER InstallDir
  Directory to install to (default: $HOME\.loom\bin)
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install.ps1
#>

param(
  [string]$InstallDir = "$HOME\.loom\bin"
)

$Host.UI.RawUI.WindowTitle = "Installing Loom"

function Write-Step($Text) {
  Write-Host "→ $Text" -ForegroundColor Cyan
}

function Write-Success($Text) {
  Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Error($Text) {
  Write-Host "✗ $Text" -ForegroundColor Red
}

# Check if Node.js is available
$nodePath = (Get-Command "node" -ErrorAction SilentlyContinue).Source
if ($nodePath) {
  Write-Step "Node.js detected at: $nodePath"
  Write-Step "Installing via npm..."
  
  try {
    $output = npm install -g loom-agent 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Success "Loom installed via npm"
      Write-Host ""
      Write-Host "Run: loom <prompt>" -ForegroundColor Green
      exit 0
    } else {
      Write-Error "npm install failed: $output"
    }
  } catch {
    Write-Error "npm install failed: $_"
  }
}

# Ensure install directory exists
if (-not (Test-Path -LiteralPath $InstallDir -PathType Container)) {
  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Check existing PATH
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$InstallDir*") {
  $newPath = "$userPath;$InstallDir"
  [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
  Write-Success "Added $InstallDir to user PATH"
  Write-Host "  (Changes apply to new terminal windows)" -ForegroundColor Cyan
}

# Download pre-built binary (if available) from GitHub releases
$binary = "loom-windows-x64.exe"
$url = "https://github.com/loom/loom-agent/releases/latest/download/$binary"

try {
  Write-Step "Downloading Loom for Windows..."
  Invoke-WebRequest -Uri $url -OutFile "$InstallDir\loom.exe" -ErrorAction Stop
  Write-Success "Loom downloaded to $InstallDir\loom.exe"
} catch {
  Write-Error "Could not download pre-built binary: $_"
  Write-Host ""
  Write-Host "Install Node.js from https://nodejs.org then run:" -ForegroundColor Yellow
  Write-Host "  npm install -g loom-agent" -ForegroundColor Cyan
  exit 1
}

Write-Host ""
Write-Success "Installation complete!"
Write-Host "Run: loom <prompt>" -ForegroundColor Green
