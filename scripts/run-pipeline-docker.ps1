param(
    [ValidateSet("full", "preprocess", "analysis", "web")]
    [string]$Mode = "full",

    [ValidateSet("flood", "drought", "multi")]
    [string]$Hazard = "flood",

    [string]$Operator = "operator",

    [string]$Image = "padis-pipeline",

    [string]$EnvFile = ".env.pipeline",

    [string]$DataDir = "backend\data",

    [switch]$Build
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location -LiteralPath $ProjectRoot

$Docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $Docker) {
    throw "Docker CLI tidak ditemukan. Install Docker Desktop, lalu buka terminal baru."
}

$Dockerfile = Join-Path -Path $ProjectRoot -ChildPath "Dockerfile.pipeline"
if (-not (Test-Path -LiteralPath $Dockerfile -PathType Leaf)) {
    throw "Dockerfile.pipeline tidak ditemukan di root project."
}

$ResolvedDataDir = Join-Path -Path $ProjectRoot -ChildPath $DataDir
if (-not (Test-Path -LiteralPath $ResolvedDataDir -PathType Container)) {
    throw "Folder data tidak ditemukan: $ResolvedDataDir. Siapkan backend\data terlebih dahulu."
}

$ResolvedEnvFile = Join-Path -Path $ProjectRoot -ChildPath $EnvFile
$HasEnvFile = Test-Path -LiteralPath $ResolvedEnvFile -PathType Leaf
if (-not $HasEnvFile -and -not $env:DATABASE_URL) {
    throw "DATABASE_URL belum tersedia. Buat .env.pipeline dari env.pipeline.example atau set Env:DATABASE_URL."
}

if ($Build) {
    docker build -f $Dockerfile -t $Image $ProjectRoot
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$DockerArgs = @(
    "run",
    "--rm"
)

if ($HasEnvFile) {
    $DockerArgs += @("--env-file", $ResolvedEnvFile)
} else {
    $DockerArgs += @("-e", "DATABASE_URL=$env:DATABASE_URL")
}

$DockerArgs += @(
    "-v", "${ResolvedDataDir}:/app/backend/data",
    $Image,
    "--mode", $Mode,
    "--hazard", $Hazard,
    "--operator", $Operator
)

docker @DockerArgs
exit $LASTEXITCODE
