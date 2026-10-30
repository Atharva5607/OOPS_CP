#pragma once
#include <stdexcept>
#include <string>

// Custom exception hierarchy (Unit 6). Catch the base to handle everything,
// or a derived type to react to one failure category.
class SentinelException : public std::runtime_error {
public:
    explicit SentinelException(const std::string& msg) : std::runtime_error(msg) {}
    virtual const char* code() const { return "SENTINEL_ERROR"; }
};

class ValidationException : public SentinelException {
public:
    explicit ValidationException(const std::string& msg) : SentinelException(msg) {}
    const char* code() const override { return "VALIDATION_ERROR"; }
};

class FileException : public SentinelException {
public:
    explicit FileException(const std::string& msg) : SentinelException(msg) {}
    const char* code() const override { return "FILE_ERROR"; }
};

class SimulationException : public SentinelException {
public:
    explicit SimulationException(const std::string& msg) : SentinelException(msg) {}
    const char* code() const override { return "SIMULATION_ERROR"; }
};
