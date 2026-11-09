@echo off
node "%~dp0launch.mjs" doctor
exit /b %errorlevel%
