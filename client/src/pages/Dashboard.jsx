import useCamera from "../hooks/useCamera"
import useFaceApi from "../hooks/useFaceApi"

export default function Dashboard({ user, onLogout }) {
  const { ready, progress, error } = useFaceApi()
  const { videoRef, canvasRef, faceCount } = useCamera({
    ready,
    authorizedFaces: [],
    userId: user?._id || "test"
  })

  return (
    <div style={{ padding: 20, fontFamily: "monospace", background: "#0a0a0a", minHeight: "100vh", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ color: "#00c8ff" }}>OmniGuard</h2>
        <button onClick={onLogout} style={{ padding: "6px 14px", background: "#ff3355", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
          Logout
        </button>
      </div>

      {/* Status IA */}
      <p style={{ color: ready ? "#00ff88" : "#ffd600", marginBottom: 16, fontSize: 13 }}>
        {ready ? "‚úÖ AI Models Ready" : `‚è≥ ${progress}% Loading...`}
        {error && <span style={{ color: "#ff3355" }}> ‚ùå {error}</span>}
      </p>

      {/* Camera feed */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <video ref={videoRef} autoPlay muted style={{ width: 640, borderRadius: 6, border: "1px solid #0e2035" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {ready && (
        <p style={{ marginTop: 10, fontSize: 13, color: "#3a6080" }}>
          Ì±§ {faceCount} face(s) detected
        </p>
      )}
    </div>
  )
}
