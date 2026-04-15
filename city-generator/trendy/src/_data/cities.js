const fs = require("fs");
const path = require("path");

module.exports = function () {
  const dir = path.join(__dirname, "cityData");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")));
};
