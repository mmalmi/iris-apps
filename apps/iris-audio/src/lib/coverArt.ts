export function coverArtDataUrl(seed: string, accent: string, secondaryAccent: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" role="img" aria-label="${seed}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="${secondaryAccent}" />
        </linearGradient>
      </defs>
      <rect width="300" height="300" rx="32" fill="url(#bg)" />
      <circle cx="84" cy="82" r="54" fill="rgba(255,255,255,0.18)" />
      <circle cx="236" cy="210" r="72" fill="rgba(15,23,42,0.18)" />
      <path d="M44 196C88 142 150 144 256 78" stroke="rgba(255,255,255,0.55)" stroke-width="12" stroke-linecap="round" />
      <path d="M48 230C112 184 174 184 250 126" stroke="rgba(15,23,42,0.4)" stroke-width="8" stroke-linecap="round" />
      <text x="34" y="266" fill="white" font-size="58" font-family="Georgia, serif" font-weight="700">${seed}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
