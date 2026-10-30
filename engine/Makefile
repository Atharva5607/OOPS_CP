CXX      ?= g++
CXXFLAGS ?= -std=c++17 -O2 -Wall -Wextra -Iinclude
SRC      := src/main.cpp src/Reports.cpp

all: sentinel_engine

sentinel_engine: $(SRC) $(wildcard include/*.h)
	$(CXX) $(CXXFLAGS) $(SRC) -o $@

test: tests/test_engine.cpp src/Reports.cpp $(wildcard include/*.h)
	$(CXX) $(CXXFLAGS) tests/test_engine.cpp src/Reports.cpp -o test_engine
	./test_engine

clean:
	rm -f sentinel_engine sentinel_engine.exe test_engine test_engine.exe
