import { supabase } from "./supabaseClient";
import React, { useState, useEffect, useMemo } from "react";
import Logo from "./Logo.jsx";
import { QUICK, PLACES, DAYS, buildPlan, weekKey, localDay, addDays, streakInfo, trimActivity } from "./training.js";
import { buildCard, cardSvg, svgDataUrl, saveCardImage, RECENT, matchRating, ratingBand, pctBand, BAND_COLOR } from "./card.js";
import Technique from "./Technique.jsx";
import Icon from "./icons.jsx";
import Team from "./Team.jsx";
import { Account } from "./Privacy.jsx";

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
      { key: "aces", label: "Service aces", rate: true, bm: { OH: [0.25, 0.15], OPP: [0.28, 0.16], MB: [0.15, 0.1], S: [0.2, 0.12] } },
      { key: "serveErr", label: "Service errors", rate: true, invert: true, bm: { OH: [0.35, 0.18], OPP: [0.38, 0.18], MB: [0.3, 0.16], S: [0.28, 0.15] } },
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

// Returns null when loading fails, so the app never mistakes a failed load for an empty account.
async function loadSessions() {
  // Only your own matches: coaches can also read their players' rows, so filter by your id.
  const { data: s } = await supabase.auth.getSession();
  const uid = s && s.session ? s.session.user.id : null;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("sessions")
    .select("payload")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });
  if (error) { console.error(error); return null; }
  return (data || []).map((row) => row.payload);
}

async function saveSessions(list) {
  const newest = list[list.length - 1];
  const { error } = await supabase.from("sessions").insert({ payload: newest });
  if (error) { console.error(error); return false; }
  return true;
}

async function loadPlans() {
  const { data, error } = await supabase.from("plans").select("payload").maybeSingle();
  if (error) { console.error(error); return null; }
  return data ? data.payload || {} : {};
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

// Ratings are scaled to a full game, so very short appearances would give silly numbers.
const UNIT_LIMITS = {
  football: { min: 15, max: 150, short: "Ratings need at least 15 minutes played to be fair.", long: "Check your minutes played. A football match is at most about 120 minutes." },
  basketball: { min: 8, max: 70, short: "Ratings need at least 8 minutes played to be fair.", long: "Check your minutes played. A basketball game is at most about 60 minutes." },
  volleyball: { min: 1, max: 5, short: "Enter at least 1 set played.", long: "A volleyball match has at most 5 sets." },
};
const defaultMinutes = (sport) => (sport === "volleyball" ? "3" : sport === "basketball" ? "30" : "90");

const SPORT_COLOR = { football: "#2dd4bf", basketball: "#fb923c", volleyball: "#60a5fa" };

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
}

// "Wing / Forward" -> "wings / forwards"
function plural(label) {
  return label.split(" / ").map((w) => `${w.toLowerCase()}s`).join(" / ");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
}

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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Barlow+Condensed:wght@700&display=swap');

body{background:#0b0d10;margin:0;}
.fs {
  --bg:#0b0d10; --card:#13161b; --raise:#1a1e25; --rule:#252a32; --rule2:#323844;
  --ink:#eceef1; --soft:#a3abb6; --mute:#8a929d;
  --lime:#c8ff3d; --good:#3dd68c; --warn:#f5b841; --bad:#f2545b; --elite:#5b9dff;
  --on-sport:#0b0d10;
  --sans:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  --cond:var(--sans); --mono:var(--sans);
  background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:15px; line-height:1.5;
  font-feature-settings:"tnum" 1,"cv11" 1;
  min-height:100vh; padding:max(20px, env(safe-area-inset-top)) 16px 64px; -webkit-font-smoothing:antialiased;
}
.fs *{box-sizing:border-box;}
.fs .wrap{max-width:960px;margin:0 auto;}
.fs button{font-family:var(--sans);}

/* ---- header ---- */
.fs .masthead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:16px;
  border-bottom:1px solid var(--rule);}
.fs .tagline{display:none;}
.fs .mastright{display:flex;align-items:center;gap:10px;}
.fs .streakchip{display:inline-flex;align-items:center;gap:7px;font-size:14px;font-weight:600;padding:7px 12px;
  border:1px solid var(--rule2);border-radius:999px;color:var(--ink);background:var(--card);cursor:pointer;white-space:nowrap;}
.fs .streakchip .flame{color:var(--warn);display:inline-flex;}
.fs .streakchip[data-zero="1"]{color:var(--soft);}
.fs .streakchip[data-zero="1"] .flame{color:var(--mute);}
.fs .installbtn{font-size:14px;font-weight:600;padding:7px 12px;border-radius:999px;background:var(--raise);
  color:var(--ink);border:1px solid var(--rule2);cursor:pointer;}

/* ---- top tabs (desktop) ---- */
.fs .tabs{display:flex;gap:4px;margin:14px 0 24px;border-bottom:1px solid var(--rule);flex-wrap:wrap;}
.fs .tab{font-size:14.5px;font-weight:600;padding:10px 14px;background:transparent;border:0;cursor:pointer;
  color:var(--soft);border-bottom:2px solid transparent;margin-bottom:-1px;}
.fs .tab:hover{color:var(--ink);}
.fs .tab[data-on="1"]{color:var(--ink);border-bottom-color:var(--lime);}
.fs .tab:focus-visible{outline:2px solid var(--lime);outline-offset:2px;border-radius:6px;}

/* ---- type + surfaces ---- */
.fs .eyebrow{font-size:11.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin:0 0 10px;}
.fs .card{background:var(--card);border:1px solid var(--rule);border-radius:16px;padding:22px;margin-bottom:16px;}
.fs .h2{font-size:22px;font-weight:700;letter-spacing:-.01em;margin:0 0 12px;color:var(--ink);}

.fs .chipset{display:flex;flex-wrap:wrap;gap:8px;}
.fs .chip{font-size:14px;font-weight:500;padding:8px 14px;background:var(--raise);color:var(--soft);
  border:1px solid var(--rule2);border-radius:10px;cursor:pointer;transition:background .12s,color .12s,border-color .12s;}
.fs .chip:hover{color:var(--ink);border-color:var(--mute);}
.fs .chip[data-on="1"]{background:var(--ink);color:var(--bg);border-color:var(--ink);font-weight:600;}
.fs .chip:focus-visible{outline:2px solid var(--lime);outline-offset:2px;}
.fs .chip.sm{font-size:13.5px;padding:7px 12px;}

.fs .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;}
.fs .field label{display:block;font-size:12.5px;font-weight:500;color:var(--soft);margin-bottom:6px;}
.fs .field input{width:100%;font-family:var(--sans);font-size:17px;font-weight:600;padding:10px 12px;
  background:var(--bg);border:1px solid var(--rule2);border-radius:10px;color:var(--ink);font-variant-numeric:tabular-nums;}
