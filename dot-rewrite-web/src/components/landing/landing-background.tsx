// Soft pastel wash behind the marketing pages, in the spirit of Apple's
// Education Store hero: a few large, heavily blurred color fields
// (blue / lavender / peach / mint) that slowly drift and melt into white
// further down. Purely decorative: absolutely positioned,
// pointer-events-none, and clipped so the blur never causes horizontal
// scroll. Drift is disabled under prefers-reduced-motion (globals.css).

export function LandingBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[1100px] overflow-hidden"
    >
      {/* Base wash: faint top tint fading to white. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F3F6FF] via-[#FAFBFF] to-white" />

      {/* Color fields. */}
      <div className="animate-drift-a absolute -top-40 left-[-10%] h-[620px] w-[620px] rounded-full bg-[#B9D8FF] opacity-70 blur-[120px]" />
      <div className="animate-drift-b absolute -top-24 left-[30%] h-[560px] w-[560px] rounded-full bg-[#D9C8FF] opacity-60 blur-[130px]" />
      <div className="animate-drift-c absolute -top-32 right-[-8%] h-[600px] w-[600px] rounded-full bg-[#FFD3C2] opacity-60 blur-[130px]" />
      <div className="animate-drift-b absolute top-[300px] left-[12%] h-[420px] w-[420px] rounded-full bg-[#C6F1E4] opacity-50 blur-[120px]" />
      <div className="animate-drift-a absolute top-[260px] right-[14%] h-[440px] w-[440px] rounded-full bg-[#FFD6EC] opacity-45 blur-[120px]" />

      {/* Fade the bottom edge into the page so there's no seam. */}
      <div className="absolute inset-x-0 bottom-0 h-[420px] bg-gradient-to-b from-transparent to-white" />
    </div>
  );
}
