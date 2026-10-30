#pragma once
#include <cstdio>
#include <map>
#include <string>

#include "Interfaces.h"
#include "Util.h"

// Abstract base class for everything an attacker can target.
// Data members are private (encapsulation / information hiding); the outside
// world only sees the public methods.
class Asset : public IJsonSerializable, public IPersistable {
    std::string name_;
    double criticality_;    // 1 (minor) .. 10 (business critical)
    double vulnerability_;  // 0 (hardened) .. 1 (wide open)
    double health_;         // 0 (destroyed) .. 100 (fully operational)

protected:
    Asset() : Asset("Unnamed", 5.0, 0.5) {}  // default constructor (delegates)
    Asset(const std::string& name, double criticality, double vulnerability, double health = 100.0)
        : name_(validateName(name, "Asset name")),
          criticality_(criticality),
          vulnerability_(clampValue(vulnerability, 0.0, 1.0)),
          health_(clampValue(health, 0.0, 100.0)) {
        if (criticality < 1.0 || criticality > 10.0)
            throw ValidationException("Asset criticality must be between 1 and 10");
    }
    Asset(const Asset& other) = default;  // copy constructor used by clone()

public:
    virtual ~Asset() {}

    virtual Asset* clone() const = 0;                                   // virtual copy
    virtual std::string type() const = 0;                               // "server", "database", ...
    virtual double exposureTo(const std::string& attackKey) const = 0;  // 0..1, differs per asset kind

    const std::string& name() const { return name_; }
    double criticality() const { return criticality_; }
    double vulnerability() const { return vulnerability_; }
    double health() const { return health_; }

    Asset& setVulnerability(double v) {  // returns *this so calls can be chained
        this->vulnerability_ = clampValue(v, 0.0, 1.0);
        return *this;
    }

    // Overloaded methods (compile-time polymorphism).
    void applyDamage(double amount) { health_ = clampValue(health_ - amount, 0.0, 100.0); }
    void applyDamage(double amount, double mitigation) {
        applyDamage(amount * (1.0 - clampValue(mitigation, 0.0, 1.0)));
    }
    void repair() { health_ = 100.0; }

    std::string toRecord() const override {
        std::ostringstream o;
        o << "asset|" << type() << '|' << name_ << '|' << criticality_ << '|' << vulnerability_ << '|' << health_;
        return o.str();
    }

    std::string toJson() const override {
        return JsonObject().add("name", name_).add("type", type())
            .add("criticality", criticality_)
            .add("vulnerability", roundTo(vulnerability_, 3))
            .add("health", roundTo(health_, 1))
            .str();
    }
};

class Server : public Asset {
public:
    Server(const std::string& name, double criticality = 7.0, double vulnerability = 0.45, double health = 100.0)
        : Asset(name, criticality, vulnerability, health) {}
    Asset* clone() const override { return new Server(*this); }
    std::string type() const override { return "server"; }
    double exposureTo(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"ddos", 1.0}, {"bruteforce", 0.85}, {"zeroday", 0.8},
            {"ransomware", 0.8}, {"malware", 0.7}, {"sqli", 0.3}, {"phishing", 0.3}};
        return lookupOr(t, k, 0.0);
    }
};

class Database : public Asset {
public:
    Database(const std::string& name, double criticality = 9.0, double vulnerability = 0.5, double health = 100.0)
        : Asset(name, criticality, vulnerability, health) {}
    Asset* clone() const override { return new Database(*this); }
    std::string type() const override { return "database"; }
    double exposureTo(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"sqli", 1.0}, {"ransomware", 0.9}, {"zeroday", 0.8},
            {"bruteforce", 0.6}, {"malware", 0.5}, {"ddos", 0.3}, {"phishing", 0.2}};
        return lookupOr(t, k, 0.0);
    }
};

class EmployeeSystem : public Asset {
public:
    EmployeeSystem(const std::string& name, double criticality = 5.0, double vulnerability = 0.6, double health = 100.0)
        : Asset(name, criticality, vulnerability, health) {}
    Asset* clone() const override { return new EmployeeSystem(*this); }
    std::string type() const override { return "employee"; }
    double exposureTo(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"phishing", 1.0}, {"malware", 0.9}, {"ransomware", 0.8},
            {"zeroday", 0.6}, {"bruteforce", 0.5}, {"ddos", 0.2}, {"sqli", 0.1}};
        return lookupOr(t, k, 0.0);
    }
};

class NetworkDevice : public Asset {
public:
    NetworkDevice(const std::string& name, double criticality = 6.0, double vulnerability = 0.4, double health = 100.0)
        : Asset(name, criticality, vulnerability, health) {}
    Asset* clone() const override { return new NetworkDevice(*this); }
    std::string type() const override { return "network"; }
    double exposureTo(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"ddos", 0.95}, {"zeroday", 0.75}, {"bruteforce", 0.7},
            {"malware", 0.4}, {"ransomware", 0.3}, {"phishing", 0.1}, {"sqli", 0.05}};
        return lookupOr(t, k, 0.0);
    }
};

// Factory: builds the right subclass from the type string stored in files / requests.
inline Asset* createAsset(const std::string& type, const std::string& name, double criticality,
                          double vulnerability, double health = 100.0) {
    if (type == "server") return new Server(name, criticality, vulnerability, health);
    if (type == "database") return new Database(name, criticality, vulnerability, health);
    if (type == "employee") return new EmployeeSystem(name, criticality, vulnerability, health);
    if (type == "network") return new NetworkDevice(name, criticality, vulnerability, health);
    throw ValidationException("Unknown asset type: " + type);
}
