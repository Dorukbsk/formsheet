import { supabase } from "./supabaseClient";
import React, { useState, useEffect, useMemo } from "react";
import Logo from "./Logo.jsx";
import { QUICK, PLACES, DAYS, buildPlan, weekKey, localDay, addDays, streakInfo, trimActivity } from "./training.js";
import { buildCard, cardSvg, svgDataUrl, saveCardImage, RECENT } from "./card.js";

/* ============================================================
   AthletiX — sport performance analyzer
   Benchmarks below are modelled placeholders, not league data.
   ============================================================ */

/* ---------- 1. STAT MODEL ---------------------------------- */
/* bm: [mean, standardDeviation] per position, at "semi-pro" level.
   rate:true  -> raw total gets normalized to the per-X window
   invert:true -> lower is better                                */

const SPORTS = {
  football: {
    label: "Football",
    unitLabel: "Minutes played",
    unitShort: "min",
    window: 90,
    windowLabel: "per 90",
    positions: {
      FW: "Striker",
      WING: "Winger",
      MID: "Midfielder",
      DEF: "Defender",
      GK: "Goalkeeper",
    },
    metrics: [
      { key: "goals", label: "Goals", rate: true, bm: { FW: [0.45, 0.25], WING: [0.25, 0.18], MID: [0.12, 0.1], DEF: [0.05, 0.05] } },
      { key: "assists", label: "Assists", rate: true, bm: { FW: [0.18, 0.12], WING: [0.25, 0.15], MID: [0.2, 0.13], DEF: [0.07, 0.06] } },
      { key: "shotAcc", label: "Shots on target", unit: "%", bm: { FW: [42, 10], WING: [38, 10], MID: [35, 11], DEF: [30, 12] } },
      { key: "passAcc", label: "Pass accuracy", unit: "%", bm: { FW: [74, 7], WING: [76, 6], MID: [84, 5], DEF: [85, 5], GK: [72, 9] } },
      { key: "keyPasses", label: "Key passes", rate: true, bm: { FW: [1.1, 0.6], WING: [1.8, 0.8], MID: [1.6, 0.8], DEF: [0.5, 0.4] } },
      { key: "duelsWon", label: "Duels won", unit: "%", bm: { FW: [48, 8], WING: [47, 8], MID: [51, 7], DEF: [55, 7] } },
      { key: "tackles", label: "Tackles won", rate: true, bm: { FW: [0.8, 0.5], WING: [1.4, 0.7], MID: [2.0, 0.9], DEF: [2.4, 1.0] } },
      { key: "intercept", label: "Interceptions", rate: true, bm: { FW: [0.4, 0.3], WING: [0.8, 0.5], MID: [1.3, 0.6], DEF: [1.8, 0.8] } },
      { key: "turnovers", label: "Possession lost", rate: true, invert: true, bm: { FW: [2.2, 0.9], WING: [2.6, 1.0], MID: [2.0, 0.9], DEF: [1.2, 0.6] } },
      { key: "distance", label: "Distance covered", unit: "km", rate: true, bm: { FW: [10.0, 0.8], WING: [10.6, 0.8], MID: [11.2, 0.8], DEF: [10.0, 0.8] } },
      { key: "saves", label: "Saves", rate: true, bm: { GK: [3.2, 1.3] } },
      { key: "savePct", label: "Save percentage", unit: "%", bm: { GK: [70, 9] } },
      { key: "claims", label: "Crosses claimed", rate: true, bm: { GK: [1.0, 0.6] } },
      { key: "conceded", label: "Goals conceded", rate: true, invert: true, bm: { GK: [1.3, 0.7] } },
    ],
  },

  basketball: {
    label: "Basketball",
    unitLabel: "Minutes played",
    unitShort: "min",
    window: 36,
    windowLabel: "per 36",
    positions: { G: "Guard", W: "Wing / Forward", B: "Big" },
    metrics: [
      { key: "points", label: "Points", rate: true, bm: { G: [16, 6], W: [15, 5], B: [14, 5] } },
      { key: "fg", label: "Field goal", unit: "%", bm: { G: [44, 5], W: [46, 5], B: [54, 6] } },
      { key: "three", label: "Three point", unit: "%", bm: { G: [35, 6], W: [35, 6], B: [30, 8] } },
      { key: "ft", label: "Free throw", unit: "%", bm: { G: [80, 8], W: [77, 9], B: [68, 11] } },
      { key: "reb", label: "Rebounds", rate: true, bm: { G: [3.8, 1.4], W: [5.5, 1.6], B: [9.0, 2.2] } },
      { key: "ast", label: "Assists", rate: true, bm: { G: [6.0, 2.2], W: [3.0, 1.3], B: [2.0, 1.0] } },
      { key: "stl", label: "Steals", rate: true, bm: { G: [1.4, 0.5], W: [1.1, 0.4], B: [0.8, 0.4] } },
      { key: "blk", label: "Blocks", rate: true, bm: { G: [0.3, 0.2], W: [0.6, 0.3], B: [1.5, 0.7] } },
      { key: "tov", label: "Turnovers", rate: true, invert: true, bm: { G: [2.6, 0.9], W: [1.9, 0.7], B: [1.8, 0.7] } },
    ],
  },

  volleyball: {
    label: "Volleyball",
    unitLabel: "Sets played",
    unitShort: "sets",
    window: 1,
    windowLabel: "per set",
    positions: { OH: "Outside hitter", OPP: "Opposite", MB: "Middle blocker", S: "Setter", L: "Libero" },
    metrics: [
      { key: "kills", label: "Kills", rate: true, bm: { OH: [3.2, 1.1], OPP: [3.6, 1.2], MB: [2.2, 0.9] } },
      { key: "hitEff", label: "Hitting efficiency", unit: "%", bm: { OH: [26, 7], OPP: [27, 7], MB: [36, 8] } },
      { key: "aces", label: "Service aces", rate: true, bm: { OH: [0.25, 0.15], OPP: [0.28, 0.16], MB: [0.15, 0.1], S: [0.2, 0.12], L: [0.1, 0.08] } },
      { key: "serveErr", label: "Service errors", rate: true, invert: true, bm: { OH: [0.35, 0.18], OPP: [0.38, 0.18], MB: [0.3, 0.16], S: [0.28, 0.15], L: [0.2, 0.12] } },
      { key: "blocksV", label: "Blocks", rate: true, bm: { OH: [0.45, 0.2], OPP: [0.55, 0.25], MB: [0.9, 0.35], S: [0.4, 0.2] } },
      { key: "digs", label: "Digs", rate: true, bm: { OH: [1.6, 0.7], OPP: [1.0, 0.5], MB: [0.5, 0.3], S: [1.2, 0.6], L: [3.0, 1.0] } },
      { key: "recep", label: "Positive reception", unit: "%", bm: { OH: [48, 9], L: [55, 9] } },
      { key: "setAst", label: "Assists", rate: true, bm: { S: [9.5, 2.0] } },
    ],
  },
};

/* ---------- 2. COACHING LIBRARY ----------------------------- */
/* This is the part that makes the app worth using. Expand it. */

