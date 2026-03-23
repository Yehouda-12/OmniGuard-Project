import axios from "axios"

export default function AlertHistory({ alerts, onDelete, token }) {
  const handleDelete = async (id) => {
    try {
      await axios.delete(`http://localhost:8000/api/alerts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      onDelete()
    } catch (e) {
      console.error("Delete error:", e)
    }
  }

  return (
    <div className="alert-list">
      {alerts.length === 0 && (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
          No alerts yet
        </div>
      )}
      {alerts.map((alert, i) => (
        <div key={alert._id || i} className={`alert-item ${alert.type === "unknownFace" ? "alert-item--danger" : ""}`}>
          <div className="alert-thumb">
            {alert.image && <img src={alert.image} alt="capture" />}
          </div>
          <div className="alert-info">
            <div className="alert-cam">{alert.cameraName}</div>
            <div className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</div>
            <div className={`alert-type ${alert.type === "unknownFace" ? "alert-type--danger" : "alert-type--safe"}`}>
              {alert.type === "unknownFace" ? "INTRUSION DETECTED" : "PERSON DETECTED"}
            </div>
            <button className="alert-delete" onClick={() => handleDelete(alert._id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
