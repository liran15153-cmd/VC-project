@echo off
REM ==========================================================================
REM Gaming Vibe Coding - Backend Quick Start (Windows)
REM ==========================================================================

echo.
echo === Gaming Vibe Coding Backend ===
echo.

REM Check Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Get it at https://nodejs.org
    pause
    exit /b 1
)

REM Install deps if node_modules missing
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)

REM Check .env exists
if not exist .env (
    echo .env not found - copying from .env.example
    copy .env.example .env >nul
    echo.
    echo [WARNING] Please edit .env and set OPENROUTER_API_KEY
    echo Create a key at: https://openrouter.ai/keys
    echo.
    pause
)

REM Start server
echo Starting server...
echo.
node server.js
