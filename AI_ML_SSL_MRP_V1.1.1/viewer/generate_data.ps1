$rootDocs = @("API_DOCS.md", "ARCHITECTURE.md", "DATABASE_SCHEMA.md", "DEPLOY_GUIDE.md")
$techDocs = Get-ChildItem -Path "system_documentation\technical_reference" -Filter *.md
$userDocs = Get-ChildItem -Path "system_documentation\user_manuals" -Filter *.md

$data = @{
    root = @{}
    technical_reference = @{}
    user_manuals = @{}
}

foreach ($file in $rootDocs) {
    if (Test-Path "system_documentation\$file") {
        $content = Get-Content -Path "system_documentation\$file" -Raw -Encoding UTF8
        $key = [System.IO.Path]::GetFileNameWithoutExtension($file)
        $data.root[$key] = $content
    }
}

foreach ($file in $techDocs) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $key = $file.BaseName
    $data.technical_reference[$key] = $content
}

foreach ($file in $userDocs) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $key = $file.BaseName
    $data.user_manuals[$key] = $content
}

$json = $data | ConvertTo-Json -Depth 10
"const docData = $json;" | Set-Content -Path "viewer\js\data.js" -Encoding UTF8
Write-Host "Data generated successfully"
