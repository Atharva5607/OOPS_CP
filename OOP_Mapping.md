# OOP Mapping: where each syllabus topic lives in Sentinel

All C++ code is in `engine/` (headers in `engine/include/`). The Python and JavaScript layers contain no simulation logic, so every concept below is demonstrated in C++.

**Class map**

```
IJsonSerializable   IPersistable                (interfaces)
        \              /
          Asset (abstract)  ── Server, Database, EmployeeSystem, NetworkDevice
          Defense (abstract) ── Firewall, IntrusionDetectionSystem, Antivirus, MultiFactorAuthentication,
                                Encryption, SecurityTraining, BackupSystem
Attack (abstract) : IJsonSerializable ── PhishingAttack, BruteForceAttack, MalwareAttack, RansomwareAttack,
                                         SQLInjectionAttack, DDoSAttack, ZeroDayAttack
Report (abstract) ── SummaryReport, AttackLogReport, RiskReport, RecommendationReport   (+ SecurityReport facade)
Support: Organization, SimulationEngine, RiskAnalyzer, RecommendationEngine, FileManager, Incident, IncidentHistory
Exceptions: SentinelException ── ValidationException, FileException, SimulationException
```

Honest notes: there is no `Person`/`User` class (the project has no user accounts, and adding one would be unused code). `BackupSystem` and `ZeroDayAttack` were added because the brief lists backups and zero-day among the required features.

---

## Unit 1: Introduction to OOP

| Concept | Where / how |
|---|---|
| **Procedural limitations / need for OOP** | In a procedural version, "attack type" would be an `int` and every function (`strength()`, `path()`, `damage()`) would need a `switch` over seven types; adding an eighth attack means editing all of them. Here each attack is one class that carries its own data and behaviour (`Attack.h`), and defenses likewise (`Defense.h`). |
| **Objects, classes, data members, methods** | `Asset` has data members `name_`, `criticality_`, `vulnerability_`, `health_` and methods `applyDamage()`, `repair()`, `exposureTo()`. `Organization myOrg = Organization::build(...)` creates an object (`main.cpp: cmdCreateOrg`). |
| **Encapsulation / information hiding** | Every data member in the project is `private`. Outsiders use getters or intent-revealing methods only: `Defense::configure(enabled, level)` validates before changing state; `Asset::applyDamage()` clamps health to 0-100, so health can never be set to nonsense. |
| **Abstraction** | `SimulationEngine::run(attack, targetName)` hides the whole formula (strength, probability, roll, damage, recommendation). `SecurityReport::create("risk", ...)` hides which report class is built. The UI never sees either. |
| **Inheritance** | `Server : Asset`, `Firewall : Defense`, `RansomwareAttack : Attack`, ... (see Unit 4). |
| **Polymorphism** | One call, many behaviours: `attack.attackPath(*target)` returns a different path for every attack class (see Unit 4). |
| **Static vs dynamic binding** | *Static (compile time):* overloaded functions (`applyDamage(double)` vs `applyDamage(double,double)`), templates, non-virtual calls such as `Asset::name()`. *Dynamic (run time):* every `virtual` call through a base reference, e.g. `attack.damageFactor()`, `asset.exposureTo(key)`, `defense->coverage(key)`. The compiler can't know which derived class `attack` really is, so it looks it up in the vtable. |
| **Message passing** | Objects interact only by calling each other's public methods: `SimulationEngine` asks the `Attack` for `strengthAgainst(target)`, asks the `Organization` for `defenseAgainst(attack)`, then tells the `Asset` to `applyDamage()`. |

## Unit 2: Classes and Objects

