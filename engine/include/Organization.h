#pragma once
#include <algorithm>
#include <string>
#include <vector>

#include "Asset.h"
#include "Attack.h"
#include "Defense.h"

// The virtual company under attack. It OWNS its assets and defenses through raw
// pointers (allocated with `new`, released with `delete`), so it needs the
// "rule of three": destructor, copy constructor and copy assignment.
class Organization : public IJsonSerializable {
    std::string name_;
    int securityLevel_;  // 1 (lax policies) .. 5 (strict policies)
    int employees_;
    std::vector<Asset*> assets_;
    std::vector<Defense*> defenses_;

    void clear() {
        for (Asset* a : assets_) delete a;
        for (Defense* d : defenses_) delete d;
        assets_.clear();
        defenses_.clear();
    }
    void copyFrom(const Organization& o) {
        for (const Asset* a : o.assets_) assets_.push_back(a->clone());
        for (const Defense* d : o.defenses_) defenses_.push_back(d->clone());
    }

public:
    Organization() : Organization("Unnamed Organization") {}
    Organization(const std::string& name, int securityLevel = 3, int employees = 50)
        : name_(validateName(name, "Organization name")), securityLevel_(securityLevel), employees_(employees) {
        if (securityLevel < 1 || securityLevel > 5) throw ValidationException("Security level must be between 1 and 5");
        if (employees < 1) throw ValidationException("Employees must be at least 1");
    }
    Organization(const Organization& o) : name_(o.name_), securityLevel_(o.securityLevel_), employees_(o.employees_) { copyFrom(o); }
    Organization& operator=(const Organization& o) {
        if (this != &o) {
            clear();
            name_ = o.name_;
            securityLevel_ = o.securityLevel_;
            employees_ = o.employees_;
            copyFrom(o);
        }
        return *this;
    }
    ~Organization() { clear(); }

    const std::string& name() const { return name_; }
    int securityLevel() const { return securityLevel_; }
    int employees() const { return employees_; }
    const std::vector<Asset*>& assets() const { return assets_; }
    const std::vector<Defense*>& defenses() const { return defenses_; }

    // Takes ownership of `a`.
    void addAsset(Asset* a) {
        if (findAsset(a->name()) != nullptr) {
            const std::string dup = a->name();
            delete a;
            throw ValidationException("Duplicate asset name: " + dup);
        }
        assets_.push_back(a);
    }
    void addDefense(Defense* d) { defenses_.push_back(d); }

    Asset* findAsset(const std::string& name) {
        for (Asset* a : assets_) if (a->name() == name) return a;
        return nullptr;
    }
    const Asset* findAsset(const std::string& name) const {
        for (const Asset* a : assets_) if (a->name() == name) return a;
        return nullptr;
    }
    Defense* findDefense(const std::string& key) {
        for (Defense* d : defenses_) if (d->key() == key) return d;
        return nullptr;
    }
    const Defense* findDefense(const std::string& key) const {
        for (const Defense* d : defenses_) if (d->key() == key) return d;
        return nullptr;
    }

    double baselineDefense() const { return 4.0 * securityLevel_; }  // policy maturity: 4..20

    // Combined protection (0..100) against one attack. Layers are independent, so the
    // chance that an attack slips through every layer is the product of the gaps.
    double defenseAgainst(const Attack& attack) const {
        double passThrough = 1.0 - baselineDefense() / 100.0;
        for (const Defense* d : defenses_) passThrough *= 1.0 - d->strengthAgainst(attack.key()) / 100.0;
        return 100.0 * (1.0 - passThrough) * (1.0 - attack.defenseBypass());
    }

    // Share of damage absorbed after a breach (backups, encryption).
    double damageMitigation() const {
        double remaining = 1.0;
        for (const Defense* d : defenses_) remaining *= 1.0 - d->damageReduction();
        return 1.0 - remaining;
    }

    double averageHealth() const {
        std::vector<double> h;
        for (const Asset* a : assets_) h.push_back(a->health());
        return average(h);
    }

    // Standard organization with sensible starting defenses.
    static Organization build(const std::string& name, int level, int employees, int servers, int databases, int devices) {
        Organization org(name, level, employees);
        const double scale = 1.2 - 0.1 * level;  // stricter policy => fewer exploitable weaknesses
        for (int i = 1; i <= servers; ++i) org.addAsset(new Server("Server-" + std::to_string(i), 7.0, 0.45 * scale));
        for (int i = 1; i <= databases; ++i) org.addAsset(new Database("Database-" + std::to_string(i), 9.0, 0.50 * scale));
        for (int i = 1; i <= devices; ++i) org.addAsset(new NetworkDevice("Network-" + std::to_string(i), 6.0, 0.40 * scale));
        const double staffFactor = 1.0 + 0.2 * std::min(employees, 500) / 500.0;  // bigger staff, bigger phishing surface
        org.addAsset(new EmployeeSystem("Employee-Workstations", 5.0, 0.60 * scale * staffFactor));
        org.addDefense(new Firewall(true, 50));
        org.addDefense(new IntrusionDetectionSystem(false, 50));
        org.addDefense(new Antivirus(true, 40));
        org.addDefense(new MultiFactorAuthentication(false, 50));
        org.addDefense(new Encryption(false, 50));
        org.addDefense(new SecurityTraining(false, 50));
        org.addDefense(new BackupSystem(false, 50));
        return org;
    }

    std::string toJson() const override {
        JsonArray as, ds;
        for (const Asset* a : assets_) as.pushRaw(a->toJson());
        for (const Defense* d : defenses_) ds.pushRaw(d->toJson());
        return JsonObject().add("name", name_).add("securityLevel", securityLevel_).add("employees", employees_)
            .add("averageHealth", roundTo(averageHealth(), 1)).addRaw("assets", as.str()).addRaw("defenses", ds.str()).str();
    }
};
