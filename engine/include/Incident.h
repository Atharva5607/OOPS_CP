#pragma once
#include <ostream>
#include <string>

#include "Interfaces.h"
#include "SimulationResult.h"
#include "Util.h"

// One line of the attack history. Fields are private; the friend operator<<
// is the only outside code allowed to touch them directly (it writes the file line).
class Incident : public IJsonSerializable, public IPersistable {
    int id_;
    std::string time_, attackKey_, attack_, target_, outcome_;
    double probability_, attackStrength_, defenseStrength_, damage_, score_;

    friend std::ostream& operator<<(std::ostream& os, const Incident& i);

public:
    Incident()
        : id_(0), probability_(0), attackStrength_(0), defenseStrength_(0), damage_(0), score_(0) {}

    Incident(int id, const SimulationResult& r)
        : id_(id), time_(timestampNow()), attackKey_(r.attackKey), attack_(r.attackName), target_(r.target),
          outcome_(outcomeName(r.outcome)), probability_(r.probability), attackStrength_(r.attackStrength),
          defenseStrength_(r.defenseStrength), damage_(r.damage), score_(r.scoreAfter) {}

    // Rebuild an incident from one history.log line.
    static Incident fromRecord(const std::string& line) {
        const std::vector<std::string> f = split(line, '|');
        if (f.size() != 11) throw FileException("Malformed incident record: " + line);
        Incident i;
        i.id_ = toInt(f[0], "incident id", 1, 1000000000);
        i.time_ = f[1];
        i.attackKey_ = f[2];
        i.attack_ = f[3];
        i.target_ = f[4];
        i.outcome_ = f[5];
        i.probability_ = toDouble(f[6], "probability");
        i.attackStrength_ = toDouble(f[7], "attack strength");
        i.defenseStrength_ = toDouble(f[8], "defense strength");
        i.damage_ = toDouble(f[9], "damage");
        i.score_ = toDouble(f[10], "score");
        return i;
    }

    int id() const { return id_; }
    const std::string& attack() const { return attack_; }
    const std::string& target() const { return target_; }
    const std::string& outcome() const { return outcome_; }
    const std::string& time() const { return time_; }
    double probability() const { return probability_; }
    double damage() const { return damage_; }
    double score() const { return score_; }

    std::string toRecord() const override {
        std::ostringstream o;
        o << *this;
        return o.str();
    }

    std::string toJson() const override {
        return JsonObject().add("id", id_).add("time", time_).add("attackKey", attackKey_).add("attack", attack_)
            .add("target", target_).add("outcome", outcome_).add("probability", roundTo(probability_, 3))
            .add("attackStrength", roundTo(attackStrength_, 1)).add("defenseStrength", roundTo(defenseStrength_, 1))
            .add("damage", roundTo(damage_, 1)).add("score", roundTo(score_, 1)).str();
    }
};

inline std::ostream& operator<<(std::ostream& os, const Incident& i) {
    return os << i.id_ << '|' << i.time_ << '|' << i.attackKey_ << '|' << i.attack_ << '|' << i.target_ << '|'
              << i.outcome_ << '|' << i.probability_ << '|' << i.attackStrength_ << '|' << i.defenseStrength_ << '|'
              << i.damage_ << '|' << i.score_;
}
