// app.js：渲染结果
import { read } from "./mvcc.js";
import { vacuum } from "./vacuum.js";

export function render(spec) {
  const reads = spec.reads || [];
  const snapshots = spec.snapshots || [];
  const view = read(spec.commits, reads, snapshots);
  const cleaned = vacuum(spec.commits, snapshots, spec.budget);
  const gone = new Set(cleaned.vacuumed.map(([seq, key]) => seq + "" + key));
  const remaining = spec.commits.filter((commit) => !gone.has(commit.seq + "" + commit.key));
  const after = read(remaining, reads, snapshots);
  const consistent = JSON.stringify(view.visible) === JSON.stringify(after.visible);
  return { visible: view.visible, chains: view.chains, vacuumed: cleaned.vacuumed,
           protected: cleaned.protected, budget_used: cleaned.used, consistent };
}
