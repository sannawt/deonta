// SVG polygon mesh background — ported from the ComplianceTwin reference HTML.
export function PolygonBackground() {
  return (
    <div id="poly-bg" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a56db" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0b1428" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points="0,0 320,0 180,260" fill="url(#g1)" opacity="0.5" />
        <polygon points="320,0 700,0 520,180 200,220" fill="#1a56db" opacity="0.06" />
        <polygon points="700,0 1100,0 980,200 580,160" fill="#1a56db" opacity="0.05" />
        <polygon points="1100,0 1440,0 1440,280 960,300" fill="#1a56db" opacity="0.07" />
        <polygon points="0,260 180,260 260,500 0,520" fill="#1a56db" opacity="0.06" />
        <polygon points="180,260 520,180 600,400 300,480" fill="#1a56db" opacity="0.04" />
        <polygon points="520,180 980,200 860,420 580,460" fill="#1a56db" opacity="0.05" />
        <polygon points="980,200 1440,280 1380,520 920,480" fill="#1a56db" opacity="0.06" />
        <polygon points="0,520 260,500 340,720 0,760" fill="#1a56db" opacity="0.05" />
        <polygon points="260,500 600,400 680,620 360,700" fill="#1a56db" opacity="0.04" />
        <polygon points="600,400 860,420 940,640 680,680" fill="#1a56db" opacity="0.04" />
        <polygon points="860,420 1380,520 1320,740 940,720" fill="#1a56db" opacity="0.05" />
        <polygon points="1380,520 1440,520 1440,900 1320,900 1320,740" fill="#1a56db" opacity="0.05" />
        <polygon points="0,760 340,720 400,900 0,900" fill="#1a56db" opacity="0.06" />
        <polygon points="340,720 680,680 740,900 400,900" fill="#1a56db" opacity="0.04" />
        <polygon points="680,680 940,720 1000,900 740,900" fill="#1a56db" opacity="0.04" />
        <polygon points="940,720 1320,740 1320,900 1000,900" fill="#1a56db" opacity="0.05" />
        {/* edge lines */}
        <g stroke="#1a56db" strokeWidth="0.5" opacity="0.25">
          <line x1="0" y1="260" x2="320" y2="0" />
          <line x1="320" y1="0" x2="700" y2="0" />
          <line x1="180" y1="260" x2="520" y2="180" />
          <line x1="520" y1="180" x2="980" y2="200" />
          <line x1="980" y1="200" x2="1440" y2="280" />
          <line x1="0" y1="520" x2="260" y2="500" />
          <line x1="260" y1="500" x2="600" y2="400" />
          <line x1="600" y1="400" x2="860" y2="420" />
          <line x1="860" y1="420" x2="1380" y2="520" />
          <line x1="0" y1="760" x2="340" y2="720" />
          <line x1="340" y1="720" x2="680" y2="680" />
          <line x1="680" y1="680" x2="940" y2="720" />
          <line x1="940" y1="720" x2="1320" y2="740" />
        </g>
      </svg>
    </div>
  );
}
