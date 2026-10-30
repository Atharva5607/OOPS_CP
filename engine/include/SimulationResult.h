#pragma once
#include <string>
#include <utility>
#include <vector>

#include "Util.h"

enum class Outcome { BLOCKED, PARTIALLY_BLOCKED, SUCCESSFUL };

inline std::string outcomeName(Outcome o) {
    switch (o) {
        case Outcome::BLOCKED: return "BLOCKED";
        case Outcome::PARTIALLY_BLOCKED: return "PARTIALLY_BLOCKED";
        default: return "SUCCESSFUL";
    }
}

// Plain data carrier produced by SimulationEngine::run().
struct SimulationResult {
    std::string attackKey, attackName, target, targetType, recommendation;
    double attackStrength = 0, defenseStrength = 0, probability = 0, roll = 0;
    double damage = 0, healthAfter = 100, scoreAfter = 0;
    Outcome outcome = Outcome::BLOCKED;
    std::vector<std::string> path;                       // attack path steps
    std::vector<std::pair<std::string, double>> layers;  // defense layer -> strength vs this attack

    std::string toJson() const {
        JsonArray p, l;
        for (const std::string& s : path) p.pushString(s);
        for (const auto& kv : layers) l.pushRaw(JsonObject().add("name", kv.first).add("strength", roundTo(kv.second, 1)).str());
        return JsonObject().add("attackKey", attackKey).add("attack", attackName).add("target", target).add("targetType", targetType)
            .add("attackStrength", roundTo(attackStrength, 1)).add("defenseStrength", roundTo(defenseStrength, 1))
            .add("probability", roundTo(probability, 3)).add("roll", roundTo(roll, 3)).add("outcome", outcomeName(outcome))
            .add("damage", roundTo(damage, 1)).add("healthAfter", roundTo(healthAfter, 1)).add("scoreAfter", roundTo(scoreAfter, 1))
            .addRaw("path", p.str()).addRaw("layers", l.str()).add("recommendation", recommendation).str();
    }
};
