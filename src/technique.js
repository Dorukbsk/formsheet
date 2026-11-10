/* ============================================================
   AthletiX — action check from pose landmarks
   Pure maths, no React, no MediaPipe. Each frame is
   { t, lm } where lm is 33 points in PIXELS {x, y, v}, or null.
   Image y grows DOWNWARD, so "higher" means a smaller y.
   ============================================================ */

const SIDE_ON = "Film from the side, about 4 m away, whole body in frame.";
const FRONT_ON = "Film from the front, about 4 m away, whole body in frame.";

export const ACTIONS = {
  football: [
    { key: "shot", name: "Shot", tips: [SIDE_ON, "Last two steps, the strike and the follow-through in frame.", "2 to 5 seconds, one shot."] },
    { key: "pass", name: "Pass", tips: [SIDE_ON, "Your approach, the contact and follow-through in frame.", "2 to 5 seconds, one pass."] },
    { key: "header", name: "Header", tips: [SIDE_ON, "From the take-off to the landing.", "2 to 5 seconds, one header."] },
    { key: "sprint", name: "Sprint start", tips: [SIDE_ON, "Start standing still, then sprint across the frame.", "Your first 5 steps in frame, 2 to 4 seconds."] },
    { key: "throwin", name: "Throw-in", tips: [SIDE_ON, "From lifting the ball to after the release.", "2 to 4 seconds, one throw."] },
  ],
  basketball: [
    { key: "jumpshot", name: "Jump shot", tips: [SIDE_ON, "From the dip to the landing.", "3 to 6 seconds, one shot."] },
    { key: "freethrow", name: "Free throw", tips: [SIDE_ON, "From your set-up to two seconds after the release.", "3 to 6 seconds, one shot."] },
    { key: "layup", name: "Layup", tips: [SIDE_ON, "Your last two steps, the jump and the release.", "2 to 5 seconds, one layup."] },
    { key: "stance", name: "Defensive stance", tips: [FRONT_ON, "Hold your stance and slide side to side.", "4 to 8 seconds."] },
  ],
  volleyball: [
    { key: "spike", name: "Spike", tips: [SIDE_ON, "The whole approach and jump in frame.", "3 to 6 seconds, one spike."] },
    { key: "serve", name: "Overhand serve", tips: [SIDE_ON, "From the toss to the follow-through.", "3 to 6 seconds, one serve."] },
    { key: "set", name: "Set", tips: [SIDE_ON, "From getting under the ball to the release.", "2 to 5 seconds, one set."] },
    { key: "dig", name: "Forearm pass", tips: [SIDE_ON, "From your ready position to after contact.", "2 to 5 seconds, one pass."] },
    { key: "block", name: "Block", tips: [SIDE_ON, "From the take-off to the landing.", "2 to 5 seconds, one block."] },
  ],
};

export const actionsFor = (sport) => ACTIONS[sport] || [];
export const findAction = (sport, key) => actionsFor(sport).find((a) => a.key === key) || null;

const P = { NOSE: 0, LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16, LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28 };
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
const clampI = (i, n) => Math.max(0, Math.min(n - 1, i));
const deg = (n) => Math.round(n);

/* ---------- checks and score ---------- */

function targetText(min, max, unit) {
  if (min !== undefined && max !== undefined) return `${min}–${max}${unit}`;
  if (min !== undefined) return `${min}${unit} or more`;
  return `${max}${unit} or less`;
}

// One measured check against a target range. tol = how far outside the range counts as a full miss.
function rangeCheck({ label, value, unit, min, max, tol, low, high }) {
  const v = Math.round(value);
  const below = min !== undefined && v < min;
  const above = max !== undefined && v > max;
  const off = below ? min - v : above ? v - max : 0;
  const fb = below ? low : above ? high : null;
  return {
    label,
    value: v,
    unit,
    target: targetText(min, max, unit),
    status: off ? "work" : "good",
    closeness: off ? Math.max(0, 1 - off / tol) : 1,
    tip: fb ? fb[0] : null,
    drill: fb ? fb[1] : null,
  };
}

// Score out of 10: 5.0 if every check is far off, 9.5 if every check is on target.
export function scoreOf(checks) {
  if (!checks.length) return 0;
  const avg = checks.reduce((s, c) => s + c.closeness, 0) / checks.length;
  return Math.round((5 + 4.5 * avg) * 10) / 10;
}

