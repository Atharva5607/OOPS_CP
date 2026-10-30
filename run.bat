@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:8000
python -m uvicorn backend.main:app --port 8000
