// AthletiX lockup — rising bars, X mark, wordmark.
// <Logo width={340} />            full lockup on the navy panel
// <Logo width={260} panel={false} />  same lockup, no background

export default function Logo({ width = 320, panel = true }) {
  return (
    <svg
      viewBox="0 0 620 200"
      width={width}
      height={(width * 200) / 620}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="AthletiX"
      style={{ display: 'block' }}
    >
      <title>AthletiX</title>

      {panel && <rect width="620" height="200" rx="24" fill="#0b1d3a" />}

      <g transform="translate(20,10) scale(0.9)">
        <g fill={panel ? '#5f7fb5' : '#2c4a7c'}>
          <rect x="18" y="140" width="32" height="42" rx="4" />
          <rect x="58" y="112" width="32" height="70" rx="4" />
          <rect x="98" y="80" width="32" height="102" rx="4" opacity="0.72" />
        </g>
        <g transform="skewX(-12) translate(8,0)" fill="#c8ff3d">
          <polygon points="100,18 126,18 188,96 162,96" />
          <polygon points="188,18 162,18 100,96 126,96" />
        </g>
      </g>

      <g transform="translate(222,0) skewX(-9)">
        <text
          x="0"
          y="128"
          fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif"
          fontWeight="700"
          fontSize="86"
          letterSpacing="1.5"
          fill={panel ? '#f2f4f0' : '#141C26'}
        >
          Athleti
          <tspan fontSize="114" fill="#c8ff3d">X</tspan>
        </text>
      </g>
    </svg>
  )
}
