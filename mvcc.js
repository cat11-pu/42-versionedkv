// mvcc.js：版本链与可见性（按快照点读）
// 规则：读到的版本 = 该键中序号不超过读所在快照点的最大序号版本，没有则为空。
export function read(commits, reads, snapshots) {
  const snapshotAt = {};
  for (const snapshot of snapshots || []) snapshotAt[snapshot.tx] = snapshot.at;

  const chains = {};
  for (const commit of commits) {
    (chains[commit.key] || (chains[commit.key] = [])).push([commit.seq, commit.value]);
  }
  // 版本链按序号升序（提交日志本身有序时此排序为空操作）
  for (const key of Object.keys(chains)) chains[key].sort((a, b) => a[0] - b[0]);

  const visible = (reads || []).map((read) => {
    const at = snapshotAt[read.tx];
    const chain = chains[read.key];
    let value = null;
    if (at !== undefined && chain) {
      for (let i = chain.length - 1; i >= 0; i -= 1) {
        if (chain[i][0] <= at) { value = chain[i][1]; break; }
      }
    }
    return [read.tx, value];
  });

  return { visible, chains };
}
