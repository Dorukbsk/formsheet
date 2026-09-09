import { supabase } from './supabaseClient'
import React, { useState, useEffect, useMemo } from "react";

/* ============================================================
   FORM SHEET — sport performance analyzer (starter prototype)
   Single-file React app. Replace the BENCHMARKS with real data
   from your own league/dataset when you have it.
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

/* ---------- 4. STORAGE ------------------------------------- */

const KEY = "formsheet:sessions:v1";
let memoryFallback = [];

async function loadSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('payload')
    .order('created_at', { ascending: true })
  if (error) { console.error(error); return [] }
  return data.map((row) => row.payload)
}

async function saveSessions(list) {
  const newest = list[list.length - 1]
  const { error } = await supabase.from('sessions').insert({ payload: newest })
  if (error) console.error(error)
}
/* ---------- 5. STYLES -------------------------------------- */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

.fs {
  --paper:#E3E5DF; --card:#F6F7F3; --ink:#141C26; --soft:#5D6873;
  --rule:#C4C7BE; --accent:#1F4FD8; --good:#0E6B4F; --bad:#AF2E22; --warn:#9A6410;
  --cond:'Barlow Condensed','Arial Narrow',Impact,sans-serif;
  --sans:'IBM Plex Sans',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
  background:var(--paper); color:var(--ink); font-family:var(--sans);
  min-height:100vh; padding:24px 16px 64px; -webkit-font-smoothing:antialiased;
}
.fs *{box-sizing:border-box;}
.fs .wrap{max-width:940px;margin:0 auto;}

.fs .masthead{display:flex;align-items:flex-end;justify-content:space-between;
  gap:16px;border-bottom:2px solid var(--ink);padding-bottom:10px;flex-wrap:wrap;}
.fs .logo{font-family:var(--cond);font-weight:700;font-size:44px;line-height:.86;
  letter-spacing:.01em;text-transform:uppercase;margin:0;}
.fs .logo span{color:var(--accent); display:inline-block; transform:skewX(-10deg);}
.fs .tagline{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--soft);padding-bottom:4px;}

.fs .tabs{display:flex;gap:0;margin:18px 0 26px;border:1px solid var(--ink);width:fit-content;}
.fs .tab{font-family:var(--cond);font-size:18px;font-weight:600;text-transform:uppercase;
  letter-spacing:.05em;padding:7px 20px;background:transparent;border:0;cursor:pointer;
  color:var(--ink);border-right:1px solid var(--ink);}
.fs .tab:last-child{border-right:0;}
.fs .tab[data-on="1"]{background:var(--ink);color:var(--card);}
.fs .tab:disabled{opacity:.35;cursor:not-allowed;}
.fs .tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

.fs .eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--soft);margin:0 0 10px;}
.fs .card{background:var(--card);border:1px solid var(--rule);padding:20px;margin-bottom:18px;}
.fs .h2{font-family:var(--cond);font-size:26px;font-weight:700;text-transform:uppercase;
  letter-spacing:.02em;margin:0 0 14px;}

.fs .chipset{display:flex;flex-wrap:wrap;gap:8px;}
.fs .chip{font-family:var(--cond);font-size:17px;font-weight:600;text-transform:uppercase;
  letter-spacing:.04em;padding:6px 14px;background:transparent;color:var(--ink);
  border:1px solid var(--rule);cursor:pointer;}
.fs .chip[data-on="1"]{background:var(--ink);color:var(--card);border-color:var(--ink);}
.fs .chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

.fs .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;}
.fs .field label{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--soft);margin-bottom:5px;}
.fs .field input{width:100%;font-family:var(--mono);font-size:16px;padding:8px 10px;
  background:#fff;border:1px solid var(--rule);color:var(--ink);}
.fs .field input:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:var(--accent);}

.fs .go{font-family:var(--cond);font-size:21px;font-weight:700;text-transform:uppercase;
  letter-spacing:.06em;padding:11px 30px;background:var(--accent);color:#fff;border:0;cursor:pointer;}
.fs .go:hover{background:var(--ink);}
.fs .ghost{background:transparent;color:var(--ink);border:1px solid var(--ink);}
.fs .ghost:hover{background:var(--ink);color:var(--card);}

/* signature: the rank row */
.fs .rankrow{display:grid;grid-template-columns:1.1fr 84px 1fr 62px;gap:14px;align-items:center;
  padding:13px 0;border-bottom:1px solid var(--rule);}
.fs .rankrow:last-child{border-bottom:0;}
.fs .rname{font-family:var(--sans);font-size:14.5px;font-weight:500;}
.fs .rsub{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft);}
.fs .rval{font-family:var(--mono);font-size:15px;font-weight:600;text-align:right;}
.fs .scale{position:relative;height:22px;border-bottom:1px solid var(--ink);}
.fs .tick{position:absolute;bottom:0;width:1px;height:6px;background:var(--rule);}
.fs .mark{position:absolute;bottom:0;width:3px;height:19px;background:var(--ink);
  transition:left .55s cubic-bezier(.2,.8,.25,1);}
