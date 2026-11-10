import React, { useEffect, useState } from "react";
import { exportMyData, deleteMyAccount } from "./teamapi.js";

// Put a contact email here (for example the school sports office) and it appears on the privacy page.
export const PRIVACY_CONTACT = "doruk.baskan@bakuoxfordschool.net";
const UPDATED = "November 2026";

const CSS = `
.pv{color:var(--ink);}
.pv h2{font-size:22px;font-weight:700;letter-spacing:-.01em;margin:0 0 6px;}
.pv h3{font-size:15.5px;font-weight:700;margin:22px 0 6px;}
.pv p,.pv li{font-size:14.5px;line-height:1.65;color:var(--soft);margin:0 0 8px;}
.pv ul{padding-left:18px;margin:0 0 8px;}
.pv b{color:var(--ink);font-weight:600;}
.pv .pvdate{font-size:12.5px;color:var(--mute);margin-bottom:14px;}
.pv a{color:var(--lime);}
`;

export function PrivacyNotice() {
  return (
    <div className="pv">
      <style>{CSS}</style>
      <h2>Privacy</h2>
      <p className="pvdate">Last updated {UPDATED}</p>
      <p>AthletiX helps you understand your game. We keep only what the app needs to work, and you stay in control of it.</p>

      <h3>What we store</h3>
      <ul>
        <li>Your <b>email address</b> and password, for logging in. The password is stored scrambled (hashed), so nobody, including us, can read it.</li>
        <li>Your <b>name, sport, position and level</b>, if you enter them.</li>
        <li>The <b>matches you log</b>: stats, ratings and dates.</li>
        <li>Your <b>training plan</b> and the days you mark as trained or rested.</li>
        <li>The <b>teams</b> you create or join.</li>
      </ul>

      <h3>Your videos never leave your phone</h3>
      <p>Technique checks and match tagging run on your own device. Videos are never uploaded, and match tags are saved only on your device.</p>

      <h3>Who can see your data</h3>
      <ul>
        <li><b>Only you</b>, unless you join a team.</li>
        <li>When you join a team, <b>that team's coach</b> can see your name on the team and your matches in that team's sport (stats, ratings and dates). They can't see your other sports, your training plan, your email or your videos.</li>
        <li>Leave a team at any time and the coach loses access straight away.</li>
        <li>We don't sell your data or show ads, and we only share it with the services that run the app (below).</li>
      </ul>

      <h3>Where it's kept</h3>
      <p>Your data is stored by Supabase on servers in Frankfurt, Germany (EU). The app is hosted by Vercel, which also counts page visits anonymously, without cookies. Fonts and the motion-tracking model are downloaded from Google and jsDelivr, which, like any website, see your device's internet address.</p>

      <h3>Your choices</h3>
      <ul>
        <li><b>Download</b> your data, or <b>delete your account</b>, from the Account page. Deleting removes your matches, plans, teams and login straight away. Supabase's security logs and backups can keep traces for a limited time before they expire.</li>
        <li><b>Logging out</b> also clears the match tags and scores saved on that device, so shared school tablets stay private.</li>
      </ul>

      <h3>Under 18?</h3>
      <p>Check with a parent or guardian before you sign up. Your school may also ask for a consent form before you use AthletiX with a team.</p>

      <h3>Questions</h3>
      <p>
        {PRIVACY_CONTACT
          ? <>Email <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>.</>
          : "Ask your coach or your school's sports department."}
      </p>
    </div>
  );
}

function download(obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `athletix-my-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Account page inside the app: download, delete, and the privacy notice.
export function Account({ onDeleted }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [typed, setTyped] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => { if (!asking) setTyped(""); }, [asking]);

  async function getData() {
    setBusy("export"); setErr(""); setMsg("");
    const r = await exportMyData();
    setBusy("");
    if (r.error) { setErr(r.error); return; }
    try { download(r.data); setMsg("Your data file has been downloaded."); } catch { setErr("Couldn't create the file on this device."); }
  }

  async function del() {
    if (typed.trim().toUpperCase() !== "DELETE") return;
    setBusy("delete"); setErr("");
    const e = await deleteMyAccount();
    setBusy("");
    if (e) { setErr(e); return; }
    if (onDeleted) onDeleted();
  }

  return (
    <>
      <section className="card">
        <p className="eyebrow">Account</p>
        <h2 className="h2">Your data</h2>
        <p className="empty">Download a copy of what AthletiX stores about you: your account email, matches, plans, profile and teams.</p>
        <button className="go ghost" style={{ marginTop: 14 }} onClick={getData} disabled={!!busy}>
          {busy === "export" ? "Preparing…" : "Download my data"}
        </button>
        {msg && <p className="okmsg" role="status" style={{ marginTop: 12 }}>{msg}</p>}
      </section>

      <section className="card dangercard">
        <p className="eyebrow">Delete account</p>
        <p className="empty">This permanently deletes your login, every match you've logged, your training plan, and any teams you coach. It can't be undone.</p>
        {!asking ? (
          <button className="go danger" style={{ marginTop: 14 }} onClick={() => setAsking(true)}>Delete my account</button>
        ) : (
          <>
            <div className="field" style={{ marginTop: 14, maxWidth: 320 }}>
              <label htmlFor="del-confirm">Type DELETE to confirm</label>
              <input id="del-confirm" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
            </div>
            <div className="chipset" style={{ marginTop: 12 }}>
              <button className="go danger" onClick={del} disabled={typed.trim().toUpperCase() !== "DELETE" || !!busy}>
                {busy === "delete" ? "Deleting…" : "Delete everything"}
              </button>
              <button className="go ghost" onClick={() => setAsking(false)} disabled={!!busy}>Cancel</button>
            </div>
          </>
        )}
        {err && <p className="err" role="alert" style={{ marginTop: 12 }}>{err}</p>}
      </section>

      <section className="card"><PrivacyNotice /></section>
    </>
  );
}
