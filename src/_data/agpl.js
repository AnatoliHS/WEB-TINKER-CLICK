// The full GNU AGPL v3 for /licence/ (licence.html), verbatim from https://www.gnu.org/licenses/agpl-3.0.txt
const fs = require("fs");
const path = require("path");

module.exports = fs.readFileSync(path.join(__dirname, "agpl-3.0.txt"), "utf8");
