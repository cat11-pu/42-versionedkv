// vacuum.js：回收（只回收所有活跃快照都看不见的旧版本，单次线性扫描）
import { buildChains } from "./mvcc.js";

export const E_VACUUM_CONFLICT = "E_VACUUM_CONFLICT";

export function vacuum(commits, snapshots, budget) {
  const active = snapshots || [];
  const limit = budget === undefined || budget === null ? Infinity : budget;
  const chains = buildChains(commits);

  // 最老活跃快照点决定回收下界；无快照时只留每键最新版本
  const horizon = active.length ? Math.min(...active.map((s) => s.at)) : Infinity;

  // 每个键被活跃快照可见的序号集合（用于冲突检测，每版本只判一次）
  const visibleSeqs = {};
  for (const key of Object.keys(chains)) {
    const chain = chains[key];
    const seen = new Set();
    for (const snapshot of active) {
      let lo = 0, hi = chain.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (chain[mid][0] <= snapshot.at) lo = mid + 1; else hi = mid;
      }
      if (lo > 0) seen.add(chain[lo - 1][0]);
    }
    visibleSeqs[key] = seen;
  }

  const vacuumed = [];
  const protectedList = [];
  let used = 0;

  for (const key of Object.keys(chains)) {
    const chain = chains[key];
    // 最老快照在该键上可见的版本（支点）：它之前的版本对所有快照都不可见
    let pivot = -1;
    for (let i = 0; i < chain.length; i += 1) {
      if (chain[i][0] <= horizon) pivot = i; else break;
    }
    for (let i = 0; i < chain.length; i += 1) {
      const [seq] = chain[i];
      if (i < pivot) {
        if (visibleSeqs[key].has(seq)) {
          const error = new Error(E_VACUUM_CONFLICT + ": " + key + "@" + seq);
          error.code = E_VACUUM_CONFLICT;
          throw error;
        }
        if (used < limit) {
          vacuumed.push([seq, key]);
          used += 1;
        } else {
          protectedList.push([seq, key]); // 预算用尽，列为受保护，不静默回收
        }
      } else if (i === pivot && pivot < chain.length - 1 && active.length) {
        protectedList.push([seq, key]); // 给最老快照保留的可见版本
      }
    }
  }

  return { vacuumed, protected: protectedList, used };
}
