// tinker.click answers every page with
//   Content-Security-Policy: default-src 'self'; style-src 'self'; script-src 'self'; ...
// so a browser drops every style="" attribute, <style> block, inline <script> and on*=""
// handler without a word. This plugin makes the build's output fit that policy:
//
//   style=""        moved into a class in /assets/css/inline.css, so templates keep writing it
//   <style>         the build fails: put the rules in src/assets/css/
//   inline <script> the build fails: put the code in src/assets/js/
//   on*=""          the build fails: use addEventListener in a file
//
// Data blocks such as <script type="application/ld+json"> are not run, so they stay.
// Pages under /concepts/ are design sketches that are never published; they are left alone.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ATTRS = String.raw`((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*)`;
// A whole <script> element (group 1), or one opening tag (name, attributes, self-closing slash).
const TAG = new RegExp(String.raw`(<script\b[^>]*>[\s\S]*?<\/script\s*>)|<([a-zA-Z][\w:-]*)${ATTRS}\s*(\/?)>`, "g");
const STYLE_ATTR = /\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const CLASS_ATTR = /(\sclass\s*=\s*)(?:"([^"]*)"|'([^']*)')/i;
const DATA_TYPES = /^(application\/(ld\+)?json|importmap|text\/plain)$/i;

function fail(outputPath, what) {
  throw new Error(`${outputPath}: ${what}. tinker.click's Content-Security-Policy would drop it; see src/_plugins/eleventy-plugin-csp.js`);
}

module.exports = function (eleventyConfig) {
  const rules = new Map(); // class name -> declarations
  let outputRoot = null;   // where this build writes, --output included

  eleventyConfig.on("eleventy.before", () => rules.clear());

  eleventyConfig.addTransform("csp", function (content) {
    const outputPath = this.page.outputPath || "";
    if (!outputPath.endsWith(".html") || (this.page.url || "").startsWith("/concepts/")) return content;
    if (this.page.url === "/") outputRoot = path.dirname(outputPath);

    return content.replace(TAG, (tag, script, name, attrs, slash) => {
      if (script) {
        const open = script.slice(0, script.indexOf(">") + 1);
        const body = script.slice(open.length, script.lastIndexOf("</"));
        const type = (/\stype\s*=\s*["']?([^"'\s>]+)/i.exec(open) || [])[1] || "";
        if (!/\ssrc\s*=/i.test(open) && body.trim() && !DATA_TYPES.test(type)) fail(outputPath, "inline <script>");
        return tag;
      }
      if (name.toLowerCase() === "style") fail(outputPath, "<style> block");
      const handler = /\s(on[a-z]+)\s*=/i.exec(attrs);
      if (handler) fail(outputPath, `${handler[1]}="" handler on <${name}>`);

      const style = STYLE_ATTR.exec(attrs);
      if (!style) return tag;
      const declarations = (style[1] ?? style[2]).trim().replace(/;\s*$/, "");
      let rest = attrs.replace(STYLE_ATTR, "");
      if (!declarations) return `<${name}${rest}${slash ? " /" : ""}>`;
      const cls = "s-" + crypto.createHash("sha256").update(declarations).digest("hex").slice(0, 8);
      rules.set(cls, declarations);
      rest = CLASS_ATTR.test(rest)
        ? rest.replace(CLASS_ATTR, (m, pre, dq, sq) => `${pre}"${dq ?? sq} ${cls}"`)
        : ` class="${cls}"${rest}`;
      return `<${name}${rest}${slash ? " /" : ""}>`;
    });
  });

  // The class is repeated so the rule outranks ordinary selectors, as the attribute did.
  eleventyConfig.on("eleventy.after", ({ dir }) => {
    const root = outputRoot || dir.output;
    const css = ["/* Written by the build from style=\"\" attributes. Do not edit: change the template. */"]
      .concat([...rules.keys()].sort().map((cls) => `.${cls}.${cls}.${cls} { ${rules.get(cls)} }`))
      .join("\n") + "\n";
    const file = path.join(root, "assets", "css", "inline.css");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, css);
  });
};
