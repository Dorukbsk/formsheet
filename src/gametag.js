/* ============================================================
   AthletiX — full-match tagging: tag buttons and stat maths.
   Pure logic, no React.
   ============================================================ */

// Each tag adds to counters (inc). `metrics` = which log-page stats it feeds,
// used to show only the buttons that matter for your position.
export const TAGS = {
  football: [
    { key: "goal", label: "Goal", inc: { goals: 1, shotOn: 1, shots: 1 }, metrics: ["goals", "shotAcc"] },
    { key: "shotOn", label: "Shot on target", inc: { shotOn: 1, shots: 1 }, metrics: ["shotAcc"] },
    { key: "shotOff", label: "Shot off target", inc: { shots: 1 }, metrics: ["shotAcc"] },
    { key: "assist", label: "Assist", inc: { assists: 1 }, metrics: ["assists"] },
    { key: "keyPass", label: "Key pass", inc: { keyPasses: 1 }, metrics: ["keyPasses"] },
    { key: "passOk", label: "Pass completed", inc: { passOk: 1, passes: 1 }, metrics: ["passAcc"] },
    { key: "passBad", label: "Pass missed", inc: { passes: 1 }, metrics: ["passAcc"] },
    { key: "duelWon", label: "Duel won", inc: { duelsW: 1, duels: 1 }, metrics: ["duelsWon"] },
    { key: "duelLost", label: "Duel lost", inc: { duels: 1 }, metrics: ["duelsWon"] },
    { key: "tackle", label: "Tackle won", inc: { tackles: 1 }, metrics: ["tackles"] },
    { key: "intercept", label: "Interception", inc: { intercept: 1 }, metrics: ["intercept"] },
    { key: "lost", label: "Lost the ball", inc: { turnovers: 1 }, metrics: ["turnovers"] },
    { key: "save", label: "Save", inc: { saves: 1, faced: 1 }, metrics: ["saves", "savePct"] },
    { key: "conceded", label: "Goal conceded", inc: { conceded: 1, faced: 1 }, metrics: ["conceded", "savePct"] },
    { key: "claim", label: "Cross claimed", inc: { claims: 1 }, metrics: ["claims"] },
  ],
  basketball: [
    { key: "m2", label: "2PT made", inc: { m2: 1, a2: 1 }, metrics: ["points", "fg"] },
    { key: "x2", label: "2PT missed", inc: { a2: 1 }, metrics: ["points", "fg"] },
    { key: "m3", label: "3PT made", inc: { m3: 1, a3: 1 }, metrics: ["points", "fg", "three"] },
    { key: "x3", label: "3PT missed", inc: { a3: 1 }, metrics: ["points", "fg", "three"] },
    { key: "mft", label: "Free throw made", inc: { mft: 1, aft: 1 }, metrics: ["points", "ft"] },
    { key: "xft", label: "Free throw missed", inc: { aft: 1 }, metrics: ["points", "ft"] },
    { key: "reb", label: "Rebound", inc: { reb: 1 }, metrics: ["reb"] },
    { key: "ast", label: "Assist", inc: { ast: 1 }, metrics: ["ast"] },
    { key: "stl", label: "Steal", inc: { stl: 1 }, metrics: ["stl"] },
    { key: "blk", label: "Block", inc: { blk: 1 }, metrics: ["blk"] },
    { key: "tov", label: "Turnover", inc: { tov: 1 }, metrics: ["tov"] },
  ],
  volleyball: [
    { key: "kill", label: "Kill", inc: { kills: 1, atk: 1 }, metrics: ["kills", "hitEff"] },
    { key: "atkErr", label: "Attack error", inc: { atkErr: 1, atk: 1 }, metrics: ["hitEff"] },
    { key: "atkIn", label: "Attack kept in play", inc: { atk: 1 }, metrics: ["hitEff"] },
    { key: "ace", label: "Ace", inc: { aces: 1 }, metrics: ["aces"] },
    { key: "srvErr", label: "Serve error", inc: { serveErr: 1 }, metrics: ["serveErr"] },
    { key: "blk", label: "Block", inc: { blocksV: 1 }, metrics: ["blocksV"] },
    { key: "dig", label: "Dig", inc: { digs: 1 }, metrics: ["digs"] },
    { key: "recOk", label: "Good reception", inc: { recOk: 1, rec: 1 }, metrics: ["recep"] },
    { key: "recBad", label: "Poor reception", inc: { rec: 1 }, metrics: ["recep"] },
    { key: "setAst", label: "Set assist", inc: { setAst: 1 }, metrics: ["setAst"] },
  ],
};

