// AthletiX line icons (24×24, 1.75 stroke). Inherit colour from the text around them.
import React from "react";

const base = {
  width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
};

const PATHS = {
  football: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2l3.6 2.6-1.4 4.2H9.8L8.4 9.8z" />
      <path d="M12 3v4.2M15.6 9.8l4.6-1.4M14.2 14l2.8 4.2M9.8 14L7 18.2M8.4 9.8L3.8 8.4" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18" />
      <path d="M5.6 5.6c3 2.8 3 10 0 12.8M18.4 5.6c-3 2.8-3 10 0 12.8" />
    </>
  ),
  volleyball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12c0-4 1.6-7 4.6-8.4M12 12c-3.5 2-6.9 2.2-9 .8M12 12c3.4 2 5.3 4.9 5.2 8.2" />
      <path d="M12 12c-1.5-3-1.3-6.3.4-9M12 12c3.4-.2 6.3.9 8.6 3.6M12 12c-2 2.8-4.9 4.4-8.1 4.3" opacity=".55" />
    </>
  ),
  log: <path d="M12 5v14M5 12h14" />,
  progress: <path d="M4 19h16M6 15l4-4 3 3 5-6" />,
  card: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M12 8l2.4 4.2-2.4 4.2-2.4-4.2z" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10.5l5-3v9l-5-3" />
    </>
  ),
  training: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  flame: <path d="M12 21c-3.6 0-6-2.4-6-5.8 0-3.6 3.2-5.4 3.6-9.2 2.6 1.8 3.4 4 3.2 6.2 1.2-.6 2-1.8 2.2-3.2 1.8 1.6 3 3.8 3 6.2 0 3.4-2.4 5.8-6 5.8z" />,
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 01-8 0z" />
      <path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2" />
      <circle cx="16.8" cy="9" r="2.5" />
      <path d="M16 14.3c2.6-.2 4.4 1.5 4.9 4.6" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  share: (
    <>
      <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" />
      <path d="M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" />
    </>
  ),
};

export default function Icon({ name, size = 22, className, style }) {
  return (
    <svg {...base} width={size} height={size} className={className} style={style}>
      {PATHS[name]}
    </svg>
  );
}
