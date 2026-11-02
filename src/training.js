/* ============================================================
   AthletiX — training plans + quick entry config
   Pure logic, no React. Imported by form-sheet.jsx.
   ============================================================ */

/* ---------- Quick entry: the 5 most telling stats per role ---------- */

export const QUICK = {
  football: {
    FW: ["goals", "shotAcc", "assists", "duelsWon", "turnovers"],
    WING: ["assists", "keyPasses", "goals", "duelsWon", "turnovers"],
    MID: ["passAcc", "keyPasses", "tackles", "intercept", "turnovers"],
    DEF: ["tackles", "intercept", "duelsWon", "passAcc", "turnovers"],
    GK: ["saves", "savePct", "claims", "conceded", "passAcc"],
  },
  basketball: {
    G: ["points", "fg", "ast", "tov", "stl"],
    W: ["points", "fg", "three", "reb", "stl"],
    B: ["points", "fg", "reb", "blk", "tov"],
  },
  volleyball: {
    OH: ["kills", "hitEff", "recep", "digs", "serveErr"],
    OPP: ["kills", "hitEff", "blocksV", "aces", "serveErr"],
    MB: ["kills", "hitEff", "blocksV", "aces", "serveErr"],
    S: ["setAst", "digs", "aces", "serveErr", "blocksV"],
    L: ["digs", "recep", "aces", "serveErr"],
  },
};

/* ---------- Where you can train ---------- */

