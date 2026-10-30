#include "Reports.h"

#include <iomanip>
#include <sstream>

#include "IncidentHistory.h"
#include "Organization.h"
#include "RecommendationEngine.h"
#include "RiskAnalyzer.h"
#include "Util.h"

namespace {
std::string bar(double value, int width = 20) {
    const int filled = static_cast<int>(clampValue(value, 0.0, 100.0) / 100.0 * width + 0.5);
    return "[" + std::string(filled, '#') + std::string(width - filled, '.') + "]";
}
std::string rule() { return std::string(64, '-') + "\n"; }
}  // namespace

std::string Report::render() const {
    std::ostringstream o;
    o << std::string(64, '=') << "\nSENTINEL  |  " << title() << "\n" << std::string(64, '=') << "\n"
      << "Organization : " << org_.name() << "\nGenerated    : " << timestampNow() << "\n\n"
      << body() << "\n" << rule() << "Simulation only. No real systems were touched.\n";
    return o.str();
}

std::string SummaryReport::body() const {
    RiskAnalyzer ra(org());
    const double score = ra.securityScore();
    std::ostringstream o;
    o << std::fixed << std::setprecision(1);
    o << "Security score : " << score << " / 100  " << bar(score) << "\n"
      << "Threat level   : " << RiskAnalyzer::threatLevel(score) << "\n"
      << "Policy level   : " << org().securityLevel() << " / 5\n"
      << "Employees      : " << org().employees() << "\n"
      << "Assets         : " << org().assets().size() << " (average health " << org().averageHealth() << "%)\n\n"
      << "Defenses\n" << rule();
    for (const Defense* d : org().defenses())
        o << std::left << std::setw(22) << d->name() << (d->enabled() ? "ON   " : "OFF  ") << d->level() << "%\n";
    o << "\nSimulation statistics\n" << rule()
      << "Attacks launched : " << history().size() << "\n"
      << "Blocked          : " << history().count("BLOCKED") << "\n"
      << "Partially blocked: " << history().count("PARTIALLY_BLOCKED") << "\n"
      << "Successful       : " << history().count("SUCCESSFUL") << "\n";
    return o.str();
}

std::string AttackLogReport::body() const {
    std::ostringstream o;
    o << std::fixed << std::setprecision(1);
    if (history().size() == 0) return "No attacks have been simulated yet.\n";
    o << std::left << std::setw(5) << "ID" << std::setw(21) << "Time" << std::setw(15) << "Attack" << std::setw(22) << "Target"
      << std::setw(19) << "Outcome" << "Prob\n" << rule();
    for (const Incident& i : history().all())
        o << std::left << std::setw(5) << i.id() << std::setw(21) << i.time() << std::setw(15) << i.attack() << std::setw(22)
          << i.target() << std::setw(19) << i.outcome() << i.probability() * 100.0 << "%\n";
    return o.str();
}

std::string RiskReport::body() const {
    RiskAnalyzer ra(org());
    std::ostringstream o;
    o << std::fixed << std::setprecision(1);
    o << "Protection against each attack type\n" << rule();
    for (const std::string& k : allAttackKeys()) {
        const double d = ra.defenseFor(k);
        o << std::left << std::setw(14) << makeAttack(k)->name() << bar(d) << " " << d << "%\n";
    }
    o << "\nWeak points (most severe first)\n" << rule();
    const std::vector<Weakness> weak = ra.weakPoints();
    if (weak.empty()) o << "None detected.\n";
    for (const Weakness& w : weak) o << "* [" << w.kind << "] " << w.subject << " - " << w.detail << "\n";
    return o.str();
}

std::string RecommendationReport::body() const {
    std::ostringstream o;
    const std::vector<Recommendation> recs = RecommendationEngine::forOrganization(org(), 6);
    if (recs.empty()) return "No improvements needed. Current defenses cover every attack type well.\n";
    int n = 1;
    for (const Recommendation& r : recs) o << n++ << ". [" << r.priority << "] " << r.text << "\n";
    return o.str();
}

std::unique_ptr<Report> SecurityReport::create(const std::string& type, const Organization& org, const IncidentHistory& history) {
    if (type == "summary") return std::make_unique<SummaryReport>(org, history);
    if (type == "attacks") return std::make_unique<AttackLogReport>(org, history);
    if (type == "risk") return std::make_unique<RiskReport>(org, history);
    if (type == "recommendations") return std::make_unique<RecommendationReport>(org, history);
    throw ValidationException("Unknown report type: " + type + " (use summary, attacks, risk or recommendations)");
}
