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
echo Dependencies installed. Fill mcp\.env locally, then run scripts\check-mcp.cmd.
exit /b 0
