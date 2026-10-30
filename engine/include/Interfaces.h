#pragma once
#include <string>

// Two small, separate interfaces (Interface Segregation): a class that only
// needs to be sent to the UI does not have to know about the file format.
struct IJsonSerializable {
    virtual ~IJsonSerializable() = default;
    virtual std::string toJson() const = 0;
};

struct IPersistable {
    virtual ~IPersistable() = default;
    virtual std::string toRecord() const = 0;  // one line of text for the data files
};