/* ---------- shared measurements ---------- */

function prepare(rawFrames) {
  const frames = rawFrames.filter(
    (f) => f && f.lm && KEY_POINTS.reduce((s, i) => s + (f.lm[i].v ?? 1), 0) / KEY_POINTS.length > 0.5
  );
  if (frames.length < 10) return null;
  const n = frames.length;
  const L = (i, k) => frames[clampI(i, n)].lm[k];
  const body = median(frames.map((f) =>
    Math.abs(mid(f.lm[P.LA], f.lm[P.RA]).y - mid(f.lm[P.LS], f.lm[P.RS]).y))) || 1;
  const kneeAvg = smooth(frames.map((f) => (angle(f.lm[P.LH], f.lm[P.LK], f.lm[P.LA]) + angle(f.lm[P.RH], f.lm[P.RK], f.lm[P.RA])) / 2));
  const hipY = smooth(frames.map((f) => mid(f.lm[P.LH], f.lm[P.RH]).y));
  const hipX = smooth(frames.map((f) => mid(f.lm[P.LH], f.lm[P.RH]).x));
  const wristY = { L: smooth(frames.map((f) => f.lm[P.LW].y)), R: smooth(frames.map((f) => f.lm[P.RW].y)) };
  const handsY = smooth(frames.map((f) => (f.lm[P.LW].y + f.lm[P.RW].y) / 2));
  const topSide = Math.min(...wristY.L) <= Math.min(...wristY.R) ? "L" : "R";
  const standY = median(hipY.slice(0, Math.max(3, Math.floor(n * 0.2))));
  const rise = (i) => Math.max(0, ((standY - hipY[i]) / body) * 100);
  const facing = (i) => {
    const f = frames[clampI(i, n)].lm;
    return Math.sign(f[P.NOSE].x - mid(f[P.LS], f[P.RS]).x) || 1;
  };
  const elbow = (i, s) => angle(L(i, SIDE[s].s), L(i, SIDE[s].e), L(i, SIDE[s].w));
  const elbowAvg = (i) => (elbow(i, "L") + elbow(i, "R")) / 2;
  const hipFlex = (i, s) => angle(L(i, SIDE[s].s), L(i, SIDE[s].h), L(i, SIDE[s].k));
  return { frames, n, L, body, kneeAvg, hipY, hipX, wristY, handsY, topSide, rise, facing, elbow, elbowAvg, hipFlex };
}

const fail = (error) => ({ ok: false, error });
const TOO_LATE = (what) => fail(`The clip starts too late. Start filming ${what}.`);

function done(c, keyIndex, side, checks) {
  return {
    ok: true,
    keyIndex,
    keyTime: c.frames[keyIndex].t,
    keyLm: c.frames[keyIndex].lm,
    side,
    checks,
    score: scoreOf(checks),
    frames: c.n,
  };
}

/* ---------- football ---------- */

