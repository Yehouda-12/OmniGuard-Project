import { useState } from "react"
import axios from "axios"
 
export default function AlertHistory({ alerts, onDelete, token }) {
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState(null)
 
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this alert?")) return
    setDeleting(id)
    try {
      await axios.delete(`http://localhost:8000/api/alerts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      onDelete()
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || "Could not delete"))
    } finally {
      setDeleting(null)
    }
  }
 
  if (alerts.length === 0) {
    return (
      <div className="alert-list">
        <div className="settings-empty">No alerts yet</div>
      </div>
    )
  }
 
  return (
    <div className="alert-list">
      {alerts.map((alert) => {
        const id = alert.id || alert._id
        const isExpanded = expanded === id
        const isDanger = alert.type === "unknownFace"
 
        return (
          <div
            key={id}
            className={`alert-item ${isDanger ? "alert-item--danger" : ""}`}
            onClick={() => setExpanded(isExpanded ? null : id)}
            style={{ cursor: "pointer" }}
          >
            {/* Thumbnail */}
            <div className="alert-thumb">
              {alert.image
                ? <img src={alert.image} alt="capture" />
                : <div className="alert-thumb-placeholder" />
              }
            </div>
 
            {/* Info */}
            <div className="alert-info">
              <div className="alert-cam">{alert.cameraName}</div>
              <div className="alert-time">
                {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className={`alert-type ${isDanger ? "alert-type--danger" : "alert-type--safe"}`}>
                {isDanger ? "INTRUSION DETECTED" : "PERSON DETECTED"}
              </div>
 
              {/* Expanded view */}
              {isExpanded && (
                <div className="alert-expanded" onClick={e => e.stopPropagation()}>
                  {alert.image && (
                    <img src={alert.image} alt="full capture" className="alert-expanded-img" />
                  )}
                  <div className="alert-expanded-date">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                  <button
                    className="alert-delete"
                    onClick={() => handleDelete(id)}
                    disabled={deleting === id}
                  >
                    {deleting === id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}