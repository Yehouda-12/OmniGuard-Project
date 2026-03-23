export default function Register({ onGoLogin }) {
  return (
    <div style={{ padding: 20, fontFamily: "monospace", background: "#0a0a0a", minHeight: "100vh", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div>
        <h2 style={{ color: "#00c8ff", marginBottom: 20 }}>OmniGuard Register</h2>
        <p style={{ color: "#3a6080" }}>Yehiel is working on this page...</p>
        <button onClick={onGoLogin} style={{ marginTop: 16, padding: "8px 16px", background: "transparent", color: "#00c8ff", border: "1px solid #00c8ff", borderRadius: 3, cursor: "pointer" }}>
          Back to Login
        </button>
      </div>
    </div>
  )
}
