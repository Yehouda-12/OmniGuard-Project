import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import axios from "axios"
import Camera from "../components/Camera"
import AlertHistory from "../components/AlertHistory"
import socket from "../socket"

export default function Dashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem("token")
  const user = JSON.parse(localStorage.getItem("user") || "{}")
  const config = { headers: { Authorization: `Bearer ${token}` } }

  const [stats, setStats] = useState({ todayAlerts: 0, totalCameras: 0, totalAlerts: 0 })
  const [alerts, setAlerts] = useState([])
  const [hourlyData, setHourlyData] = useState([])
  const [activePage, setActivePage] = useState("dashboard")
  const [camUrl, setCamUrl] = useState("")
  const [camName, setCamName] = useState("Webcam")
  const [activeCam, setActiveCam] = useState(null)
  const [surveillance, setSurveillance] = useState(false)

  useEffect(() => {
    fetchAlerts()
    fetchStats()
    fetchHourly()
  }, [])

  useEffect(() => {
    socket.on("alert_received", (data) => {
      if (data.success) { fetchAlerts(); fetchStats(); fetchHourly() }
    })
    return () => socket.off("alert_received")
  }, [])

  const fetchStats = async () => {
    try {
      const res = await axios.get(
        `http://localhost:8000/api/stats/summary?user_id=${user?.id || "test"}`,
        config
      )
      setStats(res.data)
    } catch (e) { console.error("Stats error:", e) }
  }

  const fetchAlerts = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/alerts", config)
      setAlerts(res.data)
    } catch (e) { console.error("Alerts error:", e) }
  }

  const fetchHourly = async () => {
    try {
      const res = await axios.get(
        `http://localhost:8000/api/stats/hourly?user_id=${user?.id || "test"}`,
        config
      )
      setHourlyData(res.data)
    } catch (e) { console.error("Hourly error:", e) }
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  const handleConnect = () => {
    setActiveCam({ url: camUrl || null, name: camName })
    setSurveillance(false)
  }

  const handleStartSurveillance = () => {
    if (!activeCam) {
      setActiveCam({ url: camUrl || null, name: camName })
    }
    setSurveillance(true)
  }

  const handleStop = () => {
    setSurveillance(false)
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "live",      label: "Live View" },
    { id: "alerts",    label: "Alert Logs" },
    { id: "faces",     label: "Faces" },
  ]

  return (
    <div className="dashboard">

      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="topbar-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b8cf5" strokeWidth="1.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <circle cx="12" cy="11" r="1.5" fill="#4b8cf5" stroke="none"/>
            <circle cx="9"  cy="9"  r="1"   fill="#4b8cf5" stroke="none"/>
            <circle cx="15" cy="9"  r="1"   fill="#4b8cf5" stroke="none"/>
            <circle cx="9"  cy="13" r="1"   fill="#4b8cf5" stroke="none"/>
            <circle cx="15" cy="13" r="1"   fill="#4b8cf5" stroke="none"/>
            <line x1="12" y1="11" x2="9"  y2="9"  stroke="#4b8cf5" strokeWidth=".8"/>
            <line x1="12" y1="11" x2="15" y2="9"  stroke="#4b8cf5" strokeWidth=".8"/>
            <line x1="12" y1="11" x2="9"  y2="13" stroke="#4b8cf5" strokeWidth=".8"/>
            <line x1="12" y1="11" x2="15" y2="13" stroke="#4b8cf5" strokeWidth=".8"/>
            <line x1="9"  y1="9"  x2="15" y2="9"  stroke="#4b8cf5" strokeWidth=".8"/>
            <line x1="9"  y1="13" x2="15" y2="13" stroke="#4b8cf5" strokeWidth=".8"/>
          </svg>
          <div className="logo">OmniGuard</div>
          <span className="topbar-sub">AI Sentinel</span>
        </div>
        <div className="topbar-right">
          <span className="status-pill">
            <span className={`status-dot ${surveillance ? "" : "status-dot--off"}`}></span>
            {surveillance ? "Surveillance Active" : "Standby"}
          </span>
          <button className="topbar-user" onClick={() => navigate("/settings")}>
            {user?.name || "User"} · Settings
          </button>
          <button className="topbar-user" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-body">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              className={`nav-item ${activePage === id ? "nav-item--active" : ""}`}
              onClick={() => setActivePage(id)}
            >
              {label}
            </button>
          ))}
          <div className="sidebar-divider"/>
          <button className="nav-item" onClick={() => navigate("/settings")}>Settings</button>
          <button className="nav-item nav-item--logout" onClick={handleLogout}>Logout</button>
        </aside>

        {/* ── Main ── */}
        <main className="main-content">

          {/* Camera URL input */}
          <div className="cam-connect">
            <input
              className="auth-input"
              type="text"
              placeholder="http://192.168.x.x:8080/video (leave empty for webcam)"
              value={camUrl}
              onChange={e => setCamUrl(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              className="auth-input"
              type="text"
              placeholder="Camera name"
              value={camName}
              onChange={e => setCamName(e.target.value)}
              style={{ width: 140 }}
            />
            <button
              className="auth-btn"
              style={{ width: "auto", padding: "9px 18px" }}
              onClick={handleConnect}
            >
              Set Camera
            </button>
          </div>

          {/* Surveillance buttons */}
          <div className="cam-actions">
            <button
              className="auth-btn"
              style={{ width: "auto", padding: "9px 20px" }}
              onClick={handleStartSurveillance}
              disabled={surveillance}
            >
              ▶ Start Surveillance
            </button>
            <button
              className="auth-btn"
              style={{
                width: "auto", padding: "9px 20px",
                background: "transparent",
                borderColor: "var(--accent-red)",
                color: "var(--accent-red)",
                opacity: surveillance ? 1 : 0.4
              }}
              onClick={handleStop}
              disabled={!surveillance}
            >
              ■ Stop
            </button>
          </div>

          {/* Camera feed — only when surveillance is ON */}
          <div className="section-label">Live Feed</div>
          <div className="camera-wrapper">
            {surveillance ? (
              <Camera
                userId={user?.id || "test"}
                authorizedFaces={[]}
                ipCameraUrl={activeCam?.url || null}
                cameraName={activeCam?.name || "Webcam"}
              />
            ) : (
              <div className="cam-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1">
                  <path d="M23 7l-7 5 7 5V7z"/>
                  <rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
                <p>Press Start Surveillance to activate camera</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value stat-value--red">{stats.todayAlerts ?? 0}</div>
              <div className="stat-label">Alerts Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-value stat-value--blue">{stats.totalCameras ?? 0}</div>
              <div className="stat-label">Active Cameras</div>
            </div>
            <div className="stat-card">
              <div className="stat-value stat-value--red">{stats.totalAlerts ?? 0}</div>
              <div className="stat-label">Total Alerts</div>
            </div>
            <div className="stat-card">
              <div className="stat-value stat-value--green">{alerts.length}</div>
              <div className="stat-label">In History</div>
            </div>
          </div>

          {/* Hourly chart */}
          <div className="chart-card">
            <div className="chart-title">Alerts by Hour</div>
            <div className="chart-bars">
              {Array.from({ length: 12 }, (_, i) => {
                const hour = i + 6
                const count = hourlyData.find(d => d.hour === hour)?.count || 0
                const max = Math.max(...hourlyData.map(d => d.count), 1)
                const pct = Math.round((count / max) * 100)
                return (
                  <div key={hour} className="chart-col">
                    <div
                      className={`chart-bar ${count > 0 ? "chart-bar--active" : ""}`}
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                    <div className="chart-label">{String(hour).padStart(2, "0")}</div>
                  </div>
                )
              })}
            </div>
          </div>

        </main>

        {/* ── Alert panel ── */}
        <aside className="alert-panel">
          <div className="alert-panel-head">
            <span>Alert History</span>
            <span className="alert-count">{alerts.length}</span>
          </div>
          <AlertHistory alerts={alerts} onDelete={fetchAlerts} token={token} />
        </aside>

      </div>
    </div>
  )
}