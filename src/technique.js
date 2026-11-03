/* ============================================================
   AthletiX — technique check from pose landmarks
   Pure maths, no React, no MediaPipe. Each frame is
   { t, lm } where lm is 33 points in PIXELS {x, y, v}, or null.
   ============================================================ */

export const TECHNIQUES = {
  basketball: {
    name: "Jump shot",
    tips: ["Film from the side, about 4 m away.", "Whole body in frame, from the dip to landing.", "3 to 6 seconds, one shot, good light."],
  },
  volleyball: {
    name: "Spike approach",
    tips: ["Film from the side, about 5 m away.", "Whole approach and jump in frame.", "3 to 6 seconds, one spike, good light."],
  },
  football: {
    name: "Shot",
    tips: ["Film from the side, about 4 m away.", "Last two steps, the strike and the follow-through in frame.", "2 to 5 seconds, one shot, good light."],
  },
};

const P = { LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16, LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28 };
const SIDE = {
  L: { s: P.LS, e: P.LE, w: P.LW, h: P.LH, k: P.LK, a: P.LA },
  R: { s: P.RS, e: P.RE, w: P.RW, h: P.RH, k: P.RK, a: P.RA },
};
const KEY_POINTS = [P.LS, P.RS, P.LH, P.RH, P.LK, P.RK, P.LA, P.RA];

