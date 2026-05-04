$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ProjectRoot

$ProjectPython = Join-Path -Path $ProjectRoot -ChildPath "backend\venv\Scripts\python.exe"

if (Test-Path -LiteralPath $ProjectPython -PathType Leaf) {
    $Python = $ProjectPython
} else {
    $Python = "python"
}

& $Python -m backend.scripts.cli.padis @args
exit $LASTEXITCODE
