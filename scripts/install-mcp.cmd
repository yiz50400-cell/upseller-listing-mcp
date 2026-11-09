@echo off
setlocal
node "%~dp0launch.mjs" runtime
if errorlevel 1 exit /b 1
pushd "%~dp0.." || exit /b 1
call npm ci --omit=dev --ignore-scripts --no-audit --no-fund
if errorlevel 1 (popd & exit /b 1)
if not exist "mcp\.env" copy /y "mcp\.env.example" "mcp\.env" >nul
if errorlevel 1 (popd & exit /b 1)
popd
call npx --yes playwright install chromium >nul 2>&1
echo Dependencies installed. Prefer Codex upseller_login or scripts\login-upseller.cmd, then scripts\check-mcp.cmd.
exit /b 0
