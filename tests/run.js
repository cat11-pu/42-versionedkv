import assert from "node:assert";
import { read } from "../mvcc.js";
import { vacuum } from "../vacuum.js";
import { render } from "../app.js";

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

const commits = [{ seq: 1, tx: "t0", key: "k", value: 1 }];

check("read returns visible list", () => {
  assert.ok(Array.isArray(read(commits, [], []).visible));
});

check("read returns chains", () => {
  assert.strictEqual(typeof read(commits, [], []).chains, "object");
});

check("vacuum returns vacuumed list", () => {
  assert.ok(Array.isArray(vacuum(commits, [], 1).vacuumed));
});

check("vacuum returns protected list", () => {
  assert.ok(Array.isArray(vacuum(commits, [], 1).protected));
});

check("render exposes budget_used", () => {
  assert.strictEqual(typeof render({ commits: commits, reads: [], snapshots: [], budget: 1 }).budget_used, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