const ADVICE = {
  goals: { why: "Finishing volume is low for your position — usually a shot-selection or arrival-timing problem, not a striking one.", drills: ["Two-touch finishing: 20 reps each foot from cut-backs, first touch across your body.", "Blind-side runs: react to a coach's cue at the last moment instead of starting the run early."], video: "striker finishing movement drills" },
  assists: { why: "You are getting into the final third but the final ball is not landing.", drills: ["Cut-back reps from the byline into a 2m target gate, 30 per side.", "Scan-before-receive: call out the number of defenders before your first touch."], video: "final third passing decision drills football" },
  shotAcc: { why: "Too many shots are missing the frame — usually body shape over the ball or shooting from low-value zones.", drills: ["Plant-foot placement: 20 side-foot finishes at low corners before any power shots.", "Zone rule: only shoot inside the box for one full session and log the change."], video: "shooting technique accuracy football drill" },
  passAcc: { why: "Loose passing under pressure. Almost always about scanning frequency and receiving body angle.", drills: ["Rondo 4v2, one-touch only, 6 x 3 minutes.", "Open-body receiving: half-turn to receive on the back foot, 50 reps."], video: "passing accuracy under pressure drills" },
  keyPasses: { why: "You are safe with the ball but rarely create. Your risk profile is too conservative in the final third.", drills: ["Third-man runs in an 8v8 with a rule: the pass must break a line.", "Watch your own footage and mark every missed forward option."], video: "creating chances line breaking passes drill" },
  duelsWon: { why: "Losing physical contests — often timing and body position rather than raw strength.", drills: ["1v1 shielding: 30 seconds keep-ball against a defender, 8 rounds.", "Single-leg strength: Bulgarian split squats and lateral bounds, twice a week."], video: "winning duels body positioning football" },
  tackles: { why: "Low tackle output for the role. Usually you are arriving late or diving in early.", drills: ["Delay-then-press: shadow the attacker for 3 seconds before committing.", "Front-foot defending in a 1v1 channel, 20 reps."], video: "defensive tackling technique timing drill" },
  intercept: { why: "You are reacting to the ball instead of reading the next pass.", drills: ["Position yourself in the passing lane, not on the man, for one whole session.", "Watch two full matches of an elite player in your role and pause before each interception."], video: "reading the game interceptions defender" },
  turnovers: { why: "You are giving the ball away too often — usually a first-touch or decision-speed issue.", drills: ["Wall passing, two-touch, 10 minutes daily on your weaker foot.", "Pressure rondo: 30 seconds possession with two chasers."], video: "first touch under pressure drill football" },
  distance: { why: "Work rate is below the standard for your role, which limits both pressing and support runs.", drills: ["Repeated sprint ability: 10 x 30m with 25s recovery, twice a week.", "Tempo runs at 70% for 20 minutes to build the aerobic base."], video: "football conditioning repeated sprint ability" },
  saves: { why: "Low save volume can mean poor set position or late reaction rather than an easy game.", drills: ["Reaction saves from a deflection board, 3 x 10 reps.", "Set-position footwork: side shuffle then save, 20 reps each side."], video: "goalkeeper reaction save drills" },
  savePct: { why: "Shot-stopping percentage is below par — check your starting position and hand shape.", drills: ["Low-hand technique on shots below the waist, 30 reps.", "Angle work: mark your starting position for shots from each zone."], video: "goalkeeper shot stopping technique" },
  claims: { why: "You are staying on your line instead of dominating your six-yard box.", drills: ["Cross claiming with contact: 20 crosses with a passive blocker.", "Call loud and early — record yourself to check your communication."], video: "goalkeeper claiming crosses drill" },
  conceded: { why: "Goals against is high. Separate what is on you from what is on the defensive line before changing anything.", drills: ["Review every goal conceded and tag it: positioning, handling, or team error.", "Organise the wall and defensive line in every set-piece rep."], video: "goalkeeper positioning organisation" },

  points: { why: "Scoring volume is low. Usually shot creation, not shooting ability.", drills: ["Relocate after every pass — 5 minutes of movement-only scrimmage.", "10 spots x 10 shots off the catch, track make percentage."], video: "basketball scoring off movement drills" },
  fg: { why: "Efficiency issue: your shot diet contains too many contested mid-range attempts.", drills: ["Rim-and-three rule: for one session, no shots between the paint and the arc.", "Finishing package: 20 reps each of floater, reverse, and inside hand."], video: "basketball shot selection efficiency" },
  three: { why: "Perimeter shot is not falling — check base, elbow alignment, and follow-through consistency.", drills: ["Form shooting from 5 feet, 50 makes, one hand.", "Catch-and-shoot with a 0.6s release timer, 5 spots x 10."], video: "three point shooting form drill" },
  ft: { why: "Free throws are the cheapest points in the game and the easiest to fix.", drills: ["Same routine every rep. 10 makes in a row before leaving the gym.", "Shoot 20 free throws immediately after conditioning to train under fatigue."], video: "free throw routine consistency drill" },
  reb: { why: "You are watching the ball instead of finding a body.", drills: ["Box-out then rebound: 3 x 10 reps against contact.", "Two-hand chin rule — never bring a rebound below your chest."], video: "rebounding box out technique" },
  ast: { why: "Playmaking is low — you are likely holding the ball too long or missing the weak side.", drills: ["Pick-and-roll reads with two defenders, 20 reps per coverage.", "Two-dribble limit scrimmage for 10 minutes."], video: "point guard passing reads pick and roll" },
  stl: { why: "Low deflection numbers. Active hands and gap discipline are the fix, not gambling.", drills: ["Digs and stunts from the help side, 15 reps.", "Closeout to a stance without reaching, 20 reps."], video: "defensive activity hands deflections basketball" },
  blk: { why: "Rim protection below par — usually verticality and timing.", drills: ["Jump straight up with hands high, no swiping. 20 contests.", "Weak-side rotation timing from the opposite block."], video: "rim protection verticality drill" },
  tov: { why: "Ball security is the fastest gain available to you right now.", drills: ["Two-ball dribbling, 8 minutes daily.", "Pass fake before every entry pass for one full scrimmage."], video: "basketball ball handling turnover reduction" },

  kills: { why: "Attack volume is below your role's standard — check approach speed and set connection.", drills: ["Approach footwork without a ball, 30 reps, focus on the last two steps.", "High-contact hitting against a block, 40 swings."], video: "volleyball spike approach technique" },
  hitEff: { why: "You are swinging hard but into the block or out. This is shot selection.", drills: ["Tool the block: 20 reps aiming at the outside hand.", "Roll shot and cut shot, 15 reps each, into deep corners."], video: "volleyball hitting efficiency shot selection" },
  aces: { why: "Serve is safe but not threatening. Add pace or a zone target, not both at once.", drills: ["Target zones 1 and 5, 30 serves, track hits.", "Jump float with a flat contact, 20 reps."], video: "volleyball aggressive serving zones" },
  serveErr: { why: "Too many free points given away. Bring the risk down a notch until the ratio balances.", drills: ["Serve at 80% pace for 40 reps, aiming only for depth.", "Consistent toss drill: 20 tosses caught at the same point."], video: "volleyball serving consistency toss" },
  blocksV: { why: "Blocking output is low — usually late hands or reading the hitter instead of the setter.", drills: ["Read the setter's hands, then move. 20 blocking reps.", "Penetration over the net: press, don't reach up."], video: "volleyball blocking footwork hands" },
  digs: { why: "Defensive coverage is thin. Platform angle and stopping before contact are the usual culprits.", drills: ["Freeze before contact: 30 digs, feet planted at contact.", "Platform angle work against a hard-driven ball, 25 reps."], video: "volleyball defense digging platform" },
  recep: { why: "Passing in serve receive is inconsistent, which limits your team's whole offence.", drills: ["Serve receive to a target zone, 40 reps, score each pass 0-3.", "Midline rule: play every ball between your shoulders."], video: "volleyball serve receive passing drill" },
  setAst: { why: "Distribution is low or narrow — check tempo and how often you use the middle.", drills: ["Set 30 balls to each position with a consistent tempo.", "Middle usage: one session where every third set goes to the middle."], video: "volleyball setting technique tempo" },
};

const LEVELS = [
  { key: "amateur", label: "Amateur", f: 0.75, sh: -6 },
  { key: "club", label: "Club", f: 0.9, sh: -3 },
  { key: "semi", label: "Semi-pro", f: 1, sh: 0 },
  { key: "pro", label: "Pro", f: 1.12, sh: 3 },
];

/* ---------- 3. MATH ---------------------------------------- */

function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

function adjustedMean(metric, mean, level) {
  const L = LEVELS.find((l) => l.key === level) || LEVELS[2];
  if (metric.unit === "%") return metric.invert ? mean - L.sh : mean + L.sh;
  return metric.invert ? mean / L.f : mean * L.f;
}

function percentileFor(metric, value, position, level) {
  const bm = metric.bm[position];
  if (!bm) return null;
  const mean = adjustedMean(metric, bm[0], level);
  const sd = bm[1] || 1;
  let z = (value - mean) / sd;
  if (metric.invert) z = -z;
  return Math.max(1, Math.min(99, Math.round(normCdf(z) * 100)));
}

function band(p) {
  if (p >= 80) return { key: "elite", label: "Standout" };
  if (p >= 62) return { key: "good", label: "Above level" };
  if (p >= 38) return { key: "par", label: "At level" };
  if (p >= 20) return { key: "low", label: "Below level" };
  return { key: "gap", label: "Priority gap" };
}


/* ---------- 4. STORAGE (Supabase) -------------------------- */

async function loadSessions() {
  const { data, error } = await supabase
    .from("sessions")
    .select("payload")
    .order("created_at", { ascending: true });
  if (error) { console.error(error); return []; }
  return data.map((row) => row.payload);
}

