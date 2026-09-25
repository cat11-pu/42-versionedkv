// mvcc.js：版本链与可见性（按快照点读）
export function read(commits, reads, snapshots) {
  const chains = buildChains(commits);
  const snapAt = {};
  for (const snapshot of snapshots || []) snapAt[snapshot.tx] = snapshot.at;
  const visible = (reads || []).map((read) => {
    const at = read.tx in snapAt ? snapAt[read.tx] : Infinity;
    const chain = chains[read.key] || [];
    let hit = null;
    for (const [seq, value] of chain) {
      if (seq > at) break;
      hit = value;
    }
    return [read.tx, hit];
  });
  return { visible, chains };
}

// 每个键的版本链，按序号升序，元素为 [seq, value]
export function buildChains(commits) {
  const chains = {};
  for (const commit of commits) {
    if (!chains[commit.key]) chains[commit.key] = [];
    chains[commit.key].push([commit.seq, commit.value]);
  }
  for (const key of Object.keys(chains)) chains[key].sort((a, b) => a[0] - b[0]);
  return chains;
}
