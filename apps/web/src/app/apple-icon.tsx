import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #18181b 0%, #09090b 50%, #18181b 100%)",
          color: "#f59e0b",
          fontSize: 130,
          fontWeight: 800,
          letterSpacing: "-0.05em",
          fontFamily: "serif",
        }}
      >
        K
      </div>
    ),
    { ...size },
  );
}
