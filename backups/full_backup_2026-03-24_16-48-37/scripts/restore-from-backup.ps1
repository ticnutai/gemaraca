param(
  [string]$TagName = "backup-2026-03-18",
  [string]$NewBranch = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$dirty = git status --porcelain
if ($dirty) {
  throw "Working tree is not clean. Commit or stash changes before restore."
}

Write-Host "Fetching tags from remotes"
git fetch origin --tags
git fetch old-origin --tags

$tagRef = git rev-parse -q --verify ("refs/tags/" + $TagName) 2>$null
if ($LASTEXITCODE -ne 0 -or -not $tagRef) {
  throw "Tag '$TagName' not found."
}

if (-not $NewBranch) {
  $safeTag = $TagName -replace "[^a-zA-Z0-9_-]", "-"
  $NewBranch = "restore-" + $safeTag + "-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

Write-Host "Creating restore branch '$NewBranch' from tag '$TagName'"
git switch -c $NewBranch $TagName

$head = (git rev-parse --short HEAD).Trim()
Write-Host "Restore branch is ready"
Write-Host "Branch: $NewBranch"
Write-Host "Commit: $head"
Write-Host ""
Write-Host "If this is the exact point you want, you can merge or reset other branches to it manually."
