@echo off
title NexusLLM Full-Stack AI Chatbox
echo ========================================================
echo       Launching NexusLLM Full-Stack AI Chatbox
echo ========================================================
echo.

:: Ensure Node.js is in PATH
set "PATH=C:\Program Files\nodejs;%PATH%"

:: Check if node is accessible
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in PATH or standard installation.
    echo Please install Node.js or ensure node.exe is in C:\Program Files\nodejs\
    pause
    exit /b 1
)

echo [1/2] Launching Backend Server on http://localhost:3001...
echo [2/2] Opening Chat UI in default web browser...

:: Open browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3001"

:: Run the Node.js backend
node backend/server.js
pause
