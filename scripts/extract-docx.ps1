# Extracts plain text from a Word document (unpacks word/document.xml).
# Requires: docs/project/Admin App Usage Flow.docx
$root = Split-Path $PSScriptRoot -Parent
$zip = Join-Path $root 'docs\project\Admin App Usage Flow.docx'
if (-not (Test-Path -LiteralPath $zip)) {
  Write-Error "Missing file: $zip"
  exit 1
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($zip)
$e = $z.GetEntry('word/document.xml')
$sr = New-Object System.IO.StreamReader($e.Open())
$xml = $sr.ReadToEnd()
$sr.Close()
$z.Dispose()
$text = $xml -replace '</w:p>', "`n" -replace '<[^>]+>', ' '
$text = [System.Net.WebUtility]::HtmlDecode($text)
$out = Join-Path $root 'docs\notes\admin-flow-extracted.txt'
$text -replace '[ \t]+', ' ' | Set-Content -Path $out -Encoding UTF8
Write-Host "Wrote $out"