.fs .field input::placeholder{color:#4d545e;}
.fs .field input:focus{outline:none;border-color:var(--lime);box-shadow:0 0 0 3px rgba(200,255,61,.15);}

.fs .go{font-size:15.5px;font-weight:700;padding:13px 24px;background:var(--lime);color:#0b0d10;border:0;border-radius:12px;
  cursor:pointer;transition:filter .12s, transform .12s;}
.fs .go:hover{filter:brightness(1.06);}
.fs .go:active{transform:scale(.98);}
.fs .go:disabled{opacity:.45;cursor:default;transform:none;filter:none;}
.fs .ghost{background:transparent;color:var(--ink);border:1px solid var(--rule2);}
.fs .ghost:hover{background:var(--raise);filter:none;}

/* ---- report ---- */
.fs .rankrow{display:grid;grid-template-columns:1.2fr 90px 1fr 48px;gap:16px;align-items:center;
  padding:14px 0;border-bottom:1px solid var(--rule);}
.fs .rankrow:last-child{border-bottom:0;}
.fs .rname{font-size:15px;font-weight:600;}
.fs .rsub{font-size:12.5px;color:var(--mute);margin-top:1px;}
.fs .rval{font-size:14px;font-weight:600;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;}
.fs .rval .per{color:var(--mute);font-weight:400;}
.fs .scale{position:relative;height:6px;background:var(--raise);border-radius:3px;overflow:hidden;}
.fs .bar{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--soft);}
.fs .bar[data-b="elite"]{background:var(--elite);}
.fs .bar[data-b="good"]{background:var(--good);}
.fs .bar[data-b="par"]{background:#8b939e;}
.fs .bar[data-b="low"]{background:var(--warn);}
.fs .bar[data-b="gap"]{background:var(--bad);}
.fs .pnum{font-size:22px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;}
.fs .pnum[data-b="elite"]{color:var(--elite);}
.fs .pnum[data-b="good"]{color:var(--good);}
.fs .pnum[data-b="low"]{color:var(--warn);}
.fs .pnum[data-b="gap"]{color:var(--bad);}
.fs .pbtag{font-size:10.5px;font-weight:700;letter-spacing:.04em;background:rgba(200,255,61,.14);color:var(--lime);
  padding:2px 6px;border-radius:5px;margin-left:8px;vertical-align:2px;}

.fs .stamp{display:flex;align-items:center;gap:20px;background:var(--card);border:1px solid var(--rule);border-radius:16px;
  padding:20px 22px;margin-bottom:16px;}
.fs .stampnum{min-width:96px;text-align:center;font-size:44px;font-weight:800;letter-spacing:-.02em;line-height:1;
  padding:14px 12px;border-radius:14px;font-variant-numeric:tabular-nums;color:#0b0d10;background:var(--soft);}
.fs .stampnum[data-r="elite"]{background:var(--elite);}
.fs .stampnum[data-r="good"]{background:var(--good);}
.fs .stampnum[data-r="par"]{background:#c3c9d1;}
.fs .stampnum[data-r="low"]{background:var(--warn);}
.fs .stampnum[data-r="gap"]{background:var(--bad);}
.fs .stamptxt{font-size:13.5px;color:var(--soft);}
.fs .stamptxt:first-child{font-size:19px;font-weight:700;color:var(--ink);margin-bottom:2px;}

.fs .fix{border-left:3px solid var(--bad);padding:4px 0 4px 16px;margin-bottom:22px;}
.fs .fix h4{font-size:16.5px;font-weight:700;margin:0 0 6px;}
.fs .fix p{margin:0 0 10px;font-size:14.5px;line-height:1.6;color:var(--soft);}
.fs .fix ul{margin:0 0 12px;padding-left:18px;}
.fs .fix li{font-size:14.5px;line-height:1.6;margin-bottom:5px;}
.fs .watch{font-size:13.5px;font-weight:600;color:var(--lime);text-decoration:none;}
.fs .watch:hover{text-decoration:underline;}

.fs .keep{border-left:3px solid var(--good);padding:4px 0 4px 16px;margin-bottom:14px;}
.fs .keep strong{font-size:16.5px;font-weight:700;}
.fs .keep span{display:block;font-size:14.5px;color:var(--soft);margin-top:3px;}

.fs table{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums;}
.fs th{text-align:left;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--mute);padding:0 8px 10px 0;border-bottom:1px solid var(--rule2);}
.fs td{padding:12px 8px 12px 0;border-bottom:1px solid var(--rule);}
.fs .up{color:var(--good);font-weight:600;} .fs .down{color:var(--bad);font-weight:600;}

.fs .empty{font-size:15px;color:var(--soft);line-height:1.6;margin:0;}
.fs .tcnote{font-size:12.5px;color:var(--mute);margin-top:2px;}
.fs .notice{margin-top:12px;padding:12px 14px;border-radius:10px;background:var(--raise);border:1px solid var(--rule2);}
.fs .notice p{margin:0 0 10px;font-size:14px;color:var(--soft);line-height:1.5;}
.fs .chartwrap{width:100%;}
.fs .sportnote{font-size:13.5px;color:var(--soft);margin:-4px 0 14px;}

/* ---- team + account ---- */
.fs .okmsg{font-size:14px;line-height:1.5;padding:11px 14px;margin:0 0 16px;border-radius:10px;
  border:1px solid rgba(61,214,140,.4);background:rgba(61,214,140,.1);color:#a8f0cb;}
.fs .teamgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;}
.fs .teamgrid .card{margin-bottom:0;}
.fs .tmrow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid var(--rule);}
.fs .tmrow:last-child{border-bottom:0;}
.fs .tmname{font-size:16px;font-weight:700;}
.fs .tmsub{font-size:13.5px;color:var(--soft);margin:2px 0 0;line-height:1.5;}
.fs .tmhead{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px;}
.fs .codebox{display:flex;flex-direction:column;align-items:center;gap:6px;background:var(--raise);border:1px solid var(--rule2);
  border-radius:14px;padding:12px 16px;min-width:170px;}
.fs .codelabel{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);}
.fs .codehint{font-size:11.5px;color:var(--mute);text-align:center;max-width:200px;line-height:1.4;}
.fs .codeval{font-size:26px;font-weight:800;letter-spacing:.14em;color:var(--lime);font-variant-numeric:tabular-nums;}
.fs .field input.codeinput{letter-spacing:.2em;text-transform:uppercase;font-size:20px;}
.fs .tmempty{display:flex;gap:14px;align-items:center;}
.fs .tmicon{display:flex;color:var(--mute);flex:none;}
.fs .tmtiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
.fs .tmtile{background:var(--raise);border:1px solid var(--rule);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:2px;}
.fs .tmtile b{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;}
.fs .tmtile b[data-r="elite"]{color:var(--elite);} .fs .tmtile b[data-r="good"]{color:var(--good);}
.fs .tmtile b[data-r="low"]{color:var(--warn);} .fs .tmtile b[data-r="gap"]{color:var(--bad);}
.fs .tmtile span{font-size:12.5px;color:var(--soft);}
.fs .roster{border-top:1px solid var(--rule);}
.fs .prow{border-bottom:1px solid var(--rule);}
.fs .phead{width:100%;display:flex;align-items:center;gap:12px;background:none;border:0;color:var(--ink);text-align:left;
  padding:13px 2px;cursor:pointer;}
