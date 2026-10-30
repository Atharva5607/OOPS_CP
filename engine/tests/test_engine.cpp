// Self-checking tests: build with `make test` (or see README). Exits non-zero on the first failure.
#include <cassert>
#include <cstdio>
#include <filesystem>
#include <iostream>

#include "FileManager.h"
#include "Organization.h"
#include "RecommendationEngine.h"
#include "Reports.h"
#include "RiskAnalyzer.h"
#include "SimulationEngine.h"

#define CHECK(cond) do { if (!(cond)) { std::printf("FAIL line %d: %s\n", __LINE__, #cond); return 1; } } while (0)

template <typename E, typename F>
bool throws(F f) { try { f(); } catch (const E&) { return true; } catch (...) { return false; } return false; }

int main() {
    // Polymorphism: same call, different attacks, different numbers.
    Organization org = Organization::build("TestCorp", 3, 100, 2, 1, 1);
    auto phishing = makeAttack("phishing");
    auto ddos = makeAttack("ddos");
    const Asset* staff = org.findAsset("Employee-Workstations");
    const Asset* server = org.findAsset("Server-1");
    CHECK(phishing->strengthAgainst(*staff) > phishing->strengthAgainst(*server));
    CHECK(ddos->strengthAgainst(*server) > ddos->strengthAgainst(*staff));
    CHECK(Attack::liveCount() == 2);

    // Defenses raise protection; training helps phishing far more than DDoS.
    const double before = org.defenseAgainst(*phishing);
    org.findDefense("training")->configure(true, 90);
    CHECK(org.defenseAgainst(*phishing) > before + 30);
    CHECK(org.defenseAgainst(*ddos) < org.defenseAgainst(*phishing));

    // Deep copy: changing the copy never touches the original (copy constructor).
    Organization copy(org);
    copy.findDefense("firewall")->configure(false, 0);
    copy.findAsset("Server-1")->applyDamage(50);
    CHECK(org.findDefense("firewall")->enabled());
    CHECK(org.findAsset("Server-1")->health() == 100.0);

    // Same seed => same result; damage lowers health; score moves.
    Organization a = org, b = org;
    SimulationEngine ea(a, 42), eb(b, 42);
    const SimulationResult ra = ea.run(*phishing, "Employee-Workstations");
    const SimulationResult rb = eb.run(*phishing, "Employee-Workstations");
    CHECK(ra.outcome == rb.outcome && ra.roll == rb.roll);
    CHECK(ra.probability >= 0.03 && ra.probability <= 0.97);
    CHECK(a.findAsset("Employee-Workstations")->health() == ra.healthAfter);

    // Backups absorb damage after a breach.
    Organization c = org, d = org;
    d.findDefense("backup")->configure(true, 100);
    CHECK(d.damageMitigation() > c.damageMitigation());

    // Risk analyzer + recommendations.
    RiskAnalyzer risk(org);
    CHECK(risk.securityScore() >= 0 && risk.securityScore() <= 100);
    CHECK(RiskAnalyzer::threatLevel(90) == "LOW" && RiskAnalyzer::threatLevel(10) == "CRITICAL");
    CHECK(!RecommendationEngine::forOrganization(Organization::build("Weak", 1, 10, 1, 1, 1)).empty());

    // Exceptions.
    CHECK(throws<ValidationException>([] { makeAttack("nope"); }));
    CHECK(throws<ValidationException>([] { Organization("bad|name"); }));
    CHECK(throws<SimulationException>([&] { SimulationEngine e(a, 1); e.run(*ddos, "ghost"); }));
    CHECK(throws<SentinelException>([] { createDefense("firewall", true, 500); }));  // base class catches derived

    // File handling round trip.
    const std::string dir = "test_data_tmp";
    std::filesystem::remove_all(dir);
    {
        FileManager fm(dir);
        CHECK(!fm.hasOrganization());
        fm.saveOrganization(a);
        IncidentHistory h;
        h.add(Incident(h.nextId(), ra));
        fm.appendIncident(h.all().back());
        Organization loaded = fm.loadOrganization();
        CHECK(loaded.assets().size() == a.assets().size());
        CHECK(loaded.findAsset("Employee-Workstations")->health() == a.findAsset("Employee-Workstations")->health());
        CHECK(loaded.findDefense("training")->level() == 90);
        IncidentHistory back = fm.loadHistory();
        CHECK(back.size() == 1 && back.all()[0].attack() == "Phishing");
        CHECK(fm.fileSize("history.log") > 0);
        for (const char* type : {"summary", "attacks", "risk", "recommendations"}) {
            const std::string text = SecurityReport::create(type, loaded, back)->render();
            CHECK(text.find("SENTINEL") != std::string::npos);
            CHECK(!fm.saveReport(type, text).empty());
        }
    }  // FileManager destructor closes the log before cleanup
    std::filesystem::remove_all(dir);
    CHECK(Attack::liveCount() == 2);  // phishing + ddos still alive; temporaries were freed

    std::puts("All engine tests passed.");
    return 0;
}
