// mvcc.js：版本链与可见性（基线：只留最新值）
export function read(commits, reads, snapshots) {
  const latest = {};
  for (const commit of commits) latest[commit.key] = commit.value;
  return { visible: reads.map((read) => [read.tx, latest[read.key] ?? null]), chains: latest };
}