.fs .phead:focus-visible{outline:2px solid var(--lime);outline-offset:2px;border-radius:8px;}
.fs .pmain{flex:1;min-width:0;display:flex;flex-direction:column;}
.fs .pname{font-size:15.5px;font-weight:600;}
.fs .psub{font-size:13px;color:var(--soft);}
.fs .psub[data-quiet="1"]{color:var(--warn);}
.fs .pright{display:flex;align-items:center;gap:12px;font-size:13px;white-space:nowrap;}
.fs .flat{color:var(--mute);}
.fs .rpill{display:inline-block;min-width:46px;text-align:center;font-weight:800;font-size:15px;padding:5px 8px;border-radius:9px;
  color:#0b0d10;background:#c3c9d1;font-variant-numeric:tabular-nums;}
.fs .rpill.sm{min-width:40px;font-size:13px;padding:3px 6px;}
.fs .rpill[data-r="elite"]{background:var(--elite);} .fs .rpill[data-r="good"]{background:var(--good);}
.fs .rpill[data-r="low"]{background:var(--warn);} .fs .rpill[data-r="gap"]{background:var(--bad);}
.fs .pchev{display:flex;color:var(--mute);transition:transform .15s;}
.fs .prow[data-open="1"] .pchev{transform:rotate(90deg);}
.fs .pdetail{padding:4px 2px 16px;}
.fs .pcols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:6px;}
.fs .pstat{display:flex;justify-content:space-between;gap:10px;font-size:14px;margin:0 0 4px;}
.fs .pstat span{color:var(--soft);}
.fs .go.danger{background:var(--bad);color:#fff;}
.fs .dangercard{border-color:rgba(242,84,91,.35);}
.fs .pickfoot .linkbtn + .linkbtn{margin-left:14px;}
.fs .note{font-size:12.5px;color:var(--mute);line-height:1.6;border-top:1px solid var(--rule);padding-top:14px;margin-top:24px;}

.fs .rowhead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;}
.fs .rowhead .h2{margin:0;}
.fs .hint{font-size:14px;color:var(--soft);line-height:1.55;margin:0 0 16px;}
.fs .hint b{color:var(--ink);font-weight:600;}
.fs .stepper{display:grid;grid-template-columns:44px 1fr 44px;}
.fs .stepper input{text-align:center;border-radius:0;border-left:0;border-right:0;}
.fs .stepper button{font-size:19px;font-weight:500;background:var(--raise);border:1px solid var(--rule2);color:var(--soft);cursor:pointer;padding:0;}
.fs .stepper button:first-child{border-radius:10px 0 0 10px;}
.fs .stepper button:last-child{border-radius:0 10px 10px 0;}
.fs .stepper button:hover{color:var(--ink);background:var(--rule2);}
.fs .stepper button:active{transform:scale(.96);}
.fs .stepper button:focus-visible{outline:2px solid var(--lime);outline-offset:-2px;}
.fs .err{font-size:14px;color:#ffb3b6;border:1px solid rgba(242,84,91,.4);background:rgba(242,84,91,.1);
  border-radius:10px;padding:11px 14px;margin:0 0 16px;}

/* ---- training ---- */
.fs .weekbar{display:flex;align-items:baseline;gap:12px;margin-bottom:14px;flex-wrap:wrap;}
.fs .count{font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums;}
.fs .lbl{font-size:13px;color:var(--soft);}
.fs .daycard{border:1px solid var(--rule);background:var(--card);border-radius:14px;padding:18px;margin-bottom:12px;}
.fs .daycard[data-done="1"]{border-color:rgba(61,214,140,.45);}
.fs .dayhead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;}
.fs .dayname{font-size:18px;font-weight:700;}
.fs .tag{font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;margin-left:10px;vertical-align:2px;
  background:var(--raise);color:var(--soft);}
.fs .tag[data-t="physical"]{background:rgba(245,184,65,.14);color:var(--warn);}
.fs .tag[data-t="skill"]{background:rgba(91,157,255,.15);color:var(--elite);}
.fs .donebtn{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600;padding:7px 12px;border-radius:10px;
  border:1px solid var(--rule2);background:transparent;color:var(--ink);cursor:pointer;white-space:nowrap;}
.fs .donebtn[data-on="1"]{background:rgba(61,214,140,.15);border-color:rgba(61,214,140,.5);color:var(--good);}
.fs .step{font-size:14.5px;line-height:1.55;padding:10px 0;border-top:1px solid var(--rule);}
.fs .step b{font-weight:600;}
.fs .step div{color:var(--soft);}
.fs .step .mins{font-size:12.5px;color:var(--mute);margin-left:8px;}
.fs .step .why{font-size:12.5px;font-weight:500;color:var(--elite);margin-top:3px;}

/* ---- daily tracker ---- */
.fs .streakrow{display:flex;align-items:flex-end;gap:36px;flex-wrap:wrap;margin-bottom:18px;}
.fs .streaknum{font-size:56px;font-weight:800;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums;}
.fs .days{display:grid;grid-template-columns:repeat(14,1fr);gap:5px;margin-bottom:10px;}
.fs .dot{aspect-ratio:1;background:var(--raise);border-radius:6px;display:flex;align-items:center;justify-content:center;
  font-size:10.5px;font-weight:500;color:var(--mute);font-variant-numeric:tabular-nums;}
.fs .dot[data-k="train"]{background:var(--good);color:#0b0d10;}
.fs .dot[data-k="match"]{background:var(--lime);color:#0b0d10;}
.fs .dot[data-k="rest"]{background:#3a414c;color:var(--ink);}
.fs .dot[data-today="1"]{box-shadow:0 0 0 2px var(--bg),0 0 0 3.5px var(--soft);}
.fs .legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--soft);margin-bottom:16px;}
.fs .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px;}

/* ---- personal best ---- */
.fs .pb{position:relative;overflow:hidden;display:flex;align-items:center;gap:16px;background:var(--card);
  border:1px solid rgba(200,255,61,.35);border-radius:16px;padding:18px 20px;margin-bottom:16px;
  animation:pbin .5s cubic-bezier(.2,.9,.3,1) both;}
.fs .pb::before{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(200,255,61,.10) 50%,transparent 70%);
  transform:translateX(-100%);animation:sweep 1.6s .35s ease-out both;}
.fs .pbicon{flex:none;width:46px;height:46px;border-radius:12px;background:rgba(200,255,61,.14);color:var(--lime);
  display:flex;align-items:center;justify-content:center;animation:pop .5s .25s cubic-bezier(.2,1.6,.4,1) both;}
