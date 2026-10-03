import { ImageResponse } from "next/og";

export const alt = "hackshop: give your AI agent a body";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0a0a", color: "#f4f4f2", padding: "72px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 800 }}>
        <div style={{ display: "flex", width: 18, height: 18, borderRadius: 5, background: "#ff7a00" }} />
        hackshop
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", color: "#ff7a00", fontSize: 26, textTransform: "uppercase", letterSpacing: 5 }}>Muse gadgets · boards · build steps</div>
        <div style={{ display: "flex", maxWidth: 1000, fontSize: 84, lineHeight: 1.0, fontWeight: 800 }}>Give your AI agent a body.</div>
        <div style={{ display: "flex", color: "#a3a39d", fontSize: 30 }}>Start a build, or point your agent at hackshop.dev</div>
      </div>
    </div>,
    size,
  );
}