function kick(c, kind) {
  const { frames, L } = c;
  const speed = (k) => smooth(frames.map((f, i) => (i ? Math.hypot(f.lm[k].x - frames[i - 1].lm[k].x, f.lm[k].y - frames[i - 1].lm[k].y) : 0)));
  const sL = speed(P.LA), sR = speed(P.RA);
  const side = Math.max(...sL) >= Math.max(...sR) ? "L" : "R";
  const K = SIDE[side], plant = SIDE[side === "L" ? "R" : "L"];
  const contact = argmax(side === "L" ? sL : sR);
  if (contact < 3) return TOO_LATE("before your last two steps");

  const prev = Math.max(0, contact - 2);
  const dir = Math.sign(L(contact, K.a).x - L(prev, K.a).x) || 1;
  const lean = trunkLean(frames[contact].lm, dir);
  const plantKnee = angle(L(contact, plant.h), L(contact, plant.k), L(contact, plant.a));
  const ankleY = frames.map((f) => f.lm[K.a].y);
  const groundY = median(ankleY.slice(0, contact));
  const hipY = mid(L(contact, P.LH), L(contact, P.RH)).y;
  const top = Math.min(...ankleY.slice(contact));
  const follow = Math.max(0, ((groundY - top) / Math.max(1, groundY - hipY)) * 100);

  const shot = kind === "shot";
  return done(c, contact, side, [
    rangeCheck({
      label: "Body over the ball", value: lean, unit: "°", min: shot ? -10 : -8, tol: 20,
      low: [`You're leaning back about ${Math.abs(Math.round(lean))}° at contact, which sends the ball ${shot ? "high over the bar" : "up in the air"}.`,
        shot ? "Strike 20 balls with your chest over the ball, landing on your kicking foot." : "Pass against a wall 30 times with your chest over the ball and the ball kept on the ground."],
    }),
    rangeCheck({
      label: "Plant leg", value: plantKnee, unit: "°", min: 130, max: shot ? 168 : 172, tol: 25,
      low: ["Your standing leg bends a lot, so you sink instead of driving through the ball.", "Plant-foot placement: 20 reps, standing foot beside the ball and knee slightly bent."],
      high: ["Your standing leg is locked straight, which costs balance and power.", "Plant-foot placement: 20 reps, standing foot beside the ball and knee slightly bent."],
    }),
    rangeCheck({
      label: "Follow-through", value: follow, unit: "%", min: shot ? 70 : 35, tol: shot ? 50 : 30,
      low: [shot ? "Your kicking leg stops early, so the ball gets less pace than your swing gives it." : "Your kicking foot stops at the ball, so passes die short and drift off line.",
        shot ? "Follow-through finishing: 20 strikes, landing on your kicking foot past the ball." : "Wall passing: 30 passes each foot, foot finishing pointed at your target."],
    }),
  ]);
}

function header(c) {
  const { n, hipY, rise, facing, L, frames } = c;
  const peak = argmin(hipY);
  if (peak < 3) return TOO_LATE("before you take off");
  const dir = facing(peak);
  const from = Math.max(0, peak - 8), to = Math.min(n, peak + 5);
  const leans = []; for (let i = from; i < to; i++) leans.push(trunkLean(frames[i].lm, dir));
  const snap = Math.max(...leans) - Math.min(...leans);
  const armsUp = Math.max(
    angle(L(peak, P.LH), L(peak, P.LS), L(peak, P.LE)),
    angle(L(peak, P.RH), L(peak, P.RS), L(peak, P.RE)),
  );
  return done(c, peak, "L", [
    rangeCheck({
      label: "Jump height", value: rise(peak), unit: "%", min: 10, tol: 10,
      low: ["You're barely leaving the ground, so you lose aerial duels to taller players.", "Jump training: 4 × 5 approach jumps, then 3 × 5 box jumps."],
    }),
    rangeCheck({
      label: "Upper-body snap", value: snap, unit: "°", min: 15, tol: 15,
      low: ["You're meeting the ball with your neck only. Power comes from arching back and snapping forward through the ball.", "Kneeling headers: 3 × 10, arch back and snap your chest forward through the ball."],
    }),
    rangeCheck({
      label: "Arms for balance", value: armsUp, unit: "°", min: 60, tol: 40,
      low: ["Your arms stay down, so you have less balance and protection in the air.", "Practice jumps with elbows raised to shoulder height, 3 × 8."],
    }),
  ]);
}

