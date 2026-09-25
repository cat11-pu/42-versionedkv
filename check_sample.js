import fs from "node:fs";
import { read } from "./mvcc.js";
import { vacuum } from "./vacuum.js";
import { render } from "./app.js";

// 验收断言：上面每条值收进 emit，最后与期望值逐项比对，不符就非零退出。
const __lines = [];
function emit(label, value) { __lines.push([String(label).replace(/ =$/, ""), value]); }


const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/mvcc.json", "utf8"));
const view = read(spec.commits, spec.reads || [], spec.snapshots || []);
const cleaned = vacuum(spec.commits, spec.snapshots || [], spec.budget);
const out = render(spec);

emit("每次读到的版本 =", JSON.stringify(view.visible));
emit("每个键的版本链 =", JSON.stringify(view.chains));
emit("被回收的版本 =", JSON.stringify(cleaned.vacuumed));
emit("被快照保护的版本 =", JSON.stringify(cleaned.protected));
emit("预算消耗 =", cleaned.used);
emit("活跃快照读是否一致 =", out.consistent);
emit("回收冲突的错误码 =", spec.conflict_code);


// ---- 期望值（参考模型算出，与题面给的验收数值一致）----
const EXPECTED = {
  "每次读到的版本": [
    [
      "r0",
      "v2"
    ],
    [
      "r0",
      null
    ],
    [
      "r1",
      "v3"
    ]
  ],
  "每个键的版本链": {
    "k0": [
      [
        1,
        "v1"
      ],
      [
        2,
        "v2"
      ],
      [
        4,
        "v3"
      ]
    ],
    "k1": [
      [
        3,
        "w1"
      ],
      [
        5,
        "w2"
      ]
    ]
  },
  "被回收的版本": [
    [
      1,
      "k0"
    ]
  ],
  "被快照保护的版本": [
    [
      2,
      "k0"
    ]
  ],
  "预算消耗": 1,
  "活跃快照读是否一致": true,
  "回收冲突的错误码": "E_VACUUM_CONFLICT"
};
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) { __bad += 1; console.log("缺失验收项 " + label); continue; }
  const got = found[1];
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("一致 " + label + " = " + JSON.stringify(got)); }
  else { __bad += 1; console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(got)); }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);
