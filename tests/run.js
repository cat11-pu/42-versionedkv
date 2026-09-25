import assert from "node:assert";
import { read } from "../mvcc.js";
import { vacuum, VACUUM_CONFLICT } from "../vacuum.js";
import { render } from "../app.js";

let failed = 0;
let total = 0;
function check(name, fn) {
  total += 1;
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

// ---- 功能迭代：快照读、回收、预算、不变量、异常路径 ----
const sample = {
  commits: [
    { seq: 1, tx: "t0", key: "k0", value: "v1" },
    { seq: 2, tx: "t1", key: "k0", value: "v2" },
    { seq: 3, tx: "t2", key: "k1", value: "w1" },
    { seq: 4, tx: "t3", key: "k0", value: "v3" },
    { seq: 5, tx: "t4", key: "k1", value: "w2" },
  ],
  snapshots: [{ tx: "r0", at: 2 }, { tx: "r1", at: 5 }],
  reads: [
    { tx: "r0", key: "k0" },
    { tx: "r0", key: "k1" },
    { tx: "r1", key: "k0" },
  ],
  budget: 3,
};

check("read resolves versions at snapshot points", () => {
  assert.deepStrictEqual(read(sample.commits, sample.reads, sample.snapshots).visible,
    [["r0", "v2"], ["r0", null], ["r1", "v3"]]);
});

check("read returns per-key chains sorted by seq", () => {
  assert.deepStrictEqual(read(sample.commits, [], []).chains,
    { k0: [[1, "v1"], [2, "v2"], [4, "v3"]], k1: [[3, "w1"], [5, "w2"]] });
});

check("vacuum keeps the version visible to the oldest snapshot", () => {
  assert.deepStrictEqual(vacuum(sample.commits, sample.snapshots, 3),
    { vacuumed: [[1, "k0"]], protected: [[2, "k0"]], used: 1 });
});

check("budget overflow is protected, not vacuumed", () => {
  const wide = [
    { seq: 1, tx: "t", key: "a", value: 1 },
    { seq: 2, tx: "t", key: "a", value: 2 },
    { seq: 3, tx: "t", key: "a", value: 3 },
    { seq: 4, tx: "t", key: "a", value: 4 },
  ];
  assert.deepStrictEqual(vacuum(wide, [{ tx: "r", at: 4 }], 1),
    { vacuumed: [[1, "a"]], protected: [[2, "a"], [3, "a"], [4, "a"]], used: 1 });
});

check("no snapshots keeps only the latest version per key", () => {
  const out = vacuum(sample.commits, [], 10);
  assert.deepStrictEqual(out.vacuumed, [[1, "k0"], [2, "k0"], [3, "k1"]]);
  assert.deepStrictEqual(out.protected, [[4, "k0"], [5, "k1"]]);
  assert.strictEqual(out.used, 3);
});

check("vacuuming a snapshot-visible version raises E_VACUUM_CONFLICT", () => {
  const disordered = [
    { seq: 2, tx: "t", key: "k", value: "new" },
    { seq: 1, tx: "t", key: "k", value: "old" },
  ];
  assert.throws(() => vacuum(disordered, [{ tx: "r", at: 2 }], 5),
    (error) => error.message === VACUUM_CONFLICT);
});

check("render keeps snapshot reads consistent across vacuum", () => {
  const out = render(sample);
  assert.strictEqual(out.consistent, true);
  assert.deepStrictEqual(Object.keys(out).sort(),
    ["budget_used", "chains", "consistent", "protected", "vacuumed", "visible"]);
});

console.log(total + " cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