.fs .pb .big{font-size:17px;font-weight:700;}
.fs .pb .big em{font-style:normal;color:var(--lime);}
.fs .pb .small{font-size:13.5px;color:var(--soft);margin-top:2px;}
.fs .shine,.fs .confetti{display:none;}
@keyframes pbin{0%{transform:translateY(8px);opacity:0;}100%{transform:none;opacity:1;}}
@keyframes sweep{to{transform:translateX(100%);}}
@keyframes pop{0%{transform:scale(.4);}100%{transform:scale(1);}}

/* ---- sport picker ---- */
.fs .picker{max-width:520px;}
.fs .pickhead{display:flex;justify-content:center;margin:20px 0 36px;}
.fs .picktitle{font-size:28px;font-weight:700;letter-spacing:-.02em;text-align:center;margin:0 0 8px;line-height:1.2;}
.fs .sporttiles{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;margin-top:26px;}
.fs .sporttile{position:relative;display:flex;align-items:center;gap:16px;width:100%;padding:18px 18px;
  background:var(--card);border:1px solid var(--rule);border-radius:14px;cursor:pointer;color:var(--ink);
  text-align:left;transition:background .12s,border-color .12s;}
.fs .sporttile:hover,.fs .sporttile:focus-visible{background:var(--raise);border-color:var(--rule2);outline:none;}
.fs .sporttile:active{transform:scale(.99);}
.fs .sticon{flex:none;width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--tile) 16%,transparent);color:var(--tile);}
.fs .stname{min-width:0;flex:1;font-size:18px;font-weight:600;}
.fs .stlast{font-size:12px;font-weight:600;color:var(--soft);background:var(--raise);padding:3px 9px;border-radius:999px;}
.fs .stchev{color:var(--mute);display:flex;}
.fs .pickfoot{text-align:center;margin-top:28px;}
.fs .linkbtn{background:none;border:0;color:var(--mute);font-size:14px;text-decoration:underline;cursor:pointer;padding:6px;}
.fs .linkbtn:hover{color:var(--ink);}

/* ---- log page ---- */
.fs .sportbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;}
.fs .sbname{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:700;letter-spacing:-.01em;}
.fs .sbname .sbicon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--sport) 16%,transparent);color:var(--sport);}
.fs .sbchange{font-size:14px;font-weight:600;padding:8px 14px;background:var(--card);color:var(--ink);
  border:1px solid var(--rule2);border-radius:10px;cursor:pointer;}
.fs .sbchange:hover{background:var(--raise);}
.fs .rolegrid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:22px;}

.fs .bottombar{display:none;}

/* ---- technique ---- */
.fs .tips{margin:0 0 14px;padding-left:20px;color:var(--soft);}
.fs .tips li{font-size:14.5px;line-height:1.7;}
.fs .techgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;align-items:start;}
.fs .techimg{width:100%;display:block;border-radius:12px;border:1px solid var(--rule2);}
.fs .tcheck{background:var(--bg);border:1px solid var(--rule);border-radius:12px;padding:14px 16px;margin-bottom:10px;}
.fs .tchead{display:flex;justify-content:space-between;align-items:center;gap:10px;}
.fs .tstat{font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;
  background:rgba(61,214,140,.14);color:var(--good);}
.fs .tstat[data-s="work"]{background:rgba(245,184,65,.14);color:var(--warn);}
.fs .tclabel{font-size:15.5px;font-weight:600;}
.fs .tcval{font-size:30px;font-weight:800;letter-spacing:-.02em;margin:4px 0 2px;font-variant-numeric:tabular-nums;}
.fs .tcval span{font-size:13px;font-weight:500;letter-spacing:0;color:var(--mute);margin-left:8px;}
.fs .tcheck p{margin:6px 0 0;font-size:14px;line-height:1.55;color:var(--soft);}
.fs .tcheck .drill{color:var(--ink);}
.fs .tcheck .drill b{color:var(--lime);font-weight:600;}

/* ---- video ---- */
.fs .replay{position:relative;width:100%;background:#000;border-radius:12px;overflow:hidden;border:1px solid var(--rule2);}
.fs .replay video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;}
.fs .replay canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.fs .mtbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;}
.fs .mtvideo video{width:100%;max-height:62vh;display:block;background:#000;border-radius:12px;border:1px solid var(--rule2);}
.fs .tagpad{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;}
.fs .tagbtn{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:52px;padding:10px 14px;
  background:var(--raise);border:1px solid var(--rule2);border-radius:12px;color:var(--ink);font-size:14.5px;font-weight:600;
  cursor:pointer;text-align:left;transition:background .1s,transform .08s;-webkit-tap-highlight-color:transparent;}
.fs .tagbtn:hover{background:var(--rule2);}
.fs .tagbtn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.fs .tagbtn:active{transform:scale(.96);background:rgba(200,255,61,.16);border-color:rgba(200,255,61,.5);}
.fs .tagbtn b{font-size:16px;font-variant-numeric:tabular-nums;color:var(--lime);}
.fs .chip:disabled{opacity:.4;cursor:default;}
.fs .taglist{max-height:360px;overflow-y:auto;border-top:1px solid var(--rule);}
.fs .tagrow{display:flex;align-items:center;border-bottom:1px solid var(--rule);}
.fs .tagjump{flex:1;display:flex;gap:14px;align-items:center;background:none;border:0;color:var(--ink);font-size:14.5px;
  padding:11px 4px;cursor:pointer;text-align:left;}
.fs .tagjump:hover{color:var(--lime);}
.fs .tagtime{min-width:56px;color:var(--soft);font-variant-numeric:tabular-nums;}
.fs .tagdel{background:none;border:0;color:var(--mute);font-size:20px;padding:6px 10px;cursor:pointer;}
.fs .tagdel:hover{color:var(--bad);}

/* ---- player profile ---- */
.fs .cardgrid{display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:28px;align-items:start;}
.fs .cardimg{width:100%;max-width:360px;display:block;border-radius:18px;animation:pbin .5s ease-out both;}
.fs .attr{display:grid;grid-template-columns:1fr 120px 36px 40px;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--rule);}
.fs .attr span{font-size:14.5px;}
.fs .attr b{font-size:16px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;}
.fs .attr .abar{height:6px;background:var(--raise);border-radius:3px;overflow:hidden;}
.fs .attr .abar i{display:block;height:100%;border-radius:3px;}
.fs .attr em{font-size:13px;font-style:normal;font-weight:600;text-align:right;}
.fs .namefield{margin:18px 0;}
.fs .namefield input{max-width:340px;}
.fs .ioshint{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--card);
  border:1px solid var(--rule);border-radius:12px;padding:10px 14px;margin:14px 0 0;font-size:14px;color:var(--soft);}
.fs .ioshint b{color:var(--ink);}
.fs .ioshint button{background:none;border:0;color:var(--soft);font-size:20px;cursor:pointer;padding:0 4px;}