| Concept | Where / how |
|---|---|
| **Access modifiers** | `private` data, `protected` constructors in abstract bases (`Asset`, `Attack`, `Defense` can't be created directly), `public` interface. `Report` exposes `org()`/`history()` as `protected` for subclasses only. |
| **Methods with return values / parameters** | `RiskAnalyzer::securityScore()` returns `double`; `RiskAnalyzer::defenseFor(attackKey)` takes a parameter and returns one. |
| **`this` keyword** | `Asset::setVulnerability()` uses `this->vulnerability_` and `return *this`, so calls can be chained. |
| **Method overloading** | `Asset::applyDamage(double)` / `applyDamage(double, double)`; `Defense::strengthAgainst(const string&)` / `strengthAgainst(const vector<string>&)`; `JsonObject::add(...)` for string, `const char*`, double, int, bool. |
| **Passing an object as parameter** | `SimulationEngine::run(const Attack&, ...)` (by const reference, no copy); `RecommendationEngine::bestFor(const Organization&, const Attack&)`; `Report(const Organization&, const IncidentHistory&)`. |
| **Returning an object** | `Organization::build(...)` returns an `Organization` by value; `FileManager::loadOrganization()` and `loadHistory()` return whole objects; `Incident::fromRecord(line)` returns an `Incident`. |
| **Array / vector of objects** | `IncidentHistory` holds `std::vector<Incident>`; `Organization` holds `std::vector<Asset*>` and `std::vector<Defense*>` (polymorphic collections). |
| **`new` / `delete`** | `Organization` allocates assets and defenses with `new` (`Organization::build`, `createAsset`, `createDefense`) and releases them with `delete` in `clear()`, called from the destructor and from `operator=`. |
| **Static data members / methods** | `Attack::live_` (an `inline static int`) counts attacks currently alive; `Attack::liveCount()` reads it. The C++ test checks it goes up on construction and down on destruction. |
| **Forward declaration** | `Reports.h` declares `class Organization; class IncidentHistory;` instead of including their headers; the full headers are included only in `Reports.cpp`. |

## Unit 3: Constructors and Destructors

| Concept | Where / how |
|---|---|
| **Default constructor** | `Asset()` (delegates to the full constructor), `Organization()`, `Incident()`. |
| **Parameterized constructor** | `Asset(name, criticality, vulnerability, health)`, `Organization(name, level, employees)`, `Incident(id, result)`. They validate and throw `ValidationException` on bad input. |
| **Copy constructor** | `Organization(const Organization&)` makes a deep copy by calling `clone()` on every asset and defense. `RecommendationEngine::bestFor` uses it: `Organization trial(org);` lets it test a defense upgrade without touching the real organization. `Asset(const Asset&) = default` is used by `clone()`. |
| **Constructor overloading** | `Organization()` and `Organization(name, level, employees)`; `Asset()` and `Asset(name, ...)`. |
| **Default arguments** | `Server(name, criticality = 7.0, vulnerability = 0.45, health = 100.0)`; `Firewall(enabled = true, level = 50)`; `Organization(name, securityLevel = 3, employees = 50)`. |
| **Dynamic initialization** | Values computed at run time: `Organization::build` calls `new Server("Server-" + to_string(i), 7.0, 0.45 * scale)` where `scale` depends on the chosen policy level; `SimulationEngine`'s constructor seeds its random generator from a run-time value. |
| **Destructors** | `~Organization()` deletes owned assets and defenses; `~FileManager()` closes the open log stream; `~Attack()` decrements the live counter. All base-class destructors are `virtual`, so deleting a `Defense*` runs the derived destructor first. |
| **Constructors/destructors in inheritance** | `Server(...) : Asset(...)` (derived constructor passes arguments to the base initializer). Construction order: base then derived; destruction: derived then base. `Attack::live_` shows this in the test: creating a `PhishingAttack` runs `Attack`'s constructor too. |

## Unit 4: Inheritance and Polymorphism

| Concept | Where / how |
|---|---|
| **Need for inheritance** | Seven attacks share a name, power and description but differ in path, damage and bypass. The shared part lives once in `Attack`; each subclass states only what is different. |
| **Types of inheritance used** | *Single / hierarchical:* `Server`, `Database`, `EmployeeSystem`, `NetworkDevice` all derive from `Asset`. *Multiple (of pure interfaces):* `class Asset : public IJsonSerializable, public IPersistable`. No multilevel or diamond inheritance is used, because the problem did not need it. |
| **Benefits and cost** | Benefit: adding `ZeroDayAttack` required no change to `SimulationEngine`. Cost: the engine is coupled to the base-class contract, and each virtual call costs a vtable lookup (negligible here). |
| **Method overriding** | `ZeroDayAttack::defenseBypass()` returns 0.35 while the base version returns 0; each `*Attack::attackPath()` and `damageFactor()`; `BackupSystem::damageReduction()`; every `Asset::exposureTo()`. Overrides are marked `override` so the compiler catches signature typos. |
| **Abstract classes** | `Asset`, `Attack`, `Defense`, `Report` each have pure virtual functions (`= 0`), so they cannot be instantiated. |
| **Interfaces** | `IJsonSerializable` (`toJson()`) and `IPersistable` (`toRecord()`) in `Interfaces.h` are classes with only pure virtual functions. |
| **Compile-time polymorphism** | Function overloading and templates (see Unit 6), resolved by the compiler. |
| **Runtime polymorphism** | `SimulationEngine::run(const Attack& attack, ...)` is called with any attack; `Organization` loops over `std::vector<Defense*>` calling `d->strengthAgainst(key)`, which calls each defense's own `coverage()`. `main.cpp` builds attacks via `makeAttack(key)` and never names a concrete class. |
| **Template Method pattern** | `Report::render()` is fixed (header, `body()`, footer); subclasses override only `title()`, `tag()`, `body()`. |
| **Friend function** | `friend std::ostream& operator<<(std::ostream&, const Incident&)` in `Incident.h` reads the private fields to write the exact `history.log` line, and `toRecord()` reuses it. It is a friend because it is a non-member operator that must see private data. |
| **Software reuse** | Factories `createAsset/createAttack/createDefense` are used both by the simulation and by the file loader, so a new subclass is registered in one place. `Incident::toRecord()` reuses `operator<<`. |

## Unit 5: File Handling

All in `FileManager.h` (the only class that touches the disk).

| Concept | Where / how |
|---|---|
| **File stream classes** | `std::ofstream` (writing config, history, stats, reports), `std::ifstream` (reading them back). |
| **Opening and closing** | `FileManager` opens `history.log` in its constructor and closes it in its destructor; other files use scope-based close (`ofstream` closes when it leaves scope). `clearHistory()` explicitly `close()`s and reopens. |
| **File modes** | `std::ios::out \| std::ios::app` (append incidents), `std::ios::out \| std::ios::trunc` (rewrite `org.cfg`, `stats.txt`), `std::ios::binary` (size query). |
| **File pointers** | `fileSize()`: `seekg(0, std::ios::end)` then `tellg()` reports the log size in bytes (shown by the `history` command as `logBytes`). |
| **Sequential I/O** | `std::getline` reads `org.cfg` and `history.log` line by line; `operator<<` writes one record per line. |
| **Error handling** | Every open is checked (`if (!out)`), writes are flushed and re-checked, a missing or corrupt file becomes a `FileException` with the line number. |

Files: `org.cfg` (organization, assets, defenses), `history.log` (incidents), `stats.txt` (statistics), `reports/*.txt` (reports).

## Unit 6: Exception Handling, Generic Programming, SOLID

### Exception handling

| Concept | Where / how |
|---|---|
| **Custom exceptions** | `Exceptions.h`: `SentinelException : std::runtime_error`, with `ValidationException`, `FileException`, `SimulationException`. Each overrides `code()` (used in the JSON error response). |
| **try / catch** | `main.cpp` wraps the whole command in `try`; the API turns failures into HTTP 400/404. |
| **Multiple catch blocks** | `main()` catches `SentinelException` (known failure, structured JSON, exit 1) before `std::exception` (unexpected, exit 2). Order matters: derived before base. |
| **Nested try** | `FileManager::loadOrganization()` has an inner `try` per line that catches `ValidationException` from the factories and rethrows it as a `FileException` that includes the line number. `cmdLaunch` wraps its three saves in a `try` and rethrows with the message "Attack ran but results could not be saved". |
| **Where thrown** | Constructors validate (`Asset`, `Defense`, `Organization`), factories reject unknown types, `SimulationEngine::run` throws `SimulationException` for an unknown target, `toInt/toDouble` reject malformed numbers. |

### Generic programming (`Util.h`)

| Template | Use |
|---|---|
| `template <typename T> T clampValue(T v, T lo, T hi)` | health, probabilities, vulnerability (works for `double` and `int`) |
| `template <typename T> double average(const std::vector<T>&)` | average health, average defense, average probability |
| `template <typename V> V lookupOr(const std::map<std::string,V>&, key, fallback)` | every coverage/exposure table lookup |

### SOLID

| Principle | Mapping |
|---|---|
| **S: Single Responsibility** | `FileManager` only does disk I/O. `RiskAnalyzer` only scores. `RecommendationEngine` only suggests. `SimulationEngine` only simulates. `JsonObject` only builds JSON. Each has one reason to change. |
| **O: Open/Closed** | New attack = new subclass of `Attack` plus one line each in `createAttack()` and `allAttackKeys()`. `SimulationEngine`, `RiskAnalyzer` and the reports are not modified. Same for defenses and assets. (The factory switch is the one deliberate edit point.) |
| **L: Liskov Substitution** | Any `Attack`, `Defense` or `Asset` subclass can stand in for its base: the engine and tests use them through base references and every subclass honours the same contracts (values stay in range, `clone()` returns an equal object). `PhishingAttack` and `ZeroDayAttack` are interchangeable in `SimulationEngine::run`. |
| **I: Interface Segregation** | Two small interfaces instead of one big one: `IJsonSerializable` (for the UI) and `IPersistable` (for the files). `Attack` implements only the first; `Asset`/`Defense` both. No class is forced to implement methods it doesn't need. |
| **D: Dependency Inversion** | `SimulationEngine::run` and `RecommendationEngine::bestFor` depend on the abstract `Attack&`; `Organization` depends on abstract `Asset*`/`Defense*`; callers get reports through the abstract `Report`. Honest limit: the engine takes a concrete `Organization&` and builds a `RiskAnalyzer` directly, so the dependency inversion is applied to the parts that vary (attacks, defenses, assets, reports), not everywhere. |

---

## Quick viva answers

- **Why `virtual ~Attack()`?** So deleting a derived object through a base pointer/reference runs the derived destructor too (otherwise undefined behaviour / leaks).
- **Why a copy constructor on `Organization`?** It owns raw pointers. The default copy would copy the pointers, so two organizations would delete the same objects (double free). Deep copy via `clone()` fixes that and also powers the "try this upgrade on a copy" recommendation.
- **Why `clone()` instead of copying through the base?** Copying an `Asset&` would slice off the derived part; a virtual `clone()` creates the correct derived type (virtual constructor idiom).
- **Static or dynamic binding?** `attack.damageFactor()` is dynamic (virtual); `asset.name()` and the overloaded `applyDamage` calls are static.
- **Why are `Asset`/`Attack` constructors `protected`?** The classes are abstract anyway, and a protected constructor makes the intent explicit: only subclasses build them.
- **Where is the formula hidden?** `SimulationEngine::run` and `Attack::strengthAgainst` / `Organization::defenseAgainst`; the private `power_` and `level_` are never exposed for editing.
- **How does the C++ talk to the web page?** The engine is a command-line program that prints JSON; FastAPI runs it with `subprocess` and returns the JSON; `app.js` calls the API with `fetch`.
