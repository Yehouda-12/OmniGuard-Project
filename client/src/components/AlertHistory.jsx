
import { useState, useEffect } from "react"
import axios from "axios"


export default function AlertHistory() {
  // State לשמירת רשימת ההתראות, סטטוס טעינה ושגיאות
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // useEffect: רץ פעם אחת כשהעמוד נטען כדי להביא נתונים
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        // ביצוע בקשת GET לשרת לקבלת כל ההתראות
        const response = await axios.get("http://localhost:8000/api/alerts")
        setAlerts(response.data) // שמירת הנתונים ב-State
      } catch (err) {
        setError("Failed to load alerts history.")
      } finally {
        setLoading(false) // סיום מצב הטעינה (גם אם הצליח וגם אם נכשל)
      }
    }

    fetchAlerts()
  }, []) // המערך הריק [] מבטיח הרצה חד-פעמית

  // פונקציה למחיקת התראה ספציפית
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this alert?")) return // וידוא מול המשתמש

    try {
      // שליחת בקשת מחיקה לשרת
      await axios.delete(`http://localhost:8000/api/alerts/${id}`)
      // עדכון ה-UI: סינון ההתראה שנמחקה מתוך הרשימה הקיימת
      setAlerts(alerts.filter(alert => alert._id !== id && alert.id !== id))
    } catch (err) {
      alert("Error deleting alert")
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

