@echo off
title DevDash - Developer Dashboard

echo ============================================
echo  DevDash - Developer Dashboard
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed. Please install Node.js 18+
    pause
    exit /b 1
)

:: Check if .NET is installed
where dotnet >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: .NET SDK is not installed. Please install .NET 8 SDK
    pause
    exit /b 1
)

:: Check if secrets.config.json exists
if not exist "DevDash.API\config\secrets.config.json" (
    echo.
    echo WARNING: secrets.config.json not found!
    echo Creating from template...
    copy "DevDash.API\config\secrets.config.json.template" "DevDash.API\config\secrets.config.json" >nul
    echo.
    echo Please edit DevDash.API\config\secrets.config.json with your PAT tokens.
    echo See INSTRUCTIONS.md for how to generate tokens.
    echo.
    pause
)

:: Install npm dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing npm dependencies...
    call npm install
    echo.
)

:: Start both backend and frontend
echo Starting DevDash...
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo Swagger:  http://localhost:5000/swagger
echo.
echo Press Ctrl+C to stop both servers.
echo ============================================
echo.

call npm run dev