function sprint(c) {
  const { n, hipX, body, frames, hipFlex, elbow } = c;
  const x0 = hipX[0];
  let start = -1;
  for (let i = 1; i < n; i++) if (Math.abs(hipX[i] - x0) > body * 0.03) { start = i; break; }
  if (start < 0 || start > n - 6) return fail("We couldn't see you start running. Film from the side with your first 5 steps in frame.");
  const dir = Math.sign(hipX[n - 1] - x0) || 1;
  const to = Math.min(n, start + 15);
  const leans = [], flex = [], arms = [];
  for (let i = start; i < to; i++) {
    leans.push(trunkLean(frames[i].lm, dir));
    flex.push(Math.min(hipFlex(i, "L"), hipFlex(i, "R")));
    arms.push((elbow(i, "L") + elbow(i, "R")) / 2);
  }
  return done(c, start, "L", [
    rangeCheck({
      label: "Forward lean in first steps", value: median(leans), unit: "°", min: 20, max: 60, tol: 20,
      low: ["You stand up too early, so you lose acceleration in the first five metres.", "Wall drives: lean into a wall at 45°, 3 × 10 fast knee drives."],
      high: ["You're leaning so far forward you risk stumbling. Let your body rise gradually.", "Falling starts: 6 × 10 m, lean until you have to run, then rise over 5 steps."],
    }),
    rangeCheck({
      label: "Knee drive", value: Math.min(...flex), unit: "°", max: 100, tol: 40,
      high: ["Your knees don't come up much, so your strides are short and slow.", "A-skips and high knees: 4 × 15 m each."],
    }),
    rangeCheck({
      label: "Arm drive", value: median(arms), unit: "°", min: 60, max: 120, tol: 40,
      low: ["Your arms are very bent and tight, which shortens your stride.", "Arm-drive drill seated: 3 × 20 s, elbows at about 90°, hands from hip to cheek."],
      high: ["Your arms are almost straight and swinging loosely, which wastes energy.", "Arm-drive drill seated: 3 × 20 s, elbows at about 90°, hands from hip to cheek."],
    }),
  ]);
}

function throwin(c) {
  const { n, frames, L, handsY, body, elbowAvg } = c;
  const overhead = (i) => ((L(i, P.NOSE).y - handsY[i]) / body) * 100;
  const load = argmax(frames.map((_, i) => overhead(i)));
  const handsX = frames.map((f) => (f.lm[P.LW].x + f.lm[P.RW].x) / 2);
  let rel = load, best = 0;
  for (let i = load + 1; i < n; i++) { const v = Math.abs(handsX[i] - handsX[i - 1]); if (v > best) { best = v; rel = i; } }
  if (load < 2) return TOO_LATE("before you lift the ball");
  const ankleLift = Math.max(...["LA", "RA"].map((k) => {
    const ys = frames.map((f) => f.lm[P[k]].y);
    return ((median(ys) - Math.min(...ys)) / body) * 100;
  }));
  return done(c, rel, "L", [
    rangeCheck({
      label: "Ball behind your head", value: overhead(load), unit: "%", min: 5, tol: 15,
      low: ["The ball doesn't go back far enough over your head, so you lose distance and risk a foul throw.", "Throw-in reps: 15 throws, ball fully behind your head before you release."],
    }),
    rangeCheck({
      label: "Arm extension at release", value: elbowAvg(rel), unit: "°", min: 150, tol: 40,
      low: ["Your arms are bent at release, so the throw has little length.", "Medicine-ball overhead throws: 3 × 8, finish with straight arms."],
    }),
    rangeCheck({
      label: "Feet on the ground", value: ankleLift, unit: "%", max: 5, tol: 10,
      high: ["A foot is lifting off the ground, which is a foul throw.", "Throw-in reps with both feet planted, drag the back toe if you need to."],
    }),
  ]);
}

/* ---------- basketball ---------- */

function jumpshot(c) {
  const { wristY, topSide, kneeAvg, frames, elbow } = c;
  const release = argmin(wristY[topSide]);
  if (release < 3) return TOO_LATE("before you dip for the shot");
  const load = kneeAvg[argmin(kneeAvg, 0, release)];
  return done(c, release, topSide, [
    rangeCheck({
      label: "Leg load", value: load, unit: "°", min: 105, max: 150, tol: 30,
      low: ["Your dip is very deep, which slows your release and makes it easier to block.", "Form shooting with a quick, shallow dip: 50 makes from 3 m."],
      high: ["Your knees barely bend before the shot, so your arms do all the work and your range drops when you're tired.", "Dip-and-rise reps without a ball, 3 × 15, pausing at the bottom."],
    }),
    rangeCheck({
      label: "Arm extension at release", value: elbow(release, topSide), unit: "°", min: 155, tol: 40,
      low: ["Your shooting arm isn't finishing straight, which flattens the arc and shrinks your margin on the rim.", "One-hand form shooting from 1.5 m. Hold the follow-through for 2 seconds."],
    }),
    rangeCheck({
      label: "Body balance at release", value: Math.abs(trunkLean(frames[release].lm)), unit: "°", max: 15, tol: 20,
      high: ["You're leaning or drifting when you release, so your distance control changes shot to shot.", "Shoot with your heels on a line and land on the same spot. 5 spots × 10."],
    }),
  ]);
}

