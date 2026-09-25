// vacuum.js：回收（基线：全部回收、不看快照）
export function vacuum(commits, snapshots, budget) {
  return { vacuumed: commits.map((commit) => [commit.seq, commit.key]), protected: [], used: commits.length };
}
