#pragma once
#include <algorithm>
#include <string>
#include <vector>

#include "Organization.h"
#include "RiskAnalyzer.h"

struct Recommendation : public IJsonSerializable {
    std::string defenseKey, defenseName, attackName, priority, text;
    double from = 0, to = 0;

    std::string toJson() const override {
        return JsonObject().add("defenseKey", defenseKey).add("defense", defenseName).add("attack", attackName)
            .add("priority", priority).add("text", text).add("from", roundTo(from, 1)).add("to", roundTo(to, 1)).str();
    }
};

class RecommendationEngine {
    static std::string fmt(double v) { return std::to_string(static_cast<int>(v + 0.5)); }

public:
    // Which single defense upgrade helps most against this attack? Each candidate is
    // tried on a deep copy of the organization (copy constructor), so the real one is untouched.
    static Recommendation bestFor(const Organization& org, const Attack& attack) {
        const double before = org.defenseAgainst(attack);
        Recommendation best;
        best.attackName = attack.name();
        best.from = best.to = before;
        for (const Defense* d : org.defenses()) {
            Organization trial(org);
            const int target = std::max(d->level(), 80);
            trial.findDefense(d->key())->configure(true, target);
            const double after = trial.defenseAgainst(attack);
            if (after - before > best.to - best.from + 0.5) {
                best.defenseKey = d->key();
                best.defenseName = d->name();
                best.from = before;
                best.to = after;
                best.text = std::string(d->enabled() ? "Raise " : "Enable ") + d->name() + " to " + std::to_string(target) +
                            "% - protection against " + attack.name() + " rises from " + fmt(before) + "% to " + fmt(after) + "%.";
            }
        }
        if (best.defenseKey.empty())
            best.text = "Existing defenses already give strong coverage against " + attack.name() + " (" + fmt(before) + "%).";
        best.priority = before < 35 ? "HIGH" : (before < 55 ? "MEDIUM" : "LOW");
        return best;
    }

    static std::vector<Recommendation> forOrganization(const Organization& org, size_t limit = 5) {
        std::vector<Recommendation> all;
        for (const std::string& k : allAttackKeys()) {
            auto attack = makeAttack(k);
            if (org.defenseAgainst(*attack) >= 70.0) continue;
            Recommendation r = bestFor(org, *attack);
            if (!r.defenseKey.empty()) all.push_back(r);
        }
        std::sort(all.begin(), all.end(), [](const Recommendation& a, const Recommendation& b) { return (a.to - a.from) > (b.to - b.from); });

        std::vector<Recommendation> out;  // one entry per defense keeps the list varied
        for (const Recommendation& r : all) {
            const bool seen = std::any_of(out.begin(), out.end(), [&](const Recommendation& o) { return o.defenseKey == r.defenseKey; });
            if (!seen && out.size() < limit) out.push_back(r);
        }
        for (const Asset* a : org.assets()) {
            if (a->health() < 60.0 && out.size() < limit + 2) {
                Recommendation r;
                r.defenseName = "Recovery";
                r.attackName = a->name();
                r.priority = "HIGH";
                r.text = "Restore " + a->name() + " (health " + fmt(a->health()) + "%) before the next attack lands.";
                out.push_back(r);
            }
        }
        return out;
    }
};