@media (max-width:640px){
  .fs{padding-bottom:calc(86px + env(safe-area-inset-bottom));}
  .fs .tabs{display:none;}
  .fs .bottombar{display:grid;grid-template-columns:repeat(6,1fr);position:fixed;left:0;right:0;bottom:0;z-index:40;
    background:rgba(13,15,19,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--rule);
    padding:6px 4px calc(6px + env(safe-area-inset-bottom));}
  .fs .bottombar button{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:0;cursor:pointer;
    color:var(--mute);font-size:11px;font-weight:600;padding:6px 0;min-width:0;}
  .fs .bottombar .bbicon{display:flex;}
  .fs .bottombar button[data-on="1"]{color:var(--lime);}
  .fs .masthead{flex-wrap:nowrap;margin-bottom:18px;}
  .fs .masthead svg.logo{width:132px !important;height:auto !important;}
  .fs .streakchip{font-size:13px;padding:6px 10px;}
  .fs .installbtn{font-size:13px;padding:6px 10px;}
  .fs .card{padding:18px;border-radius:14px;}
  .fs .rolegrid{grid-template-columns:1fr;gap:16px;}
  .fs .cardgrid,.fs .techgrid{grid-template-columns:1fr;}
  .fs .tagpad{grid-template-columns:1fr 1fr;}
  .fs .teamgrid{grid-template-columns:1fr;}
  .fs .tmhead{flex-direction:column;align-items:stretch;}
  .fs .tmtiles{grid-template-columns:1fr 1fr;}
  .fs .tmrow{flex-direction:column;align-items:flex-start;}
  .fs .bottombar button{font-size:10.5px;}
  .fs .mtvideo{position:sticky;top:0;z-index:5;background:var(--card);margin:0 -18px;padding:8px 18px;}
  .fs .mtvideo video{max-height:36vh;}
  .fs .tagbtn{min-height:56px;font-size:14px;}
  .fs .cardimg{margin:0 auto;}
  .fs .attr{grid-template-columns:1fr 80px 32px 36px;}
  .fs .rankrow{grid-template-columns:1fr auto 40px;grid-template-areas:"n v p" "s s s";row-gap:8px;}
  .fs .rname{grid-area:n;} .fs .rval{grid-area:v;} .fs .pnum{grid-area:p;}
  .fs .scale{grid-area:s;}
  .fs .stampnum{min-width:80px;font-size:36px;}
  .fs .dayhead{flex-wrap:wrap;}
  .fs .days{gap:3px;}
  .fs .dot{font-size:9.5px;border-radius:4px;}
  .fs .picktitle{font-size:24px;}
  .fs .streaknum{font-size:48px;}
}
@media (prefers-reduced-motion:reduce){
  .fs *, .fs *::before, .fs *::after{animation:none !important;transition:none !important;}
}
`;

/* ---------- 6. UI ------------------------------------------ */

export default function FormSheet({ onSignOut }) {
  const [view, setView] = useState("entry");
  const [picked, setPicked] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [sport, setSport] = useState("football");
  const [position, setPosition] = useState("MID");
  const [level, setLevel] = useState("club");
  const [minutes, setMinutes] = useState("90");
  const [raw, setRaw] = useState({});
  const [mode, setModeState] = useState(readMode);
  const [prefilled, setPrefilled] = useState(""); // "" | "last" | "video"
  const [report, setReport] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focusHint, setFocusHint] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadTry, setLoadTry] = useState(0);

  function applyPrefill(sp, pos, list) {
    const prev = [...list].reverse().find((x) => x.sport === sp && x.position === pos && x.raw);
    if (prev) {
      setRaw({ ...prev.raw });
      setMinutes(String(prev.minutes));
      setPrefilled("last");
    } else {
      setRaw({});
      setMinutes(defaultMinutes(sp));
      setPrefilled("");
    }
  }

  useEffect(() => {
    let alive = true;
    Promise.all([loadSessions(), loadPlans()]).then(([s, p]) => {
      if (!alive) return;
      if (s === null || p === null) {
        // Stop here: carrying on would save an empty plan over the real one.
        setLoadFailed(true);
        return;
      }
      setLoadFailed(false);
      setSessions(s);
      setPlans(p || {});
      const prof = (p && p.profile) || {};
      const last = s[s.length - 1];
      const start = SPORTS[prof.sport] ? prof.sport : last && SPORTS[last.sport] ? last.sport : "football";
      setSport(start);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [loadTry]);

  useEffect(() => {
    try { window.scrollTo(0, 0); } catch { /* not available in tests */ }
  }, [view]);

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

  function roleFor(k) {
    const prof = plans.profile || {};
    const mem = (prof.roles && prof.roles[k]) || {};
    const last = [...sessions].reverse().find((x) => x.sport === k);
    const pos = SPORTS[k].positions[mem.position] ? mem.position
      : last && SPORTS[k].positions[last.position] ? last.position
      : Object.keys(SPORTS[k].positions)[0];
    const lvl = LEVELS.some((l) => l.key === mem.level) ? mem.level
      : last && LEVELS.some((l) => l.key === last.level) ? last.level : "club";
    return { pos, lvl };
  }

  function switchSport(k) {
    const { pos, lvl } = roleFor(k);
    setSport(k);
    setPosition(pos);
    setLevel(lvl);
    setReport((r) => (r && !r.saved ? r : null)); // never throw away a match you haven't saved
    setEntryError("");
    applyPrefill(k, pos, sessions);
  }

  function rememberRole(k, pos, lvl) {
    const prof = plans.profile || {};
    const roles = { ...(prof.roles || {}), [k]: { position: pos, level: lvl } };
    updatePlans({ ...plans, profile: { ...prof, sport: k, roles } });
  }

  function pickSport(k) {
    switchSport(k);
    const { pos, lvl } = roleFor(k);
    rememberRole(k, pos, lvl);
    setPicked(true);
    setView("entry");
    if (typeof window !== "undefined" && window.scrollTo) { try { window.scrollTo(0, 0); } catch { /* jsdom */ } }
  }

  function changeLevel(l) {
    setLevel(l);
    rememberRole(sport, position, l);
  }

  function switchPosition(p) {
    setPosition(p);
    setEntryError("");
    applyPrefill(sport, p, sessions);
    rememberRole(sport, p, level);
  }

  function analyse() {
    const entered = shownMetrics.filter((m) => raw[m.key] !== undefined && raw[m.key] !== "" && !isNaN(parseFloat(raw[m.key])));
    if (!entered.length) {
      setEntryError("Enter at least one stat from your match first.");
      return;
    }
    if (!entered.some((m) => parseFloat(raw[m.key]) > 0)) {
      setEntryError("All your stats are 0. Enter what you actually did in the match.");
      return;
    }
    const bad = entered.find((m) => {
      const v = parseFloat(raw[m.key]);
      return m.unit === "%" ? v > 100 || v < (m.key === "hitEff" ? -100 : 0) : v < 0;
    });
    if (bad) {
      setEntryError(bad.unit === "%"
        ? `${bad.label} has to be between ${bad.key === "hitEff" ? "-100" : "0"} and 100%.`
        : `${bad.label} can't be negative.`);
      return;
    }
    if (entered.length < 2 && shownMetrics.length >= 2) {
      setEntryError("Enter at least 2 stats so your rating means something.");
      return;
    }
    const mins = parseFloat(minutes);
    const lim = UNIT_LIMITS[sport];
    if (!(mins > 0)) {
      setEntryError(`Enter ${cfg.unitLabel.toLowerCase()} first.`);
      return;
    }
    if (mins < lim.min) {
      setEntryError(lim.short);
      return;
    }
    if (mins > lim.max) {
      setEntryError(lim.long);
      return;
    }
    setEntryError("");
    const rows = entered.map((m) => {
      const value = parseFloat(raw[m.key]);
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
    setPrefilled("last");
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

  function applyVideoStats(videoRaw, units) {
    setRaw({ ...videoRaw });
    setMinutes(units);
    setModeState("full");
    setPrefilled("video");
    setEntryError("");
    setReport(null);
    setView("entry");
  }

  function planFromReport(keys) {
    setSport(report.sport);
    setPosition(report.position);
    setFocusHint(keys);
    setView("training");
  }

  if (loadFailed) {
    return (
      <div className="fs">
        <style>{CSS}</style>
        <div className="wrap picker">
          <div className="pickhead"><Logo width={210} panel={false} dark /></div>
          <h1 className="picktitle">Couldn't load your data</h1>
          <p className="hint" style={{ textAlign: "center" }}>Check your internet connection and try again. Nothing has been lost.</p>
          <p style={{ textAlign: "center", marginTop: 20 }}>
            <button className="go" onClick={() => { setLoadFailed(false); setLoadTry((n) => n + 1); }}>Try again</button>
          </p>
          {onSignOut && <p className="pickfoot"><button className="linkbtn" onClick={onSignOut}>Log out</button></p>}
        </div>
      </div>
    );
  }

  if (loading || !picked) {
    return (
      <div className="fs" style={{ "--sport": SPORT_COLOR[sport] }}>
        <style>{CSS}</style>
        <div className="wrap picker">
          <div className="pickhead">
            <Logo width={210} panel={false} dark />
          </div>
          {loading ? (
            <p className="empty" style={{ textAlign: "center" }}>Loading…</p>
          ) : (
            <>
              <h1 className="picktitle">{sessions.length ? "What are you playing today?" : "Pick your sport"}</h1>
              {!sessions.length && (
                <p className="hint" style={{ textAlign: "center" }}>
                  Log a match, see where you rank, and get a plan to fix your gaps.
                </p>
              )}
              <div className="sporttiles" role="list">
                {Object.entries(SPORTS).map(([k, s]) => (
                  <button
                    key={k}
                    className="sporttile"
                    data-last={k === sport && sessions.length ? 1 : 0}
                    style={{ "--tile": SPORT_COLOR[k] }}
                    onClick={() => pickSport(k)}
                  >
                    <span className="sticon"><Icon name={k} size={26} /></span>
                    <span className="stname">{s.label}</span>
                    {k === sport && sessions.length > 0 && <span className="stlast">Last played</span>}
                    <span className="stchev"><Icon name="chevron" size={18} /></span>
                  </button>
                ))}
              </div>
              {onSignOut && (
                <p className="pickfoot"><button className="linkbtn" onClick={onSignOut}>Log out</button></p>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const TABS = [
    ["entry", "Log", "Log a match", "log"],
    ["progress", "Progress", "Progress", "progress"],
    ["card", "Profile", "Profile", "card"],
    ["technique", "Video", "Video", "video"],
    ["training", "Training", "Training", "training"],
    ["team", "Team", "Team", "team"],
  ];

  return (
    <div className="fs" style={{ "--sport": SPORT_COLOR[sport] }}>
      <style>{CSS}</style>
      <div className="wrap">
        <header className="masthead">
          <Logo width={170} panel={false} dark />
          <div className="mastright">
            {!loading && (
              <button className="streakchip" data-zero={streak.current ? 0 : 1} onClick={() => setView("training")}>
                <span className="flame"><Icon name="flame" size={16} /></span>
                {streak.current ? `${streak.current}-day streak` : "Start your streak"}
              </button>
            )}
            <InstallButton />
            <div className="tagline">Know your game · fix what's costing you</div>
          </div>
        </header>
        <IosHint />

        <nav className="tabs" aria-label="Sections">
          {TABS.map(([k, , long]) => (
            <button key={k} className="tab" data-on={view === k ? 1 : 0} aria-current={view === k ? "page" : undefined} onClick={() => setView(k)}>
              <span>{long}</span>
            </button>
          ))}
          {report && (
            <button className="tab" data-on={view === "report" ? 1 : 0} onClick={() => setView("report")}>
              <span>Report</span>
            </button>
          )}
        </nav>

        <nav className="bottombar" aria-label="Sections">
          {TABS.map(([k, short, , icon]) => (
            <button key={k} data-on={view === k || (k === "entry" && view === "report") ? 1 : 0} aria-current={view === k ? "page" : undefined} onClick={() => setView(k)}>
              <span className="bbicon"><Icon name={icon} size={22} /></span>
              <span>{short}</span>
            </button>
          ))}
        </nav>

        {error && <p className="err" role="alert">{error}</p>}

        {view === "entry" && (
          <Entry
            cfg={cfg}
            sport={sport}
            changeSport={() => setPicked(false)}
            position={position}
            setPosition={switchPosition}
            level={level}
            setLevel={changeLevel}
            entryError={entryError}
            lastReport={report && !report.saved ? () => setView("report") : null}
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

        {view === "progress" && <Progress sessions={sessions} sport={sport} loading={loading} goLog={() => setView("entry")} />}

        {view === "technique" && (
          <Technique sport={sport} sports={SPORTS} sportColor={SPORT_COLOR[sport]} position={position}
            onSport={switchSport} onUseStats={applyVideoStats} />
        )}

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

        {view === "team" && <Team sport={sport} sports={SPORTS} plans={plans} />}

        {view === "account" && <Account onDeleted={onSignOut} />}

        <p className="note">
          Ratings compare your numbers with typical figures for your position and level. Use them as a guide for
          training, not for team selection.
        </p>
        <p className="pickfoot" style={{ textAlign: "left" }}>
          <button className="linkbtn" onClick={() => setView("account")}>Account &amp; privacy</button>
          {onSignOut && <button className="linkbtn" onClick={onSignOut}>Log out</button>}
        </p>
      </div>
    </div>
  );
}

function Stepper({ metric, value, onChange }) {
  const step = stepFor(metric);
  const max = metric.unit === "%" ? 100 : Infinity;
  const min = metric.key === "hitEff" ? -100 : 0;
  const num = parseFloat(value);
  const cur = isNaN(num) ? 0 : num;
  function bump(d) {
    const n = Math.min(max, Math.max(min, Math.round((cur + d) * 100) / 100));
    onChange(String(n));
  }
  return (
    <div className="stepper">
      <button type="button" aria-label={`Decrease ${metric.label}`} onClick={() => bump(-step)}>−</button>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step="any"
        placeholder="–"
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
    cfg, sport, changeSport, position, setPosition, level, setLevel, minutes, setMinutes,
    metrics, totalCount, quickCount, mode, setMode, prefilled, raw, setRaw, analyse, entryError, lastReport,
  } = props;
  const canToggle = totalCount > quickCount;
  return (
    <>
      <div className="sportbar">
        <span className="sbname"><span className="sbicon"><Icon name={sport} size={22} /></span>{cfg.label}</span>
        <button className="sbchange" onClick={changeSport}>Change sport</button>
      </div>
      {lastReport && (
        <button className="go ghost" style={{ width: "100%", marginBottom: 16 }} onClick={lastReport}>
          Back to your unsaved report
        </button>
      )}

      <section className="card">
        <div className="rolegrid">
          <div>
            <p className="eyebrow">Your position</p>
            <div className="chipset">
              {Object.entries(cfg.positions).map(([k, label]) => (
                <button key={k} className="chip sm" data-on={position === k ? 1 : 0} aria-pressed={position === k} onClick={() => setPosition(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">Compare me against</p>
            <div className="chipset">
              {LEVELS.map((l) => (
                <button key={l.key} className="chip sm" data-on={level === l.key ? 1 : 0} aria-pressed={level === l.key} onClick={() => setLevel(l.key)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rowhead" style={{ marginTop: 22 }}>
          <h2 className="h2">Enter your totals</h2>
          {canToggle && (
            <div className="chipset">
              <button className="chip sm" data-on={mode === "quick" ? 1 : 0} aria-pressed={mode === "quick"} onClick={() => setMode("quick")}>
                Quick
              </button>
              <button className="chip sm" data-on={mode === "full" ? 1 : 0} aria-pressed={mode === "full"} onClick={() => setMode("full")}>
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
          {prefilled === "video"
            ? <> <b>Filled in from your match video.</b> Check the numbers, add anything you couldn't tag, then analyse.</>
            : prefilled
              ? <> Filled in from your last match, so change only what's different.</>
              : <> Leave a box empty if you didn't track it.</>}
        </p>
        <div className="grid">
          <div className="field">
            <label htmlFor="log-units">{cfg.unitLabel}</label>
            <input id="log-units" type="number" inputMode="decimal" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
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
        {entryError && <p className="err" role="alert" style={{ marginTop: 18, marginBottom: 0 }}>{entryError}</p>}
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
        {r.unit === "%" ? "%" : r.unit ? ` ${r.unit}` : ""}
        {r.unit !== "%" && <span className="per"> {windowLabel}</span>}
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

function PersonalBest({ bests }) {
  const top = bests[0];
  return (
    <div className="pb" role="status">
      <div className="pbicon"><Icon name="trophy" size={24} /></div>
      <div>
        <div className="big">New personal best · <em>{top.label} {ordinal(top.pct)} percentile</em></div>
        <div className="small">
          Up from {ordinal(top.prev)}
          {bests.length > 1 && ` · plus ${bests.length - 1} more personal best${bests.length > 2 ? "s" : ""} this match`}
        </div>
      </div>
    </div>
  );
}

function RatingNum({ value }) {
  const n = useCountUp(Math.round(value * 10));
  return <>{(n / 10).toFixed(1)}</>;
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
  const gaps = sorted.filter((r) => r.pct < 38).slice(0, 3);
  const strengths = [...sorted].reverse().filter((r) => r.pct >= 62).slice(0, 3);
  const planKeys = (gaps.length ? gaps : sorted.slice(0, 2)).map((r) => r.key);

  return (
    <>
      {bests.length > 0 && <PersonalBest key={rec.id} bests={bests} />}

      <div className="stamp">
        <div className="stampnum" data-r={ratingBand(matchRating(rec.overall))}><RatingNum value={matchRating(rec.overall)} /></div>
        <div>
          <div className="stamptxt">Match rating</div>
          <div className="stamptxt">
            vs {LEVELS.find((l) => l.key === rec.level).label.toLowerCase()} {plural(cfg.positions[rec.position])} · {ordinal(rec.overall)} percentile overall
          </div>
          <div className="stamptxt">
            {fmtDate(rec.date)} · {rec.minutes} {cfg.unitShort}
          </div>
        </div>
      </div>
      {!rec.saved && (
        <button className="go" style={{ width: "100%", marginBottom: 16 }} onClick={onSave}>Save this match</button>
      )}

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
              <strong>{r.label} — {ordinal(r.pct)} percentile</strong>
              <span>Better than roughly {r.pct}% of players in your role at this level. Build your game around it.</span>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <p className="eyebrow">Work on this next</p>
        <h2 className="h2">{gaps.length ? "Your fixes" : "No priority gaps"}</h2>
        {gaps.length === 0 && (
          <p className="empty">Nothing fell below your level this match. Raise the comparison level and run it again to find the next ceiling.</p>
        )}
        {gaps.map((r) => {
          const a = ADVICE[r.key];
          if (!a) return null;
          return (
            <div className="fix" key={r.key}>
              <h4>{r.label} — {ordinal(r.pct)} percentile</h4>
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
                {done ? <><Icon name="check" size={16} />Done</> : "Mark done"}
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
        <p className="eyebrow">Player profile</p>
        <h2 className="h2">Build your {cfg.label.toLowerCase()} profile</h2>
        <p className="hint">Save one {cfg.label.toLowerCase()} match and your profile appears here: a rating out of 10 and a breakdown of your strengths, from your real stats.</p>
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
    const n = name.trim().slice(0, 18);
    if (n === saved) return;
    onSave({ ...plans, profile: { ...(plans.profile || {}), name: n } });
  }

  async function share() {
    setStatus("");
    try {
      const r = await saveCardImage(svg, `athletix-${sport}-profile.png`);
      setStatus(r === "downloaded" ? "Saved to your downloads." : r === "shared" ? "Shared." : "");
    } catch {
      setStatus("Couldn't create the image. Try again.");
    }
  }

  const games = Math.min(card.matches, RECENT);
  return (
    <section className="card">
      <p className="eyebrow">Player profile · {cfg.label} · last {games} {games === 1 ? "match" : "matches"}</p>
      <div className="cardgrid">
        <div>
          <img className="cardimg" src={svgDataUrl(svg)} alt={`Player profile: rating ${card.rating.toFixed(1)}, ${cfg.positions[card.position]}`} />
        </div>
        <div>
          <h2 className="h2">Rating {card.rating.toFixed(1)}</h2>
          <p className="hint">
            {card.delta === null
              ? <>Average of your recent matches. It updates every time you save one.</>
              : card.delta > 0
                ? <><b>Up {card.delta.toFixed(1)}</b> since your last match.</>
                : card.delta < 0
                  ? <><b>Down {Math.abs(card.delta).toFixed(1)}</b> since your last match.</>
                  : <><b>No change</b> since your last match.</>}
            {" "}7.0 is an average game at your level.
          </p>
          {card.attrs.map((a) => (
            <div className="attr" key={a.code}>
              <span>{a.label}</span>
              <div className="abar"><i style={{ width: `${a.rating}%`, background: BAND_COLOR[pctBand(a.rating)] }} /></div>
              <b>{a.rating}</b>
              <em className={a.delta > 0 ? "up" : a.delta < 0 ? "down" : ""}>
                {a.delta === undefined || a.delta === 0 ? "" : `${a.delta > 0 ? "+" : ""}${a.delta}`}
              </em>
            </div>
          ))}
          <p className="hint" style={{ marginTop: 10 }}>Each number is your percentile against players in your role and level.</p>
          <div className="field namefield">
            <label htmlFor="card-name">Name on profile</label>
            <input
              id="card-name"
              maxLength={18}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            />
          </div>
          <button className="go" onClick={share} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="share" size={18} />Save or share profile
          </button>
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
          <div key={d} className="dot" data-k={activity[d] || ""} data-today={d === today ? 1 : 0} title={d}
            role="img" aria-label={`${fmtDate(d)}: ${{ train: "trained", match: "match", rest: "rest day" }[activity[d]] || "nothing logged"}`}>
            {Number(d.slice(8))}
          </div>
        ))}
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--good)" }} />Trained</span>
        <span><i style={{ background: "var(--lime)" }} />Match</span>
        <span><i style={{ background: "#3a414c" }} />Rest day</span>
      </div>
      <p className="hint">
        {t === "match"
          ? <><b>Match logged today.</b> Your streak is safe.</>
          : <><b>Today:</b> log training or a rest day to keep your streak. Rest days count, because recovery is part of getting better.</>}
      </p>
      {t !== "match" && (
        <div className="chipset">
          <button className="chip" data-on={t === "train" ? 1 : 0} aria-pressed={t === "train"} onClick={() => onMark("train")}>I trained today</button>
          <button className="chip" data-on={t === "rest" ? 1 : 0} aria-pressed={t === "rest"} onClick={() => onMark("rest")}>Rest day</button>
        </div>
      )}
    </section>
  );
}

function useWidth(ref, fallback = 640) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const set = () => { if (el.clientWidth) setW(el.clientWidth); };
    set();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function TrendChart({ list }) {
  const box = React.useRef(null);
  const W = Math.max(260, useWidth(box));
  const H = 230, L = 34, R = 14, T = 14, B = 34;
  const lo = 4, hi = 10;
  const pts = list.map((s) => ({ r: matchRating(s.overall), date: s.date }));
  const step = pts.length > 1 ? (W - L - R) / (pts.length - 1) : 0;
  const X = (i) => (pts.length > 1 ? L + i * step : (L + W - R) / 2);
  const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.r).toFixed(1)}`).join(" ");
  const maxLabels = Math.max(2, Math.floor((W - L - R) / 64));
  const every = Math.max(1, Math.ceil(pts.length / maxLabels));
  const F = "Inter, system-ui, sans-serif";
  return (
    <div className="chartwrap" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={`Match rating over your last ${pts.length} matches, latest ${pts.length ? pts[pts.length - 1].r.toFixed(1) : ""}`}>
        {[5, 6, 7, 8, 9].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={Y(g)} y2={Y(g)} stroke={g === 7 ? "#4a525e" : "#252a32"} strokeWidth="1" strokeDasharray={g === 7 ? "0" : "3 4"} />
            <text x={L - 8} y={Y(g) + 4} fontSize="12" fill="#8a929d" textAnchor="end" fontFamily={F}>{g}</text>
          </g>
        ))}
        {pts.length > 1 && <path d={line} fill="none" stroke="#c8ff3d" strokeWidth="2.5" strokeLinejoin="round" />}
        {pts.map((p, i) => (
          <circle key={i} cx={X(i)} cy={Y(p.r)} r="5" fill={BAND_COLOR[ratingBand(p.r)]} stroke="#0b0d10" strokeWidth="2" />
        ))}
        {pts.map((p, i) => ((i % every === 0 || i === pts.length - 1) && (i === pts.length - 1 || pts.length - 1 - i >= every / 2) ? (
          <text key={`d${i}`} x={X(i)} y={H - 10} fontSize="12" fill="#8a929d" textAnchor={pts.length > 1 && i === 0 ? "start" : pts.length > 1 && i === pts.length - 1 ? "end" : "middle"} fontFamily={F}>
            {fmtDate(p.date)}
          </text>
        ) : null))}
      </svg>
    </div>
  );
}

function Progress({ sessions, sport, loading, goLog }) {
  if (loading) return <section className="card"><p className="empty">Loading your record…</p></section>;
  const cfg = SPORTS[sport];
  const list = sessions.filter((s) => s.sport === sport && typeof s.overall === "number");
  const others = Object.keys(SPORTS).filter((k) => k !== sport && sessions.some((s) => s.sport === k));

  if (!list.length)
    return (
      <section className="card">
        <p className="eyebrow">Nothing logged yet</p>
        <p className="empty">
          {others.length
            ? `No ${cfg.label.toLowerCase()} matches yet. Log one, or change sport on the Log page to see your ${others.map((k) => SPORTS[k].label.toLowerCase()).join(" and ")} record.`
            : "Log a match, then save the report. Once you have two or more matches, a trend line shows whether your training is working."}
        </p>
        <button className="go" style={{ marginTop: 16 }} onClick={goLog}>Log a match</button>
      </section>
    );

  const last = list[list.length - 1];
  const prev = list.length > 1 ? list[list.length - 2] : null;
  let movers = [];
  if (prev && prev.position === last.position) {
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
        <p className="eyebrow">{cfg.label} · match rating · {list.length} {list.length === 1 ? "match" : "matches"}</p>
        <h2 className="h2">Trend</h2>
        {others.length > 0 && (
          <p className="sportnote">Showing {cfg.label.toLowerCase()} only. Change sport on the Log page to see your {others.map((k) => SPORTS[k].label.toLowerCase()).join(" and ")} record.</p>
        )}
        <TrendChart list={list} />
        <p className="hint" style={{ marginTop: 8 }}>Ratings run from 4 to 10. The solid line at 7 is a typical game at your level.</p>
      </section>

      {movers.length > 0 && (
        <section className="card">
          <p className="eyebrow">Change since your previous match · percentile</p>
          <h2 className="h2">Biggest movers</h2>
          <table>
            <thead>
              <tr><th>Stat</th><th>Now</th><th>Change</th></tr>
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
            <tr><th>Date</th><th>Position</th><th>Played</th><th style={{ textAlign: "right" }}>Rating</th></tr>
          </thead>
          <tbody>
            {[...list].reverse().map((s) => {
              const r = matchRating(s.overall);
              return (
                <tr key={s.id}>
                  <td>{fmtDate(s.date)}</td>
                  <td>{cfg.positions[s.position] || ""}</td>
                  <td>{s.minutes} {cfg.unitShort}</td>
                  <td style={{ textAlign: "right" }}><span className="rpill sm" data-r={ratingBand(r)}>{r.toFixed(1)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