function freethrow(c) {
  const { n, wristY, topSide, kneeAvg, frames, elbow, L } = c;
  const release = argmin(wristY[topSide]);
  if (release < 3) return TOO_LATE("before your set-up");
  const load = kneeAvg[argmin(kneeAvg, 0, release)];
  let held = 0;
  for (let i = release; i < n; i++) { if (wristY[topSide][i] < L(i, P.NOSE).y) held++; else break; }
  const holdS = held > 1 ? frames[Math.min(n - 1, release + held - 1)].t - frames[release].t : 0;
  return done(c, release, topSide, [
    rangeCheck({
      label: "Knee bend", value: load, unit: "°", min: 120, max: 160, tol: 25,
      low: ["You're bending very deep, which makes the motion hard to repeat.", "Free-throw routine: 50 shots with the same small knee bend every time."],
      high: ["Your legs stay straight, so you push with your arms and miss short when tired.", "Free-throw routine: 50 shots, small knee bend timed with the arm."],
    }),
    rangeCheck({
      label: "Arm extension at release", value: elbow(release, topSide), unit: "°", min: 155, tol: 40,
      low: ["Your arm doesn't finish straight, so the ball comes off flat.", "One-hand form shooting from 1.5 m, 50 makes."],
    }),
    { ...rangeCheck({
      label: "Follow-through held", value: holdS * 10, unit: "", min: 4, tol: 4,
      low: ["You drop your arm right after the release, which usually means you're rushing the shot.", "Hold your follow-through until the ball hits the rim, 30 free throws."],
    }), value: Math.round(holdS * 10) / 10, unit: " s", target: "0.4 s or more" },
    rangeCheck({
      label: "Body balance", value: Math.abs(trunkLean(frames[release].lm)), unit: "°", max: 10, tol: 15,
      high: ["You're leaning at release, which changes your distance shot to shot.", "Free throws with eyes on the rim and feet still, 30 shots."],
    }),
  ]);
}

function layup(c) {
  const { n, hipY, rise, wristY, topSide, hipFlex, elbow } = c;
  const peak = argmin(hipY);
  if (peak < 3) return TOO_LATE("before your last two steps");
  let knee = 180;
  for (let i = Math.max(0, peak - 4); i < Math.min(n, peak + 3); i++) knee = Math.min(knee, hipFlex(i, "L"), hipFlex(i, "R"));
  const release = argmin(wristY[topSide], Math.max(0, peak - 4), Math.min(n, peak + 6));
  return done(c, peak, topSide, [
    rangeCheck({
      label: "Jump height", value: rise(peak), unit: "%", min: 12, tol: 12,
      low: ["You're not getting up, so the shot is easier to block.", "Power layups off one foot: 3 × 10 each side."],
    }),
    rangeCheck({
      label: "Knee drive", value: knee, unit: "°", max: 110, tol: 40,
      high: ["Your lifting knee stays low, which costs height and protection.", "Mikan drill with a big knee lift: 3 × 30 s."],
    }),
    rangeCheck({
      label: "Arm reach at release", value: elbow(release, topSide), unit: "°", min: 150, tol: 40,
      low: ["You're releasing with a bent arm, low and away from the rim.", "Reach-and-release layups: 20 each side, arm fully extended."],
    }),
  ]);
}

function stance(c) {
  const { frames, kneeAvg, hipY, body } = c;
  const width = median(frames.map((f) => Math.abs(f.lm[P.LA].x - f.lm[P.RA].x) / Math.max(1, Math.abs(f.lm[P.LS].x - f.lm[P.RS].x))));
  const lowMed = median(kneeAvg);
  const ys = [...hipY].sort((a, b) => a - b);
  const bounce = ((ys[Math.floor(ys.length * 0.9)] - ys[Math.floor(ys.length * 0.1)]) / body) * 100;
  return done(c, argmin(kneeAvg), "L", [
    rangeCheck({
      label: "Knee bend", value: lowMed, unit: "°", min: 100, max: 145, tol: 30,
      low: ["You're squatting very deep, which slows your first step.", "Stance holds: 4 × 30 s at a comfortable depth."],
      high: ["You're standing too tall, so quick guards will get past you.", "Wall sits 3 × 30 s, then slides staying at that height."],
    }),
    { ...rangeCheck({
      label: "Stance width", value: width * 100, unit: "", min: 130, tol: 50,
      low: ["Your feet are too close together, which makes you easy to unbalance.", "Lateral slides with a band around your ankles, 4 × 20 s."],
    }), value: Math.round(width * 10) / 10, unit: "×", target: "1.3× shoulder width or more" },
    rangeCheck({
      label: "Stay low while sliding", value: bounce, unit: "%", max: 5, tol: 8,
      high: ["Your hips bounce up and down as you slide, which slows you down.", "Slides under a rope or bar at hip height, 4 × 20 s."],
    }),
  ]);
}