.fs .mark[data-b="elite"],.fs .mark[data-b="good"]{background:var(--good);}
.fs .mark[data-b="low"]{background:var(--warn);}
.fs .mark[data-b="gap"]{background:var(--bad);}
.fs .pnum{font-family:var(--cond);font-size:40px;font-weight:700;line-height:.8;text-align:right;}
.fs .pnum[data-b="elite"],.fs .pnum[data-b="good"]{color:var(--good);}
.fs .pnum[data-b="low"]{color:var(--warn);}
.fs .pnum[data-b="gap"]{color:var(--bad);}

.fs .stamp{display:flex;align-items:baseline;gap:14px;border:2px solid var(--ink);
  padding:14px 20px;margin-bottom:18px;background:var(--card);}
.fs .stampnum{font-family:var(--cond);font-size:78px;font-weight:700;line-height:.78;}
.fs .stamptxt{font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);}

.fs .fix{border-left:3px solid var(--bad);padding:14px 0 14px 16px;margin-bottom:16px;}
.fs .fix h4{font-family:var(--cond);font-size:22px;font-weight:700;text-transform:uppercase;margin:0 0 6px;}
.fs .fix p{margin:0 0 10px;font-size:14px;line-height:1.55;color:var(--ink);}
.fs .fix ul{margin:0 0 12px;padding-left:18px;}
.fs .fix li{font-size:13.5px;line-height:1.6;margin-bottom:5px;}
.fs .watch{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent);}

.fs .keep{border-left:3px solid var(--good);padding:10px 0 10px 16px;margin-bottom:12px;}
.fs .keep strong{font-family:var(--cond);font-size:20px;font-weight:700;text-transform:uppercase;}
.fs .keep span{display:block;font-size:13.5px;color:var(--soft);margin-top:2px;}

.fs table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:12.5px;}
.fs th{text-align:left;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--soft);font-weight:500;padding:0 8px 8px 0;border-bottom:1px solid var(--ink);}
.fs td{padding:9px 8px 9px 0;border-bottom:1px solid var(--rule);}
.fs .up{color:var(--good);} .fs .down{color:var(--bad);}

.fs .empty{font-family:var(--mono);font-size:12.5px;color:var(--soft);line-height:1.7;}
.fs .note{font-family:var(--mono);font-size:10.5px;color:var(--soft);line-height:1.65;
  border-top:1px solid var(--rule);padding-top:12px;margin-top:22px;}

