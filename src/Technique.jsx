import React, { useEffect, useRef, useState } from "react";
import { actionsFor, findAction, analyse, BONES, JOINTS } from "./technique.js";
import { ratingBand } from "./card.js";
import MatchTagger from "./MatchTagger.jsx";

const MP_VERSION = "1.2.0";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const FPS = 15;
const MAX_SECONDS = 12;

let landmarkerPromise = null;
let lastTs = 0;

function getLandmarker() {
  if (!landmarkerPromise) {
    const urls = (typeof window !== "undefined" && window.__athletixPose) || {};
    landmarkerPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(urls.wasm || WASM_URL);
      const make = (delegate) =>
        vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: urls.model || MODEL_URL, delegate },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      try {
        return await make("GPU");
      } catch {
        return await make("CPU");
      }
    })().catch((e) => {
      landmarkerPromise = null;
      throw e;
    });
  }
  return landmarkerPromise;
}

function waitFor(el, event, ms = 4000) {
  return new Promise((resolve, reject) => {
    const done = () => { clearTimeout(timer); el.removeEventListener(event, done); resolve(); };
    const timer = setTimeout(() => { el.removeEventListener(event, done); reject(new Error("timeout")); }, ms);
    el.addEventListener(event, done, { once: true });
  });
}

async function seek(video, t) {
  if (Math.abs(video.currentTime - t) < 0.001) return;
  const p = waitFor(video, "seeked", 3000);
  video.currentTime = t;
  await p;
}

// Reads the clip at 15 frames a second and tracks the body in each frame.
// Returns the object URL so the replay can play the same clip; the caller revokes it.
// Some recordings (screen recorders, web recorders) report an endless length
// until the browser is asked to seek to the end.
async function realDuration(video) {
  if (isFinite(video.duration) && video.duration > 0) return video.duration;
  const changed = waitFor(video, "durationchange", 3000).catch(() => {});
  const seeked = waitFor(video, "seeked", 3000).catch(() => {});
  video.currentTime = 1e7;
  await Promise.all([changed, seeked]); // let the jump finish so it can't be mistaken for frame 0
  const d = video.duration;
  if (isFinite(d) && d > 0) await seek(video, 0).catch(() => {});
  return d;
}

async function readFrames(file, onProgress, wanted = () => true) {
  const landmarker = await getLandmarker();
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "");
  Object.assign(video.style, { position: "fixed", left: "-9999px", top: "0", width: "2px", height: "2px", opacity: "0" });
  document.body.appendChild(video); // some phones only decode videos that are on the page
  video.src = url;
  try {
    await waitFor(video, "loadeddata", 15000);
    try { await video.play(); video.pause(); } catch { /* some browsers block this; seeking still works */ }
    const full = await realDuration(video);
    if (!isFinite(full) || full <= 0) throw new Error("length");
    const dur = Math.min(full, MAX_SECONDS);
    const W = video.videoWidth, H = video.videoHeight;
    const frames = [];
    const total = Math.max(1, Math.floor(dur * FPS));
    for (let i = 0; i < total; i++) {
      if (!wanted()) throw new Error("cancelled");
      const t = i / FPS;
      await seek(video, t);
      lastTs += 1000 / FPS;
      const res = landmarker.detectForVideo(video, lastTs);
      const pts = res.landmarks && res.landmarks[0];
      frames.push({
        t,
        lm: pts ? pts.map((p) => ({ x: p.x * W, y: p.y * H, v: p.visibility ?? 1 })) : null,
      });
      onProgress((i + 1) / total);
    }
    return { frames, url, W, H, long: full > MAX_SECONDS + 0.5 };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  } finally {
    video.removeAttribute("src");
    video.load();
    video.remove();
  }
}

function drawSkeleton(g, lm, scale, color, w) {
  const pt = (i) => ({ x: lm[i].x * scale, y: lm[i].y * scale });
  g.lineCap = "round";
  g.strokeStyle = "rgba(11,13,16,.8)";
  g.lineWidth = Math.max(5, w / 110);
  BONES.forEach(([a, b]) => { const p = pt(a), q = pt(b); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); });
  g.strokeStyle = color;
  g.lineWidth = Math.max(2.5, w / 220);
  BONES.forEach(([a, b]) => { const p = pt(a), q = pt(b); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); });
  g.fillStyle = "#c8ff3d";
  JOINTS.forEach((i) => {
    const p = pt(i);
    g.beginPath(); g.arc(p.x, p.y, Math.max(3, w / 170), 0, Math.PI * 2); g.fill();
  });
}

