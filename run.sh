#!/usr/bin/env sh
cd "$(dirname "$0")"
echo "Open http://127.0.0.1:8000"
python3 -m uvicorn backend.main:app --port 8000