@media (max-width:640px){
  .fs .rankrow{grid-template-columns:1fr 62px 44px;grid-template-areas:"n v p" "s s s";row-gap:8px;}
  .fs .rname{grid-area:n;} .fs .rval{grid-area:v;} .fs .pnum{grid-area:p;font-size:32px;}
  .fs .scale{grid-area:s;}
  .fs .logo{font-size:34px;} .fs .stampnum{font-size:60px;}
}
@media (prefers-reduced-motion:reduce){ .fs .mark{transition:none;} }
`;

/* ---------- 6. UI ------------------------------------------ */

export default function FormSheet() {
  const [view, setView] = useState("entry");
  const [sport, setSport] = useState("football");
  const [position, setPosition] = useState("MID");
  const [level, setLevel] = useState("club");
  const [minutes, setMinutes] = useState("90");
  const [raw, setRaw] = useState({});
  const [report, setReport] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions().then((s) => {
      setSessions(s);
      setLoading(false);
    });
  }, []);

  const cfg = SPORTS[sport];
  const activeMetrics = useMemo(
    () => cfg.metrics.filter((m) => m.bm[position]),
    [sport, position]
  );

  function switchSport(k) {
    setSport(k);
    setPosition(Object.keys(SPORTS[k].positions)[0]);
    setRaw({});
    setReport(null);
    setMinutes(k === "volleyball" ? "4" : k === "basketball" ? "30" : "90");
  }

  function analyse() {
    const mins = parseFloat(minutes) || cfg.window;
    const rows = activeMetrics.map((m) => {
      const v = parseFloat(raw[m.key]);
      const value = isNaN(v) ? 0 : v;
      const per = m.rate ? (value / mins) * cfg.window : value;
      const p = percentileFor(m, per, position, level);
      return { key: m.key, label: m.label, unit: m.unit || "", per: Math.round(per * 100) / 100, pct: p, band: band(p) };
    });
    const overall = Math.round(rows.reduce((a, r) => a + r.pct, 0) / rows.length);
    const rec = {
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      sport,
      position,
      level,
      minutes: mins,
      overall,
      rows,
    };
    setReport(rec);
    setView("report");
  }

  async function saveReport() {
    if (!report) return;
    const next = [...sessions, report];
    setSessions(next);
    await saveSessions(next);
    setView("progress");
  }

  return (
    <div className="fs">
      <style>{CSS}</style>
      <div className="wrap">
        <header className="masthead">
          <h1 className="logo">
            Athleti<span>X</span>
          </h1>
          <div className="tagline">Know your game · fix what's costing you</div>
        </header>

        <nav className="tabs">
          <button className="tab" data-on={view === "entry" ? 1 : 0} onClick={() => setView("entry")}>
            Log a match
          </button>
          <button className="tab" data-on={view === "report" ? 1 : 0} disabled={!report} onClick={() => setView("report")}>
            Report
          </button>
          <button className="tab" data-on={view === "progress" ? 1 : 0} onClick={() => setView("progress")}>
            Progress
          </button>
        </nav>

        {view === "entry" && (
          <Entry
            cfg={cfg}
            sport={sport}
            switchSport={switchSport}
            position={position}
            setPosition={setPosition}
            level={level}
            setLevel={setLevel}
            minutes={minutes}
            setMinutes={setMinutes}
            metrics={activeMetrics}
            raw={raw}
            setRaw={setRaw}
            analyse={analyse}
          />
        )}

        {view === "report" && report && <Report rec={report} cfg={SPORTS[report.sport]} onSave={saveReport} />}

        {view === "progress" && <Progress sessions={sessions} loading={loading} />}

        <p className="note">
          Percentiles compare you against a modelled distribution for your position and level. The
          numbers shipped here are placeholders — swap in real league data before you trust them for
          selection decisions.
        </p>
      </div>
    </div>
  );
}

function Entry(props) {
  const { cfg, sport, switchSport, position, setPosition, level, setLevel, minutes, setMinutes, metrics, raw, setRaw, analyse } = props;
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
        <h2 className="h2">Enter your totals</h2>
        <div className="grid">
          <div className="field">
            <label>{cfg.unitLabel}</label>
            <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
          {metrics.map((m) => (
            <div className="field" key={m.key}>
              <label>
                {m.label} {m.unit ? `(${m.unit})` : `(total)`}
              </label>
              <input
                type="number"
                step="any"
                placeholder="0"
                value={raw[m.key] ?? ""}
                onChange={(e) => setRaw({ ...raw, [m.key]: e.target.value })}
              />
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

function RankRow({ r, windowLabel }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(r.pct), 40);
    return () => clearTimeout(t);
  }, [r.pct]);
  return (
    <div className="rankrow">
      <div>
        <div className="rname">{r.label}</div>
        <div className="rsub">{r.band.label}</div>
      </div>
      <div className="rval">
        {r.per}
        {r.unit || ""}
        {!r.unit && <span style={{ opacity: 0.45 }}> {windowLabel}</span>}
      </div>
      <div className="scale">
        {[25, 50, 75].map((t) => (
          <span key={t} className="tick" style={{ left: `${t}%` }} />
        ))}
        <span className="mark" data-b={r.band.key} style={{ left: `${w}%` }} />
      </div>
      <div className="pnum" data-b={r.band.key}>
        {r.pct}
      </div>
    </div>
  );
}

function Report({ rec, cfg, onSave }) {
  const sorted = [...rec.rows].sort((a, b) => a.pct - b.pct);
  const gaps = sorted.filter((r) => r.pct < 40).slice(0, 3);
  const strengths = [...sorted].reverse().filter((r) => r.pct >= 62).slice(0, 3);

  return (
    <>
      <div className="stamp">
        <div className="stampnum">{rec.overall}</div>
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
          <RankRow key={r.key} r={r} windowLabel={cfg.windowLabel} />
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
        <h2 className="h2">{gaps.length ? "Three fixes" : "No priority gaps"}</h2>
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

      <button className="go" onClick={onSave}>
        Save to my record
      </button>
    </>
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
              <line x1={PAD} x2={W - PAD} y1={Y(g)} y2={Y(g)} stroke="#C4C7BE" strokeWidth="1" strokeDasharray="3 4" />
              <text x={4} y={Y(g) + 4} fontSize="11" fill="#5D6873" fontFamily="IBM Plex Mono, monospace">{g}</text>
            </g>
          ))}
          <path d={line} fill="none" stroke="#1F4FD8" strokeWidth="2.5" />
          {pts.map((p, i) => (
            <circle key={i} cx={X(i)} cy={Y(p.y)} r="4.5" fill="#141C26" />
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