async function saveSessions(list) {
  const newest = list[list.length - 1];
  const { error } = await supabase.from("sessions").insert({ payload: newest });
  if (error) { console.error(error); return false; }
  return true;
}

async function loadPlans() {
  const { data, error } = await supabase.from("plans").select("payload").maybeSingle();
  if (error) { console.error(error); return {}; }
  return data ? data.payload : {};
}

async function savePlans(plans) {
  const { data: s } = await supabase.auth.getSession();
  const uid = s && s.session ? s.session.user.id : null;
  if (!uid) return false;
  const { error } = await supabase
    .from("plans")
    .upsert({ user_id: uid, payload: plans, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) { console.error(error); return false; }
  return true;
}

function readMode() {
  try { return localStorage.getItem("athletix:mode") || "quick"; } catch { return "quick"; }
}
function writeMode(m) {
  try { localStorage.setItem("athletix:mode", m); } catch { /* ignore */ }
}

const defaultMinutes = (sport) => (sport === "volleyball" ? "4" : sport === "basketball" ? "30" : "90");

const SPORT_COLOR = { football: "#2bd46b", basketball: "#ff8a2a", volleyball: "#4aa8ff" };

function useCountUp(target, ms = 800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof requestAnimationFrame === "undefined") { setV(target); return undefined; }
    let raf;
    let start;
    const tick = (t) => {
      if (start === undefined) start = t;
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function stepFor(m) {
  if (m.unit === "%") return 5;
  if (m.unit === "km") return 0.5;
  return 1;
}

/* ---------- 5. STYLES -------------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,500;0,600;0,700;0,800;1,700;1,800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

body{background:#07142b;margin:0;}
.fs {
  --bg:#07142b; --card:#0f2347; --raise:#163262; --ink:#f2f5fa; --soft:#b4c3de;
  --rule:#26406e; --lime:#c8ff3d; --good:#5ee08a; --warn:#ffc24a; --bad:#ff6b5e;
  --on-sport:#06122a;
  --cond:'Barlow Condensed','Arial Narrow',Impact,sans-serif;
  --sans:'IBM Plex Sans',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
  background:var(--bg); color:var(--ink); font-family:var(--sans);
  min-height:100vh; padding:max(24px, env(safe-area-inset-top)) 16px 64px; -webkit-font-smoothing:antialiased;
}
.fs *{box-sizing:border-box;}
.fs .wrap{max-width:940px;margin:0 auto;}

.fs .masthead{display:flex;align-items:flex-end;justify-content:space-between;
  gap:16px;border-bottom:3px solid var(--sport);padding-bottom:12px;flex-wrap:wrap;}
.fs .tagline{font-family:var(--mono);font-size:12px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--soft);padding-bottom:4px;}
.fs .mastright{display:flex;flex-direction:column;align-items:flex-end;gap:8px;}

.fs .streakchip{display:inline-flex;align-items:center;gap:6px;font-family:var(--cond);font-size:20px;font-weight:700;
  font-style:italic;text-transform:uppercase;letter-spacing:.03em;padding:5px 12px;border:2px solid var(--lime);
  color:var(--lime);background:transparent;cursor:pointer;}
.fs .streakchip[data-zero="1"]{border-color:var(--rule);color:var(--soft);}
.fs .flame{display:inline-block;}
.fs .streakchip:not([data-zero="1"]) .flame{animation:flick 1.6s ease-in-out infinite;}
@keyframes flick{0%,100%{transform:scale(1) rotate(-4deg);}50%{transform:scale(1.18) rotate(5deg);}}

.fs .tabs{display:flex;gap:6px;margin:18px 0 26px;flex-wrap:wrap;}
.fs .tab{font-family:var(--cond);font-size:19px;font-weight:700;font-style:italic;text-transform:uppercase;
  letter-spacing:.04em;padding:8px 20px;background:var(--card);border:0;cursor:pointer;
  color:var(--soft);transform:skewX(-8deg);}
.fs .tab > *{display:inline-block;transform:skewX(8deg);}
.fs .tab:hover{color:var(--ink);}
.fs .tab[data-on="1"]{background:var(--sport);color:var(--on-sport);}
.fs .tab:disabled{opacity:.4;cursor:not-allowed;}
.fs .tab:focus-visible{outline:2px solid var(--lime);outline-offset:2px;}

.fs .eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.12em;font-weight:500;
  text-transform:uppercase;color:var(--sport);margin:0 0 10px;}
.fs .card{background:var(--card);border:1px solid var(--rule);border-top:3px solid var(--sport);
  padding:20px;margin-bottom:18px;}
.fs .h2{font-family:var(--cond);font-size:30px;font-weight:800;font-style:italic;text-transform:uppercase;
  letter-spacing:.02em;margin:0 0 14px;color:var(--ink);}

.fs .chipset{display:flex;flex-wrap:wrap;gap:8px;}
.fs .chip{font-family:var(--cond);font-size:17px;font-weight:700;text-transform:uppercase;
  letter-spacing:.04em;padding:7px 14px;background:var(--raise);color:var(--ink);
  border:1px solid var(--rule);cursor:pointer;transition:transform .12s;}
.fs .chip:hover{border-color:var(--sport);}
.fs .chip:active{transform:scale(.96);}
.fs .chip[data-on="1"]{background:var(--sport);color:var(--on-sport);border-color:var(--sport);}
.fs .chip:focus-visible{outline:2px solid var(--lime);outline-offset:2px;}

.fs .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;}
.fs .field label{display:block;font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;font-weight:500;
  text-transform:uppercase;color:var(--soft);margin-bottom:6px;}
.fs .field input{width:100%;font-family:var(--mono);font-size:17px;font-weight:600;padding:9px 10px;
  background:var(--bg);border:1px solid var(--rule);color:var(--ink);}
.fs .field input::placeholder{color:#6f84ab;}
.fs .field input:focus{outline:2px solid var(--sport);outline-offset:-1px;border-color:var(--sport);}

.fs .go{font-family:var(--cond);font-size:22px;font-weight:800;font-style:italic;text-transform:uppercase;
  letter-spacing:.05em;padding:12px 30px;background:var(--lime);color:var(--on-sport);border:0;cursor:pointer;
  transition:transform .12s, filter .12s;}
.fs .go:hover{filter:brightness(1.08);transform:translateY(-1px);}
.fs .go:active{transform:scale(.97);}
.fs .go:disabled{opacity:.5;cursor:default;transform:none;filter:none;}
.fs .ghost{background:transparent;color:var(--ink);border:2px solid var(--sport);}
.fs .ghost:hover{background:var(--sport);color:var(--on-sport);}

.fs .rankrow{display:grid;grid-template-columns:1.1fr 84px 1fr 62px;gap:14px;align-items:center;
  padding:13px 0;border-bottom:1px solid var(--rule);}
.fs .rankrow:last-child{border-bottom:0;}
.fs .rname{font-family:var(--sans);font-size:15px;font-weight:600;}
.fs .rsub{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--soft);}
.fs .rval{font-family:var(--mono);font-size:15px;font-weight:600;text-align:right;white-space:nowrap;}
.fs .rval .per{color:var(--soft);font-weight:400;}
.fs .scale{position:relative;height:10px;background:var(--bg);border-radius:5px;overflow:hidden;}
.fs .bar{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:var(--soft);}
.fs .bar[data-b="elite"],.fs .bar[data-b="good"]{background:var(--good);}
.fs .bar[data-b="low"]{background:var(--warn);}
.fs .bar[data-b="gap"]{background:var(--bad);}
.fs .pnum{font-family:var(--cond);font-size:40px;font-weight:800;font-style:italic;line-height:.8;text-align:right;}
.fs .pnum[data-b="elite"],.fs .pnum[data-b="good"]{color:var(--good);}
.fs .pnum[data-b="low"]{color:var(--warn);}
.fs .pnum[data-b="gap"]{color:var(--bad);}
.fs .pbtag{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.08em;background:var(--lime);
  color:var(--on-sport);padding:2px 6px;margin-left:8px;vertical-align:2px;}

.fs .stamp{display:flex;align-items:center;gap:18px;background:var(--sport);color:var(--on-sport);
  padding:16px 22px;margin-bottom:18px;}
.fs .stampnum{font-family:var(--cond);font-size:84px;font-weight:800;font-style:italic;line-height:.8;}
.fs .stamptxt{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;}

.fs .fix{border-left:4px solid var(--bad);padding:14px 0 14px 16px;margin-bottom:16px;}
.fs .fix h4{font-family:var(--cond);font-size:23px;font-weight:800;font-style:italic;text-transform:uppercase;margin:0 0 6px;}
.fs .fix p{margin:0 0 10px;font-size:15px;line-height:1.55;}
.fs .fix ul{margin:0 0 12px;padding-left:18px;}
.fs .fix li{font-size:14.5px;line-height:1.6;margin-bottom:5px;}
.fs .watch{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--lime);text-decoration:none;border-bottom:1px solid var(--lime);}

.fs .keep{border-left:4px solid var(--good);padding:10px 0 10px 16px;margin-bottom:12px;}
.fs .keep strong{font-family:var(--cond);font-size:21px;font-weight:800;font-style:italic;text-transform:uppercase;}
.fs .keep span{display:block;font-size:14.5px;color:var(--soft);margin-top:2px;}

.fs table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:13.5px;}
.fs th{text-align:left;font-size:11px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--soft);font-weight:500;padding:0 8px 8px 0;border-bottom:2px solid var(--sport);}
.fs td{padding:10px 8px 10px 0;border-bottom:1px solid var(--rule);}
.fs .up{color:var(--good);font-weight:600;} .fs .down{color:var(--bad);font-weight:600;}

.fs .empty{font-family:var(--sans);font-size:15px;color:var(--soft);line-height:1.6;}
.fs .note{font-family:var(--mono);font-size:11.5px;color:var(--soft);line-height:1.65;
  border-top:1px solid var(--rule);padding-top:12px;margin-top:22px;}

.fs .rowhead{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
.fs .rowhead .h2{margin:0;}
.fs .chip.sm{font-size:15px;padding:5px 12px;}
.fs .hint{font-family:var(--sans);font-size:14px;color:var(--soft);line-height:1.55;margin:0 0 16px;}
.fs .hint b{color:var(--ink);font-weight:600;}
.fs .stepper{display:grid;grid-template-columns:42px 1fr 42px;}
.fs .stepper input{text-align:center;border-left:0;border-right:0;}
.fs .stepper button{font-family:var(--mono);font-size:20px;font-weight:600;background:var(--raise);
  border:1px solid var(--rule);color:var(--ink);cursor:pointer;padding:0;}
.fs .stepper button:hover{background:var(--sport);color:var(--on-sport);border-color:var(--sport);}
.fs .stepper button:active{transform:scale(.94);}
.fs .stepper button:focus-visible{outline:2px solid var(--lime);outline-offset:-2px;}
.fs .err{font-family:var(--sans);font-size:14px;color:var(--bad);border-left:4px solid var(--bad);
  background:var(--card);padding:10px 12px;margin:0 0 16px;}

.fs .weekbar{display:flex;align-items:center;gap:14px;margin-bottom:16px;flex-wrap:wrap;}
.fs .count{font-family:var(--cond);font-size:48px;font-weight:800;font-style:italic;line-height:.85;color:var(--sport);}
.fs .lbl{font-family:var(--mono);font-size:12px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);}
.fs .daycard{border:1px solid var(--rule);border-left:4px solid var(--rule);background:var(--card);padding:16px;margin-bottom:12px;}
.fs .daycard[data-done="1"]{border-left-color:var(--good);}
.fs .dayhead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}
.fs .dayname{font-family:var(--cond);font-size:28px;font-weight:800;font-style:italic;text-transform:uppercase;}
.fs .tag{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
  padding:3px 8px;margin-left:10px;vertical-align:4px;}
.fs .tag[data-t="physical"]{background:var(--warn);color:var(--on-sport);}
.fs .tag[data-t="skill"]{background:var(--sport);color:var(--on-sport);}
.fs .donebtn{font-family:var(--cond);font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
  padding:7px 14px;border:2px solid var(--good);background:transparent;color:var(--good);cursor:pointer;white-space:nowrap;}
.fs .donebtn[data-on="1"]{background:var(--good);color:var(--on-sport);}
.fs .step{font-size:14.5px;line-height:1.55;padding:8px 0;border-top:1px solid var(--rule);}
.fs .step b{font-weight:600;}
.fs .step .mins{font-family:var(--mono);font-size:12px;color:var(--soft);margin-left:8px;}
.fs .step .why{font-family:var(--mono);font-size:12px;font-weight:500;color:var(--lime);margin-top:3px;}

/* ---- daily tracker ---- */
.fs .streakrow{display:flex;align-items:flex-end;gap:28px;flex-wrap:wrap;margin-bottom:16px;}
.fs .streaknum{font-family:var(--cond);font-size:72px;font-weight:800;font-style:italic;line-height:.8;color:var(--lime);}
.fs .days{display:grid;grid-template-columns:repeat(14,1fr);gap:5px;margin-bottom:8px;}
.fs .dot{aspect-ratio:1;background:var(--bg);border:1px solid var(--rule);display:flex;align-items:center;justify-content:center;
  font-family:var(--mono);font-size:10px;color:var(--soft);}
.fs .dot[data-k="train"]{background:var(--sport);border-color:var(--sport);color:var(--on-sport);}
.fs .dot[data-k="match"]{background:var(--lime);border-color:var(--lime);color:var(--on-sport);}
.fs .dot[data-k="rest"]{background:var(--raise);border-color:var(--soft);color:var(--ink);}
.fs .dot[data-today="1"]{outline:2px solid var(--ink);outline-offset:1px;}
.fs .legend{display:flex;gap:14px;flex-wrap:wrap;font-family:var(--mono);font-size:11.5px;color:var(--soft);margin-bottom:16px;}
.fs .legend i{display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px;}

/* ---- personal best ---- */
.fs .pb{position:relative;overflow:hidden;background:var(--lime);color:var(--on-sport);padding:18px 22px;margin-bottom:18px;
  animation:pbin .6s cubic-bezier(.2,1.4,.4,1) both;}
.fs .pb .big{font-family:var(--cond);font-size:34px;font-weight:800;font-style:italic;text-transform:uppercase;line-height:1;}
.fs .pb .small{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin-top:6px;}
.fs .pb .shine{position:absolute;top:0;bottom:0;width:80px;left:-120px;background:rgba(255,255,255,.55);
  transform:skewX(-20deg);animation:shine 1.4s .5s ease-out both;}
.fs .confetti{position:absolute;inset:0;pointer-events:none;}
.fs .confetti span{position:absolute;top:50%;left:50%;width:8px;height:12px;opacity:0;
  animation:burst 1.1s ease-out forwards;}
@keyframes pbin{0%{transform:scale(.6) rotate(-3deg);opacity:0;}100%{transform:scale(1) rotate(0);opacity:1;}}
@keyframes shine{to{left:110%;}}
@keyframes burst{0%{opacity:1;transform:translate(-50%,-50%) rotate(0);}
  100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(var(--r));}}

/* ---- player card + install ---- */
.fs .cardgrid{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:28px;align-items:start;}
.fs .cardimg{width:100%;max-width:340px;display:block;animation:cardin .7s cubic-bezier(.2,1.3,.4,1) both;}
@keyframes cardin{0%{transform:perspective(800px) rotateY(-70deg) scale(.85);opacity:0;}100%{transform:none;opacity:1;}}
.fs .attr{display:grid;grid-template-columns:44px 1fr 44px;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--rule);}
.fs .attr b{font-family:var(--cond);font-size:28px;font-weight:800;font-style:italic;color:var(--ink);}
.fs .attr span{font-size:15px;}
.fs .attr em{font-family:var(--mono);font-size:13px;font-style:normal;font-weight:600;text-align:right;}
.fs .namefield{margin:16px 0;}
.fs .namefield input{max-width:340px;}
.fs .installbtn{font-family:var(--cond);font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
  padding:5px 12px;background:var(--sport);color:var(--on-sport);border:0;cursor:pointer;}