/* ---------- volleyball ---------- */

function spike(c) {
  const { hipY, kneeAvg, wristY, topSide, rise, elbow } = c;
  const peak = argmin(hipY);
  if (peak < 3) return TOO_LATE("before your approach steps");
  const load = kneeAvg[argmin(kneeAvg, 0, peak)];
  const contact = argmin(wristY[topSide]);
  return done(c, contact, topSide, [
    rangeCheck({
      label: "Take-off load", value: load, unit: "°", min: 100, max: 140, tol: 30,
      low: ["You're sinking very deep, which slows your take-off.", "Approach jumps focusing on a quick, half-depth plant. 4 × 5."],
      high: ["You're not sinking into your last step, so you're leaving jump height on the floor.", "Approach footwork without a ball: 30 reps, fast and low on the last two steps."],
    }),
    rangeCheck({
      label: "Arm reach at contact", value: elbow(contact, topSide), unit: "°", min: 160, tol: 40,
      low: ["Your hitting arm is bent at contact, so you hit lower than you can reach and into the block.", "Standing wall hits: reach high and snap, 3 × 20."],
    }),
    rangeCheck({
      label: "Jump height", value: rise(peak), unit: "%", min: 20, tol: 15,
      low: ["Your hips don't rise much in the jump. More height means more of the court to hit into.", "Approach jumps 4 × 5 and box jumps 3 × 5, full rest between sets."],
    }),
  ]);
}

function serve(c) {
  const { wristY, topSide, elbow, L, body, frames } = c;
  const contact = argmin(wristY[topSide]);
  if (contact < 3) return TOO_LATE("before your toss");
  const S = SIDE[topSide];
  const height = ((L(contact, S.s).y - L(contact, S.w).y) / body) * 100;
  return done(c, contact, topSide, [
    rangeCheck({
      label: "Arm extension at contact", value: elbow(contact, topSide), unit: "°", min: 160, tol: 40,
      low: ["You're hitting with a bent arm, so the serve is low and easy to pass.", "Wall serves: 3 × 15, contact at full reach."],
    }),
    rangeCheck({
      label: "Contact height", value: height, unit: "%", min: 30, tol: 20,
      low: ["You're contacting the ball too low, close to your head.", "Toss practice: 50 tosses that land just in front of your hitting shoulder."],
    }),
    rangeCheck({
      label: "Body balance", value: Math.abs(trunkLean(frames[contact].lm)), unit: "°", max: 20, tol: 20,
      high: ["You're leaning a lot at contact, which makes your serve inconsistent.", "Serves from a fixed stance: 30 reps, weight moving forward through the ball."],
    }),
  ]);
}

function set(c) {
  const { handsY, kneeAvg, L, body, elbowAvg } = c;
  const key = argmin(handsY);
  if (key < 3) return TOO_LATE("before you get under the ball");
  const above = ((L(key, P.NOSE).y - handsY[key]) / body) * 100;
  const legs = kneeAvg[argmin(kneeAvg, 0, key)];
  return done(c, key, "L", [
    rangeCheck({
      label: "Hands above your forehead", value: above, unit: "%", min: 5, tol: 15,
      low: ["You're setting from in front of your face, so sets are low and inconsistent.", "Wall setting: 100 sets with the ball leaving from above your forehead."],
    }),
    rangeCheck({
      label: "Arm extension", value: elbowAvg(key), unit: "°", min: 150, tol: 40,
      low: ["Your arms don't extend fully, so you're short on distance.", "Long sets against a wall: 3 × 20, finish with straight arms."],
    }),
    rangeCheck({
      label: "Leg drive", value: legs, unit: "°", min: 120, max: 165, tol: 25,
      low: ["You're bending very deep, which slows your release.", "Sets from a slight knee bend: 50 reps."],
      high: ["Your legs stay straight, so all the power comes from your arms.", "Squat-and-set: 3 × 15, push up through your legs into the set."],
    }),
  ]);
}

