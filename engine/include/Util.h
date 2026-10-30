#pragma once
#include <cmath>
#include <ctime>
#include <iomanip>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#include "Exceptions.h"

// ---- Generic programming (Unit 6) -------------------------------------
template <typename T>
T clampValue(T v, T lo, T hi) { return v < lo ? lo : (v > hi ? hi : v); }

template <typename T>
double average(const std::vector<T>& v) {
    if (v.empty()) return 0.0;
    double sum = 0.0;
    for (const T& x : v) sum += x;
    return sum / static_cast<double>(v.size());
}

template <typename V>
V lookupOr(const std::map<std::string, V>& table, const std::string& key, V fallback) {
    auto it = table.find(key);
    return it == table.end() ? fallback : it->second;
}

inline double roundTo(double v, int places) {
    const double f = std::pow(10.0, places);
    return std::round(v * f) / f;
}

// ---- Text helpers --------------------------------------------------------
inline std::vector<std::string> split(const std::string& s, char delim) {
    std::vector<std::string> out;
    std::string part;
    std::istringstream in(s);
    while (std::getline(in, part, delim)) out.push_back(part);
    return out;
}

inline std::string trim(const std::string& s) {
    const size_t a = s.find_first_not_of(" \t\r\n");
    if (a == std::string::npos) return "";
    return s.substr(a, s.find_last_not_of(" \t\r\n") - a + 1);
}

inline double toDouble(const std::string& s, const std::string& what) {
    try {
        size_t used = 0;
        const double v = std::stod(s, &used);
        if (used != s.size()) throw std::invalid_argument("trailing characters");
        return v;
    } catch (const std::exception&) {
        throw ValidationException("Invalid number for " + what + ": '" + s + "'");
    }
}

inline int toInt(const std::string& s, const std::string& what, int lo, int hi) {
    const double v = toDouble(s, what);
    if (v != std::floor(v) || v < lo || v > hi)
        throw ValidationException(what + " must be a whole number between " + std::to_string(lo) +
                                  " and " + std::to_string(hi));
    return static_cast<int>(v);
}

// Names end up in '|' separated data files, so they must stay clean.
inline std::string validateName(const std::string& raw, const std::string& what) {
    const std::string name = trim(raw);
    if (name.empty() || name.size() > 60)
        throw ValidationException(what + " must be 1-60 characters");
    for (unsigned char c : name)
        if (c == '|' || c < 32) throw ValidationException(what + " contains an illegal character");
    return name;
}

inline std::string timestampNow() {
    std::time_t t = std::time(nullptr);
    char buf[32];
    std::strftime(buf, sizeof buf, "%Y-%m-%d %H:%M:%S", std::localtime(&t));
    return buf;
}

// ---- Minimal JSON writer (the engine only ever emits JSON) -----------------
inline std::string jsonEscape(const std::string& s) {
    std::string out;
    for (unsigned char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof buf, "\\u%04x", c);
                    out += buf;
                } else {
                    out += static_cast<char>(c);
                }
        }
    }
    return out;
}

class JsonObject {
    std::string body_;
    void key(const std::string& k) {
        if (!body_.empty()) body_ += ',';
        body_ += '"' + jsonEscape(k) + "\":";
    }

public:
    // Overloaded add(): the compiler picks the right one from the value's type.
    JsonObject& add(const std::string& k, const std::string& v) { key(k); body_ += '"' + jsonEscape(v) + '"'; return *this; }
    JsonObject& add(const std::string& k, const char* v) { return add(k, std::string(v)); }
    JsonObject& add(const std::string& k, double v) { key(k); std::ostringstream o; o << std::setprecision(8) << v; body_ += o.str(); return *this; }
    JsonObject& add(const std::string& k, int v) { key(k); body_ += std::to_string(v); return *this; }
    JsonObject& add(const std::string& k, bool v) { key(k); body_ += v ? "true" : "false"; return *this; }
    JsonObject& addRaw(const std::string& k, const std::string& rawJson) { key(k); body_ += rawJson; return *this; }
    std::string str() const { return "{" + body_ + "}"; }
};

class JsonArray {
    std::string body_;

public:
    JsonArray& pushRaw(const std::string& rawJson) { if (!body_.empty()) body_ += ','; body_ += rawJson; return *this; }
    JsonArray& pushString(const std::string& s) { return pushRaw('"' + jsonEscape(s) + '"'); }
    std::string str() const { return "[" + body_ + "]"; }
};
