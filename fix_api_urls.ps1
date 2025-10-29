$files = @(
    "backend\templates\admin-applications.js",
    "backend\templates\admin-salons.js",
    "backend\templates\admin-script.js",
    "backend\templates\admin-users.js",
    "backend\templates\booking.js",
    "backend\templates\chat.js",
    "backend\templates\components\navbar.js",
    "backend\templates\customer-home.js",
    "backend\templates\my-bookings.js",
    "backend\templates\reviews.js",
    "backend\templates\salon-application-status.js",
    "backend\templates\salon-owner-dashboard.js"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    $content = $content -replace "https://web-production-e6265.up.railway.app", ""
    Set-Content $file -Value $content -NoNewline
    Write-Host "Fixed: $file"
}

Write-Host "All files updated!"
