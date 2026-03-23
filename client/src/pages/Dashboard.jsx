import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import axios from "axios"
import Camera from "../components/Camera"
import AlertHistory from "../components/AlertHistory"
import socket from "../socket"

export default function Dashboard() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem("user") || "{}")
  const token = localStorage.getItem("token")

  const [stats, setStats] = useState({ alertsToday: 0, activeCameras: 0, intruders: 0, authorizedFaces: 0 })
  const [alerts, setAlerts] = useState([])
  const [hourlyData, setHourlyData] = useState([])
  const [activePage, setActivePage] = useState("dashboard")

  useEffect(() => {
    if (!token) { navigate("/login"); return }
    fetchStats()
    fetchAlerts()
  }, [])

  useEffect(() => {
    socket.on("alert_received", (data) => {
      if (data.success) { fetchAlerts(); fetchStats() }
    })
    return () => socket.off("alert_received")
  }, [])

  const fetchStats = async () => {
    try {
      
      const res = await axios.get(`http://localhost:8000/api/stats/summary?user_id=${user?._id || "test"}`, {
  headers: { Authorization: `Bearer ${token}` }
})
      setStats(res.data)
    } catch (e) { console.error("Stats error:", e) }
  }

  const fetchAlerts = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/alerts", {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAlerts(res.data)
    } catch (e) { console.error("Alerts error:", e) }
  }
  

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  const camera = user?.cameras?.[0] || null

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "live", label: "Live View" },
    { id: "alerts", label: "Alert Logs" },
    { id: "faces", label: "Faces" },
    { id: "settings", label: "Settings" },
  ]

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-left">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4b8cf5" strokeWidth="1.2">
  {/* Shield */}
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  {/* Brain / AI nodes inside */}
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
            <span className="status-dot"></span>
            System Armed
          </span>
          <button className="topbar-user" onClick={handleLogout}>
            {user?.name || "User"} · Logout
          </button>
        </div>
      </header>

      <div className="dashboard-body">
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
          <button className="nav-item nav-item--logout" onClick={handleLogout}>Logout</button>
        </aside>

        <main className="main-content">
          <div className="section-label">Live Feed</div>
          <div className="camera-wrapper">
            <Camera
              userId={user?._id || "test"}
              authorizedFaces={camera?.authorizedFaces?.map(f => f.descriptor) || []}
              ipCameraUrl={camera?.url || null}
              cameraName={camera?.name || "Webcam"}
            />
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value stat-value--red">{stats.alertsToday}</div>
              <div className="stat-label">Alerts Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-value stat-value--blue">{stats.activeCameras || 1}</div>
              <div className="stat-label">Active Cameras</div>
            </div>
            <div className="stat-card">
              <div className="stat-value stat-value--red">{stats.intruders}</div>
              <div className="stat-label">Intruders</div>
            </div>
            <div className="stat-card">
              <div className="stat-value stat-value--green">{stats.authorizedFaces}</div>
              <div className="stat-label">Auth Faces</div>
            </div>
          </div>

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
                    <div className={`chart-bar ${count > 0 ? "chart-bar--active" : ""}`} style={{ height: `${Math.max(pct, 4)}%` }}/>
                    <div className="chart-label">{String(hour).padStart(2, "0")}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </main>

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