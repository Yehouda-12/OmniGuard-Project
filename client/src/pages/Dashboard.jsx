import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import axios from "axios"
import Camera from "../components/Camera"
import AlertHistory from "../components/AlertHistory"
import AlertToast from "../components/AlertToast"
import socket from "../socket"

const WEBCAM_OPTION = { id: "webcam", name: "Built-in Webcam", url: null, authorizedFaces: [] }

export default function Dashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem("token")
  const user = JSON.parse(localStorage.getItem("user") || "{}")
  const config = { headers: { Authorization: `Bearer ${token}` } }

  const [stats, setStats] = useState({ todayAlerts: 0, totalCameras: 0, totalAlerts: 0 })
  const [alerts, setAlerts] = useState([])
  const [hourlyData, setHourlyData] = useState([])
  const [dailyData, setDailyData] = useState([])
  const [cameraStats, setCameraStats] = useState([])
  const [statsOpen, setStatsOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const [cameras, setCameras] = useState([])
  const [selectedCam, setSelectedCam] = useState(WEBCAM_OPTION)
  const [surveillance, setSurveillance] = useState(false)
  const [activePage, setActivePage] = useState("dashboard")

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    socket.on("alert_received", (data) => {
      if (data.success) {
        fetchAlerts()
        fetchStats()
        fetchHourly()
        fetchDaily()
        fetchCameraStats()
        // Show toast for unknown face
        if (data.type === "unknownFace" || !data.type) {
          setToasts(prev => [...prev, { ...data, id: Date.now() }])
        }
      }
    })
    return () => socket.off("alert_received")
  }, [])

  const fetchAll = async () => {
    await Promise.all([
      fetchCameras(),
      fetchAlerts(),
      fetchStats(),
      fetchHourly(),
      fetchDaily(),
      fetchCameraStats()
    ])
  }

  const fetchCameras = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/cameras", config)
      setCameras(res.data)
    } catch (e) { console.error("Cameras error:", e) }
  }

  const fetchStats = async () => {
    try {
      const res = await axios.get(
        `http://localhost:8000/api/stats/summary?user_id=${user?.id || "test"}`, config
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
        `http://localhost:8000/api/stats/hourly?user_id=${user?.id || "test"}`, config
      )
      setHourlyData(res.data)
    } catch (e) { console.error("Hourly error:", e) }
  }

  const fetchDaily = async () => {
    try {
      const res = await axios.get(
        `http://localhost:8000/api/stats/daily?user_id=${user?.id || "test"}`, config
      )
      setDailyData(res.data)
    } catch (e) { console.error("Daily error:", e) }
  }

  const fetchCameraStats = async () => {
    try {
      const res = await axios.get(
        `http://localhost:8000/api/stats/cameras?user_id=${user?.id || "test"}`, config
      )
      setCameraStats(res.data)
    } catch (e) { console.error("Camera stats error:", e) }
  }

  const handleExportCSV = () => {
    window.open(
      `http://localhost:8000/api/stats/csv?user_id=${user?.id || "test"}`,
      "_blank"
    )
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  const allCamOptions = [WEBCAM_OPTION, ...cameras]
  const authorizedFaces = selectedCam?.authorizedFaces?.map(f => f.descriptor) || []
  const totalAuthFaces = cameras.reduce((acc, c) => acc + (c.authorizedFaces?.length || 0), 0)

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
          <button className="nav-item" onClick={handleExportCSV}>Export CSV</button>
          <button className="nav-item nav-item--logout" onClick={handleLogout}>Logout</button>
        </aside>

        {/* ── Main ── */}
        <main className="main-content">

          {/* Camera selector */}
          <div className="cam-connect">
            <select
              className="auth-input"
              style={{ flex: 1 }}
              value={selectedCam?.id || "webcam"}
              onChange={e => {
                const cam = allCamOptions.find(c => c.id === e.target.value)
                setSelectedCam(cam)
                setSurveillance(false)
              }}
            >
              {allCamOptions.map(cam => (
                <option key={cam.id} value={cam.id}>
                  {cam.name}{cam.url ? ` — ${cam.url}` : " (laptop/USB)"}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center", whiteSpace: "nowrap" }}>
              {authorizedFaces.length} face{authorizedFaces.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Surveillance buttons */}
          <div className="cam-actions">
            <button
              className="auth-btn"
              style={{ width: "auto", padding: "9px 20px" }}
              onClick={() => setSurveillance(true)}
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
              onClick={() => setSurveillance(false)}
              disabled={!surveillance}
            >
              ■ Stop
            </button>
          </div>

          {/* Camera feed */}
          <div className="section-label">Live Feed</div>
          <div className="camera-wrapper">
            {surveillance ? (
              <Camera
                userId={user?.id || "test"}
                authorizedFaces={authorizedFaces}
                ipCameraUrl={selectedCam?.url || null}
                cameraName={selectedCam?.name || "Webcam"}
              />
            ) : (
              <div className="cam-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1">
                  <path d="M23 7l-7 5 7 5V7z"/>
                  <rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
                <p>Press Start Surveillance to activate</p>
              </div>
            )}
          </div>

          {/* Stats accordion */}
          <div className="accordion">
            <div
              className="accordion-header"
              onClick={() => setStatsOpen(o => !o)}
            >
              <span>
                Statistics — {stats.todayAlerts ?? 0} alerts today · {cameras.length} cameras · {totalAuthFaces} auth faces
              </span>
              <span className={`accordion-arrow ${statsOpen ? "accordion-arrow--open" : ""}`}>▼</span>
            </div>

            {statsOpen && (
              <div className="accordion-body">
                {/* Stat cards */}
                <div className="stats-grid" style={{ marginBottom: 14 }}>
                  <div className="stat-card">
                    <div className="stat-value stat-value--red">{stats.todayAlerts ?? 0}</div>
                    <div className="stat-label">Alerts Today</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value stat-value--blue">{cameras.length}</div>
                    <div className="stat-label">IP Cameras</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value stat-value--red">{stats.totalAlerts ?? 0}</div>
                    <div className="stat-label">Total Alerts</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value stat-value--green">{totalAuthFaces}</div>
                    <div className="stat-label">Auth Faces</div>
                  </div>
                </div>

                {/* Charts */}
                <div className="charts-row">
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

                  <div className="chart-card">
                    <div className="chart-title">Last 7 Days</div>
                    <div className="chart-bars">
                      {dailyData.slice(-7).map((d, i) => {
                        const max = Math.max(...dailyData.map(x => x.count), 1)
                        const pct = Math.round((d.count / max) * 100)
                        const label = new Date(d.date).toLocaleDateString("en", { weekday: "short" })
                        return (
                          <div key={i} className="chart-col">
                            <div className={`chart-bar ${d.count > 0 ? "chart-bar--active" : ""}`} style={{ height: `${Math.max(pct, 4)}%` }}/>
                            <div className="chart-label">{label}</div>
                          </div>
                        )
                      })}
                      {dailyData.length === 0 && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "20px 0" }}>No data yet</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Camera stats */}
                {cameraStats.length > 0 && (
                  <div className="chart-card" style={{ marginTop: 14 }}>
                    <div className="chart-title">Alerts by Camera</div>
                    <div className="cam-stats-list">
                      {cameraStats.map((c, i) => {
                        const max = Math.max(...cameraStats.map(x => x.count), 1)
                        const pct = Math.round((c.count / max) * 100)
                        return (
                          <div key={i} className="cam-stat-row">
                            <div className="cam-stat-name">{c.cameraName}</div>
                            <div className="cam-stat-bar-wrap">
                              <div className="cam-stat-bar" style={{ width: `${pct}%` }}/>
                            </div>
                            <div className="cam-stat-count">{c.count}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
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
      {/* ── Toast notifications ── */}
      <div className="toast-container">
        {toasts.map(toast => (
          <AlertToast
            key={toast.id}
            alert={toast}
            token={token}
            onDismiss={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            onAuthorized={(name) => {
              setToasts(prev => prev.filter(t => t.id !== toast.id))
              fetchCameras()
            }}
          />
        ))}
      </div>

    </div>
  )
}