// Plays the clip with the tracked skeleton drawn on top, in slow motion if you like.
function Replay({ clip, keyTime, color }) {
  const video = useRef(null);
  const canvas = useRef(null);
  const [rate, setRate] = useState(0.5);

  useEffect(() => { if (video.current) video.current.playbackRate = rate; }, [rate]);

  useEffect(() => {
    let raf;
    const tick = () => {
      const v = video.current, c = canvas.current;
      if (v && c) {
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        const g = c.getContext("2d");
        g.clearRect(0, 0, w, h);
        const idx = Math.round(v.currentTime * FPS);
        const f = clip.frames[Math.max(0, Math.min(clip.frames.length - 1, idx))];
        if (f && f.lm && clip.W) drawSkeleton(g, f.lm, w / clip.W, color, w);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clip, color]);

  function toKey() {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = keyTime;
  }

  return (
    <div>
      <div className="replay" style={{ aspectRatio: `${clip.W} / ${clip.H}` }}>
        <video
          ref={video}
          src={clip.url}
          playsInline
          muted
          controls
          preload="auto"
          onLoadedMetadata={() => { if (video.current) { video.current.playbackRate = rate; video.current.currentTime = keyTime; } }}
        />
        <canvas ref={canvas} aria-hidden="true" />
      </div>
      <div className="mtbar">
        <button className="chip sm" onClick={toKey}>Jump to key moment</button>
        <div className="chipset">
          {[0.25, 0.5, 1].map((r) => (
            <button key={r} className="chip sm" data-on={rate === r ? 1 : 0} aria-pressed={rate === r} onClick={() => setRate(r)}>{r}×</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function lastScoreKey(sport, action) { return `athletix:lastscore:${sport}:${action}`; }
function readLast(sport, action) {
  try { const v = parseFloat(localStorage.getItem(lastScoreKey(sport, action))); return isFinite(v) ? v : null; } catch { return null; }
}
function writeLast(sport, action, v) {
  try { localStorage.setItem(lastScoreKey(sport, action), String(v)); } catch { /* blocked */ }
}

function ActionCheck({ sport, sportColor }) {
  const list = actionsFor(sport);
  const [action, setAction] = useState(list[0].key);
  const [state, setState] = useState("idle"); // idle | model | reading | done | error
  const [progress, setProgress] = useState(0);
  const [out, setOut] = useState(null);
  const [clip, setClip] = useState(null);
  const [prev, setPrev] = useState(null);
  const [err, setErr] = useState("");
  const input = useRef(null);
  const alive = useRef(true);
  const cancelled = useRef(false);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);

  const act = findAction(sport, action) || list[0];

  function reset() {
    setState("idle"); setOut(null); setClip(null); setErr(""); setProgress(0); setPrev(null);
    if (input.current) input.current.value = "";
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (input.current) input.current.value = "";
    setErr(""); setOut(null); setClip(null); setProgress(0);
    cancelled.current = false;
    setState("model");
    try {
      await getLandmarker();
      if (!alive.current || cancelled.current) { if (alive.current) setState("idle"); return; }
      setState("reading");
      const c = await readFrames(file, (p) => alive.current && setProgress(p), () => alive.current && !cancelled.current);
      if (!alive.current) { URL.revokeObjectURL(c.url); return; }
      const res = analyse(c.frames, sport, act.key);
      if (!res.ok) { URL.revokeObjectURL(c.url); throw Object.assign(new Error(res.error), { friendly: true }); }
      setPrev(readLast(sport, act.key));
      writeLast(sport, act.key, res.score);
      setOut({ ...res, action: act.key, long: c.long });
      setClip(c);
      setState("done");
    } catch (ex) {
      if (!alive.current) return;
      if (cancelled.current) { setState("idle"); setProgress(0); return; }
      setErr(ex.friendly ? ex.message
        : ex.message === "length" ? "We couldn't read that video. Try a normal phone recording (MP4 or MOV)."
        : ex.message === "timeout" ? "That video took too long to open. Try a shorter clip, under 10 seconds."
        : "Something went wrong reading the video. Check your connection and try again.");
      setState("error");
    }
  }

  const good = out ? out.checks.filter((c) => c.status === "good").length : 0;
  const busy = state === "model" || state === "reading";

  return (
    <>
      <section className="card">
        <p className="eyebrow">What are you filming?</p>
        <div className="chipset" style={{ marginBottom: 18 }}>
          {list.map((a) => (
            <button key={a.key} className="chip" data-on={action === a.key ? 1 : 0} aria-pressed={action === a.key} disabled={busy}
              onClick={() => { if (a.key !== action) { reset(); setAction(a.key); } }}>
              {a.name}
            </button>
          ))}
        </div>
        <h2 className="h2">{act.name}</h2>
        <ul className="tips">
          {act.tips.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="hint"><b>Private:</b> your video is analysed on this device and never uploaded.</p>

        <input ref={input} type="file" accept="video/*" onChange={onFile} style={{ display: "none" }} id="tech-file" />
        {!busy && (
          <button className="go" onClick={() => input.current && input.current.click()}>
            {state === "idle" ? "Record or choose a clip" : "Try another clip"}
          </button>
        )}
        {state === "model" && <p className="hint"><b>Getting the motion tracker ready…</b> The first time takes a few seconds.</p>}
        {busy && <button className="chip sm" style={{ marginTop: 10 }} onClick={() => { cancelled.current = true; }}>Cancel</button>}
        {state === "reading" && (
          <div>
            <p className="hint"><b>Tracking your movement…</b> {Math.round(progress * 100)}%</p>
            <div className="scale" role="progressbar" aria-label="Tracking progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span className="bar" data-b="good" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          </div>
        )}
        {state === "error" && <p className="err" role="alert" style={{ marginTop: 16 }}>{err}</p>}
      </section>

      {state === "done" && out && clip && (
        <section className="card">
          <div className="stamp" style={{ border: 0, padding: 0, background: "none" }}>
            <div className="stampnum" data-r={ratingBand(out.score)}>{out.score.toFixed(1)}</div>
            <div>
              <div className="stamptxt">{findAction(sport, out.action).name} score</div>
              <div className="stamptxt">{good} of {out.checks.length} checks on target</div>
              <div className="stamptxt">
                {prev === null ? "Your first check of this action." : `Last time ${prev.toFixed(1)} · ${out.score > prev ? "better" : out.score < prev ? "lower" : "the same"}`}
              </div>
            </div>
          </div>
          {out.long && <p className="hint">Only the first {MAX_SECONDS} seconds were checked. For a whole game, use Full match.</p>}
          <div className="techgrid">
            <Replay clip={clip} keyTime={out.keyTime} color={sportColor} />
            <div>
              {out.checks.map((c) => (
                <div className="tcheck" key={c.label} data-s={c.status}>
                  <div className="tchead">
                    <span className="tclabel">{c.label}</span>
                    <span className="tstat" data-s={c.status}>{c.status === "good" ? "On target" : "Work on this"}</span>
                  </div>
                  <div className="tcval">{c.value}{c.unit} <span>target {c.target}</span></div>
                  {c.unit === "%" && <div className="tcnote">{c.label === "Follow-through" ? "% of your leg length" : "% of your body size, shoulders to ankles"}</div>}
                  {c.tip && <p>{c.tip}</p>}
                  {c.drill && <p className="drill"><b>Drill:</b> {c.drill}</p>}
                </div>
              ))}
            </div>
          </div>
          <p className="note">Angles from a phone video are estimates. Film the way the tips say for the most accurate read, and use this as a guide alongside your coach.</p>
        </section>
      )}
    </>
  );
}

export default function Technique({ sport, sports, sportColor, position, onSport, onUseStats }) {
  const [mode, setMode] = useState("action");
  const [matchLoaded, setMatchLoaded] = useState(false);
  const [pendingSport, setPendingSport] = useState(null);

  function pickSport(k) {
    if (k === sport) { setPendingSport(null); return; }
    // switching sport closes the match video, so ask once first
    if (mode === "match" && matchLoaded && pendingSport !== k) { setPendingSport(k); return; }
    setPendingSport(null);
    onSport(k);
  }
  function pickMode(m) { setPendingSport(null); setMode(m); }

  return (
    <>
      <section className="card">
        <p className="eyebrow">Video analysis</p>
        <div className="chipset" style={{ marginBottom: 14 }}>
          <button className="chip" data-on={mode === "action" ? 1 : 0} aria-pressed={mode === "action"} onClick={() => pickMode("action")}>Action check</button>
          <button className="chip" data-on={mode === "match" ? 1 : 0} aria-pressed={mode === "match"} onClick={() => pickMode("match")}>Full match</button>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          {mode === "action"
            ? "A short clip of one action, rated out of 10 with what to fix."
            : "Your whole game. Tag what happens and the app builds your match stats."}
        </p>
        <div className="chipset" style={{ marginTop: 14 }}>
          {Object.entries(sports).map(([k, s]) => (
            <button key={k} className="chip sm" data-on={sport === k ? 1 : 0} aria-pressed={sport === k} onClick={() => pickSport(k)}>
              {s.label}
            </button>
          ))}
        </div>
        {pendingSport && (
          <div className="notice" role="alert">
            <p>Switching to {sports[pendingSport].label} closes this video. Your tags are saved for when you come back.</p>
            <div className="chipset">
              <button className="chip sm" onClick={() => pickSport(pendingSport)}>Switch to {sports[pendingSport].label}</button>
              <button className="chip sm" onClick={() => setPendingSport(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
      {mode === "action"
        ? <ActionCheck key={sport} sport={sport} sportColor={sportColor} />
        : <MatchTagger key={sport + position} sport={sport} cfg={sports[sport]} position={position} onUse={onUseStats} onLoaded={setMatchLoaded} />}
    </>
  );
}
