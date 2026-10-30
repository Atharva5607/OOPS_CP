@echo off
rem Builds the C++ engine and runs the C++ tests.
cd /d "%~dp0engine"
g++ -std=c++17 -O2 -Wall -Wextra -Iinclude src/main.cpp src/Reports.cpp -o sentinel_engine.exe || exit /b 1
g++ -std=c++17 -O2 -Wall -Wextra -Iinclude tests/test_engine.cpp src/Reports.cpp -o test_engine.exe || exit /b 1
.\test_engine.exe
