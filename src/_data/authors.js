// The Tinker Click Authors for /licence/#authors: the names in the repo's AUTHORS file, without its comments
const fs = require("fs");
const path = require("path");

module.exports = fs.readFileSync(path.join(__dirname, "..", "..", "AUTHORS"), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
