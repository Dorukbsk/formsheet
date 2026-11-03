/* ============================================================
   AthletiX — player profile ratings + shareable image
   Pure logic, no React.
   ============================================================ */

const ATTRS = {
  football: [
    { code: "SHO", label: "Shooting", m: ["goals", "shotAcc"] },
    { code: "PAS", label: "Passing", m: ["passAcc"] },
    { code: "CRE", label: "Creativity", m: ["keyPasses", "assists"] },
    { code: "DEF", label: "Defending", m: ["tackles", "intercept"] },
    { code: "PHY", label: "Physical", m: ["duelsWon", "distance"] },
    { code: "CON", label: "Ball security", m: ["turnovers"] },
  ],
  footballGK: [
    { code: "REF", label: "Reflexes", m: ["saves"] },
    { code: "STP", label: "Shot stopping", m: ["savePct"] },
    { code: "AIR", label: "Aerial", m: ["claims"] },
    { code: "POS", label: "Positioning", m: ["conceded"] },
    { code: "DIS", label: "Distribution", m: ["passAcc"] },
  ],
  basketball: [
    { code: "SCO", label: "Scoring", m: ["points"] },
    { code: "SHT", label: "Shooting", m: ["fg", "three"] },
    { code: "FT", label: "Free throws", m: ["ft"] },
    { code: "REB", label: "Rebounding", m: ["reb"] },
    { code: "PLM", label: "Playmaking", m: ["ast", "tov"] },
    { code: "DEF", label: "Defence", m: ["stl", "blk"] },
  ],
  volleyball: [
    { code: "ATK", label: "Attack", m: ["kills", "hitEff"] },
    { code: "SRV", label: "Serve", m: ["aces", "serveErr"] },
    { code: "BLK", label: "Block", m: ["blocksV"] },
    { code: "DIG", label: "Defence", m: ["digs"] },
    { code: "REC", label: "Reception", m: ["recep"] },
    { code: "SET", label: "Setting", m: ["setAst"] },
  ],
};

export const RECENT = 5; // profile uses your last 5 matches in this sport and role

// Sofascore-style rating: 4.0–10.0, where 7.0 is an average game at your level.
export function matchRating(pct) {
  return Math.max(4, Math.min(10, Math.round((4 + pct * 0.06) * 10) / 10));
}
export function ratingBand(r) {
  if (r >= 9) return "elite";
  if (r >= 7.5) return "good";
  if (r >= 6.5) return "par";
  if (r >= 5.5) return "low";
  return "gap";
}
export function pctBand(p) {
  if (p >= 80) return "elite";
  if (p >= 62) return "good";
  if (p >= 38) return "par";
  if (p >= 20) return "low";
  return "gap";
}
export const BAND_COLOR = { elite: "#5b9dff", good: "#3dd68c", par: "#c3c9d1", low: "#f5b841", gap: "#f2545b" };

function rate(list, attrs) {
  const sums = {};
  list.forEach((s) => s.rows.forEach((r) => {
    sums[r.key] = sums[r.key] || { t: 0, n: 0 };
    sums[r.key].t += r.pct;
    sums[r.key].n += 1;
  }));
  const out = [];
  attrs.forEach((a) => {
    const vals = a.m.filter((k) => sums[k]).map((k) => sums[k].t / sums[k].n);
    if (vals.length) {
      const pct = Math.max(1, Math.min(99, Math.round(vals.reduce((x, y) => x + y, 0) / vals.length)));
      out.push({ code: a.code, label: a.label, rating: pct });
    }
  });
  return out;
}

const avg = (arr) => arr.reduce((x, a) => x + a.rating, 0) / arr.length;

export function buildCard(sessions, sport) {
  const mine = sessions.filter((s) => s.sport === sport && Array.isArray(s.rows) && s.rows.length);
  if (!mine.length) return null;
  const position = mine[mine.length - 1].position;
  const role = mine.filter((s) => s.position === position);
  const attrs = (sport === "football" && position === "GK") ? ATTRS.footballGK : ATTRS[sport];

  const now = rate(role.slice(-RECENT), attrs);
  if (!now.length) return null;
  const overall = Math.round(avg(now));
  const rating = matchRating(avg(now));

  let delta = null;
  if (role.length > 1) {
    const before = rate(role.slice(0, -1).slice(-RECENT), attrs);
    const map = Object.fromEntries(before.map((a) => [a.code, a.rating]));
    now.forEach((a) => { if (map[a.code] !== undefined) a.delta = a.rating - map[a.code]; });
    if (before.length) delta = Math.round((rating - matchRating(avg(before))) * 10) / 10;
  }

  return { sport, position, overall, rating, band: ratingBand(rating), delta, attrs: now, matches: role.length };
}

