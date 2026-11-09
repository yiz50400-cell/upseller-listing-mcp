@echo off
node "%~dp0launch.mjs" listing %*
exit /b %errorlevel%
