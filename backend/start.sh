#!/usr/bin/env bash
# NexusLLM Backend Launch Script for Git Bash / MSYS2 / UCRT64

export PATH="/c/Program Files/nodejs:$PATH"

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js not found in /c/Program Files/nodejs"
    exit 1
fi

echo "=========================================================="
echo "  🚀 Starting NexusLLM Backend on http://localhost:3001"
echo "=========================================================="

node server.js
