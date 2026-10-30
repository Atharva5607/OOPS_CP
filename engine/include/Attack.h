#pragma once
#include <memory>
#include <string>
#include <vector>

#include "Asset.h"

// Abstract attack. The simulation only ever talks to `const Attack&`; each
// derived class supplies its own behaviour through the virtual methods
// (runtime polymorphism / dynamic binding).
class Attack : public IJsonSerializable {
    std::string key_, name_, description_;
    double power_;                 // base strength 0..100 (private: hidden formula input)
    inline static int live_ = 0;   // static data member: attacks currently alive

protected:
    Attack(const std::string& key, const std::string& name, const std::string& description, double power)
        : key_(key), name_(name), description_(description), power_(power) { ++live_; }

public:
    virtual ~Attack() { --live_; }
    static int liveCount() { return live_; }  // static method

    const std::string& key() const { return key_; }
    const std::string& name() const { return name_; }
    const std::string& description() const { return description_; }
    double power() const { return power_; }

    virtual double damageFactor() const = 0;                              // how destructive on success
    virtual double defenseBypass() const { return 0.0; }                  // share of defenses it evades
    virtual std::vector<std::string> attackPath(const Asset& target) const = 0;

    // Attack strength against a concrete target: base power, scaled by how exposed
    // this kind of asset is and by how vulnerable this particular asset is.
    double strengthAgainst(const Asset& target) const {
        return clampValue(power_ * target.exposureTo(key_) * (0.5 + target.vulnerability()), 0.0, 100.0);
    }

    std::string toJson() const override {
        return JsonObject().add("key", key_).add("name", name_).add("description", description_)
            .add("power", power_).add("bypass", defenseBypass()).str();
    }
};

class PhishingAttack : public Attack {
public:
    PhishingAttack() : Attack("phishing", "Phishing", "Deceptive emails that trick staff into handing over credentials.", 70) {}
    double damageFactor() const override { return 0.8; }
    double defenseBypass() const override { return 0.15; }  // targets people, not perimeter
    std::vector<std::string> attackPath(const Asset& t) const override {
        return {"Recon on staff", "Spoofed email crafted", "Delivered to inbox", "Credentials harvested", "Foothold on " + t.name()};
    }
};

class BruteForceAttack : public Attack {
public:
    BruteForceAttack() : Attack("bruteforce", "Brute Force", "Automated password guessing against exposed login services.", 60) {}
    double damageFactor() const override { return 0.7; }
    std::vector<std::string> attackPath(const Asset& t) const override {
        return {"Port scan", "Login service found", "Credential stuffing", "Account takeover", "Access to " + t.name()};
    }
};

class MalwareAttack : public Attack {
public:
    MalwareAttack() : Attack("malware", "Malware", "Malicious payload that executes on a host and spreads.", 75) {}
    double damageFactor() const override { return 1.2; }
    std::vector<std::string> attackPath(const Asset& t) const override {
        return {"Payload delivered", "Dropper executes", "Persistence installed", "Lateral spread", "Compromise of " + t.name()};
    }
};

class RansomwareAttack : public Attack {
public:
    RansomwareAttack() : Attack("ransomware", "Ransomware", "Encrypts business data and demands payment for the key.", 85) {}
    double damageFactor() const override { return 1.6; }
    std::vector<std::string> attackPath(const Asset& t) const override {
        return {"Initial access", "Privilege escalation", "Backups discovered", "Files encrypted", "Ransom note on " + t.name()};
    }
};

class SQLInjectionAttack : public Attack {
public:
    SQLInjectionAttack() : Attack("sqli", "SQL Injection", "Crafted input that makes a database run attacker-chosen queries.", 70) {}
    double damageFactor() const override { return 1.3; }
    std::vector<std::string> attackPath(const Asset& t) const override {
        return {"Find input form", "Inject payload", "Query manipulated", "Data dumped", "Records exposed on " + t.name()};
    }
};

class DDoSAttack : public Attack {
public:
    DDoSAttack() : Attack("ddos", "DDoS", "Floods a service with traffic until legitimate users are locked out.", 72) {}
    double damageFactor() const override { return 0.9; }
    std::vector<std::string> attackPath(const Asset& t) const override {
        return {"Botnet assembled", "Traffic flood launched", "Bandwidth saturated", "Service degraded", "Outage on " + t.name()};
    }
};

class ZeroDayAttack : public Attack {
public:
    ZeroDayAttack() : Attack("zeroday", "Zero-Day", "Exploits an unknown flaw that signature-based tools cannot recognise.", 92) {}
    double damageFactor() const override { return 1.5; }
    double defenseBypass() const override { return 0.35; }  // no signature exists yet
    std::vector<std::string> attackPath(const Asset& t) const override {
        return {"Unknown flaw found", "Exploit crafted", "Signature checks evaded", "Remote code execution", "Full control of " + t.name()};
    }
};

inline const std::vector<std::string>& allAttackKeys() {
    static const std::vector<std::string> keys = {"phishing", "bruteforce", "malware", "ransomware", "sqli", "ddos", "zeroday"};
    return keys;
}

inline Attack* createAttack(const std::string& key) {
    if (key == "phishing") return new PhishingAttack();
    if (key == "bruteforce") return new BruteForceAttack();
    if (key == "malware") return new MalwareAttack();
    if (key == "ransomware") return new RansomwareAttack();
    if (key == "sqli") return new SQLInjectionAttack();
    if (key == "ddos") return new DDoSAttack();
    if (key == "zeroday") return new ZeroDayAttack();
    throw ValidationException("Unknown attack type: " + key);
}

inline std::unique_ptr<Attack> makeAttack(const std::string& key) { return std::unique_ptr<Attack>(createAttack(key)); }