export function angle(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (!d) return 180;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d));
  return (Math.acos(cos) * 180) / Math.PI;
}

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Positive = shoulders ahead of hips in the x direction `dir` (+1 or -1).
export function trunkLean(lm, dir = 1) {
  const s = mid(lm[P.LS], lm[P.RS]);
  const h = mid(lm[P.LH], lm[P.RH]);
  return (Math.atan2((s.x - h.x) * dir, h.y - s.y) * 180) / Math.PI;
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

// 3-point median smoothing kills single-frame tracking glitches.
function smooth(series) {
  return series.map((_, i) => median(series.slice(Math.max(0, i - 1), i + 2)));
}

function argmin(arr, from = 0, to = arr.length) {
  let best = from;
  for (let i = from; i < to; i++) if (arr[i] < arr[best]) best = i;
  return best;
}
function argmax(arr, from = 0, to = arr.length) {
  let best = from;
  for (let i = from; i < to; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

const deg = (n) => Math.round(n);

export function analyse(rawFrames, sport) {
  const frames = rawFrames.filter(
    (f) => f.lm && KEY_POINTS.reduce((s, i) => s + (f.lm[i].v ?? 1), 0) / KEY_POINTS.length > 0.5
  );
  if (frames.length < 10) {
    return {
      ok: false,
      error: "We couldn't see your whole body clearly enough. Film side-on, keep head to feet in frame, and use good light.",
    };
  }

  const lm = (i, k) => frames[i].lm[k];
  const body = median(frames.map((f) =>
    Math.abs(mid(f.lm[P.LA], f.lm[P.RA]).y - mid(f.lm[P.LS], f.lm[P.RS]).y))) || 1;
  const kneeAvg = smooth(frames.map((f) => (angle(f.lm[P.LH], f.lm[P.LK], f.lm[P.LA]) + angle(f.lm[P.RH], f.lm[P.RK], f.lm[P.RA])) / 2));

  if (sport === "basketball") return basketball(frames, lm, kneeAvg);
  if (sport === "volleyball") return volleyball(frames, lm, kneeAvg, body);
  return football(frames, lm, body);
}

function result(frames, keyIndex, side, checks) {
  return { ok: true, keyIndex, keyTime: frames[keyIndex].t, keyLm: frames[keyIndex].lm, side, checks, frames: frames.length };
}

function check(label, value, unit, target, good, tip, drill) {
  return { label, value, unit, target, status: good ? "good" : "work", tip: good ? null : tip, drill: good ? null : drill };
}

/* ---------- Basketball: jump shot ---------- */

function basketball(frames, lm, kneeAvg) {
  const wy = { L: frames.map((f) => f.lm[P.LW].y), R: frames.map((f) => f.lm[P.RW].y) };
  const side = Math.min(...wy.L) <= Math.min(...wy.R) ? "L" : "R";
  const S = SIDE[side];
  const release = argmin(smooth(wy[side]));
  if (release < 3) return { ok: false, error: "The clip starts too late. Start filming before you dip for the shot." };

  const loadI = argmin(kneeAvg, 0, release);
  const load = deg(kneeAvg[loadI]);
  const elbow = deg(angle(lm(release, S.s), lm(release, S.e), lm(release, S.w)));
  const lean = deg(Math.abs(trunkLean(frames[release].lm)));

  return result(frames, release, side, [
    check("Leg load", load, "°", "105–150°", load >= 105 && load <= 150,
      load > 150
        ? "Your knees barely bend before the shot, so your arms do all the work and your range drops when you're tired."
        : "Your dip is very deep, which slows your release and makes it easier to block.",
      load > 150
        ? "Dip-and-rise reps without a ball, 3 × 15, pausing at the bottom."
        : "Form shooting with a quick, shallow dip: 50 makes from 3 m."),
    check("Arm extension at release", elbow, "°", "155° or more", elbow >= 155,
      "Your shooting arm isn't finishing straight, which flattens the arc and shrinks your margin on the rim.",
      "One-hand form shooting from 1.5 m. Hold the follow-through for 2 seconds."),
    check("Body balance at release", lean, "°", "15° or less", lean <= 15,
      "You're leaning or drifting when you release, so your distance control changes shot to shot.",
      "Shoot with your heels on a line and land on the same spot. 5 spots × 10."),
  ]);
}

/* ---------- Volleyball: spike approach ---------- */

function volleyball(frames, lm, kneeAvg, body) {
  const hipY = smooth(frames.map((f) => mid(f.lm[P.LH], f.lm[P.RH]).y));
  const peak = argmin(hipY);
  if (peak < 3) return { ok: false, error: "The clip starts too late. Start filming before your approach steps." };

  const loadI = argmin(kneeAvg, 0, peak);
  const load = deg(kneeAvg[loadI]);

  const wy = { L: frames.map((f) => f.lm[P.LW].y), R: frames.map((f) => f.lm[P.RW].y) };
  const side = Math.min(...wy.L) <= Math.min(...wy.R) ? "L" : "R";
  const S = SIDE[side];
  const contact = argmin(smooth(wy[side]));
  const elbow = deg(angle(lm(contact, S.s), lm(contact, S.e), lm(contact, S.w)));

  const start = median(hipY.slice(0, Math.max(3, Math.floor(hipY.length * 0.2))));
  const rise = Math.max(0, Math.round(((start - hipY[peak]) / body) * 100));

  return result(frames, contact, side, [
    check("Take-off load", load, "°", "100–140°", load >= 100 && load <= 140,
      load > 140
        ? "You're not sinking into your last step, so you're leaving jump height on the floor."
        : "You're sinking very deep, which slows your take-off.",
      load > 140
        ? "Approach footwork without a ball: 30 reps, fast and low on the last two steps."
        : "Approach jumps focusing on a quick, half-depth plant. 4 × 5."),
    check("Arm reach at contact", elbow, "°", "160° or more", elbow >= 160,
      "Your hitting arm is bent at contact, so you hit lower than you can reach and into the block.",
      "Standing wall hits: reach high and snap, 3 × 20. Then 20 approach swings at full reach."),
    check("Jump height", rise, "%", "20% of your height or more", rise >= 20,
      "Your hips don't rise much in the jump. More height means more of the court to hit into.",
      "Jump training: approach jumps 4 × 5 and box jumps 3 × 5, full rest between sets."),
  ]);
}

/* ---------- Football: shot ---------- */

function football(frames, lm, body) {
  const speed = (k) => frames.map((f, i) => (i ? Math.hypot(f.lm[k].x - frames[i - 1].lm[k].x, f.lm[k].y - frames[i - 1].lm[k].y) : 0));
  const sL = smooth(speed(P.LA)), sR = smooth(speed(P.RA));
  const side = Math.max(...sL) >= Math.max(...sR) ? "L" : "R";
  const K = SIDE[side], plant = SIDE[side === "L" ? "R" : "L"];
  const contact = argmax(side === "L" ? sL : sR);
  if (contact < 3) return { ok: false, error: "The clip starts too late. Start filming before your last two steps." };

  const prev = Math.max(0, contact - 2);
  const dir = Math.sign(lm(contact, K.a).x - lm(prev, K.a).x) || 1;
  const lean = deg(trunkLean(frames[contact].lm, dir));
  const plantKnee = deg(angle(lm(contact, plant.h), lm(contact, plant.k), lm(contact, plant.a)));

  const ankleY = frames.map((f) => f.lm[K.a].y);
  const groundY = median(ankleY.slice(0, contact));
  const hipY = mid(lm(contact, P.LH), lm(contact, P.RH)).y;
  const top = Math.min(...ankleY.slice(contact));
  const follow = Math.max(0, Math.round(((groundY - top) / Math.max(1, groundY - hipY)) * 100));

  return result(frames, contact, side, [
    check("Body over the ball", lean, "°", "leaning back 10° or less", lean >= -10,
      `You're leaning back about ${Math.abs(lean)}° when you strike, which is why shots fly high over the bar.`,
      "Strike 20 balls focusing on chest over the ball and landing on your kicking foot."),
    check("Plant leg", plantKnee, "°", "130–168°", plantKnee >= 130 && plantKnee <= 168,
      plantKnee > 168
        ? "Your standing leg is locked straight, which kills balance and power through the ball."
        : "Your standing leg bends a lot, so you're sinking instead of driving through the shot.",
      "Plant-foot placement: 20 side-foot finishes, standing foot beside the ball and knee slightly bent."),
    check("Follow-through", follow, "%", "70% of hip height or more", follow >= 70,
      "Your kicking leg stops early, so the ball gets less pace than your swing gives it.",
      "Follow-through finishing: 20 strikes, land on your kicking foot past the ball."),
  ]);
}

/* ---------- Drawing the key frame ---------- */

export const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32],
];
