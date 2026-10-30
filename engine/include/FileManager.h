#pragma once
#include <filesystem>
#include <fstream>
#include <string>

#include "IncidentHistory.h"
#include "Organization.h"

// All disk access lives here (Single Responsibility). Layout of the data folder:
//   org.cfg       organization + assets + defenses   (one record per line, '|' separated)
//   history.log   one incident per line, appended
//   stats.txt     simulation statistics, rewritten after each attack
//   reports/      generated text reports
class FileManager {
    std::string dir_;
    std::ofstream log_;  // kept open in append mode for the object's lifetime

    std::string path(const std::string& file) const { return dir_ + "/" + file; }

    void openLog(std::ios::openmode mode) {
        log_.open(path("history.log"), mode);
        if (!log_) throw FileException("Cannot open " + path("history.log") + " for writing");
    }

public:
    explicit FileManager(const std::string& dir) : dir_(dir) {
        try {
            std::filesystem::create_directories(dir_ + "/reports");
        } catch (const std::filesystem::filesystem_error& e) {
            throw FileException(std::string("Cannot create data folder: ") + e.what());
        }
        openLog(std::ios::out | std::ios::app);
    }
    ~FileManager() { if (log_.is_open()) log_.close(); }  // release the file handle
    FileManager(const FileManager&) = delete;             // a stream cannot be copied
    FileManager& operator=(const FileManager&) = delete;

    bool hasOrganization() const { return std::filesystem::exists(path("org.cfg")); }

    void saveOrganization(const Organization& org) {
        std::ofstream out(path("org.cfg"), std::ios::out | std::ios::trunc);
        if (!out) throw FileException("Cannot write " + path("org.cfg"));
        out << "org|" << org.name() << '|' << org.securityLevel() << '|' << org.employees() << '\n';
        for (const Asset* a : org.assets()) out << a->toRecord() << '\n';
        for (const Defense* d : org.defenses()) out << d->toRecord() << '\n';
        out.flush();
        if (!out) throw FileException("Write failed for " + path("org.cfg"));
    }

    Organization loadOrganization() const {
        std::ifstream in(path("org.cfg"));
        if (!in) throw FileException("No organization found. Create one first.");
        Organization org;
        std::string line;
        int lineNo = 0;
        bool header = false;
        while (std::getline(in, line)) {
            ++lineNo;
            line = trim(line);
            if (line.empty()) continue;
            try {  // inner try: add the line number, then rethrow as a file error
                const std::vector<std::string> f = split(line, '|');
                if (f[0] == "org" && f.size() == 4) {
                    org = Organization(f[1], toInt(f[2], "level", 1, 5), toInt(f[3], "employees", 1, 100000000));
                    header = true;
                } else if (f[0] == "asset" && f.size() == 6) {
                    org.addAsset(createAsset(f[1], f[2], toDouble(f[3], "criticality"), toDouble(f[4], "vulnerability"), toDouble(f[5], "health")));
                } else if (f[0] == "defense" && f.size() == 4) {
                    org.addDefense(createDefense(f[1], f[2] == "1", toInt(f[3], "level", 0, 100)));
                } else {
                    throw ValidationException("unrecognised record");
                }
            } catch (const ValidationException& e) {
                throw FileException("Corrupt org.cfg at line " + std::to_string(lineNo) + ": " + e.what());
            }
        }
        if (!header) throw FileException("org.cfg has no organization header");
        return org;
    }

    void appendIncident(const Incident& incident) {
        log_ << incident << '\n';
        log_.flush();
        if (!log_) throw FileException("Write failed for history.log");
    }

    IncidentHistory loadHistory() const {
        IncidentHistory h;
        std::ifstream in(path("history.log"));
        std::string line;
        while (std::getline(in, line)) {
            if (trim(line).empty()) continue;
            try {
                h.add(Incident::fromRecord(line));
            } catch (const ValidationException& e) {  // bad number inside a record
                throw FileException(std::string("Corrupt history.log: ") + e.what());
            }
        }
        return h;
    }

    void clearHistory() {
        log_.close();
        openLog(std::ios::out | std::ios::trunc);  // truncate, then continue appending
        log_.close();
        openLog(std::ios::out | std::ios::app);
    }

    void saveStats(const IncidentHistory& h, double score) {
        std::ofstream out(path("stats.txt"), std::ios::out | std::ios::trunc);
        if (!out) throw FileException("Cannot write " + path("stats.txt"));
        out << "incidents=" << h.size() << "\nblocked=" << h.count("BLOCKED") << "\npartial=" << h.count("PARTIALLY_BLOCKED")
            << "\nsuccessful=" << h.count("SUCCESSFUL") << "\nsecurity_score=" << score << '\n';
    }

    std::string saveReport(const std::string& tag, const std::string& text) {
        const std::string stamp = timestampNow();
        std::string safe;
        for (char c : stamp) safe += (c == ' ' || c == ':') ? '-' : c;
        const std::string file = "reports/" + tag + "_" + safe + ".txt";
        std::ofstream out(path(file));
        if (!out) throw FileException("Cannot write report " + path(file));
        out << text;
        return path(file);
    }

    // File pointer demo: seek to the end, ask where we are.
    long fileSize(const std::string& file) const {
        std::ifstream in(path(file), std::ios::binary);
        if (!in) return 0;
        in.seekg(0, std::ios::end);
        return static_cast<long>(in.tellg());
    }
};
