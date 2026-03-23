import { useState, useEffect } from "react"
import axios from "axios"

export default function AlertHistory() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 1. Récupération du token depuis le localStorage
  const token = localStorage.getItem("token")

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        // 2. Ajout du header Authorization pour la récupération
        const response = await axios.get("http://localhost:8000/api/alerts", {
          headers: { Authorization: `Bearer ${token}` }
        })
        setAlerts(response.data)
      } catch (err) {
        setError("Failed to load alerts history.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchAlerts()
    } else {
      setError("No authorization token found. Please login.")
      setLoading(false)
    }
  }, [token]) 

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this alert?")) return

    try {
      // 3. Ajout du header Authorization pour la suppression
      await axios.delete(`http://localhost:8000/api/alerts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      setAlerts(alerts.filter(alert => alert._id !== id && alert.id !== id))
    } catch (err) {
      alert("Error deleting alert: " + (err.response?.data?.detail || "Unauthorized"))
    }
  }

  if (loading) return <div className="history-container">Loading data...</div>
  if (error) return <div className="history-container" style={{ color: "#ff3355" }}>{error}</div>

  return (
    <div className="history-container">
      <h1 className="history-title">Security Alert Logs</h1>

      {alerts.length === 0 ? (
        <div className="empty-state">No alerts found in the system.</div>
      ) : (
        <div className="alerts-grid">
          {alerts.map((alert) => (
            <div key={alert._id || alert.id} className="alert-card">
              <img src={alert.image} alt="Security Capture" className="alert-image" />
              
              <div className="alert-info">
                <div className="camera-name">CAM: {alert.cameraName}</div>
                <div className="timestamp">{new Date(alert.timestamp).toLocaleString()}</div>
                
                <button className="delete-btn" onClick={() => handleDelete(alert._id || alert.id)}>
                  [X] DELETE RECORD
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}