.fs .ioshint{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--card);
  border:1px solid var(--rule);border-left:4px solid var(--lime);padding:10px 12px;margin:14px 0 0;font-size:14px;color:var(--soft);}
.fs .ioshint b{color:var(--ink);}
.fs .ioshint button{background:none;border:0;color:var(--soft);font-size:20px;cursor:pointer;padding:0 4px;}

@media (max-width:640px){
  .fs .cardgrid{grid-template-columns:1fr;}
  .fs .cardimg{margin:0 auto;}
  .fs .rankrow{grid-template-columns:1fr 62px 44px;grid-template-areas:"n v p" "s s s";row-gap:8px;}
  .fs .rname{grid-area:n;} .fs .rval{grid-area:v;} .fs .pnum{grid-area:p;font-size:32px;}
  .fs .scale{grid-area:s;}
  .fs .stampnum{font-size:64px;}
  .fs .tab{flex:1 1 auto;font-size:16px;padding:8px 10px;}
  .fs .dayhead{flex-wrap:wrap;}
  .fs .days{gap:3px;}
  .fs .dot{font-size:9px;}
  .fs .mastright{align-items:flex-start;}
}
@media (prefers-reduced-motion:reduce){
  .fs *, .fs *::before, .fs *::after{animation:none !important;transition:none !important;}
}
`;

/* ---------- 6. UI ------------------------------------------ */

export default function FormSheet() {
  const [view, setView] = useState("entry");
  const [sport, setSport] = useState("football");
  const [position, setPosition] = useState("MID");
  const [level, setLevel] = useState("club");
  const [minutes, setMinutes] = useState("90");
  const [raw, setRaw] = useState({});
  const [mode, setModeState] = useState(readMode);
  const [prefilled, setPrefilled] = useState(false);
  const [report, setReport] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focusHint, setFocusHint] = useState(null);

  function applyPrefill(sp, pos, list) {
    const prev = [...list].reverse().find((x) => x.sport === sp && x.position === pos && x.raw);
    if (prev) {
      setRaw({ ...prev.raw });
      setMinutes(String(prev.minutes));
      setPrefilled(true);
    } else {
      setRaw({});
      setMinutes(defaultMinutes(sp));
      setPrefilled(false);
    }
  }

  useEffect(() => {
    let alive = true;
    Promise.all([loadSessions(), loadPlans()]).then(([s, p]) => {
      if (!alive) return;
      setSessions(s);
      setPlans(p || {});
      const last = s[s.length - 1];
      if (last && SPORTS[last.sport] && SPORTS[last.sport].positions[last.position]) {
        setSport(last.sport);
        setPosition(last.position);
        if (LEVELS.some((l) => l.key === last.level)) setLevel(last.level);
        applyPrefill(last.sport, last.position, s);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const cfg = SPORTS[sport];
  const allMetrics = useMemo(() => cfg.metrics.filter((m) => m.bm[position]), [cfg, position]);
  const shownMetrics = useMemo(() => {
    if (mode !== "quick") return allMetrics;
    const keys = (QUICK[sport] && QUICK[sport][position]) || [];
    const picked = keys.map((k) => allMetrics.find((m) => m.key === k)).filter(Boolean);
    return picked.length ? picked : allMetrics;
  }, [mode, sport, position, allMetrics]);

  function setMode(m) {
    setModeState(m);
    writeMode(m);
  }

  function switchSport(k) {
    const pos = Object.keys(SPORTS[k].positions)[0];
    setSport(k);
    setPosition(pos);
    setReport(null);
    applyPrefill(k, pos, sessions);
  }

  function switchPosition(p) {
    setPosition(p);
    applyPrefill(sport, p, sessions);
  }

  function analyse() {
    const mins = parseFloat(minutes) || cfg.window;
    const rows = shownMetrics.map((m) => {
      const v = parseFloat(raw[m.key]);
      const value = isNaN(v) ? 0 : v;
      const per = m.rate ? (value / mins) * cfg.window : value;
      const p = percentileFor(m, per, position, level);
      return { key: m.key, label: m.label, unit: m.unit || "", per: Math.round(per * 100) / 100, pct: p, band: band(p) };
    });
    const overall = Math.round(rows.reduce((a, r) => a + r.pct, 0) / rows.length);
    const kept = {};
    allMetrics.forEach((m) => {
      if (raw[m.key] !== undefined && raw[m.key] !== "") kept[m.key] = raw[m.key];
    });
    setReport({
      id: Date.now(),
      date: localDay(),
      sport,
      position,
      level,
      minutes: mins,
      mode,
      raw: kept,
      overall,
      rows,
    });
    setView("report");
  }

  async function saveReport() {
    if (!report || report.saved) return;
    const ok = await saveSessions([...sessions, report]);
    if (!ok) {
      setError("Couldn't save this match. Check your connection and try again.");
      return;
    }
    setError("");
    const rec = { ...report, saved: true };
    setReport(rec);
    setSessions((prev) => [...prev, rec]);
    setPrefilled(true);
    setView("progress");
  }

  async function updatePlans(next) {
    setPlans(next);
    const ok = await savePlans(next);
    setError(ok ? "" : "Couldn't save your plan. Check your connection and try again.");
  }

  const today = localDay();
  const activity = useMemo(() => {
    const a = { ...(plans.activity || {}) };
    sessions.forEach((s) => { if (s.date) a[s.date] = "match"; });
    return a;
  }, [plans, sessions]);
  const streak = streakInfo(activity, today);

  function markDay(kind) {
    const act = { ...(plans.activity || {}) };
    if (act[today] === kind) delete act[today];
    else act[today] = kind;
    updatePlans({ ...plans, activity: trimActivity(act, today) });
  }

  function planFromReport(keys) {
    setSport(report.sport);
    setPosition(report.position);
    setFocusHint(keys);
    setView("training");
  }

  return (
    <div className="fs" style={{ "--sport": SPORT_COLOR[sport] }}>
      <style>{CSS}</style>
      <div className="wrap">
        <header className="masthead">
          <Logo width={230} />
          <div className="mastright">
            {!loading && (
              <button className="streakchip" data-zero={streak.current ? 0 : 1} onClick={() => setView("training")}>
                <span className="flame" aria-hidden="true">🔥</span>
                {streak.current}-day streak
              </button>
            )}
            <InstallButton />
            <div className="tagline">Know your game · fix what's costing you</div>
          </div>
        </header>
        <IosHint />

        <nav className="tabs">
          <button className="tab" data-on={view === "entry" ? 1 : 0} onClick={() => setView("entry")}>
            <span>Log a match</span>
          </button>
          <button className="tab" data-on={view === "report" ? 1 : 0} disabled={!report} onClick={() => setView("report")}>
            <span>Report</span>
          </button>
          <button className="tab" data-on={view === "progress" ? 1 : 0} onClick={() => setView("progress")}>
            <span>Progress</span>
          </button>
          <button className="tab" data-on={view === "card" ? 1 : 0} onClick={() => setView("card")}>
            <span>My card</span>
          </button>
          <button className="tab" data-on={view === "training" ? 1 : 0} onClick={() => setView("training")}>
            <span>Training</span>
          </button>
        </nav>

        {error && <p className="err" role="alert">{error}</p>}

        {view === "entry" && (
          <Entry
            cfg={cfg}
            sport={sport}
            switchSport={switchSport}
            position={position}
            setPosition={switchPosition}
            level={level}
            setLevel={setLevel}
            minutes={minutes}
            setMinutes={setMinutes}
            metrics={shownMetrics}
            totalCount={allMetrics.length}
            quickCount={((QUICK[sport] && QUICK[sport][position]) || []).length}
            mode={mode}
            setMode={setMode}
            prefilled={prefilled}
            raw={raw}
            setRaw={setRaw}
            analyse={analyse}
          />
        )}

        {view === "report" && report && (
          <Report rec={report} cfg={SPORTS[report.sport]} sessions={sessions} onSave={saveReport} onPlan={planFromReport} />
        )}

        {view === "progress" && <Progress sessions={sessions} loading={loading} />}

        {view === "card" && (loading ? (
          <section className="card"><p className="empty">Loading your card…</p></section>
        ) : (
          <CardView key={sport} sport={sport} sessions={sessions} plans={plans} onSave={updatePlans} goLog={() => setView("entry")} />
        ))}

        {view === "training" && (loading ? (
          <section className="card"><p className="empty">Loading your plan…</p></section>
        ) : (<>
          <Tracker activity={activity} today={today} streak={streak} onMark={markDay} />
          <Training
            key={sport + position}
            sport={sport}
            position={position}
            cfg={cfg}
            sessions={sessions}
            plans={plans}
            onSave={updatePlans}
            focusHint={focusHint}
            onFocusUsed={() => setFocusHint(null)}
          />
        </>))}

        <p className="note">
          Percentiles compare you against a modelled distribution for your position and level. The
          numbers shipped here are placeholders — swap in real league data before you trust them for
          selection decisions.
        </p>
      </div>
    </div>
  );
}

function Stepper({ metric, value, onChange }) {
  const step = stepFor(metric);
  const max = metric.unit === "%" ? 100 : Infinity;
  const num = parseFloat(value);
  const cur = isNaN(num) ? 0 : num;
  function bump(d) {
    const n = Math.min(max, Math.max(0, Math.round((cur + d) * 100) / 100));
    onChange(String(n));
  }
  return (
    <div className="stepper">
      <button type="button" aria-label={`Decrease ${metric.label}`} onClick={() => bump(-step)}>−</button>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        placeholder="0"
        aria-label={metric.label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" aria-label={`Increase ${metric.label}`} onClick={() => bump(step)}>+</button>
    </div>
  );
}

function Entry(props) {
  const {
    cfg, sport, switchSport, position, setPosition, level, setLevel, minutes, setMinutes,
    metrics, totalCount, quickCount, mode, setMode, prefilled, raw, setRaw, analyse,
  } = props;
  const canToggle = totalCount > quickCount;
  return (
    <>
      <section className="card">
        <p className="eyebrow">Step 1 — who is playing</p>
        <h2 className="h2">Sport and role</h2>
        <div className="chipset" style={{ marginBottom: 14 }}>
          {Object.entries(SPORTS).map(([k, s]) => (
            <button key={k} className="chip" data-on={sport === k ? 1 : 0} onClick={() => switchSport(k)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="chipset" style={{ marginBottom: 14 }}>
          {Object.entries(cfg.positions).map(([k, label]) => (
            <button key={k} className="chip" data-on={position === k ? 1 : 0} onClick={() => setPosition(k)}>
              {label}
            </button>
          ))}
        </div>
        <p className="eyebrow" style={{ marginTop: 18 }}>Compare me against</p>
        <div className="chipset">
          {LEVELS.map((l) => (
            <button key={l.key} className="chip" data-on={level === l.key ? 1 : 0} onClick={() => setLevel(l.key)}>
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Step 2 — the match</p>
        <div className="rowhead">
          <h2 className="h2">Enter your totals</h2>
          {canToggle && (
            <div className="chipset">
              <button className="chip sm" data-on={mode === "quick" ? 1 : 0} onClick={() => setMode("quick")}>
                Quick
              </button>
              <button className="chip sm" data-on={mode === "full" ? 1 : 0} onClick={() => setMode("full")}>
                Full · {totalCount}
              </button>
            </div>
          )}
        </div>
        <p className="hint">
          {canToggle
            ? mode === "quick"
              ? <><b>Quick log:</b> the stats that matter most for your role. Tap Full for everything.</>
              : <><b>Full log:</b> every stat for your role.</>
            : <><b>Your stats</b> for this role.</>}
          {prefilled && <> Filled in from your last match, so change only what's different.</>}
        </p>
        <div className="grid">
          <div className="field">
            <label>{cfg.unitLabel}</label>
            <input type="number" inputMode="decimal" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
          {metrics.map((m) => (
            <div className="field" key={m.key}>
              <label>
                {m.label} {m.unit ? `(${m.unit})` : `(total)`}
              </label>
              <Stepper metric={m} value={raw[m.key]} onChange={(v) => setRaw({ ...raw, [m.key]: v })} />
            </div>
          ))}
        </div>
        <button className="go" style={{ marginTop: 20 }} onClick={analyse}>
          Analyse this match
        </button>
      </section>
    </>
  );
}

function RankRow({ r, windowLabel, pb }) {
  const n = useCountUp(r.pct);
  return (
    <div className="rankrow">
      <div>
        <div className="rname">
          {r.label}
          {pb && <span className="pbtag">PB</span>}
        </div>
        <div className="rsub">{r.band.label}</div>
      </div>
      <div className="rval">
        {r.per}
        {r.unit || ""}
        {!r.unit && <span className="per"> {windowLabel}</span>}
      </div>
      <div className="scale">
        <span className="bar" data-b={r.band.key} style={{ width: `${n}%` }} />
      </div>
      <div className="pnum" data-b={r.band.key}>
        {n}
      </div>
    </div>
  );
}

function CountNum({ value }) {
  return <>{useCountUp(value)}</>;
}

const CONFETTI = Array.from({ length: 28 }, (_, i) => {
  const ang = (i / 28) * Math.PI * 2;
  const dist = 140 + (i % 4) * 45;
  return {
    x: `${Math.round(Math.cos(ang) * dist * 1.6)}px`,
    y: `${Math.round(Math.sin(ang) * dist * 0.6)}px`,
    r: `${(i % 2 ? 1 : -1) * (180 + i * 23)}deg`,
    c: ["#06122a", "#ffffff", "#ff8a2a", "#4aa8ff"][i % 4],
    d: `${(i % 5) * 40}ms`,
  };
});

function PersonalBest({ bests }) {
  const top = bests[0];
  return (
    <div className="pb" role="status">
      <div className="confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <span key={i} style={{ background: c.c, animationDelay: c.d, "--x": c.x, "--y": c.y, "--r": c.r }} />
        ))}
      </div>
      <div className="shine" aria-hidden="true" />
      <div className="big">New best: {top.label} {top.pct}</div>
      <div className="small">
        Up from {top.prev}
        {bests.length > 1 && ` · plus ${bests.length - 1} more personal best${bests.length > 2 ? "s" : ""}`}
      </div>
    </div>
  );
}

function Report({ rec, cfg, sessions, onSave, onPlan }) {
  const prevBest = {};
  sessions.forEach((s) => {
    if (s.id === rec.id || s.sport !== rec.sport || s.position !== rec.position) return;
    s.rows.forEach((r) => {
      if (prevBest[r.key] === undefined || r.pct > prevBest[r.key]) prevBest[r.key] = r.pct;
    });
  });
  const bests = rec.rows
    .filter((r) => prevBest[r.key] !== undefined && r.pct > prevBest[r.key])
    .map((r) => ({ key: r.key, label: r.label, pct: r.pct, prev: prevBest[r.key] }))
    .sort((a, b) => (b.pct - b.prev) - (a.pct - a.prev));
  const pbKeys = new Set(bests.map((b) => b.key));
  const sorted = [...rec.rows].sort((a, b) => a.pct - b.pct);
  const gaps = sorted.filter((r) => r.pct < 40).slice(0, 3);
  const strengths = [...sorted].reverse().filter((r) => r.pct >= 62).slice(0, 3);
  const planKeys = (gaps.length ? gaps : sorted.slice(0, 2)).map((r) => r.key);

  return (
    <>
      {bests.length > 0 && <PersonalBest key={rec.id} bests={bests} />}

      <div className="stamp">
        <div className="stampnum"><CountNum value={rec.overall} /></div>
        <div>
          <div className="stamptxt">Overall rank vs {LEVELS.find((l) => l.key === rec.level).label} {cfg.positions[rec.position]}</div>
          <div className="stamptxt" style={{ marginTop: 4 }}>
            {rec.date} · {rec.minutes} {cfg.unitShort}
          </div>
        </div>
      </div>

      <section className="card">
        <p className="eyebrow">Every metric, ranked 1–99</p>
        <h2 className="h2">The sheet</h2>
        {rec.rows.map((r) => (
          <RankRow key={r.key} r={r} windowLabel={cfg.windowLabel} pb={pbKeys.has(r.key)} />
        ))}
      </section>

      {strengths.length > 0 && (
        <section className="card">
          <p className="eyebrow">Keep doing this</p>
          <h2 className="h2">Your strengths</h2>
          {strengths.map((r) => (
            <div className="keep" key={r.key}>
              <strong>{r.label} — {r.pct}th percentile</strong>
              <span>Better than roughly {r.pct}% of players in your role at this level. Build your game around it.</span>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <p className="eyebrow">Work on this next</p>
        <h2 className="h2">{gaps.length ? "Your fixes" : "No priority gaps"}</h2>
        {gaps.length === 0 && (
          <p className="empty">Nothing fell below the 40th percentile this match. Raise the comparison level and run it again to find the next ceiling.</p>
        )}
        {gaps.map((r) => {
          const a = ADVICE[r.key];
          if (!a) return null;
          return (
            <div className="fix" key={r.key}>
              <h4>{r.label} — {r.pct}th percentile</h4>
              <p>{a.why}</p>
              <ul>
                {a.drills.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
              <a
                className="watch"
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(a.video)}`}
                target="_blank"
                rel="noreferrer"
              >
                Watch drills →
              </a>
            </div>
          );
        })}
      </section>

      <div className="chipset">
        <button className="go" onClick={onSave} disabled={rec.saved}>
          {rec.saved ? "Saved" : "Save to my record"}
        </button>
        <button className="go ghost" onClick={() => onPlan(planKeys)}>
          Build a training plan
        </button>
      </div>
    </>
  );
}

