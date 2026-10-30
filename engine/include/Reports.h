#pragma once
#include <memory>
#include <string>

class Organization;     // forward declarations: the headers are only needed in Reports.cpp
class IncidentHistory;

// Template-method pattern: render() is fixed (header + body + footer), each
// subclass only supplies title() and body(). Data members are private.
class Report {
    const Organization& org_;
    const IncidentHistory& history_;

protected:
    const Organization& org() const { return org_; }
    const IncidentHistory& history() const { return history_; }
    virtual std::string body() const = 0;

public:
    Report(const Organization& org, const IncidentHistory& history) : org_(org), history_(history) {}
    virtual ~Report() {}
    virtual std::string title() const = 0;
    virtual std::string tag() const = 0;  // used in the file name
    std::string render() const;
};

class SummaryReport : public Report {
public:
    using Report::Report;
    std::string title() const override { return "Executive Summary Report"; }
    std::string tag() const override { return "summary"; }
protected:
    std::string body() const override;
};

class AttackLogReport : public Report {
public:
    using Report::Report;
    std::string title() const override { return "Attack Log Report"; }
    std::string tag() const override { return "attack-log"; }
protected:
    std::string body() const override;
};

class RiskReport : public Report {
public:
    using Report::Report;
    std::string title() const override { return "Risk Assessment Report"; }
    std::string tag() const override { return "risk"; }
protected:
    std::string body() const override;
};

class RecommendationReport : public Report {
public:
    using Report::Report;
    std::string title() const override { return "Recommendation Report"; }
    std::string tag() const override { return "recommendations"; }
protected:
    std::string body() const override;
};

// Facade: callers ask for a report by name and never see the concrete classes.
class SecurityReport {
public:
    static std::unique_ptr<Report> create(const std::string& type, const Organization& org, const IncidentHistory& history);
};
