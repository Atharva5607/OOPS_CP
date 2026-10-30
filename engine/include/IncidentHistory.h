#pragma once
#include <algorithm>
#include <string>
#include <vector>

#include "Incident.h"

class IncidentHistory {
    std::vector<Incident> incidents_;  // vector of objects

public:
    void add(const Incident& i) { incidents_.push_back(i); }
    size_t size() const { return incidents_.size(); }
    const std::vector<Incident>& all() const { return incidents_; }
    int nextId() const { return incidents_.empty() ? 1 : incidents_.back().id() + 1; }

    int count(const std::string& outcome) const {
        return static_cast<int>(std::count_if(incidents_.begin(), incidents_.end(),
                                              [&](const Incident& i) { return i.outcome() == outcome; }));
    }

    // Newest first, at most `limit` entries.
    std::vector<Incident> recent(size_t limit) const {
        std::vector<Incident> out(incidents_.rbegin(), incidents_.rend());
        if (out.size() > limit) out.resize(limit);
        return out;
    }

    std::string statsJson() const {
        std::vector<double> probs;
        for (const Incident& i : incidents_) probs.push_back(i.probability());
        const int total = static_cast<int>(size());
        const int blocked = count("BLOCKED");
        return JsonObject().add("total", total).add("blocked", blocked).add("partial", count("PARTIALLY_BLOCKED"))
            .add("successful", count("SUCCESSFUL")).add("blockRate", total ? roundTo(100.0 * blocked / total, 1) : 0.0)
            .add("avgProbability", roundTo(average(probs), 3)).str();
    }

    std::string toJson(size_t limit) const {
        JsonArray a;
        for (const Incident& i : recent(limit)) a.pushRaw(i.toJson());
        return a.str();
    }
};