function Training({ sport, position, cfg, sessions, plans, onSave, focusHint, onFocusUsed }) {
  const plan = plans[sport];
  const roleMetrics = cfg.metrics.filter((m) => m.bm[position]);
  const label = (k) => (cfg.metrics.find((m) => m.key === k) || { label: k }).label;
  const latest = [...sessions].reverse().find((s) => s.sport === sport && s.position === position);

  function defaultFocus() {
    if (focusHint && focusHint.length) return focusHint.slice(0, 3);
    if (plan && plan.position === position) return plan.focus;
    if (latest) return [...latest.rows].sort((a, b) => a.pct - b.pct).slice(0, 2).map((r) => r.key);
    return [];
  }

  const [editing, setEditing] = useState(!plan || !!(focusHint && focusHint.length));
  const [days, setDays] = useState(plan ? plan.days : 3);
  const [mins, setMins] = useState(plan ? plan.minutes : 45);
  const [where, setWhere] = useState(plan ? plan.where : "field");
  const [matchDay, setMatchDay] = useState(plan ? plan.matchDay : 5);
  const [focus, setFocus] = useState(defaultFocus);

  useEffect(() => {
    if (focusHint) onFocusUsed();
  }, []);

  function toggleFocus(k) {
    if (focus.includes(k)) setFocus(focus.filter((x) => x !== k));
    else if (focus.length < 3) setFocus([...focus, k]);
  }

  function create() {
    const built = buildPlan({ sport, position, days, minutes: mins, where, matchDay, focus });
    const startPct = {};
    if (latest) {
      focus.forEach((k) => {
        const row = latest.rows.find((r) => r.key === k);
        if (row) startPct[k] = row.pct;
      });
    }
    onSave({ ...plans, [sport]: { ...built, startPct, done: {} } });
    setEditing(false);
  }

  if (editing || !plan) {
    const placeName = { field: PLACES.field[sport], gym: PLACES.gym, home: PLACES.home };
    return (
      <section className="card">
        <p className="eyebrow">{cfg.label} · {cfg.positions[position]}</p>
        <h2 className="h2">Build your weekly plan</h2>

        <p className="eyebrow">Days per week</p>
        <div className="chipset" style={{ marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className="chip" data-on={days === n ? 1 : 0} onClick={() => setDays(n)}>{n}</button>
          ))}
        </div>

        <p className="eyebrow">Minutes per session</p>
        <div className="chipset" style={{ marginBottom: 16 }}>
          {[30, 45, 60].map((n) => (
            <button key={n} className="chip" data-on={mins === n ? 1 : 0} onClick={() => setMins(n)}>{n}</button>
          ))}
        </div>

        <p className="eyebrow">Where you train</p>
        <div className="chipset" style={{ marginBottom: 16 }}>
          {["field", "gym", "home"].map((w) => (
            <button key={w} className="chip" data-on={where === w ? 1 : 0} onClick={() => setWhere(w)}>{placeName[w]}</button>
          ))}
        </div>

        <p className="eyebrow">Match day</p>
        <div className="chipset" style={{ marginBottom: 16 }}>
          <button className="chip" data-on={matchDay === -1 ? 1 : 0} onClick={() => setMatchDay(-1)}>None</button>
          {DAYS.map((d, i) => (
            <button key={d} className="chip" data-on={matchDay === i ? 1 : 0} onClick={() => setMatchDay(i)}>{d}</button>
          ))}
        </div>

        <p className="eyebrow">Focus — up to 3</p>
        <p className="hint">
          {latest ? "Your weakest stats from your last match are picked for you." : "Log a match first and the app picks your weakest stats for you."}
        </p>
        <div className="chipset" style={{ marginBottom: 20 }}>
          {roleMetrics.map((m) => (
            <button key={m.key} className="chip sm" data-on={focus.includes(m.key) ? 1 : 0} onClick={() => toggleFocus(m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="chipset">
          <button className="go" onClick={create}>Create plan</button>
          {plan && <button className="go ghost" onClick={() => setEditing(false)}>Cancel</button>}
        </div>
      </section>
    );
  }

  const wk = weekKey();
  const doneNow = (plan.done && plan.done[wk]) || [];

  function toggleDone(i) {
    const list = doneNow.includes(i) ? doneNow.filter((x) => x !== i) : [...doneNow, i];
    const done = { ...(plan.done || {}), [wk]: list };
    const keep = Object.keys(done).sort().slice(-12);
    const trimmed = {};
    keep.forEach((k) => { trimmed[k] = done[k]; });
    const act = { ...(plans.activity || {}) };
    const day = localDay();
    if (!doneNow.includes(i) && !act[day]) act[day] = "train";
    onSave({ ...plans, activity: trimActivity(act, day), [sport]: { ...plan, done: trimmed } });
  }

  const since = sessions.filter(
    (s) => s.sport === sport && s.position === plan.position && s.id > Date.parse(plan.createdAt)
  );
  const now = since[since.length - 1];
  const placeName = plan.where === "field" ? PLACES.field[sport] : PLACES[plan.where];

  return (
    <>
      <section className="card">
        <p className="eyebrow">
          {cfg.label} · {cfg.positions[plan.position]} · {plan.days} {plan.days === 1 ? "day" : "days"} × {plan.minutes} min · {placeName}
        </p>
        <div className="weekbar">
          <div className="count">{doneNow.length}/{plan.sessions.length}</div>
          <div className="lbl">sessions done this week</div>
        </div>
        {plan.position !== position && (
          <p className="hint">This plan was built for {cfg.positions[plan.position]}. Change the plan to rebuild it for {cfg.positions[position]}.</p>
        )}
        <p className="hint">
          Rest days are part of the plan. {plan.matchDay >= 0 && `No hard training on ${DAYS[plan.matchDay]} or the day before.`}
        </p>
        <button className="go ghost" onClick={() => setEditing(true)}>Change plan</button>
      </section>

      {plan.sessions.map((s, i) => {
        const done = doneNow.includes(i);
        return (
          <section className="daycard" key={i} data-done={done ? 1 : 0}>
            <div className="dayhead">
              <div>
                <span className="dayname">{DAYS[s.day]}</span>
                <span className="tag" data-t={s.type}>{s.type === "skill" ? "Technique" : "Fitness"}</span>
              </div>
              <button className="donebtn" data-on={done ? 1 : 0} onClick={() => toggleDone(i)}>
                {done ? "Done ✓" : "Mark done"}
              </button>
            </div>
            <div className="step"><b>Warm-up</b><span className="mins">10 min</span><div>{s.warmup}</div></div>
            {s.drills.map((d) => {
              const hits = d.metrics.filter((m) => plan.focus.includes(m));
              return (
                <div className="step" key={d.name}>
                  <b>{d.name}</b><span className="mins">{d.mins} min</span>
                  <div>{d.detail}</div>
                  {hits.length > 0 && <div className="why">Targets: {hits.map(label).join(", ")}</div>}
                </div>
              );
            })}
            <div className="step"><b>Cool-down</b><span className="mins">5 min</span><div>{s.cooldown}</div></div>
          </section>
        );
      })}

      {plan.focus.length > 0 && (
        <section className="card">
          <p className="eyebrow">Is it working?</p>
          <h2 className="h2">Your focus stats</h2>
          {!now && <p className="empty">Log a match to see whether the plan is moving your numbers.</p>}
          {now && (
            <table>
              <thead>
                <tr><th>Stat</th><th>Start</th><th>Now</th><th>Change</th></tr>
              </thead>
              <tbody>
                {plan.focus.map((k) => {
                  const a = plan.startPct ? plan.startPct[k] : undefined;
                  const row = now.rows.find((r) => r.key === k);
                  const b = row ? row.pct : undefined;
                  const d = a !== undefined && b !== undefined ? b - a : null;
                  return (
                    <tr key={k}>
                      <td>{label(k)}</td>
                      <td>{a !== undefined ? a : "—"}</td>
                      <td>{b !== undefined ? b : "—"}</td>
                      <td className={d > 0 ? "up" : d < 0 ? "down" : ""}>{d === null ? "—" : `${d > 0 ? "+" : ""}${d}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}

function InstallButton() {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); };
    const onDone = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onDone);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onDone);
    };
  }, []);
  if (!evt) return null;
  return (
    <button className="installbtn" onClick={async () => { evt.prompt(); await evt.userChoice; setEvt(null); }}>
      Install app
    </button>
  );
}

function IosHint() {
  const [show, setShow] = useState(() => {
    try {
      const ua = navigator.userAgent || "";
      const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
      const installed = window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
      return ios && !installed && localStorage.getItem("athletix:ioshint") !== "off";
    } catch { return false; }
  });
  if (!show) return null;
  return (
    <div className="ioshint">
      <span><b>Get the app:</b> tap the Share button, then <b>Add to Home Screen</b>.</span>
      <button aria-label="Dismiss" onClick={() => { try { localStorage.setItem("athletix:ioshint", "off"); } catch { /* ignore */ } setShow(false); }}>×</button>
    </div>
  );
}

function CardView({ sport, sessions, plans, onSave, goLog }) {
  const cfg = SPORTS[sport];
  const card = buildCard(sessions, sport);
  const saved = (plans.profile && plans.profile.name) || "";
  const [name, setName] = useState(saved);
  const [status, setStatus] = useState("");

  if (!card) {
    return (
      <section className="card">
        <p className="eyebrow">My card</p>
        <h2 className="h2">Unlock your {cfg.label} card</h2>
        <p className="hint">Log and save one {cfg.label.toLowerCase()} match and your player card appears here, rated from your real stats.</p>
        <button className="go" onClick={goLog}>Log a match</button>
      </section>
    );
  }

  const svg = cardSvg(card, {
    name: name.trim() || "Player",
    positionLabel: cfg.positions[card.position],
    sportLabel: cfg.label,
    sportColor: SPORT_COLOR[sport],
  });

  function saveName() {
    const n = name.trim().slice(0, 16);
    if (n === saved) return;
    onSave({ ...plans, profile: { ...(plans.profile || {}), name: n } });
  }

  async function share() {
    setStatus("");
    try {
      const r = await saveCardImage(svg, `athletix-${sport}-card.png`);
      setStatus(r === "downloaded" ? "Saved to your downloads." : r === "shared" ? "Shared." : "");
    } catch {
      setStatus("Couldn't create the image. Try again.");
    }
  }

  return (
    <section className="card">
      <p className="eyebrow">My card · {cfg.label} · last {Math.min(card.matches, RECENT)} {Math.min(card.matches, RECENT) === 1 ? "match" : "matches"}</p>
      <div className="cardgrid">
        <div>
          <img className="cardimg" src={svgDataUrl(svg)} alt={`Player card: overall ${card.overall}, ${cfg.positions[card.position]}`} />
        </div>
        <div>
          <h2 className="h2">Overall {card.overall}</h2>
          <p className="hint">
            {card.delta === null
              ? <>Your card updates every time you save a match.</>
              : card.delta > 0
                ? <><b>Up {card.delta}</b> since your last match. Keep it going.</>
                : card.delta < 0
                  ? <><b>Down {Math.abs(card.delta)}</b> since your last match. One good game turns it around.</>
                  : <><b>No change</b> since your last match.</>}
            {" "}{card.tier === "gold" ? "Gold card." : card.tier === "silver" ? `Silver card. Gold starts at 75.` : `Bronze card. Silver starts at 65.`}
          </p>
          {card.attrs.map((a) => (
            <div className="attr" key={a.code}>
              <b>{a.rating}</b>
              <span>{a.label}</span>
              <em className={a.delta > 0 ? "up" : a.delta < 0 ? "down" : ""}>
                {a.delta === undefined || a.delta === 0 ? "" : `${a.delta > 0 ? "+" : ""}${a.delta}`}
              </em>
            </div>
          ))}
          <div className="field namefield">
            <label htmlFor="card-name">Name on card</label>
            <input
              id="card-name"
              maxLength={16}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
          </div>
          <button className="go" onClick={share}>Save or share card</button>
          {status && <p className="hint" style={{ marginTop: 12 }}>{status}</p>}
        </div>
      </div>
    </section>
  );
}

function Tracker({ activity, today, streak, onMark }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const t = activity[today];
  return (
    <section className="card">
      <p className="eyebrow">Daily tracker</p>
      <div className="streakrow">
        <div>
          <div className="streaknum"><CountNum value={streak.current} /></div>
          <div className="lbl">day streak</div>
        </div>
        <div>
          <div className="count">{streak.best}</div>
          <div className="lbl">best streak</div>
        </div>
      </div>
      <div className="days">
        {days.map((d) => (
          <div key={d} className="dot" data-k={activity[d] || ""} data-today={d === today ? 1 : 0} title={d}>
            {Number(d.slice(8))}
          </div>
        ))}
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--sport)" }} />Trained</span>
        <span><i style={{ background: "var(--lime)" }} />Match</span>
        <span><i style={{ background: "var(--raise)", border: "1px solid var(--soft)" }} />Rest day</span>
      </div>
      <p className="hint">
        {t === "match"
          ? <><b>Match logged today.</b> Your streak is safe.</>
          : <><b>Today:</b> log training or a rest day to keep your streak. Rest days count, because recovery is part of getting better.</>}
      </p>
      {t !== "match" && (
        <div className="chipset">
          <button className="chip" data-on={t === "train" ? 1 : 0} onClick={() => onMark("train")}>I trained today</button>
          <button className="chip" data-on={t === "rest" ? 1 : 0} onClick={() => onMark("rest")}>Rest day</button>
        </div>
      )}
    </section>
  );
}

function Progress({ sessions, loading }) {
  if (loading) return <section className="card"><p className="empty">Loading your record…</p></section>;
  if (!sessions.length)
    return (
      <section className="card">
        <p className="eyebrow">Nothing logged yet</p>
        <p className="empty">
          Log a match, then save the report. Once you have three or more entries the trend line
          below starts telling you whether your training is actually working.
        </p>
      </section>
    );

  const pts = sessions.map((s, i) => ({ x: i, y: s.overall, date: s.date }));
  const W = 880, H = 200, PAD = 28;
  const step = pts.length > 1 ? (W - PAD * 2) / (pts.length - 1) : 0;
  const X = (i) => PAD + i * step;
  const Y = (v) => H - PAD - (v / 100) * (H - PAD * 2);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i)},${Y(p.y)}`).join(" ");

  const last = sessions[sessions.length - 1];
  const prev = sessions.length > 1 ? sessions[sessions.length - 2] : null;
  let movers = [];
  if (prev && prev.sport === last.sport && prev.position === last.position) {
    movers = last.rows
      .map((r) => {
        const o = prev.rows.find((x) => x.key === r.key);
        return o ? { label: r.label, d: r.pct - o.pct, now: r.pct } : null;
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
      .slice(0, 5);
  }

  return (
    <>
      <section className="card">
        <p className="eyebrow">Overall rank across {sessions.length} logged {sessions.length === 1 ? "match" : "matches"}</p>
        <h2 className="h2">Trend</h2>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Overall rank over time">
          {[25, 50, 75].map((g) => (
            <g key={g}>
              <line x1={PAD} x2={W - PAD} y1={Y(g)} y2={Y(g)} stroke="#26406e" strokeWidth="1" strokeDasharray="3 4" />
              <text x={4} y={Y(g) + 4} fontSize="11" fill="#b4c3de" fontFamily="IBM Plex Mono, monospace">{g}</text>
            </g>
          ))}
          <path d={line} fill="none" stroke="#c8ff3d" strokeWidth="3" />
          {pts.map((p, i) => (
            <circle key={i} cx={X(i)} cy={Y(p.y)} r="5" fill="#07142b" stroke="#c8ff3d" strokeWidth="2" />
          ))}
        </svg>
      </section>

      {movers.length > 0 && (
        <section className="card">
          <p className="eyebrow">Change since your previous match</p>
          <h2 className="h2">Biggest movers</h2>
          <table>
            <thead>
              <tr><th>Metric</th><th>Now</th><th>Change</th></tr>
            </thead>
            <tbody>
              {movers.map((m) => (
                <tr key={m.label}>
                  <td>{m.label}</td>
                  <td>{m.now}</td>
                  <td className={m.d > 0 ? "up" : m.d < 0 ? "down" : ""}>
                    {m.d > 0 ? "+" : ""}{m.d}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card">
        <p className="eyebrow">Full record</p>
        <h2 className="h2">Match log</h2>
        <table>
          <thead>
            <tr><th>Date</th><th>Sport</th><th>Role</th><th>Load</th><th>Rank</th></tr>
          </thead>
          <tbody>
            {[...sessions].reverse().map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td>
                <td>{SPORTS[s.sport].label}</td>
                <td>{SPORTS[s.sport].positions[s.position]}</td>
                <td>{s.minutes} {SPORTS[s.sport].unitShort}</td>
                <td>{s.overall}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
