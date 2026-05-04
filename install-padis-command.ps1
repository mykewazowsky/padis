$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PadisLauncher = Join-Path -Path $ProjectRoot -ChildPath "padis.ps1"

if (-not (Test-Path -LiteralPath $PadisLauncher -PathType Leaf)) {
    Write-Error "padis.ps1 tidak ditemukan di root project: $ProjectRoot"
    exit 1
}

$PadisLauncherPath = (Resolve-Path -LiteralPath $PadisLauncher).Path
$ProfilePath = $PROFILE.CurrentUserCurrentHost

if (-not $ProfilePath) {
    $ProfilePath = [string]$PROFILE
}

$ProfileDir = Split-Path -Parent $ProfilePath

if (-not (Test-Path -LiteralPath $ProfileDir -PathType Container)) {
    New-Item -ItemType Directory -Path $ProfileDir -Force | Out-Null
}

if (-not (Test-Path -LiteralPath $ProfilePath -PathType Leaf)) {
    New-Item -ItemType File -Path $ProfilePath -Force | Out-Null
}

$ExistingAlias = Get-Alias -Name padis -ErrorAction SilentlyContinue
if ($ExistingAlias) {
    $ExistingDefinition = $ExistingAlias.Definition
    $ExistingPath = $ExistingDefinition

    if (Test-Path -LiteralPath $ExistingDefinition -PathType Leaf) {
        $ExistingPath = (Resolve-Path -LiteralPath $ExistingDefinition).Path
    }

    if ($ExistingPath -ne $PadisLauncherPath) {
        Write-Warning "Alias 'padis' sudah ada dan mengarah ke: $ExistingDefinition"
        Write-Host "Alias tidak diubah otomatis agar konfigurasi PowerShell user tetap aman."
        Write-Host ""
        Write-Host "Jika ingin mengganti manual, edit profile PowerShell:"
        Write-Host "  $ProfilePath"
        Write-Host ""
        Write-Host "Tambahkan atau ubah baris menjadi:"
        Write-Host "  Set-Alias padis '$PadisLauncherPath'"
        exit 2
    }
}

$AliasLine = "Set-Alias padis '$($PadisLauncherPath.Replace("'", "''"))'"
$ProfileContent = Get-Content -LiteralPath $ProfilePath -Raw -ErrorAction SilentlyContinue
$ProfileAliasLines = @()

if ($ProfileContent) {
    $ProfileAliasLines = $ProfileContent -split "`r?`n" | Where-Object {
        $_ -match "^\s*Set-Alias\s+(?:-Name\s+)?padis\b"
    }
}

if ($ProfileAliasLines.Count -gt 0) {
    $ProfileAliasMatchesTarget = $false

    foreach ($Line in $ProfileAliasLines) {
        if ($Line.Contains($PadisLauncherPath) -or $Line.Contains($PadisLauncherPath.Replace("'", "''"))) {
            $ProfileAliasMatchesTarget = $true
            break
        }
    }

    if ($ProfileAliasMatchesTarget) {
        Write-Host "Alias 'padis' sudah terpasang di profile PowerShell."
    } else {
        Write-Warning "Profile PowerShell sudah memiliki alias 'padis' yang mengarah ke target berbeda."
        Write-Host "Alias tidak diubah otomatis agar konfigurasi PowerShell user tetap aman."
        Write-Host ""
        Write-Host "Edit manual profile PowerShell jika ingin mengganti alias:"
        Write-Host "  $ProfilePath"
        Write-Host ""
        Write-Host "Gunakan baris:"
        Write-Host "  $AliasLine"
        exit 2
    }
} elseif ($ProfileContent -and $ProfileContent.Contains($AliasLine)) {
    Write-Host "Alias 'padis' sudah terpasang di profile PowerShell."
} else {
    Add-Content -LiteralPath $ProfilePath -Value ""
    Add-Content -LiteralPath $ProfilePath -Value "# PADIS CLI local alias"
    Add-Content -LiteralPath $ProfilePath -Value $AliasLine
    Write-Host "Alias 'padis' berhasil ditambahkan ke profile PowerShell."
}


Write-Host ""
Write-Host "Profile:"
Write-Host "  $ProfilePath"
Write-Host ""
Write-Host "Langkah berikutnya:"
Write-Host "  1. Restart PowerShell"
Write-Host "  2. Jalankan: padis check"
Write-Host "  3. Jalankan: padis start"
