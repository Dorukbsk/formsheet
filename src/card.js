/* ============================================================
   AthletiX — player card ratings + shareable image
   Pure logic, no React.
   ============================================================ */

const ATTRS = {
  football: [
    { code: "SHO", label: "Shooting", m: ["goals", "shotAcc"] },
    { code: "PAS", label: "Passing", m: ["passAcc"] },
    { code: "CRE", label: "Creativity", m: ["keyPasses", "assists"] },
    { code: "DEF", label: "Defending", m: ["tackles", "intercept"] },
    { code: "PHY", label: "Physical", m: ["duelsWon", "distance"] },
    { code: "CON", label: "Control", m: ["turnovers"] },
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

export const RECENT = 5; // card uses your last 5 matches in this sport and role

const toRating = (pct) => Math.max(40, Math.min(99, Math.round(40 + pct * 0.59)));

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
    if (vals.length) out.push({ code: a.code, label: a.label, rating: toRating(vals.reduce((x, y) => x + y, 0) / vals.length) });
  });
  return out;
}

export function tierOf(overall) {
  if (overall >= 75) return "gold";
  if (overall >= 65) return "silver";
  return "bronze";
}

export function buildCard(sessions, sport) {
  const mine = sessions.filter((s) => s.sport === sport && Array.isArray(s.rows) && s.rows.length);
  if (!mine.length) return null;
  const position = mine[mine.length - 1].position;
  const role = mine.filter((s) => s.position === position);
  const attrs = (sport === "football" && position === "GK") ? ATTRS.footballGK : ATTRS[sport];

  const now = rate(role.slice(-RECENT), attrs);
  if (!now.length) return null;
  const overall = Math.round(now.reduce((x, a) => x + a.rating, 0) / now.length);

  let delta = null;
  if (role.length > 1) {
    const before = rate(role.slice(0, -1).slice(-RECENT), attrs);
    const map = Object.fromEntries(before.map((a) => [a.code, a.rating]));
    now.forEach((a) => { if (map[a.code] !== undefined) a.delta = a.rating - map[a.code]; });
    if (before.length) delta = overall - Math.round(before.reduce((x, a) => x + a.rating, 0) / before.length);
  }

  return { sport, position, overall, delta, tier: tierOf(overall), attrs: now, matches: role.length };
}

/* ---------- Card as an SVG image (used on screen and for saving) ---------- */

const TIERS = {
  gold: { a: "#fbe38a", b: "#c9952e", ink: "#2a1c02", line: "#8a6414" },
  silver: { a: "#eef3f9", b: "#97a6bb", ink: "#151d2a", line: "#5d6b80" },
  bronze: { a: "#f2bd8a", b: "#9a5a28", ink: "#2a1405", line: "#6d3d17" },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function cardSvg(card, { name, positionLabel, sportLabel, sportColor }) {
  const t = TIERS[card.tier];
  const W = 600, H = 840;
  const shape = "M60,20 L540,20 L580,70 L580,690 L300,820 L20,690 L20,70 Z";
  const font = "'Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif";
  const display = (name || "Player").toUpperCase().slice(0, 16);
  const nameSize = display.length > 11 ? 44 : 56;

  const cols = [card.attrs.slice(0, 3), card.attrs.slice(3, 6)];
  const attrRows = cols.map((col, ci) => col.map((a, ri) => {
    const x = ci === 0 ? 110 : 340;
    const y = 560 + ri * 58;
    return `<text x="${x}" y="${y}" font-family="${font}" font-weight="900" font-size="40" fill="${t.ink}">${a.rating}</text>` +
      `<text x="${x + 70}" y="${y}" font-family="${font}" font-weight="700" font-size="30" fill="${t.ink}" opacity="0.85">${a.code}</text>`;
  }).join("")).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${t.a}"/><stop offset="1" stop-color="${t.b}"/></linearGradient>
  <clipPath id="c"><path d="${shape}"/></clipPath>
</defs>
<path d="${shape}" fill="url(#g)"/>
<g clip-path="url(#c)">
  <polygon points="380,20 600,20 600,330" fill="${sportColor}" opacity="0.9"/>
  <polygon points="0,560 0,840 220,840" fill="#ffffff" opacity="0.12"/>
</g>
<path d="${shape}" fill="none" stroke="${t.line}" stroke-width="6"/>
<text x="80" y="150" font-family="${font}" font-weight="900" font-size="120" fill="${t.ink}">${card.overall}</text>
<text x="86" y="200" font-family="${font}" font-weight="900" font-size="38" fill="${t.ink}">${esc(card.position)}</text>
<text x="86" y="240" font-family="${font}" font-weight="700" font-size="22" fill="${t.ink}" opacity="0.8">${esc(sportLabel.toUpperCase())}</text>
<g transform="translate(420,60) scale(0.62)">
  <g fill="${t.ink}" opacity="0.55"><rect x="18" y="140" width="32" height="42" rx="4"/><rect x="58" y="112" width="32" height="70" rx="4"/><rect x="98" y="80" width="32" height="102" rx="4"/></g>
  <g transform="skewX(-12) translate(8,0)" fill="#0b1d3a"><polygon points="100,18 126,18 188,96 162,96"/><polygon points="188,18 162,18 100,96 126,96"/></g>
</g>
<text x="300" y="${display.length > 11 ? 420 : 425}" text-anchor="middle" font-family="${font}" font-weight="900" font-style="italic" font-size="${nameSize}" fill="${t.ink}">${esc(display)}</text>
<text x="300" y="462" text-anchor="middle" font-family="${font}" font-weight="700" font-size="22" fill="${t.ink}" opacity="0.8">${esc(positionLabel.toUpperCase())}</text>
<line x1="90" y1="495" x2="510" y2="495" stroke="${t.line}" stroke-width="3"/>
<line x1="300" y1="515" x2="300" y2="680" stroke="${t.line}" stroke-width="3"/>
${attrRows}
<text x="300" y="760" text-anchor="middle" font-family="${font}" font-weight="900" font-style="italic" font-size="26" fill="${t.ink}">ATHLETI<tspan fill="#0b1d3a">X</tspan></text>
</svg>`;
}

export function svgDataUrl(svg) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// Turns the card into a PNG and shares it (phone) or downloads it (computer).
export async function saveCardImage(svg, fileName = "athletix-card.png") {
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
      await navigator.share({ files: [file], title: "My AthletiX card" });
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
