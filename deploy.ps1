# Deploy the unified system to Firebase (hosting + security rules)
# Usage:  .\deploy.ps1
Set-Location $PSScriptRoot

$cfg = Get-Content "public\core\firebase-config.js" -Raw
if ($cfg -match 'PUT_API_KEY') {
    Write-Host "public\core\firebase-config.js is not configured yet - see README.md" -ForegroundColor Red
    exit 1
}

Write-Host "Deploying rules + hosting..." -ForegroundColor Cyan
firebase deploy --only "firestore:rules,hosting"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Done." -ForegroundColor Green
}