const pct = (ok, all) => (all > 0 ? Math.round((ok / all) * 100) : undefined);

// counters -> log-page stats
const FORMULAS = {
  football: {
    goals: (c) => c.goals, assists: (c) => c.assists, shotAcc: (c) => pct(c.shotOn, c.shots),
    passAcc: (c) => pct(c.passOk, c.passes), keyPasses: (c) => c.keyPasses, duelsWon: (c) => pct(c.duelsW, c.duels),
    tackles: (c) => c.tackles, intercept: (c) => c.intercept, turnovers: (c) => c.turnovers,
    saves: (c) => c.saves, savePct: (c) => pct(c.saves, c.faced), claims: (c) => c.claims, conceded: (c) => c.conceded,
  },
  basketball: {
    points: (c) => 2 * c.m2 + 3 * c.m3 + c.mft, fg: (c) => pct(c.m2 + c.m3, c.a2 + c.a3), three: (c) => pct(c.m3, c.a3),
    ft: (c) => pct(c.mft, c.aft), reb: (c) => c.reb, ast: (c) => c.ast, stl: (c) => c.stl, blk: (c) => c.blk, tov: (c) => c.tov,
  },
  volleyball: {
    kills: (c) => c.kills, hitEff: (c) => (c.atk > 0 ? Math.round(((c.kills - c.atkErr) / c.atk) * 100) : undefined),
    aces: (c) => c.aces, serveErr: (c) => c.serveErr, blocksV: (c) => c.blocksV, digs: (c) => c.digs,
    recep: (c) => pct(c.recOk, c.rec), setAst: (c) => c.setAst,
  },
};

export function visibleTags(sport, metricKeys) {
  const keys = new Set(metricKeys);
  return (TAGS[sport] || []).filter((t) => t.metrics.some((m) => keys.has(m)));
}

export function countTags(tags) {
  const by = {};
  tags.forEach((t) => { by[t.type] = (by[t.type] || 0) + 1; });
  return by;
}

// tags: [{ t, type }]. Returns { raw: { metricKey: "value" } } for the metrics of your position.
export function computeStats(tags, sport, metricKeys) {
  const defs = Object.fromEntries((TAGS[sport] || []).map((d) => [d.key, d]));
  const store = {};
  tags.forEach((t) => {
    const d = defs[t.type];
    if (!d) return;
    Object.entries(d.inc).forEach(([k, v]) => { store[k] = (store[k] || 0) + v; });
  });
  const counters = new Proxy(store, { get: (o, k) => o[k] || 0 });

  const shown = new Set(visibleTags(sport, metricKeys).flatMap((t) => t.metrics));
  const raw = {};
  (metricKeys || []).forEach((k) => {
    const f = FORMULAS[sport] && FORMULAS[sport][k];
    if (!f || !shown.has(k)) return;
    const v = f(counters);
    if (v === undefined || Number.isNaN(v)) return; // percentages with no attempts stay empty
    raw[k] = String(v);
  });
  return { raw };
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

export function defaultUnits(sport, durationSec) {
  if (sport === "volleyball") return 3;
  return Math.max(1, Math.round((durationSec || 0) / 60));
}
