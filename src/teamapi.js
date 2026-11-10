/* ============================================================
   AthletiX — teams, privacy and account calls to Supabase.
   Every rule about who sees what is enforced in the database
   (supabase-teams.sql); these functions only ask.
   ============================================================ */
import { supabase } from "./supabaseClient";

export async function myId() {
  const { data } = await supabase.auth.getSession();
  return data && data.session ? data.session.user.id : null;
}

// Turns database errors into sentences a player or coach can act on.
export function friendly(error, fallback) {
  const m = (error && error.message) || "";
  if (/No team with that code/i.test(m)) return "No team has that code. Check it with your coach and try again.";
  if (/You coach this team/i.test(m)) return "You're the coach of this team, so you can't join it as a player.";
  if (/Only the coach/i.test(m)) return "Only the team's coach can do that.";
  if (/Team limit reached/i.test(m)) return "You've reached the limit of 20 teams.";
  if (/name is required/i.test(m)) return "Enter a name first.";
  if (/function .* does not exist|Could not find the function|relation .* does not exist|schema cache/i.test(m)) {
    return "Teams aren't switched on yet. The app owner needs to finish the team setup.";
  }
  if (/fetch|network|Failed to/i.test(m)) return "No connection. Check your internet and try again.";
  return fallback;
}

// Teams I coach + teams I play for.
export async function loadMyTeams() {
  const uid = await myId();
  if (!uid) return { coach: [], player: [], error: "Not logged in." };
  const [c, p] = await Promise.all([
    supabase.from("teams").select("id,name,sport,coach_name,created_at,team_codes(code)").eq("coach_id", uid).order("created_at", { ascending: true }),
    supabase.from("team_members").select("team_id,display_name,joined_at,teams(id,name,sport,coach_name)").eq("user_id", uid),
  ]);
  const err = c.error || p.error;
  if (err) return { coach: [], player: [], error: friendly(err, "Couldn't load your teams. Try again.") };
  const player = (p.data || [])
    .filter((r) => r.teams)
    .map((r) => ({ ...r.teams, display_name: r.display_name, joined_at: r.joined_at }));
  const coach = (c.data || []).map(({ team_codes: tc, ...t }) => ({ ...t, code: (Array.isArray(tc) ? tc[0] && tc[0].code : tc && tc.code) || "" }));
  return { coach, player, error: "" };
}

export async function createTeam(name, sport, coachName) {
  const { data, error } = await supabase.rpc("create_team", { p_name: name, p_sport: sport, p_coach_name: coachName });
  if (error) return { error: friendly(error, "Couldn't create the team. Try again.") };
  return { team: data };
}

export async function joinTeam(code, name) {
  const { data, error } = await supabase.rpc("join_team", { p_code: code, p_name: name });
  if (error) return { error: friendly(error, "Couldn't join the team. Try again.") };
  return { team: data };
}

export async function leaveTeam(teamId) {
  const uid = await myId();
  if (!uid) return "You're logged out. Log in again and try once more.";
  const { data, error } = await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", uid).select("team_id");
  if (error) return friendly(error, "Couldn't leave the team. Try again.");
  return data && data.length ? "" : "Couldn't leave the team. Refresh and try again.";
}

// Removes the player. They could rejoin with the code; a new code stops that.
export async function removePlayer(teamId, userId) {
  const { error } = await supabase.rpc("remove_player", { p_team: teamId, p_user: userId });
  return error ? friendly(error, "Couldn't remove the player. Try again.") : "";
}

export async function rotateCode(teamId) {
  const { data, error } = await supabase.rpc("rotate_team_code", { p_team: teamId });
  if (error) return { error: friendly(error, "Couldn't make a new code. Try again.") };
  return { code: data };
}

export async function deleteTeam(teamId) {
  const { data, error } = await supabase.from("teams").delete().eq("id", teamId).select("id");
  if (error) return friendly(error, "Couldn't delete the team. Try again.");
  return data && data.length ? "" : "Couldn't delete the team. Refresh and try again.";
}

// Coach view: the team's players and their matches in the team's sport.
export async function loadRoster(team) {
  const m = await supabase.from("team_members").select("user_id,display_name,joined_at").eq("team_id", team.id).order("joined_at", { ascending: true });
  if (m.error) return { players: [], error: friendly(m.error, "Couldn't load the team. Try again.") };
  const members = m.data || [];
  if (!members.length) return { players: [], error: "" };
  // Newest first, in pages of 1000 (the most the server returns at once), so recent matches are never cut off.
  const ids = members.map((x) => x.user_id);
  const rows = [];
  for (let page = 0; page < 10; page++) {
    const s = await supabase.from("sessions").select("user_id,payload,created_at")
      .in("user_id", ids).eq("payload->>sport", team.sport)
      .order("created_at", { ascending: false }).range(page * 1000, page * 1000 + 999);
    if (s.error) return { players: [], error: friendly(s.error, "Couldn't load the players' matches. Try again.") };
    rows.push(...(s.data || []));
    if (!s.data || s.data.length < 1000) break;
  }
  rows.reverse(); // back to oldest first
  const by = {};
  rows.forEach((r) => {
    if (!r.payload || r.payload.sport !== team.sport) return;
    (by[r.user_id] = by[r.user_id] || []).push(r.payload);
  });
  return { players: members.map((x) => ({ ...x, matches: by[x.user_id] || [] })), error: "" };
}

// Everything we hold about you, as a file you can keep.
export async function exportMyData() {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess && sess.session ? sess.session.user : null;
  const uid = user ? user.id : null;
  if (!uid) return { error: "Not logged in." };
  const [s, p, t] = await Promise.all([
    supabase.from("sessions").select("payload,created_at").eq("user_id", uid).order("created_at", { ascending: true }),
    supabase.from("plans").select("payload,updated_at").eq("user_id", uid).maybeSingle(),
    loadMyTeams(),
  ]);
  if (s.error || p.error || t.error) return { error: "Couldn't collect your data. Try again." };
  return {
    data: {
      exported_at: new Date().toISOString(),
      account: { email: user.email || null, created_at: user.created_at || null },
      matches: (s.data || []).map((r) => r.payload),
      plans_and_profile: p.data ? p.data.payload : null,
      teams_you_coach: t.coach.map(({ name, sport, code }) => ({ name, sport, code })),
      teams_you_play_for: t.player.map(({ name, sport, display_name }) => ({ name, sport, your_name_on_team: display_name })),
    },
  };
}

export async function deleteMyAccount() {
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return friendly(error, "Couldn't delete your account. Check your connection and try again.");
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("athletix:")).forEach((k) => localStorage.removeItem(k));
  } catch { /* storage blocked */ }
  // The login no longer exists on the server, so just forget it on this device.
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* already gone */ }
  return "";
}
