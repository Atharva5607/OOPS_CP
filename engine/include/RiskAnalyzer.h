#pragma once
#include <algorithm>
#include <string>
#include <vector>

#include "Organization.h"

struct Weakness {
    std::string kind;     // "attack" or "asset"
    std::string subject;  // attack or asset name
    std::string detail;
    double severity;      // 0..100, used for ranking
};

class RiskAnalyzer {
    const Organization& org_;

public:
    explicit RiskAnalyzer(const Organization& org) : org_(org) {}

    // Combined protection against one attack type (0..100).
    double defenseFor(const std::string& attackKey) const {
        return org_.defenseAgainst(*makeAttack(attackKey));
    }

    // 80% defense coverage across all attack types + 20% asset health.
    double securityScore() const {
        std::vector<double> d;
        for (const std::string& k : allAttackKeys()) d.push_back(defenseFor(k));
        return clampValue(0.8 * average(d) + 0.2 * org_.averageHealth(), 0.0, 100.0);
    }

    static std::string threatLevel(double score) {
        if (score >= 80) return "LOW";
        if (score >= 60) return "MODERATE";
        if (score >= 40) return "HIGH";
        return "CRITICAL";
    }

    std::vector<Weakness> weakPoints() const {
        std::vector<Weakness> out;
        for (const std::string& k : allAttackKeys()) {
            auto attack = makeAttack(k);
            const double d = defenseFor(k);
            if (d < 55.0)
                out.push_back({"attack", attack->name(),
                               "Only " + std::to_string(static_cast<int>(d)) + "% protection against a power-" +
                                   std::to_string(static_cast<int>(attack->power())) + " attack",
                               (1.0 - d / 100.0) * attack->power()});
        }
        for (const Asset* a : org_.assets()) {
            if (a->vulnerability() > 0.6)
                out.push_back({"asset", a->name(),
                               "High vulnerability (" + std::to_string(static_cast<int>(a->vulnerability() * 100)) + "%) on a criticality-" +
                                   std::to_string(static_cast<int>(a->criticality())) + " asset",
                               a->vulnerability() * a->criticality() * 10.0});
            if (a->health() < 60.0)
                out.push_back({"asset", a->name(), "Degraded to " + std::to_string(static_cast<int>(a->health())) + "% health after incidents",
                               100.0 - a->health()});
        }
        std::sort(out.begin(), out.end(), [](const Weakness& x, const Weakness& y) { return x.severity > y.severity; });
        if (out.size() > 8) out.resize(8);
        return out;
    }

    std::string toJson() const {
        const double score = securityScore();
        JsonArray perAttack, weak;
        for (const std::string& k : allAttackKeys()) {
            auto attack = makeAttack(k);
            perAttack.pushRaw(JsonObject().add("key", k).add("name", attack->name()).add("power", attack->power())
                                  .add("defense", roundTo(defenseFor(k), 1)).str());
        }
        for (const Weakness& w : weakPoints())
            weak.pushRaw(JsonObject().add("kind", w.kind).add("subject", w.subject).add("detail", w.detail)
                             .add("severity", roundTo(w.severity, 1)).str());
        return JsonObject().add("score", roundTo(score, 1)).add("threat", threatLevel(score))
            .add("averageHealth", roundTo(org_.averageHealth(), 1)).addRaw("byAttack", perAttack.str())
            .addRaw("weakPoints", weak.str()).str();
    }
};
