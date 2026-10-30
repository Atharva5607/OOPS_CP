#pragma once
#include <random>
#include <string>

#include "Organization.h"
#include "RecommendationEngine.h"
#include "RiskAnalyzer.h"
#include "SimulationResult.h"

// Hides the formula behind one call: run(). Callers never see how strength,
// probability or damage are computed (abstraction).
class SimulationEngine {
    Organization& org_;
    std::mt19937 rng_;

    Outcome decide(double probability, double roll) const {
        if (roll < probability * 0.6) return Outcome::SUCCESSFUL;
        if (roll < probability) return Outcome::PARTIALLY_BLOCKED;
        return Outcome::BLOCKED;
    }

public:
    SimulationEngine(Organization& org, unsigned seed) : org_(org) {
        std::seed_seq seq{seed, seed ^ 0x9e3779b9u};  // raw small seeds give correlated first mt19937 outputs
        rng_.seed(seq);
    }

    // `attack` is a reference to the base class: PhishingAttack, DDoSAttack, ... all work (polymorphism).
    SimulationResult run(const Attack& attack, const std::string& targetName) {
        Asset* target = org_.findAsset(targetName);
        if (target == nullptr) throw SimulationException("Unknown target: " + targetName);

        SimulationResult r;
        r.attackKey = attack.key();
        r.attackName = attack.name();
        r.target = target->name();
        r.targetType = target->type();
        r.path = attack.attackPath(*target);

        r.attackStrength = attack.strengthAgainst(*target);
        r.defenseStrength = org_.defenseAgainst(attack);
        r.layers.push_back({"Security policy", org_.baselineDefense()});
        for (const Defense* d : org_.defenses())
            if (d->enabled()) r.layers.push_back({d->name(), d->strengthAgainst(attack.key())});

        r.probability = clampValue(0.4 + (r.attackStrength - r.defenseStrength) / 100.0, 0.03, 0.97);
        r.roll = std::uniform_real_distribution<double>(0.0, 1.0)(rng_);
        r.outcome = decide(r.probability, r.roll);

        const double fullDamage = 4.0 * target->criticality() * attack.damageFactor();
        const double raw = r.outcome == Outcome::SUCCESSFUL ? fullDamage
                         : r.outcome == Outcome::PARTIALLY_BLOCKED ? fullDamage / 3.0 : 0.0;
        const double before = target->health();
        target->applyDamage(raw, org_.damageMitigation());  // overload with mitigation
        r.damage = before - target->health();
        r.healthAfter = target->health();
        r.scoreAfter = RiskAnalyzer(org_).securityScore();

        r.recommendation = RecommendationEngine::bestFor(org_, attack).text;
        if (target->vulnerability() > 0.6) r.recommendation += " Also harden " + target->name() + " (vulnerability above 60%).";
        return r;
    }
};
