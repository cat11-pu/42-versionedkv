// vacuum.js：回收（只回收所有活跃快照都看不见的旧版本）
//
// 下界 low = 最老活跃快照点：对每个键，序号不超过 low 的最大序号版本（锚点）
// 是所有活跃快照都可能可见的最老版本，必须保留；比它更旧的版本任何快照都
// 看不见，可以回收。没有活跃快照时 low 视为 +∞，即每个键只留最新版本。
//
// 预算：一轮最多回收 budget 个版本，超出的候选列为 protected。
//
// 线性扫描：提交日志按 seq 有序，单次顺序扫描中每个版本只判断一次。
// 每个键的锚点在遇到第一个超过 low 的版本时被锁定；扫描中暂记的锚点若被
// 更新的（仍不超过 low 的）版本取代，旧锚点即降级为可回收候选——无需回头
// 重扫链。输出阶段只按已记录的决定排放，不做任何判断。

export const VACUUM_CONFLICT = "E_VACUUM_CONFLICT";

export function vacuum(commits, snapshots, budget) {
  const limit = budget === undefined || budget === null ? Infinity : budget;
  let low = Infinity;
  for (const snapshot of snapshots || []) {
    if (snapshot.at < low) low = snapshot.at;
  }

  const states = {}; // key -> { anchor, locked }
  const decisions = new Map(); // commit -> "vacuum" | "protected"
  let used = 0;

  // 分类：单次线性扫描，每个版本只判断一次
  for (const commit of commits) {
    const state = states[commit.key] || (states[commit.key] = { anchor: null, locked: false });
    if (!state.locked && commit.seq <= low) {
      if (state.anchor !== null) {
        // 旧锚点被更新的（仍不超过 low 的）版本取代，降级为可回收候选：
        // 它的序号严格小于新锚点，对任何活跃快照都不可见
        if (used < limit) {
          decisions.set(state.anchor, "vacuum");
          used += 1;
        } else {
          decisions.set(state.anchor, "protected"); // 预算耗尽，列为受保护
        }
      }
      state.anchor = commit;
    } else {
      state.locked = true; // 出现超过 low 的版本后锚点不再变化
    }
  }

  // 收尾：仍停留在锚点位置的版本是该键为快照保留的可见版本，受保护
  for (const key of Object.keys(states)) {
    const anchor = states[key].anchor;
    if (anchor !== null) decisions.set(anchor, "protected");
  }

  // 防御性检查：被回收的版本不得是任何活跃快照可见的版本。
  // 候选序号都严格小于同键锚点（不超过 low 的最大序号版本），其余快照点
  // 都 >= low，可见版本只会更新，因此有序日志不会触发；若触发说明回收
  // 会删掉活跃快照可见的版本，拒绝照删。
  for (const [commit, decision] of decisions) {
    if (decision !== "vacuum") continue;
    const anchor = states[commit.key].anchor;
    if (anchor === null || anchor.seq > low || commit.seq >= anchor.seq) {
      throw new Error(VACUUM_CONFLICT);
    }
  }

  // 排放：按提交顺序输出，vacuumed 与 protected 都按序号升序
  const vacuumed = [];
  const protectedList = [];
  for (const commit of commits) {
    const decision = decisions.get(commit);
    if (decision === "vacuum") vacuumed.push([commit.seq, commit.key]);
    else if (decision === "protected") protectedList.push([commit.seq, commit.key]);
  }
  return { vacuumed, protected: protectedList, used };
}
