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
  
  // NOUVEAU : État pour le flux vidéo venant du script Python
  const [liveFrame, setLiveFrame] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    // 1. Rejoindre la Room privée dès la connexion
    const onConnect = () => {
      if (user?.id) {
        socket.emit("join", user.id)
        console.log("🏠 Joined room:", user.id)
      }
    }

    if (socket.connected) onConnect()
    socket.on("connect", onConnect)

    // 2. Recevoir le flux vidéo direct du script Python
    socket.on("stream_to_dashboard", (data) => {
      setLiveFrame(data.image)
    })

    // 3. Résultat de l'analyse IA
    socket.on("detection_result", (data) => {
      if (data.isUnknown) {
        setToasts(prev => [...prev, { ...data, id: Date.now() }])
        fetchAlerts() // Rafraîchir la liste à gauche
        fetchStats()
      }
    })

    // Legacy — garde pour compatibilité
    socket.on("alert_received", (data) => {
      if (data.success) {
        fetchAlerts()
        fetchStats()
      }
    })

    return () => {
      socket.off("connect", onConnect)
      socket.off("stream_to_dashboard")
      socket.off("detection_result")
      socket.off("alert_received")
    }
  }, [user?.id])

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

  // --- Tes fonctions fetch restent identiques ---
  const fetchCameras = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/cameras", config)
      setCameras(res.data)
    } catch (e) { console.error("Cameras error:", e) }
  }

  const fetchStats = async () => {
    try {
      const res = await axios.get(`http://localhost:8000/api/stats/summary?user_id=${user?.id || "test"}`, config)
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
      const res = await axios.get(`http://localhost:8000/api/stats/hourly?user_id=${user?.id || "test"}`, config)
      setHourlyData(res.data)
    } catch (e) { console.error("Hourly error:", e) }
  }

  const fetchDaily = async () => {
    try {
      const res = await axios.get(`http://localhost:8000/api/stats/daily?user_id=${user?.id || "test"}`, config)
      setDailyData(res.data)
    } catch (e) { console.error("Daily error:", e) }
  }

  const fetchCameraStats = async () => {
    try {
      const res = await axios.get(`http://localhost:8000/api/stats/cameras?user_id=${user?.id || "test"}`, config)
      setCameraStats(res.data)
    } catch (e) { console.error("Camera stats error:", e) }
  }

  const handleExportCSV = () => { window.open(`http://localhost:8000/api/stats/csv?user_id=${user?.id || "test"}`, "_blank") }

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
      <header className="topbar">
        <div className="topbar-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b8cf5" strokeWidth="1.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <circle cx="12" cy="11" r="1.5" fill="#4b8cf5" stroke="none"/>
          </svg>
          <div className="logo">OmniGuard</div>
          <span className="topbar-sub">AI Sentinel</span>
        </div>
        <div className="topbar-right">
          <span className="status-pill">
            <span className={`status-dot ${surveillance || liveFrame ? "" : "status-dot--off"}`}></span>
            {surveillance || liveFrame ? "Surveillance Active" : "Standby"}
          </span>
          <button className="topbar-user" onClick={() => navigate("/settings")}>
            {user?.name || "User"} · Settings
          </button>
          <button className="topbar-user" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className="sidebar">
          {navItems.map(({ id, label }) => (
            <button key={id} className={`nav-item ${activePage === id ? "nav-item--active" : ""}`} onClick={() => setActivePage(id)}>{label}</button>
          ))}
          <div className="sidebar-divider"/>
          <button className="nav-item" onClick={handleExportCSV}>Export CSV</button>
          <button className="nav-item nav-item--logout" onClick={handleLogout}>Logout</button>
        </aside>

        <main className="main-content">
          <div className="cam-connect">
            <select
              className="auth-input"
              style={{ flex: 1 }}
              value={selectedCam?.id || "webcam"}
              onChange={e => {
                const cam = allCamOptions.find(c => c.id === e.target.value)
                setSelectedCam(cam)
                setSurveillance(false)
                setLiveFrame(null) // Reset le flux python au changement
              }}
            >
              {allCamOptions.map(cam => (
                <option key={cam.id} value={cam.id}>
                  {cam.name}{cam.url ? ` — ${cam.url}` : " (laptop/USB)"}
                </option>
              ))}
            </select>
          </div>

          <div className="section-label">Live Feed</div>
          <div className="camera-wrapper">
            {/* PRIORITÉ 1 : Flux direct du Script Python Desktop */}
            {liveFrame ? (
              <img src={liveFrame} alt="Live Python Feed" style={{ width: "100%", borderRadius: "8px" }} />
            ) : surveillance ? (
              /* PRIORITÉ 2 : Caméra interne du navigateur (Si script desktop éteint) */
              <Camera
                userId={user?.id || "test"}
                authorizedFaces={authorizedFaces}
                ipCameraUrl={selectedCam?.url || null}
                cameraName={selectedCam?.name || "Webcam"}
                cameraId={selectedCam?.id}
              />
            ) : (
              <div className="cam-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1">
                  <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
                <p>Lancez le script bureau ou cliquez sur Start</p>
                <button className="auth-btn" onClick={() => setSurveillance(true)} style={{marginTop: 10, width: 'auto'}}>Start Browser Cam</button>
              </div>
            )}
          </div>

          {/* Ton accordéon de statistiques reste ici... */}
          <div className="accordion">
             {/* ... contenu identique ... */}
             <div className="accordion-header" onClick={() => setStatsOpen(o => !o)}>
               <span>Statistics — {stats.todayAlerts ?? 0} alerts today</span>
               <span className={`accordion-arrow ${statsOpen ? "accordion-arrow--open" : ""}`}>▼</span>
             </div>
             {statsOpen && (
               <div className="accordion-body">
                 {/* ... Tes cartes et graphiques ... */}
               </div>
             )}
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