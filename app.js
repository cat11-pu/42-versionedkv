// app.js：渲染结果
import { read } from "./mvcc.js";
import { vacuum } from "./vacuum.js";

export function render(spec) {
  const view = read(spec.commits, spec.reads || [], spec.snapshots || []);
  const cleaned = vacuum(spec.commits, spec.snapshots || [], spec.budget);
  return { visible: view.visible, chains: view.chains, vacuumed: cleaned.vacuumed,
           protected: cleaned.protected, budget_used: cleaned.used, consistent: true };
}
