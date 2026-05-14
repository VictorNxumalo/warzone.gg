$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$excludeDirs = @("node_modules", ".git")
$allowedFiles = @(
  "c:\personal\warzonegg\warzongg\.env",
  "c:\personal\warzonegg\warzongg\.env.example",
  "c:\personal\warzonegg\warzongg\warzongg-api\.env",
  "c:\personal\warzonegg\warzongg\warzongg-api\.env.example"
)

$patterns = @(
  "SUPABASE_SERVICE_KEY\s*=\s*eyJ[A-Za-z0-9\-_\.]+",
  "SUPABASE_ANON_KEY\s*=\s*eyJ[A-Za-z0-9\-_\.]+",
  "AKIA[0-9A-Z]{16}",
  "-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----"
)

$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $full = $_.FullName
  foreach ($dir in $excludeDirs) {
    if ($full -match [regex]::Escape("\$dir\")) { return $false }
  }
  return $true
}

$hits = @()
foreach ($f in $files) {
  if ($allowedFiles -contains $f.FullName) { continue }
  if ($f.FullName -eq $PSCommandPath) { continue }

  foreach ($p in $patterns) {
    $match = Select-String -Path $f.FullName -Pattern $p -SimpleMatch:$false
    if ($match) {
      $hits += $match
    }
  }
}

if ($hits.Count -gt 0) {
  Write-Host "Potential secrets detected:" -ForegroundColor Red
  $hits | ForEach-Object {
    Write-Host (" - {0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim())
  }
  exit 1
}

Write-Host "No obvious hardcoded secrets found." -ForegroundColor Green
exit 0
