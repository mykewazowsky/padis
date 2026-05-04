$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ProjectRoot

& python -m backend.scripts.cli.padis @args
exit $LASTEXITCODE
