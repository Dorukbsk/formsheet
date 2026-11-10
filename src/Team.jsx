import React, { useEffect, useState } from "react";
import { matchRating, ratingBand } from "./card.js";
import Icon from "./icons.jsx";
import { loadMyTeams, createTeam, joinTeam, leaveTeam, removePlayer, deleteTeam, loadRoster, rotateCode } from "./teamapi.js";

/* ---------- helpers ---------- */

const RECENT = 5;

function daysAgo(day) {
  if (!day || typeof day !== "string") return null;
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - new Date(y, m - 1, d)) / 864e5);
}
function whenText(day) {
  const n = daysAgo(day);
  if (n === null) return "";
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 14) return `${n} days ago`;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function dateText(day) {
  const [y, m, d] = String(day || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
const ratingOf = (s) => matchRating(typeof s.overall === "number" ? s.overall : 0);
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const one = (n) => Math.round(n * 10) / 10;

// Summary of one player's recent matches (matches are oldest first).
export function playerSummary(matches) {
  const list = matches.filter((s) => typeof s.overall === "number");
  if (!list.length) return { count: 0 };
  const recent = list.slice(-RECENT);
  const ratings = recent.map(ratingOf);
  const rating = one(avg(ratings));
  let trend = null;
  if (list.length >= 2) {
    const prev = list.slice(-RECENT - 1, -1).map(ratingOf);
    trend = one(ratingOf(list[list.length - 1]) - avg(prev));
  }
  const stats = {};
  recent.forEach((s) => (s.rows || []).forEach((r) => {
    if (typeof r.pct !== "number") return;
    (stats[r.key] = stats[r.key] || { label: r.label, t: 0, n: 0 });
    stats[r.key].t += r.pct;
    stats[r.key].n += 1;
  }));
  const ranked = Object.values(stats).map((x) => ({ label: x.label, pct: Math.round(x.t / x.n) })).sort((a, b) => b.pct - a.pct);
  const strengths = ranked.filter((x) => x.pct >= 62).slice(0, 2);
  const gaps = ranked.filter((x) => x.pct < 38).slice(-2).reverse();
  const last = list[list.length - 1];
  return { count: list.length, rating, band: ratingBand(rating), trend, last, recent: [...recent].reverse(), strengths, gaps };
}

function useConfirm() {
  const [armed, setArmed] = useState(null);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(null), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return [armed, (k) => { if (armed === k) { setArmed(null); return true; } setArmed(k); return false; }];
}

// "Aliyev" -> "Coach Aliyev", but "Coach Aliyev" stays as it is
const coachLabel = (n) => (/^coach\b/i.test(n.trim()) ? n.trim() : `Coach ${n.trim()}`);

const cleanCode = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

/* ---------- main ---------- */

export default function Team({ sport, sports, plans }) {
  const profileName = (plans && plans.profile && plans.profile.name) || "";
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState({ coach: [], player: [] });
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [armed, confirm] = useConfirm();

  async function refresh() {
    const r = await loadMyTeams();
    setTeams({ coach: r.coach, player: r.player });
    setErr(r.error);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function leave(t) {
    if (!confirm(`leave:${t.id}`)) return;
    const e = await leaveTeam(t.id);
    if (e) { setErr(e); return; }
    setInfo(`You left ${t.name}. Your coach can no longer see your matches.`);
    refresh();
  }

  if (loading) return <section className="card"><p className="empty">Loading your teams…</p></section>;

  const none = !teams.coach.length && !teams.player.length;

  return (
    <>
      {none && (
        <section className="card">
          <p className="eyebrow">Team</p>
          <h2 className="h2">Train as a team</h2>
          <p className="empty">
            Coaches create a team and share its code. Players join with the code, and the coach sees every player's
            matches, ratings and progress in one place.
          </p>
        </section>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      {info && <p className="okmsg" role="status">{info}</p>}

      {teams.coach.map((t) => (
        <CoachTeam key={t.id} team={t} sports={sports} onDeleted={(name) => { setInfo(`${name} was deleted.`); refresh(); }} />
      ))}

      {teams.player.length > 0 && (
        <section className="card">
          <p className="eyebrow">Teams you play for</p>
          {teams.player.map((t) => (
            <div className="tmrow" key={t.id}>
              <div className="tmmain">
                <div className="tmname">{t.name}</div>
                <div className="tmsub">
                  {sports[t.sport] ? sports[t.sport].label : t.sport}
                  {t.coach_name ? ` · ${coachLabel(t.coach_name)}` : ""} · you're listed as {t.display_name}
                </div>
                <div className="tmsub">Your coach can see your {sports[t.sport] ? sports[t.sport].label.toLowerCase() : ""} matches: stats, ratings and dates.</div>
              </div>
              <button className="chip sm" onClick={() => leave(t)}>{armed === `leave:${t.id}` ? "Tap again to leave" : "Leave team"}</button>
            </div>
          ))}
        </section>
      )}

      <div className="teamgrid">
        <JoinCard defaultName={profileName} sports={sports}
          onJoined={(t) => { setErr(""); setInfo(`You joined ${t.name}. Your coach can now see your ${sports[t.sport] ? sports[t.sport].label.toLowerCase() : ""} matches.`); refresh(); }} />
        <CreateCard defaultName={profileName} sport={sport} sports={sports}
          onCreated={(t) => { setErr(""); setInfo(`${t.name} is ready. Share the code ${t.code} with your players.`); refresh(); }} />
      </div>
    </>
  );
}

/* ---------- join / create ---------- */

function JoinCard({ defaultName, onJoined }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function join() {
    if (code.length !== 6) { setErr("Team codes have 6 letters and numbers."); return; }
    if (!name.trim()) { setErr("Enter your name so your coach knows who you are."); return; }
    setBusy(true);
    const r = await joinTeam(code, name.trim());
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setErr("");
    setCode("");
    onJoined(r.team);
  }

  return (
    <section className="card">
      <p className="eyebrow">Player</p>
      <h2 className="h2">Join your team</h2>
      <div className="field">
        <label htmlFor="tm-code">Team code from your coach</label>
        <input id="tm-code" className="codeinput" value={code} autoComplete="off" autoCapitalize="characters" spellCheck="false"
          placeholder="ABC123" onChange={(e) => setCode(cleanCode(e.target.value))} />
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="tm-pname">Your name on the team</label>
        <input id="tm-pname" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        Joining lets the coach see your matches in that team's sport: stats, ratings and dates. They can't see your other
        sports, your training plan or your videos. You can leave at any time.
      </p>
      {err && <p className="err" role="alert" style={{ marginTop: 12 }}>{err}</p>}
      <button className="go" style={{ marginTop: 14 }} onClick={join} disabled={busy}>{busy ? "Joining…" : "Join team"}</button>
    </section>
  );
}

function CreateCard({ defaultName, sport, sports, onCreated }) {
  const [name, setName] = useState("");
  const [sp, setSp] = useState(sport);
  const [coach, setCoach] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function create() {
    if (!name.trim()) { setErr("Give your team a name first."); return; }
    setBusy(true);
    const r = await createTeam(name.trim(), sp, coach.trim());
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setErr("");
    setName("");
    onCreated(r.team);
  }

  return (
    <section className="card">
      <p className="eyebrow">Coach</p>
      <h2 className="h2">Create a team</h2>
      <div className="field">
        <label htmlFor="tm-tname">Team name</label>
        <input id="tm-tname" value={name} maxLength={60} placeholder="e.g. U18 Boys Basketball" onChange={(e) => setName(e.target.value)} />
      </div>
      <p className="eyebrow" style={{ marginTop: 14 }}>Sport</p>
      <div className="chipset">
        {Object.entries(sports).map(([k, s]) => (
          <button key={k} className="chip sm" data-on={sp === k ? 1 : 0} aria-pressed={sp === k} onClick={() => setSp(k)}>{s.label}</button>
        ))}
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="tm-cname">Your name (players see this)</label>
        <input id="tm-cname" value={coach} maxLength={60} placeholder="e.g. Mr Aliyev" onChange={(e) => setCoach(e.target.value)} />
      </div>
      {err && <p className="err" role="alert" style={{ marginTop: 12 }}>{err}</p>}
      <button className="go ghost" style={{ marginTop: 14 }} onClick={create} disabled={busy}>{busy ? "Creating…" : "Create team"}</button>
    </section>
  );
}

/* ---------- coach view ---------- */

function CoachTeam({ team, sports, onDeleted }) {
  const cfg = sports[team.sport];
  const [roster, setRoster] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState(team.code);
  const [armed, confirm] = useConfirm();

  async function load() {
    const r = await loadRoster(team);
    setErr(r.error);
    setRoster(r.players);
  }
  useEffect(() => { load(); }, [team.id]);

  function copy() {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => {});
    } catch { /* clipboard blocked */ }
  }
  function share() {
    const text = `Join ${team.name} on AthletiX: open ${window.location.origin}, go to Team and enter the code ${code}.`;
    if (navigator.share) navigator.share({ title: "Join my team on AthletiX", text }).catch(() => {});
  }
  async function newCode() {
    if (!confirm("code")) return;
    const r = await rotateCode(team.id);
    if (r.error) { setErr(r.error); return; }
    setErr("");
    setCode(r.code);
  }
  async function remove(p) {
    if (!confirm(`rm:${p.user_id}`)) return;
    const e = await removePlayer(team.id, p.user_id);
    if (e) { setErr(e); return; }
    setOpen(null);
    load();
  }
  async function del() {
    if (!confirm("delete")) return;
    const e = await deleteTeam(team.id);
    if (e) { setErr(e); return; }
    onDeleted(team.name);
  }

  const players = (roster || []).map((p) => ({ ...p, sum: playerSummary(p.matches) }));
  players.sort((a, b) => (b.sum.rating || 0) - (a.sum.rating || 0) || a.display_name.localeCompare(b.display_name));
  const rated = players.filter((p) => p.sum.count);
  const teamRating = rated.length ? one(avg(rated.map((p) => p.sum.rating))) : null;
  const totalMatches = players.reduce((a, p) => a + p.sum.count, 0);
  const activeWeek = players.filter((p) => p.matches.some((s) => { const n = daysAgo(s.date); return n !== null && n <= 7; })).length;

  return (
    <section className="card coachteam">
      <div className="tmhead">
        <div>
          <p className="eyebrow">Coach view · {cfg ? cfg.label : team.sport}</p>
          <h2 className="h2" style={{ marginBottom: 4 }}>{team.name}</h2>
          {team.coach_name && <p className="tmsub">{coachLabel(team.coach_name)}</p>}
        </div>
        <div className="codebox">
          <span className="codelabel">Team code</span>
          <span className="codeval">{code}</span>
          <div className="chipset" style={{ justifyContent: "center" }}>
            <button className="chip sm" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            {typeof navigator !== "undefined" && navigator.share && <button className="chip sm" onClick={share}>Share</button>}
            <button className="chip sm" onClick={newCode}>{armed === "code" ? "Tap again" : "New code"}</button>
          </div>
          <span className="codehint">Only you can see this code. A new code stops the old one working.</span>
        </div>
      </div>

      {err && <p className="err" role="alert">{err}</p>}

      {roster === null ? (
        <p className="empty">Loading players…</p>
      ) : !players.length ? (
        <div className="tmempty">
          <span className="tmicon"><Icon name="team" size={26} /></span>
          <p className="empty">No players yet. Players open the <b>Team</b> tab in AthletiX and enter the code <b>{code}</b>.</p>
        </div>
      ) : (
        <>
          <div className="tmtiles">
            <div className="tmtile"><b>{players.length}</b><span>Players</span></div>
            <div className="tmtile"><b>{totalMatches}</b><span>Matches logged</span></div>
            <div className="tmtile"><b data-r={teamRating !== null ? ratingBand(teamRating) : undefined}>{teamRating !== null ? teamRating.toFixed(1) : "–"}</b><span>Team rating</span></div>
            <div className="tmtile"><b>{activeWeek}/{players.length}</b><span>Played this week</span></div>
          </div>

          <p className="eyebrow" style={{ marginTop: 20 }}>Players · rating is the average of their last {RECENT} matches</p>
          <div className="roster">
            {players.map((p) => {
              const s = p.sum;
              const isOpen = open === p.user_id;
              const quiet = !s.count || (daysAgo(s.last.date) ?? 99) > 14;
              return (
                <div key={p.user_id} className="prow" data-open={isOpen ? 1 : 0}>
                  <button className="phead" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.user_id)}>
                    <span className="pmain">
                      <span className="pname">{p.display_name}</span>
                      <span className="psub" data-quiet={quiet ? 1 : 0}>
                        {s.count
                          ? `${s.count} ${s.count === 1 ? "match" : "matches"} · last ${whenText(s.last.date)}${cfg && cfg.positions[s.last.position] ? ` · ${cfg.positions[s.last.position]}` : ""}`
                          : "No matches logged yet"}
                      </span>
                    </span>
                    {s.count > 0 && (
                      <span className="pright">
                        {s.trend !== null && (
                          <span className={s.trend > 0 ? "up" : s.trend < 0 ? "down" : "flat"}>
                            {s.trend > 0 ? "▲" : s.trend < 0 ? "▼" : "•"} {Math.abs(s.trend).toFixed(1)}
                          </span>
                        )}
                        <span className="rpill" data-r={s.band}>{s.rating.toFixed(1)}</span>
                      </span>
                    )}
                    <span className="pchev" aria-hidden="true"><Icon name="chevron" size={16} /></span>
                  </button>
                  {isOpen && (
                    <div className="pdetail">
                      {s.count > 0 ? (
                        <>
                          <div className="pcols">
                            <div>
                              <p className="eyebrow">Strengths</p>
                              {s.strengths.length ? s.strengths.map((x) => <p className="pstat" key={x.label}><span>{x.label}</span><b className="up">{x.pct}</b></p>)
                                : <p className="tmsub">Nothing above level yet.</p>}
                            </div>
                            <div>
                              <p className="eyebrow">Work on</p>
                              {s.gaps.length ? s.gaps.map((x) => <p className="pstat" key={x.label}><span>{x.label}</span><b className="down">{x.pct}</b></p>)
                                : <p className="tmsub">No big gaps.</p>}
                            </div>
                          </div>
                          <p className="tmsub" style={{ margin: "4px 0 12px" }}>Numbers are percentiles against their position and level (50 = typical).</p>
                          <p className="eyebrow">Recent matches</p>
                          <table>
                            <tbody>
                              {s.recent.map((m, i) => (
                                <tr key={m.id || i}>
                                  <td>{dateText(m.date)}</td>
                                  <td>{cfg && cfg.positions[m.position] ? cfg.positions[m.position] : ""}</td>
                                  <td style={{ textAlign: "right" }}><span className="rpill sm" data-r={ratingBand(ratingOf(m))}>{ratingOf(m).toFixed(1)}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      ) : (
                        <p className="tmsub">When {p.display_name} logs a {cfg ? cfg.label.toLowerCase() : ""} match, it shows up here.</p>
                      )}
                      <button className="chip sm" style={{ marginTop: 12 }} onClick={() => remove(p)}>
                        {armed === `rm:${p.user_id}` ? "Tap again to remove" : "Remove from team"}
                      </button>
                      <p className="tmsub" style={{ marginTop: 6 }}>Removed players can rejoin with the code. To keep someone out, tap New code.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="chipset" style={{ marginTop: 18 }}>
        <button className="chip sm" onClick={load}>Refresh</button>
        <button className="chip sm" onClick={del}>{armed === "delete" ? "Tap again to delete the team" : "Delete team"}</button>
      </div>
    </section>
  );
}
