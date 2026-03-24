param(
  [string]$TagName = "",
  [string]$BundlePath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not $TagName) {
  $TagName = (git tag --list "backup-*" --sort=-creatordate | Select-Object -First 1).Trim()
}

if (-not $TagName) {
  throw "No backup tags found (pattern: backup-*)."
}

if (-not $BundlePath) {
  $BundlePath = Join-Path $repoRoot ("backups/gemaraca-" + $TagName + ".bundle")
}

$localTag = git rev-parse -q --verify ("refs/tags/" + $TagName) 2>$null
if ($LASTEXITCODE -ne 0 -or -not $localTag) {
  throw "Local tag '$TagName' was not found."
}

$originTag = (git ls-remote --tags origin | Select-String ("refs/tags/" + $TagName + "$|refs/tags/" + $TagName + "\^\{\}$") | Out-String).Trim()
if (-not $originTag) {
  throw "Tag '$TagName' was not found on origin."
}

$oldOriginTag = (git ls-remote --tags old-origin | Select-String ("refs/tags/" + $TagName + "$|refs/tags/" + $TagName + "\^\{\}$") | Out-String).Trim()
if (-not $oldOriginTag) {
  throw "Tag '$TagName' was not found on old-origin."
}

if (-not (Test-Path $BundlePath)) {
  throw "Bundle file not found: $BundlePath"
}

$bundleVerify = git bundle verify $BundlePath

$embedCount = (Select-String -Path "src/pages/EmbedPdfViewerPage.tsx" -Pattern "textColumnCount|doc-search|sendBeautifyCmd|iconBarPinned|columnCount|rightColumnCount" | Measure-Object).Count
$tmplCount = (Select-String -Path "src/lib/psakDinTemplates.ts" -Pattern "postState|window\.parent|psak-search-state|mousedown" | Measure-Object).Count

Write-Host "Backup verification passed"
Write-Host "Tag: $TagName"
Write-Host "Bundle: $BundlePath"
Write-Host "EmbedPdf feature matches: $embedCount"
Write-Host "Template feature matches: $tmplCount"
Write-Host ""
Write-Host $bundleVerify
