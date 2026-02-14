
$files = @(
    "d:\BAS-LIVE\BAS-SOFTWARE\Frontend\public\js\wh-purchase.js",
    "d:\BAS-LIVE\BAS-SOFTWARE\Frontend\public\js\wh-purchase-return.js"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = [System.IO.File]::ReadAllBytes($file)
        $clean = $content | Where-Object { $_ -ne 0 }
        [System.IO.File]::WriteAllBytes($file, $clean)
        Write-Host "Fixed $file"
    }
}
