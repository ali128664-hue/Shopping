// Tiny JSON-file database with atomic writes (no dependencies).
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "db.json");

const EMPTY = { products: {}, orders: [], messages: [], subscribers: [], counters: { order: 1000 } };
let state = null;
let timer = null;

function load() {
  if (state) return state;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    state = { ...structuredClone(EMPTY), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch (e) {
    if (e.code !== "ENOENT") {
      // keep a copy of a damaged file instead of silently overwriting it
      fs.copyFileSync(FILE, FILE + ".broken-" + Date.now());
      console.warn("[db] db.json could not be read, a backup was made and a fresh database started.");
    }
    state = structuredClone(EMPTY);
  }
  return state;
}

function writeNow() {
  clearTimeout(timer); timer = null;
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, FILE);
}

// batch writes that happen close together
function save() {
  if (!timer) timer = setTimeout(writeNow, 50);
}

process.on("exit", () => { if (timer) writeNow(); });
["SIGINT", "SIGTERM"].forEach((s) => process.on(s, () => { if (timer) writeNow(); process.exit(0); }));

module.exports = { load, save, writeNow, FILE, DATA_DIR };
