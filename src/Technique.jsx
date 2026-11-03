import React, { useEffect, useRef, useState } from "react";
import { TECHNIQUES, analyse, BONES } from "./technique.js";

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

async function readFrames(file, onProgress) {
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
    const dur = Math.min(video.duration, MAX_SECONDS);
    if (!isFinite(dur) || dur <= 0) throw new Error("length");
    const W = video.videoWidth, H = video.videoHeight;
    const frames = [];
    const total = Math.max(1, Math.floor(dur * FPS));
    for (let i = 0; i < total; i++) {
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
    return { frames, video, url, W, H };
  } catch (e) {
    URL.revokeObjectURL(url);
    video.remove();
    throw e;
  }
}

async function drawKeyFrame({ video, W, H }, out, color) {
  await seek(video, out.keyTime);
  const scale = Math.min(1, 720 / Math.max(W, H));
  const c = document.createElement("canvas");
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const g = c.getContext("2d");
  g.drawImage(video, 0, 0, c.width, c.height);
  const pt = (i) => ({ x: out.keyLm[i].x * scale, y: out.keyLm[i].y * scale });
  g.lineCap = "round";
  g.strokeStyle = "rgba(6,18,42,.85)";
  g.lineWidth = Math.max(6, c.width / 90);
  BONES.forEach(([a, b]) => { const p = pt(a), q = pt(b); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); });
  g.strokeStyle = color;
  g.lineWidth = Math.max(3, c.width / 180);
  BONES.forEach(([a, b]) => { const p = pt(a), q = pt(b); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); });
  g.fillStyle = "#c8ff3d";
  [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach((i) => {
    const p = pt(i);
    g.beginPath(); g.arc(p.x, p.y, Math.max(4, c.width / 140), 0, Math.PI * 2); g.fill();
  });
  return c.toDataURL("image/jpeg", 0.85);
}

export default function Technique({ sport, sports, sportColor, onSport }) {
  const tech = TECHNIQUES[sport];
  const [state, setState] = useState("idle"); // idle | model | reading | done | error
  const [progress, setProgress] = useState(0);
  const [out, setOut] = useState(null);
  const [img, setImg] = useState(null);
  const [err, setErr] = useState("");
  const input = useRef(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  function reset() {
    setState("idle"); setOut(null); setImg(null); setErr(""); setProgress(0);
    if (input.current) input.current.value = "";
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setErr(""); setOut(null); setImg(null); setProgress(0);
    setState("model");
    let clip = null;
    try {
      await getLandmarker();
      if (!alive.current) return;
      setState("reading");
      clip = await readFrames(file, (p) => alive.current && setProgress(p));
      const res = analyse(clip.frames, sport);
      if (!res.ok) throw Object.assign(new Error(res.error), { friendly: true });
      const pic = await drawKeyFrame(clip, res, sportColor);
      if (!alive.current) return;
      setOut(res); setImg(pic); setState("done");
    } catch (ex) {
      if (!alive.current) return;
      setErr(ex.friendly ? ex.message
        : ex.message === "length" ? "We couldn't read that video. Try a normal phone recording (MP4 or MOV)."
        : ex.message === "timeout" ? "That video took too long to open. Try a shorter clip, under 10 seconds."
        : "Something went wrong reading the video. Check your connection and try again.");
      setState("error");
    } finally {
      if (clip) { URL.revokeObjectURL(clip.url); clip.video.remove(); }
    }
  }

  const good = out ? out.checks.filter((c) => c.status === "good").length : 0;

  return (
    <>
      <section className="card">
        <p className="eyebrow">Technique check</p>
        <div className="chipset" style={{ marginBottom: 16 }}>
          {Object.entries(sports).map(([k, s]) => (
            <button key={k} className="chip" data-on={sport === k ? 1 : 0} onClick={() => { if (k !== sport) { reset(); onSport(k); } }}>
              {s.label}
            </button>
          ))}
        </div>
        <h2 className="h2">{tech.name}</h2>
        <ul className="tips">
          {tech.tips.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <p className="hint"><b>Private:</b> your video is analysed on this device and never uploaded.</p>

        <input ref={input} type="file" accept="video/*" onChange={onFile} style={{ display: "none" }} id="tech-file" />
        {(state === "idle" || state === "done" || state === "error") && (
          <button className="go" onClick={() => input.current && input.current.click()}>
            {state === "idle" ? "Record or choose a clip" : "Try another clip"}
          </button>
        )}
        {state === "model" && <p className="hint"><b>Getting the motion tracker ready…</b> The first time takes a few seconds.</p>}
        {state === "reading" && (
          <div>
            <p className="hint"><b>Tracking your movement…</b> {Math.round(progress * 100)}%</p>
            <div className="scale"><span className="bar" data-b="good" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          </div>
        )}
        {state === "error" && <p className="err" role="alert" style={{ marginTop: 16 }}>{err}</p>}
      </section>

      {state === "done" && out && (
        <section className="card">
          <p className="eyebrow">Your {tech.name.toLowerCase()} · {good} of {out.checks.length} on target</p>
          <div className="techgrid">
            <img className="techimg" src={img} alt={`Key moment of your ${tech.name.toLowerCase()} with your body tracked`} />
            <div>
              {out.checks.map((c) => (
                <div className="tcheck" key={c.label} data-s={c.status}>
                  <div className="tchead">
                    <span className="tclabel">{c.label}</span>
                    <span className="tstat" data-s={c.status}>{c.status === "good" ? "On target" : "Work on this"}</span>
                  </div>
                  <div className="tcval">{c.value}{c.unit} <span>target {c.target}</span></div>
                  {c.tip && <p>{c.tip}</p>}
                  {c.drill && <p className="drill"><b>Drill:</b> {c.drill}</p>}
                </div>
              ))}
            </div>
          </div>
          <p className="note">Angles from a phone video are estimates. Film side-on in good light for the most accurate read, and use this as a guide alongside your coach.</p>
        </section>
      )}
    </>
  );
}
