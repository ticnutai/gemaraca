param(
  [string]$TagName = ("backup-" + (Get-Date -Format "yyyy-MM-dd-HHmmss")),
  [string]$BundlePath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not $BundlePath) {
  $BundlePath = Join-Path $repoRoot ("backups/gemaraca-" + $TagName + ".bundle")
}

$bundleDir = Split-Path -Parent $BundlePath
if (-not (Test-Path $bundleDir)) {
  New-Item -ItemType Directory -Path $bundleDir | Out-Null
}

$insideRepo = git rev-parse --is-inside-work-tree 2>$null
if ($insideRepo -ne "true") {
  throw "Not inside a git repository."
}

$existingTag = git rev-parse -q --verify ("refs/tags/" + $TagName) 2>$null
if ($LASTEXITCODE -eq 0 -and $existingTag) {
  throw "Tag '$TagName' already exists. Pick a different tag name."
}

$head = (git rev-parse --short HEAD).Trim()
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$message = "Backup snapshot at commit $head on $timestamp"

Write-Host "[1/4] Creating tag $TagName on $head"
git tag -a $TagName -m $message

Write-Host "[2/4] Pushing tag to origin"
git push origin $TagName

Write-Host "[3/4] Pushing tag to old-origin"
git push old-origin $TagName

Write-Host "[4/4] Creating and verifying bundle: $BundlePath"
git bundle create $BundlePath --all
$verifyOutput = git bundle verify $BundlePath

Write-Host ""
Write-Host "Backup completed successfully"
Write-Host "Tag: $TagName"
Write-Host "Commit: $head"
Write-Host "Bundle: $BundlePath"
Write-Host $verifyOutput
