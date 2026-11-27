#!/usr/bin/env node
// Render design/social-card.html to src/assets/social-card.png at 1200 x 630.
//
//   node design/render-social.cjs                 # the dark card, into src/assets/
//   node design/render-social.cjs --theme light   # the light one
//   node design/render-social.cjs --out FILE      # somewhere else, to compare
//
// Needs Google Chrome (or $CHROME) and nothing from npm: it drives Chrome over the DevTools
// protocol with Node's own fetch and WebSocket. It refuses to write a card whose fonts or
// pictures did not load, since a fallback font on a share image goes out to everyone.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const theme = opt("--theme", "dark");
const out = path.resolve(opt("--out", path.join(root, "src", "assets", "social-card.png")));
const chromePath = process.env.CHROME || (process.platform === "darwin"
  ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "google-chrome");
const W = 1200, H = 630;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "social-card-"));
  const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
    `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
  try {
    // Chrome writes the port it chose into the profile folder.
    const portFile = path.join(profile, "DevToolsActivePort");
    for (let i = 0; i < 80 && !fs.existsSync(portFile); i++) await sleep(100);
    const port = fs.readFileSync(portFile, "utf8").split("\n")[0];
    let target;
    for (let i = 0; i < 40 && !target; i++) {
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {}
      if (!target) await sleep(100);
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const waiting = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      waiting.set(++id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    const url = "file://" + path.join(root, "design", "social-card.html") + (theme === "light" ? "?theme=light" : "");
    await send("Page.navigate", { url });
    await sleep(500);
    const check = await send("Runtime.evaluate", {
      awaitPromise: true, returnByValue: true,
      expression: `(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
        return {
          anton: document.fonts.check('400 100px Anton'),
          geist: document.fonts.check('500 40px Geist'),
          images: [...document.images].every((i) => i.complete && i.naturalWidth > 0),
          fits: document.documentElement.scrollWidth <= ${W} && document.documentElement.scrollHeight <= ${H},
        };
      })()`,
    });
    const ok = check.result.value;
    const failed = Object.entries(ok).filter(([, v]) => !v).map(([k]) => k);
    if (failed.length) throw new Error(`not written: ${failed.join(", ")} failed (${JSON.stringify(ok)})`);
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
    console.log(`wrote ${path.relative(process.cwd(), out)} (${theme}, ${W}x${H})`);
    ws.close();
  } finally {
    chrome.kill();
    await sleep(200);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((err) => { console.error("render-social:", err.message); process.exit(1); });
