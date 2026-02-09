#!/bin/bash

echo "============================================"
echo " DevDash - Developer Dashboard"
echo "============================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

# Check if .NET is installed
if ! command -v dotnet &> /dev/null; then
    echo "ERROR: .NET SDK is not installed. Please install .NET 8 SDK"
    exit 1
fi

# Check if secrets.config.json exists
if [ ! -f "DevDash.API/config/secrets.config.json" ]; then
    echo ""
    echo "WARNING: secrets.config.json not found!"
    echo "Creating from template..."
    cp "DevDash.API/config/secrets.config.json.template" "DevDash.API/config/secrets.config.json"
    echo ""
    echo "Please edit DevDash.API/config/secrets.config.json with your PAT tokens."
    echo "See INSTRUCTIONS.md for how to generate tokens."
    echo ""
    read -p "Press Enter to continue..."
fi

# Install npm dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
    echo ""
fi

# Start both backend and frontend
echo "Starting DevDash..."
echo ""
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo "Swagger:  http://localhost:5000/swagger"
echo ""
echo "Press Ctrl+C to stop both servers."
echo "============================================"
echo ""

npm run dev
