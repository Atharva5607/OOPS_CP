// sentinel_engine <command> [key=value ...]
// One-shot command line front door to the simulation. Every command prints one JSON
// object to stdout; state lives in the data folder (see FileManager).
#include <cstdlib>
#include <iostream>
#include <map>
#include <random>
#include <string>

#include "FileManager.h"
#include "IncidentHistory.h"
#include "Organization.h"
#include "RecommendationEngine.h"
#include "Reports.h"
#include "RiskAnalyzer.h"
#include "SimulationEngine.h"

using Args = std::map<std::string, std::string>;

static std::string need(const Args& a, const std::string& key) {
    auto it = a.find(key);
    if (it == a.end() || it->second.empty()) throw ValidationException("Missing argument: " + key);
    return it->second;
}
static std::string opt(const Args& a, const std::string& key, const std::string& fallback) {
    auto it = a.find(key);
    return it == a.end() || it->second.empty() ? fallback : it->second;
}

static std::string attackCatalogJson() {
    JsonArray arr;
    for (const std::string& k : allAttackKeys()) arr.pushRaw(makeAttack(k)->toJson());
    return arr.str();
}

static std::string recommendationsJson(const Organization& org, size_t limit = 5) {
    JsonArray arr;
    for (const Recommendation& r : RecommendationEngine::forOrganization(org, limit)) arr.pushRaw(r.toJson());
    return arr.str();
}

static JsonObject okObject() { return JsonObject().add("ok", true); }

static std::string stateJson(const Organization& org, const IncidentHistory& h) {
    return okObject().addRaw("organization", org.toJson()).addRaw("risk", RiskAnalyzer(org).toJson())
        .addRaw("recommendations", recommendationsJson(org)).addRaw("stats", h.statsJson())
        .addRaw("attacks", attackCatalogJson()).str();
}

// ---- commands ----------------------------------------------------------------

static std::string cmdCreateOrg(FileManager& fm, const Args& a) {
    Organization org = Organization::build(need(a, "name"), toInt(opt(a, "level", "3"), "level", 1, 5),
                                           toInt(opt(a, "employees", "50"), "employees", 1, 100000),
                                           toInt(opt(a, "servers", "3"), "servers", 0, 20),
                                           toInt(opt(a, "databases", "2"), "databases", 0, 20),
                                           toInt(opt(a, "devices", "3"), "devices", 0, 20));
    fm.saveOrganization(org);
    fm.clearHistory();
    IncidentHistory empty;
    fm.saveStats(empty, RiskAnalyzer(org).securityScore());
    return stateJson(org, empty);
}

static std::string cmdState(FileManager& fm, const Args&) {
    return stateJson(fm.loadOrganization(), fm.loadHistory());
}

static std::string cmdAnalyze(FileManager& fm, const Args&) {
    Organization org = fm.loadOrganization();
    return okObject().addRaw("risk", RiskAnalyzer(org).toJson()).addRaw("recommendations", recommendationsJson(org, 6)).str();
}

// defenses=firewall:1:70,mfa:0:50   (key:enabled:level)
static std::string cmdConfigure(FileManager& fm, const Args& a) {
    Organization org = fm.loadOrganization();
    for (const std::string& item : split(need(a, "defenses"), ',')) {
        const std::vector<std::string> f = split(item, ':');
        if (f.size() != 3) throw ValidationException("Defense setting must look like key:enabled:level, got '" + item + "'");
        Defense* d = org.findDefense(f[0]);
        if (d == nullptr) throw ValidationException("Unknown defense: " + f[0]);
        d->configure(toInt(f[1], "enabled", 0, 1) == 1, toInt(f[2], "level", 0, 100));
    }
    fm.saveOrganization(org);
    return stateJson(org, fm.loadHistory());
}

static std::string cmdLaunch(FileManager& fm, const Args& a) {
    Organization org = fm.loadOrganization();
    IncidentHistory history = fm.loadHistory();
    const std::unique_ptr<Attack> attack = makeAttack(need(a, "attack"));
    const unsigned seed = a.count("seed") ? static_cast<unsigned>(toInt(a.at("seed"), "seed", 0, 2000000000)) : std::random_device{}();

    SimulationEngine engine(org, seed);
    const SimulationResult result = engine.run(*attack, need(a, "target"));

    history.add(Incident(history.nextId(), result));
    try {
        fm.saveOrganization(org);
        fm.appendIncident(history.all().back());
        fm.saveStats(history, result.scoreAfter);
    } catch (const FileException& e) {
        throw FileException(std::string("Attack ran but results could not be saved: ") + e.what());
    }
    return okObject().addRaw("result", result.toJson()).addRaw("state", stateJson(org, history)).str();
}

static std::string cmdRepair(FileManager& fm, const Args&) {
    Organization org = fm.loadOrganization();
    for (Asset* asset : org.assets()) asset->repair();
    fm.saveOrganization(org);
    return stateJson(org, fm.loadHistory());
}

static std::string cmdHistory(FileManager& fm, const Args& a) {
    IncidentHistory h = fm.loadHistory();
    const size_t limit = static_cast<size_t>(toInt(opt(a, "limit", "100"), "limit", 1, 10000));
    return okObject().addRaw("incidents", h.toJson(limit)).addRaw("stats", h.statsJson())
        .add("logBytes", static_cast<double>(fm.fileSize("history.log"))).str();
}

static std::string cmdReport(FileManager& fm, const Args& a) {
    Organization org = fm.loadOrganization();
    IncidentHistory h = fm.loadHistory();
    const std::string type = opt(a, "type", "summary");
    const std::unique_ptr<Report> report = SecurityReport::create(type, org, h);
    const std::string text = report->render();
    const std::string saved = fm.saveReport(report->tag(), text);
    return okObject().add("type", type).add("title", report->title()).add("path", saved).add("content", text).str();
}

// ---- entry point -------------------------------------------------------------

int main(int argc, char** argv) {
    try {
        if (argc < 2) throw ValidationException("Usage: sentinel_engine <command> [key=value ...]");
        const std::string command = argv[1];
        Args args;
        for (int i = 2; i < argc; ++i) {
            const std::string token = argv[i];
            const size_t eq = token.find('=');
            if (eq == std::string::npos || eq == 0) throw ValidationException("Arguments must look like key=value, got '" + token + "'");
            args[token.substr(0, eq)] = token.substr(eq + 1);
        }
        const char* env = std::getenv("SENTINEL_DATA");
        FileManager fm(opt(args, "data", env ? env : "data"));

        std::string out;
        if (command == "create-org") out = cmdCreateOrg(fm, args);
        else if (command == "state") out = cmdState(fm, args);
        else if (command == "analyze-risk") out = cmdAnalyze(fm, args);
        else if (command == "configure-defense") out = cmdConfigure(fm, args);
        else if (command == "launch-attack") out = cmdLaunch(fm, args);
        else if (command == "repair") out = cmdRepair(fm, args);
        else if (command == "history") out = cmdHistory(fm, args);
        else if (command == "generate-report") out = cmdReport(fm, args);
        else throw ValidationException("Unknown command: " + command);

        std::cout << out << std::endl;
        return 0;
    } catch (const SentinelException& e) {  // our own errors carry a machine-readable code
        std::cout << JsonObject().add("ok", false).add("code", e.code()).add("error", e.what()).str() << std::endl;
        return 1;
    } catch (const std::exception& e) {  // anything unexpected from the standard library
        std::cout << JsonObject().add("ok", false).add("code", "INTERNAL_ERROR").add("error", e.what()).str() << std::endl;
        return 2;
    }
}