export const PLACES = {
  field: { football: "Pitch", basketball: "Court", volleyball: "Court" },
  gym: "Gym",
  home: "Home",
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ---------- Drill library ----------
   type: "skill" (technique) or "physical" (fitness)
   where: places this drill works
   metrics: stats it improves
   gk: true = goalkeeper-only drill                     */

export const DRILLS = {
  football: [
    { name: "Rondo 4v2, one touch", detail: "6 × 2 min. Defenders swap on every interception.", mins: 12, type: "skill", where: ["field"], metrics: ["passAcc", "turnovers", "keyPasses"] },
    { name: "Wall passing, both feet", detail: "Two-touch against a wall, 5 min each foot. Receive across your body.", mins: 10, type: "skill", where: ["field", "home"], metrics: ["passAcc", "turnovers"] },
    { name: "Ball mastery in a small space", detail: "Toe taps, sole rolls, inside-outside touches. 6 × 40 s on, 20 s off.", mins: 8, type: "skill", where: ["home", "field"], metrics: ["turnovers", "passAcc"] },
    { name: "Juggling and first touch", detail: "Alternate feet, then thigh-foot. Count your best streak and beat it.", mins: 8, type: "skill", where: ["home", "field"], metrics: ["turnovers"] },
    { name: "Cut-back finishing", detail: "20 finishes each side from a cut-back. First touch across your body, then finish low.", mins: 12, type: "skill", where: ["field"], metrics: ["goals", "shotAcc"] },
    { name: "Low-corner placement", detail: "20 side-foot finishes aimed at the bottom corners before any power shots.", mins: 10, type: "skill", where: ["field"], metrics: ["shotAcc", "goals"] },
    { name: "Line-breaking passes", detail: "3-zone game: a point only counts when a pass skips a zone.", mins: 12, type: "skill", where: ["field"], metrics: ["keyPasses", "assists"] },
    { name: "Cross and cut-back delivery", detail: "Deliver into a 2 m target gate, 15 per side.", mins: 10, type: "skill", where: ["field"], metrics: ["assists", "keyPasses"] },
    { name: "1v1 shielding", detail: "Keep the ball for 30 s against a defender. 8 rounds.", mins: 10, type: "skill", where: ["field"], metrics: ["duelsWon", "turnovers"] },
    { name: "Front-foot 1v1 defending", detail: "Channel 10 m wide. Delay, show outside, tackle only when the touch goes long. 20 reps.", mins: 10, type: "skill", where: ["field"], metrics: ["tackles", "duelsWon"] },
    { name: "Passing-lane game", detail: "3v3 where an interception scores 2 points. Stand in lanes, not on players.", mins: 12, type: "skill", where: ["field"], metrics: ["intercept"] },
    { name: "Repeated sprints", detail: "10 × 30 m, 25 s walk back between each.", mins: 12, type: "physical", where: ["field"], metrics: ["distance", "tackles", "duelsWon"] },
    { name: "Tempo runs", detail: "15 × 100 m at 70% pace, walk 50 m between.", mins: 20, type: "physical", where: ["field", "home"], metrics: ["distance"] },
    { name: "Bike or rower intervals", detail: "8 × 1 min hard, 1 min easy.", mins: 16, type: "physical", where: ["gym"], metrics: ["distance"] },
    { name: "Single-leg strength", detail: "Split squats 3 × 8 each leg, lateral bounds 3 × 6 each side.", mins: 15, type: "physical", where: ["gym", "home"], metrics: ["duelsWon", "tackles"] },
    { name: "Core and hip stability", detail: "Plank 40 s, side plank 30 s each, glute bridge 15. Three rounds.", mins: 10, type: "physical", where: ["home", "gym"], metrics: ["duelsWon"] },
    { name: "Reaction saves", detail: "Shots off a deflection board or a partner's hand. 3 × 10.", mins: 12, type: "skill", where: ["field"], metrics: ["saves", "savePct"], gk: true },
    { name: "Low-hand technique", detail: "30 shots below the waist. Hands lead, body behind the ball.", mins: 10, type: "skill", where: ["field"], metrics: ["savePct", "saves"], gk: true },
    { name: "Cross claiming", detail: "20 crosses with a passive blocker. Call early and loud.", mins: 10, type: "skill", where: ["field"], metrics: ["claims"], gk: true },
    { name: "Set-position footwork", detail: "Side shuffle, set, explode to a dive mat or cone. 4 × 6 each side.", mins: 10, type: "physical", where: ["field", "gym", "home"], metrics: ["saves", "savePct"], gk: true },
    { name: "Distribution to targets", detail: "Throws and kicks to a partner in 3 zones, 10 each.", mins: 10, type: "skill", where: ["field"], metrics: ["passAcc"], gk: true },
    { name: "Goals-conceded review", detail: "Watch your last match. Tag each goal: positioning, handling, or team.", mins: 10, type: "skill", where: ["home"], metrics: ["conceded"], gk: true },
  ],

  basketball: [
    { name: "Form shooting", detail: "One hand from 5 ft, 50 makes. Hold the follow-through.", mins: 10, type: "skill", where: ["field"], metrics: ["fg", "three", "ft"] },
    { name: "Catch-and-shoot", detail: "5 spots × 10 shots. Record your makes.", mins: 12, type: "skill", where: ["field"], metrics: ["three", "fg", "points"] },
    { name: "Free throws under fatigue", detail: "Sprint the court, then 2 free throws. 10 rounds.", mins: 10, type: "skill", where: ["field"], metrics: ["ft", "points"] },
    { name: "Finishing package", detail: "20 each: floater, reverse layup, inside-hand finish.", mins: 12, type: "skill", where: ["field"], metrics: ["fg", "points"] },
    { name: "Two-ball dribbling", detail: "Same rhythm, then alternating. 6 × 40 s.", mins: 8, type: "skill", where: ["field", "home"], metrics: ["tov", "ast"] },
    { name: "Stationary handling series", detail: "Pound, crossover, between legs, behind back. 45 s each.", mins: 8, type: "skill", where: ["home", "field"], metrics: ["tov"] },
    { name: "Pick-and-roll reads", detail: "Partner calls the coverage. Make the right pass, 20 reps.", mins: 10, type: "skill", where: ["field"], metrics: ["ast", "tov"] },
    { name: "Box-out and rebound", detail: "Box out first, then two-hand rebound to the chin. 3 × 10.", mins: 10, type: "skill", where: ["field"], metrics: ["reb"] },
    { name: "Closeouts and slides", detail: "Close out to a stance without reaching, slide, recover. 4 × 30 s.", mins: 10, type: "physical", where: ["field", "home"], metrics: ["stl", "blk"] },
    { name: "Verticality contests", detail: "Jump straight up with hands high on 20 shots. No swiping.", mins: 10, type: "skill", where: ["field"], metrics: ["blk", "reb"] },
    { name: "Plyometrics", detail: "Box jumps 4 × 5, broad jumps 4 × 4. Full rest between sets.", mins: 12, type: "physical", where: ["gym", "home"], metrics: ["reb", "blk"] },
    { name: "Court conditioning", detail: "Baseline-to-baseline sprints, 6 × 4 lengths, 40 s rest.", mins: 10, type: "physical", where: ["field"], metrics: ["stl", "points"] },
    { name: "Lower-body strength", detail: "Goblet squats 3 × 8, Romanian deadlifts 3 × 8.", mins: 15, type: "physical", where: ["gym"], metrics: ["reb", "blk", "points"] },
    { name: "Core and ankle stability", detail: "Single-leg balance 30 s each, plank 40 s, dead bugs 12. Three rounds.", mins: 10, type: "physical", where: ["home", "gym"], metrics: ["tov", "reb"] },
  ],

  volleyball: [
    { name: "Approach footwork", detail: "30 approaches without a ball. Fast last two steps.", mins: 8, type: "skill", where: ["field", "home"], metrics: ["kills", "hitEff"] },
    { name: "Hitting against a block", detail: "40 swings. Aim to use the block's outside hand.", mins: 12, type: "skill", where: ["field"], metrics: ["hitEff", "kills"] },
    { name: "Roll and cut shots", detail: "15 each into the deep corners.", mins: 10, type: "skill", where: ["field"], metrics: ["hitEff"] },
    { name: "Zone serving", detail: "30 serves to zones 1 and 5. Track how many land.", mins: 12, type: "skill", where: ["field"], metrics: ["aces", "serveErr"] },
    { name: "Serve consistency", detail: "40 serves at 80% pace, depth only. Then 20 tosses caught at the same point.", mins: 10, type: "skill", where: ["field"], metrics: ["serveErr"] },
    { name: "Toss practice", detail: "50 tosses caught at the same spot. Consistent toss, consistent serve.", mins: 6, type: "skill", where: ["home"], metrics: ["serveErr", "aces"] },
    { name: "Read-the-setter blocking", detail: "Watch the setter's hands, then move. 20 blocking reps.", mins: 10, type: "skill", where: ["field"], metrics: ["blocksV"] },
    { name: "Freeze-before-contact digs", detail: "30 digs. Feet set and still at the moment of contact.", mins: 12, type: "skill", where: ["field"], metrics: ["digs"] },
    { name: "Serve-receive to target", detail: "40 receptions, score each pass 0–3.", mins: 12, type: "skill", where: ["field"], metrics: ["recep"] },
    { name: "Wall platform passing", detail: "Forearm passes against a wall, 3 × 50 touches.", mins: 10, type: "skill", where: ["home", "field"], metrics: ["recep", "digs"] },
    { name: "Setting tempo", detail: "30 sets to each position at a consistent tempo.", mins: 12, type: "skill", where: ["field"], metrics: ["setAst"] },
    { name: "Wall setting", detail: "100 overhead sets against a wall. Soft, quiet hands.", mins: 8, type: "skill", where: ["home", "field"], metrics: ["setAst"] },
    { name: "Jump training", detail: "Approach jumps 4 × 5, box jumps 3 × 5. Full rest.", mins: 12, type: "physical", where: ["gym", "home"], metrics: ["kills", "blocksV"] },
    { name: "Shoulder care", detail: "Band external rotations 3 × 15, scapula pull-aparts 3 × 15.", mins: 10, type: "physical", where: ["home", "gym"], metrics: ["kills", "aces", "hitEff"] },
    { name: "Lateral speed", detail: "Shuffle between cones 4 m apart, 6 × 20 s.", mins: 10, type: "physical", where: ["home", "gym", "field"], metrics: ["digs", "blocksV", "recep"] },
  ],
};

export const WARMUP = {
  field: "Jog, skips, leg swings, hip openers, then 3 build-up sprints.",
  gym: "5 min easy bike or rower, then leg swings, hip openers and 10 bodyweight squats.",
  home: "Jumping jacks, high knees, leg swings, hip openers and 10 bodyweight squats.",
};
export const COOLDOWN = "Easy walk or jog, then 30 s stretches for calves, hamstrings, quads and hips.";

/* ---------- Which days ----------
   Never on match day, never the day before, avoid the day after.
   Without a match day, use fixed spacing.                         */

const SPACING = [[0], [0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 4, 5]];

export function pickDays(n, matchDay) {
  n = Math.max(1, Math.min(5, n));
  if (matchDay < 0) return SPACING[n - 1];

  const before = (matchDay + 6) % 7;
  const after = (matchDay + 1) % 7;
  const ordered = [];
  for (let k = 2; k < 7; k++) ordered.push((matchDay + k) % 7);
  ordered.push(after); // day after the match: only used when there's no other room
  let pool = ordered.filter((d) => d !== before && d !== after);
  if (n > pool.length) pool = ordered.filter((d) => d !== before);

  const picks = [];
  if (n === 1) picks.push(pool[0]);
  else for (let i = 0; i < n; i++) picks.push(pool[Math.round((i * (pool.length - 1)) / (n - 1))]);
  return [...new Set(picks)].sort((a, b) => a - b);
}

/* ---------- Build the plan ---------- */

export function buildPlan({ sport, position, days, minutes, where, matchDay, focus }) {
  const isGK = sport === "football" && position === "GK";
  const pool = (DRILLS[sport] || []).filter(
    (d) => d.where.includes(where) && (isGK ? d.gk || (d.type === "physical" && !d.gk) : !d.gk)
  );
  const budget = Math.max(10, minutes - 15); // 10 warm-up + 5 cool-down
  const dayIdx = pickDays(days, matchDay);
  const used = {};

  const sessions = dayIdx.map((day, i) => {
    const want = i % 2 === 0 ? "skill" : "physical";
    const scored = pool
      .map((d) => ({
        d,
        s: d.metrics.filter((m) => focus.includes(m)).length * 10 +
           (d.type === want ? 3 : 0) -
           (used[d.name] || 0) * 4,
      }))
      .sort((a, b) => b.s - a.s);

    const drills = [];
    let left = budget;
    for (const { d } of scored) {
      if (d.mins <= left) {
        drills.push(d);
        left -= d.mins;
        used[d.name] = (used[d.name] || 0) + 1;
      }
      if (left < 6) break;
    }
    if (!drills.length && scored.length) drills.push(scored[0].d);

    return {
      day,
      type: drills.length && drills.every((d) => d.type === "physical") ? "physical" : want,
      warmup: WARMUP[where],
      cooldown: COOLDOWN,
      drills: drills.map(({ name, detail, mins, metrics }) => ({ name, detail, mins, metrics })),
    };
  });

  return { sport, position, days, minutes, where, matchDay, focus, sessions, createdAt: new Date().toISOString() };
}

/* ---------- Daily tracker ---------- */

export function localDay(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

// activity: { "2026-11-03": "train" | "match" | "rest" }
export function streakInfo(activity, today = localDay()) {
  let current = 0;
  let d = activity[today] ? today : addDays(today, -1);
  while (activity[d]) { current++; d = addDays(d, -1); }

  let best = 0, run = 0, prev = null;
  Object.keys(activity).sort().forEach((x) => {
    run = prev && addDays(prev, 1) === x ? run + 1 : 1;
    best = Math.max(best, run);
    prev = x;
  });
  return { current, best: Math.max(best, current) };
}

export function trimActivity(activity, today = localDay()) {
  const cutoff = addDays(today, -400);
  const out = {};
  Object.keys(activity).forEach((k) => { if (k >= cutoff) out[k] = activity[k]; });
  return out;
}

/* ---------- Week key for ticking sessions off ---------- */

export function weekKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - shift);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