/* ---------- Profile as an SVG image (on screen and for saving) ---------- */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function cardSvg(card, { name, positionLabel, sportLabel, sportColor }) {
  const W = 600, H = 840;
  const F = "Inter,'Helvetica Neue',Helvetica,Arial,sans-serif";
  const display = (name || "Player").slice(0, 18);
  const bandCol = BAND_COLOR[card.band];
  const n = card.attrs.length;

  // radar
  const cx = 300, cy = 470, R = 150;
  const pt = (i, f) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n, 3);
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const poly = (f) => card.attrs.map((_, i) => pt(i, f).map((v) => v.toFixed(1)).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1].map((f) =>
    `<polygon points="${poly(f)}" fill="none" stroke="#2a3039" stroke-width="${f === 1 ? 1.5 : 1}"/>`).join("");
  const spokes = card.attrs.map((_, i) => { const [x, y] = pt(i, 1); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#2a3039"/>`; }).join("");
  const shape = card.attrs.map((a, i) => pt(i, Math.max(0.06, a.rating / 99)).map((v) => v.toFixed(1)).join(",")).join(" ");
  const dots = card.attrs.map((a, i) => { const [x, y] = pt(i, Math.max(0.06, a.rating / 99)); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${sportColor}"/>`; }).join("");
  const labels = card.attrs.map((a, i) => {
    const [x, y] = pt(i, 1.24);
    const anchor = Math.abs(x - cx) < 10 ? "middle" : x > cx ? "start" : "end";
    return `<text x="${x.toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="${anchor}" font-family="${F}" font-size="17" font-weight="600" fill="#a3abb6">${esc(a.label)}</text>` +
      `<text x="${x.toFixed(1)}" y="${(y + 16).toFixed(1)}" text-anchor="${anchor}" font-family="${F}" font-size="20" font-weight="700" fill="${BAND_COLOR[pctBand(a.rating)]}">${a.rating}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" rx="36" fill="#13161b"/>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="35" fill="none" stroke="#252a32" stroke-width="2"/>
<rect x="48" y="44" width="56" height="6" rx="3" fill="${sportColor}"/>
<text x="48" y="80" font-family="${F}" font-size="15" font-weight="600" letter-spacing="2" fill="#6f7782">PLAYER PROFILE</text>
<text x="48" y="132" font-family="${F}" font-size="${display.length > 15 ? 30 : display.length > 12 ? 36 : 46}" font-weight="800" fill="#eceef1">${esc(display)}</text>
<text x="48" y="170" font-family="${F}" font-size="21" font-weight="500" fill="#a3abb6">${esc(positionLabel)} · ${esc(sportLabel)}</text>
<rect x="412" y="58" width="140" height="112" rx="20" fill="${bandCol}"/>
<text x="482" y="128" text-anchor="middle" font-family="${F}" font-size="50" font-weight="800" fill="#0b0d10">${card.rating.toFixed(1)}</text>
<text x="482" y="156" text-anchor="middle" font-family="${F}" font-size="14" font-weight="700" fill="#0b0d10" opacity="0.7">RATING</text>
<line x1="48" y1="214" x2="552" y2="214" stroke="#252a32" stroke-width="2"/>
${rings}${spokes}
<polygon points="${shape}" fill="${sportColor}" fill-opacity="0.22" stroke="${sportColor}" stroke-width="3" stroke-linejoin="round"/>
${dots}${labels}
<line x1="48" y1="740" x2="552" y2="740" stroke="#252a32" stroke-width="2"/>
<text x="48" y="786" font-family="${F}" font-size="16" font-weight="500" fill="#6f7782">Average of last ${Math.min(card.matches, RECENT)} ${Math.min(card.matches, RECENT) === 1 ? "match" : "matches"} · percentile vs role</text>
<g transform="translate(470,758) scale(0.32)">
  <g fill="#5f7fb5"><rect x="18" y="140" width="32" height="42" rx="4"/><rect x="58" y="112" width="32" height="70" rx="4"/><rect x="98" y="80" width="32" height="102" rx="4" opacity="0.72"/></g>
  <g transform="skewX(-12) translate(8,0)" fill="#c8ff3d"><polygon points="100,18 126,18 188,96 162,96"/><polygon points="188,18 162,18 100,96 126,96"/></g>
</g>
</svg>`;
}

export function svgDataUrl(svg) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// Turns the profile into a PNG and shares it (phone) or downloads it (computer).
export async function saveCardImage(svg, fileName = "athletix-profile.png") {
  const img = new Image();
  img.src = svgDataUrl(svg);
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1680;
  canvas.getContext("2d").drawImage(img, 0, 0, 1200, 1680);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("Couldn't create the image.");

  const file = typeof File !== "undefined" ? new File([blob], fileName, { type: "image/png" }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My AthletiX profile" });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "downloaded";
}
