// app.js：渲染结果
import { read } from "./mvcc.js";
import { vacuum } from "./vacuum.js";

export function render(spec) {
  const snapshots = spec.snapshots || [];
  const reads = spec.reads || [];
  const view = read(spec.commits, reads, snapshots);
  const cleaned = vacuum(spec.commits, snapshots, spec.budget);

  // 不变量校验：把被回收的版本从提交日志中移除后，活跃快照的读结果必须一致
  const removed = new Set(cleaned.vacuumed.map(([seq, key]) => seq + "" + key));
  const remaining = spec.commits.filter((commit) => !removed.has(commit.seq + "" + commit.key));
  const after = read(remaining, reads, snapshots);
  const consistent = JSON.stringify(after.visible) === JSON.stringify(view.visible);

  return { visible: view.visible, chains: view.chains, vacuumed: cleaned.vacuumed,
           protected: cleaned.protected, budget_used: cleaned.used, consistent };
}