function dig(c) {
  const { kneeAvg, elbowAvg, L, body, facing, frames } = c;
  const key = argmin(kneeAvg);
  const below = ((((L(key, P.LW).y + L(key, P.RW).y) / 2) - mid(L(key, P.LS), L(key, P.RS)).y) / body) * 100;
  const lean = trunkLean(frames[key].lm, facing(key));
  return done(c, key, "L", [
    rangeCheck({
      label: "Knee bend", value: kneeAvg[key], unit: "°", min: 100, max: 150, tol: 30,
      low: ["You're very low, which makes it hard to move to the ball.", "Ready-position holds: 4 × 20 s, then shuffle and pass."],
      high: ["You're passing with straight legs, so you swing your arms and the ball sprays.", "Wall passing from a low ready position, 3 × 50 touches."],
    }),
    rangeCheck({
      label: "Straight arms", value: elbowAvg(key), unit: "°", min: 160, tol: 40,
      low: ["Your elbows bend at contact, so the ball goes off your arms in random directions.", "Platform holds: lock your elbows and pass to yourself, 3 × 30."],
    }),
    rangeCheck({
      label: "Platform below shoulders", value: below, unit: "%", min: 10, tol: 15,
      low: ["Your arms are up near your shoulders at contact. Get lower and keep the platform at your waist.", "Partner tosses at waist height: 3 × 20, arms stay low."],
    }),
    rangeCheck({
      label: "Forward lean", value: lean, unit: "°", min: 10, max: 45, tol: 20,
      low: ["You're leaning back, so passes fly high and long.", "Pass from a forward-leaning ready position, shoulders over your knees."],
      high: ["You're bent over too far, so you can't see or angle the pass.", "Ready-position holds with chest up, 4 × 20 s."],
    }),
  ]);
}

function block(c) {
  const { hipY, rise, elbowAvg, L, handsY, body, frames } = c;
  const peak = argmin(hipY);
  if (peak < 3) return TOO_LATE("before you take off");
  const over = ((L(peak, P.NOSE).y - handsY[peak]) / body) * 100;
  return done(c, peak, "L", [
    rangeCheck({
      label: "Jump height", value: rise(peak), unit: "%", min: 15, tol: 15,
      low: ["You're not getting high enough to get your hands over the net.", "Block jumps from a quick squat: 4 × 6."],
    }),
    rangeCheck({
      label: "Arms straight up", value: elbowAvg(peak), unit: "°", min: 160, tol: 40,
      low: ["Your arms are bent, so there's a gap above your hands.", "Block jumps reaching to touch a high target, 3 × 8."],
    }),
    rangeCheck({
      label: "Hands above head", value: over, unit: "%", min: 15, tol: 15,
      low: ["Your hands stay close to your head instead of reaching over the net.", "Standing reach drill: press both hands up and forward, 3 × 10."],
    }),
    rangeCheck({
      label: "Body straight", value: Math.abs(trunkLean(frames[peak].lm)), unit: "°", max: 15, tol: 20,
      high: ["You're drifting or leaning in the air, which risks touching the net.", "Block jumps on a line, landing where you took off, 3 × 8."],
    }),
  ]);
}

const RUN = {
  football: { shot: (c) => kick(c, "shot"), pass: (c) => kick(c, "pass"), header, sprint, throwin },
  basketball: { jumpshot, freethrow, layup, stance },
  volleyball: { spike, serve, set, dig, block },
};

export function analyse(rawFrames, sport, action) {
  const fn = RUN[sport] && RUN[sport][action];
  if (!fn) return fail("Pick an action first.");
  const c = prepare(rawFrames);
  if (!c) {
    return fail("We couldn't see your whole body clearly enough. Keep head to feet in frame, film in good light, and follow the filming tips.");
  }
  return fn(c);
}

/* ---------- drawing ---------- */

export const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32],
];
export const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
