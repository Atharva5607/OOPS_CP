#!/usr/bin/env sh
# Builds the C++ engine and runs the C++ tests.
set -e
cd "$(dirname "$0")/engine"
g++ -std=c++17 -O2 -Wall -Wextra -Iinclude src/main.cpp src/Reports.cpp -o sentinel_engine
g++ -std=c++17 -O2 -Wall -Wextra -Iinclude tests/test_engine.cpp src/Reports.cpp -o test_engine
./test_engine
