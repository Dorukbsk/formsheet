import React, { useEffect, useMemo, useRef, useState } from "react";
import { TAGS, visibleTags, computeStats, countTags, fmtTime, defaultUnits } from "./gametag.js";

const SPEEDS = [1, 1.5, 2];

// Tags are saved per video, sport and position, so they never mix between sports.
function storeKey(file, sport, position) {
  return `athletix:tags:${sport}:${position}:${file.name}:${file.size}:${file.lastModified || 0}`;
}
function readTags(key, sport) {
  const valid = new Set((TAGS[sport] || []).map((d) => d.key));
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(v) ? v.filter((t) => t && typeof t.t === "number" && valid.has(t.type)) : [];
  } catch { return []; }
}
function writeTags(key, tags) {
  try { localStorage.setItem(key, JSON.stringify(tags)); } catch { /* storage full or blocked */ }
}

export default function MatchTagger({ sport, cfg, position, onUse, onLoaded }) {
  const metricKeys = useMemo(() => cfg.metrics.filter((m) => m.bm[position]).map((m) => m.key), [cfg, position]);
  const buttons = useMemo(() => visibleTags(sport, metricKeys), [sport, metricKeys]);
  const labelOf = useMemo(() => Object.fromEntries((TAGS[sport] || []).map((b) => [b.key, b.label])), [sport]);

  const [url, setUrl] = useState(null);
  const [key, setKey] = useState(null);
  const [duration, setDuration] = useState(0);
  const [tags, setTags] = useState([]);
  const [speed, setSpeed] = useState(1);
  const [units, setUnits] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [broken, setBroken] = useState(false);
  const video = useRef(null);
  const input = useRef(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => { if (key) writeTags(key, tags); }, [key, tags]);
  useEffect(() => { if (video.current) video.current.playbackRate = speed; }, [speed, url]);
  useEffect(() => { if (onLoaded) onLoaded(!!url); }, [url, onLoaded]);
  useEffect(() => () => { if (onLoaded) onLoaded(false); }, [onLoaded]);
  // "Tap again to clear all" disarms itself after a few seconds
  useEffect(() => {
    if (!confirmClear) return undefined;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // lets you pick the same file again
    if (!file) return;
    setErr("");
    setBroken(false);
    setConfirmClear(false);
    const k = storeKey(file, sport, position);
    const saved = readTags(k, sport);
    setKey(k);
    setTags(saved);
    setNote(saved.length ? `Picked up where you left off: ${saved.length} moment${saved.length === 1 ? "" : "s"} already tagged.` : "");
    setDuration(0);
    setUnits("");
    setUrl(URL.createObjectURL(file));
  }

  function onMeta() {
    const d = video.current ? video.current.duration : 0;
    if (video.current) video.current.playbackRate = speed;
    // some recordings report an endless length; they still play and can be tagged
    if (d === Infinity) return;
    if (!isFinite(d) || d <= 0) {
      setBroken(true);
      setErr("We couldn't read that video. Try a normal phone or camera recording (MP4 or MOV).");
      return;
    }
    setDuration(d);
    if (sport === "volleyball") setUnits((u) => u || String(defaultUnits(sport, d)));
  }
  function onDurationChange() {
    const d = video.current ? video.current.duration : 0;
    if (isFinite(d) && d > 0 && !duration) {
      setDuration(d);
      if (sport === "volleyball") setUnits((u) => u || String(defaultUnits(sport, d)));
    }
  }

  function tag(type) {
    if (broken) return;
    const t = video.current ? video.current.currentTime : 0;
    setTags((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, t, type }]);
  }
  const undo = () => setTags((prev) => prev.slice(0, -1));
  const remove = (id) => setTags((prev) => prev.filter((x) => x.id !== id));
  function seek(t, play = true) {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || t, t));
    if (play) v.play().catch(() => {});
  }
  const skip = (s) => video.current && seek(video.current.currentTime + s, !video.current.paused);

  function clearAll() {
    if (!confirmClear) { setConfirmClear(true); return; }
    setTags([]);
    setNote("");
    setConfirmClear(false);
  }

  const counts = countTags(tags);
  const stats = computeStats(tags, sport, metricKeys).raw;
  const metricLabel = Object.fromEntries(cfg.metrics.map((m) => [m.key, m.label + (m.unit === "%" ? " (%)" : "")]));
  const statKeys = metricKeys.filter((k) => stats[k] !== undefined);
  const untaggable = cfg.metrics.filter((m) => m.bm[position] && !buttons.some((b) => b.metrics.includes(m.key)));

  function send() {
    const n = parseFloat(units);
    if (broken) { setErr("We couldn't play that video. Choose another one first."); return; }
    if (!tags.length) { setErr("Tag at least one moment from your match first."); return; }
    if (!(n > 0)) { setErr(`Enter ${cfg.unitLabel.toLowerCase()} first.`); return; }
    setErr("");
    onUse(stats, String(n));
  }

  if (!url) {
    return (
      <section className="card">
        <p className="eyebrow">Full match</p>
        <h2 className="h2">Tag your match video</h2>
        <ul className="tips">
          <li>Upload a full game or any part of one, any length.</li>
          <li>Play it back and tap a button each time something happens to you: a pass, a shot, a tackle.</li>
          <li>The app counts everything, works out your percentages and sends the stats to your match log.</li>
        </ul>
        <p className="hint"><b>Private:</b> the video stays on this device. Your tags are saved here too, so you can stop and come back.</p>
        <input ref={input} type="file" accept="video/*" onChange={onFile} style={{ display: "none" }} id="match-file" />
        <button className="go" onClick={() => input.current && input.current.click()}>Choose match video</button>
        {err && <p className="err" role="alert" style={{ marginTop: 16 }}>{err}</p>}
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <p className="eyebrow">Full match · {cfg.label} · {cfg.positions[position]}</p>
        <div className="mtvideo">
          <video ref={video} src={url} controls playsInline preload="metadata" onLoadedMetadata={onMeta} onDurationChange={onDurationChange} onError={() => { setBroken(true); setErr("We couldn't play that video. Try a normal phone or camera recording (MP4 or MOV)."); }} />
        </div>
        <div className="mtbar">
          <div className="chipset">
            <button className="chip sm" onClick={() => skip(-10)}>−10 s</button>
            <button className="chip sm" onClick={() => skip(10)}>+10 s</button>
          </div>
          <div className="chipset">
            {SPEEDS.map((s) => (
              <button key={s} className="chip sm" data-on={speed === s ? 1 : 0} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>
            ))}
          </div>
        </div>
        {note && <p className="hint" style={{ marginTop: 12 }}>{note}</p>}
        {err && <p className="err" role="alert" style={{ marginTop: 12 }}>{err}</p>}

        <p className="eyebrow" style={{ marginTop: 18 }}>Tap when it happens</p>
        <div className="tagpad">
          {buttons.map((b) => (
            <button key={b.key} className="tagbtn" disabled={broken} onClick={() => tag(b.key)}>
              <span>{b.label}</span>
              <b>{counts[b.key] || 0}</b>
            </button>
          ))}
        </div>
        <div className="chipset" style={{ marginTop: 12 }}>
          <button className="chip sm" onClick={undo} disabled={!tags.length}>Undo last</button>
          <button className="chip sm" onClick={() => input.current && input.current.click()}>Change video</button>
          <input ref={input} type="file" accept="video/*" onChange={onFile} style={{ display: "none" }} id="match-file" />
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Your match so far · {tags.length} moment{tags.length === 1 ? "" : "s"} tagged</p>
        {tags.length === 0 || statKeys.length === 0 ? (
          <p className="empty">Tag moments as you watch and your stats build up here.</p>
        ) : (
          <table>
            <tbody>
              {statKeys.map((k) => (
                <tr key={k}><td>{metricLabel[k]}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{stats[k]}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {untaggable.length > 0 && (
          <p className="hint" style={{ marginTop: 12 }}>
            {untaggable.map((m) => m.label).join(", ")} can't be tagged from video. Add {untaggable.length === 1 ? "it" : "them"} on the log page if you track {untaggable.length === 1 ? "it" : "them"}.
          </p>
        )}
        <p className="hint" style={{ marginTop: 12 }}>Anything you didn't tag counts as 0. Clear a box on the log page if you didn't track it.</p>
        <div className="field" style={{ maxWidth: 240, marginTop: 8 }}>
          <label htmlFor="mt-units">{cfg.unitLabel}</label>
          <input id="mt-units" type="number" inputMode="decimal" min="1" value={units} onChange={(e) => setUnits(e.target.value)} />
        </div>
        {sport !== "volleyball" && (
          <p className="hint" style={{ marginTop: 6 }}>Enter the minutes you were actually on the pitch or court, not the video length.</p>
        )}
        <div className="chipset" style={{ marginTop: 16 }}>
          <button className="go" onClick={send}>Send to match log</button>
          {tags.length > 0 && (
            <button className="go ghost" onClick={clearAll}>
              {confirmClear ? "Tap again to clear all" : "Clear all tags"}
            </button>
          )}
        </div>
      </section>

      {tags.length > 0 && (
        <section className="card">
          <p className="eyebrow">Your moments · tap to watch</p>
          <div className="taglist">
            {[...tags].sort((a, b) => b.t - a.t).map((x) => (
              <div className="tagrow" key={x.id}>
                <button className="tagjump" onClick={() => seek(x.t - 3)}>
                  <span className="tagtime">{fmtTime(x.t)}</span>
                  <span>{labelOf[x.type] || x.type}</span>
                </button>
                <button className="tagdel" aria-label={`Remove ${labelOf[x.type] || x.type} at ${fmtTime(x.t)}`} onClick={() => remove(x.id)}>×</button>
              </div>
            ))}
          </div>
          {duration > 0 && <p className="hint" style={{ marginTop: 10 }}>Video length {fmtTime(duration)}.</p>}
        </section>
      )}
    </>
  );
}
