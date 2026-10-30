#pragma once
#include <map>
#include <string>
#include <vector>

#include "Attack.h"
#include "Interfaces.h"

// Abstract defense. Each kind of defense is good against different attacks,
// expressed by the virtual coverage() table. `level` is the configured
// investment (0..100) and stays private.
class Defense : public IJsonSerializable, public IPersistable {
    std::string key_, name_;
    bool enabled_;
    int level_;

protected:
    Defense(const std::string& key, const std::string& name, bool enabled, int level)
        : key_(key), name_(name), enabled_(enabled), level_(level) {
        if (level < 0 || level > 100) throw ValidationException("Defense level must be between 0 and 100");
    }

public:
    virtual ~Defense() {}
    virtual Defense* clone() const = 0;
    virtual double coverage(const std::string& attackKey) const = 0;  // 0..1 at full level
    virtual double damageReduction() const { return 0.0; }            // share of damage absorbed after a breach

    const std::string& key() const { return key_; }
    const std::string& name() const { return name_; }
    bool enabled() const { return enabled_; }
    int level() const { return level_; }

    void configure(bool enabled, int level) {
        if (level < 0 || level > 100) throw ValidationException("Defense level must be between 0 and 100");
        enabled_ = enabled;
        level_ = level;
    }

    // Overloaded: one attack, or the average over a set of attacks.
    double strengthAgainst(const std::string& attackKey) const {
        return enabled_ ? level_ * coverage(attackKey) : 0.0;
    }
    double strengthAgainst(const std::vector<std::string>& attackKeys) const {
        std::vector<double> v;
        for (const std::string& k : attackKeys) v.push_back(strengthAgainst(k));
        return average(v);
    }

    std::string toRecord() const override {
        return "defense|" + key_ + '|' + (enabled_ ? "1" : "0") + '|' + std::to_string(level_);
    }

    std::string toJson() const override {
        JsonObject cov;
        for (const std::string& k : allAttackKeys()) cov.add(k, coverage(k));
        return JsonObject().add("key", key_).add("name", name_).add("enabled", enabled_).add("level", level_)
            .addRaw("coverage", cov.str()).add("damageReduction", damageReduction()).str();
    }
};

class Firewall : public Defense {
public:
    Firewall(bool enabled = true, int level = 50) : Defense("firewall", "Firewall", enabled, level) {}
    Defense* clone() const override { return new Firewall(*this); }
    double coverage(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"ddos", 0.85}, {"bruteforce", 0.55}, {"sqli", 0.55},
            {"malware", 0.35}, {"ransomware", 0.30}, {"zeroday", 0.25}, {"phishing", 0.05}};
        return lookupOr(t, k, 0.0);
    }
};

class IntrusionDetectionSystem : public Defense {
public:
    IntrusionDetectionSystem(bool enabled = false, int level = 50) : Defense("ids", "Intrusion Detection", enabled, level) {}
    Defense* clone() const override { return new IntrusionDetectionSystem(*this); }
    double coverage(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"bruteforce", 0.65}, {"sqli", 0.60}, {"malware", 0.55},
            {"ddos", 0.50}, {"ransomware", 0.45}, {"zeroday", 0.45}, {"phishing", 0.20}};
        return lookupOr(t, k, 0.0);
    }
};

class Antivirus : public Defense {
public:
    Antivirus(bool enabled = true, int level = 40) : Defense("antivirus", "Antivirus", enabled, level) {}
    Defense* clone() const override { return new Antivirus(*this); }
    double coverage(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"malware", 0.90}, {"ransomware", 0.75}, {"phishing", 0.30}, {"zeroday", 0.30}};
        return lookupOr(t, k, 0.0);
    }
};

class MultiFactorAuthentication : public Defense {
public:
    MultiFactorAuthentication(bool enabled = false, int level = 50) : Defense("mfa", "Multi-Factor Auth", enabled, level) {}
    Defense* clone() const override { return new MultiFactorAuthentication(*this); }
    double coverage(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"bruteforce", 0.90}, {"phishing", 0.55}, {"sqli", 0.10},
            {"ransomware", 0.10}, {"zeroday", 0.10}, {"malware", 0.05}};
        return lookupOr(t, k, 0.0);
    }
};

class Encryption : public Defense {
public:
    Encryption(bool enabled = false, int level = 50) : Defense("encryption", "Encryption", enabled, level) {}
    Defense* clone() const override { return new Encryption(*this); }
    double coverage(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"sqli", 0.35}, {"ransomware", 0.30}, {"bruteforce", 0.25},
            {"malware", 0.20}, {"zeroday", 0.20}, {"phishing", 0.10}};
        return lookupOr(t, k, 0.0);
    }
    double damageReduction() const override { return enabled() ? 0.30 * level() / 100.0 : 0.0; }  // stolen data is unreadable
};

class SecurityTraining : public Defense {
public:
    SecurityTraining(bool enabled = false, int level = 50) : Defense("training", "Awareness Training", enabled, level) {}
    Defense* clone() const override { return new SecurityTraining(*this); }
    double coverage(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"phishing", 0.85}, {"malware", 0.35}, {"ransomware", 0.30},
            {"bruteforce", 0.20}, {"zeroday", 0.10}, {"sqli", 0.05}};
        return lookupOr(t, k, 0.0);
    }
};

class BackupSystem : public Defense {
public:
    BackupSystem(bool enabled = false, int level = 50) : Defense("backup", "Backup System", enabled, level) {}
    Defense* clone() const override { return new BackupSystem(*this); }
    double coverage(const std::string& k) const override {
        static const std::map<std::string, double> t = {{"ransomware", 0.40}, {"malware", 0.15}, {"zeroday", 0.10}};
        return lookupOr(t, k, 0.0);
    }
    double damageReduction() const override { return enabled() ? 0.60 * level() / 100.0 : 0.0; }  // restore instead of rebuild
};

inline const std::vector<std::string>& allDefenseKeys() {
    static const std::vector<std::string> keys = {"firewall", "ids", "antivirus", "mfa", "encryption", "training", "backup"};
    return keys;
}

inline Defense* createDefense(const std::string& key, bool enabled, int level) {
    if (key == "firewall") return new Firewall(enabled, level);
    if (key == "ids") return new IntrusionDetectionSystem(enabled, level);
    if (key == "antivirus") return new Antivirus(enabled, level);
    if (key == "mfa") return new MultiFactorAuthentication(enabled, level);
    if (key == "encryption") return new Encryption(enabled, level);
    if (key == "training") return new SecurityTraining(enabled, level);
    if (key == "backup") return new BackupSystem(enabled, level);
    throw ValidationException("Unknown defense: " + key);
}
