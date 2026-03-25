import { useState } from "react"
import axios from "axios"
import { apiUrl } from "../lib/api"

export default function AlertHistory({ alerts, onDelete, onAuthorized, token }) {
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [addingFace, setAddingFace] = useState(null) // alert id
  const [faceName, setFaceName] = useState("")
  const [saving, setSaving] = useState(false)

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this alert?")) return
    setDeleting(id)
    try {
      await axios.delete(apiUrl(`/api/alerts/${id}`), {
        headers: { Authorization: `Bearer ${token}` }
      })
      onDelete()
    } catch (err) {
      window.alert("Error: " + (err.response?.data?.detail || "Could not delete"))
    } finally {
      setDeleting(null)
    }
  }

  const handleAddFace = async (alert) => {
    if (!faceName.trim()) return
    if (!alert.descriptor || !alert.cameraId) {
      window.alert("Face data not available for this alert")
      return
    }

    setSaving(true)
    try {
      // Get current camera
      const res = await axios.get(apiUrl("/api/cameras"), {
        headers: { Authorization: `Bearer ${token}` }
      })
      const camera = res.data.find(c => c.id === alert.cameraId)
      if (!camera) {
        window.alert("Camera not found")
        return
      }

      const updatedFaces = [
        ...(camera.authorizedFaces || []),
        { name: faceName.trim(), descriptor: alert.descriptor }
      ]

      const alreadyAuthorized = (camera.authorizedFaces || []).some((face) => {
        const current = JSON.stringify(face.descriptor || [])
        const incoming = JSON.stringify(alert.descriptor || [])
        return current === incoming
      })
      if (alreadyAuthorized) {
        setAddingFace(null)
        setFaceName("")
        onAuthorized?.()
        return
      }

      await axios.put(
        apiUrl(`/api/cameras/${alert.cameraId}`),
        { name: camera.name, url: camera.url, authorizedFaces: updatedFaces },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setAddingFace(null)
      setFaceName("")
      onAuthorized?.()
      window.alert(`✓ "${faceName}" added to authorized faces!`)
    } catch (e) {
      window.alert("Error saving face: " + e.message)
    } finally {
      setSaving(false)
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
        const isDanger = alert.type === "unknownFace"
const isKnown  = alert.type === "knownFace"
        const isExpanded = expanded === id
        const isAddingFace = addingFace === id

        return (
          <div
            key={id}
            className={`alert-item ${isDanger ? "alert-item--danger" : isKnown ? "alert-item--known" : ""}`}
          >
            {/* Main row — clickable to expand */}
            <div
              style={{ display: "flex", gap: 8, cursor: "pointer", width: "100%" }}
              onClick={() => setExpanded(isExpanded ? null : id)}
            >
              <div className="alert-thumb">
                {alert.image && (
                  <img src={alert.image} alt="capture" />
                )}
              </div>
              <div className="alert-info">
                <div className="alert-cam">{alert.cameraName}</div>
                <div className="alert-time">
                  {new Date(alert.timestamp).toLocaleTimeString([], {
                    hour: "2-digit", minute: "2-digit", second: "2-digit"
                  })}
                </div>
               <div className={`alert-type ${isDanger ? "alert-type--danger" : isKnown ? "alert-type--known" : "alert-type--safe"}`}>
  {isDanger ? "INTRUSION DETECTED" : isKnown ? "AUTHORIZED PERSON" : "PERSON DETECTED"}
</div>
              </div>
            </div>

            {/* Expanded section */}
            {isExpanded && (
              <div className="alert-expanded" onClick={e => e.stopPropagation()}>

                {/* Full photo */}
                {alert.image && (
                  <img src={alert.image} alt="full capture" className="alert-expanded-img" />
                )}

                <div className="alert-expanded-date">
                  {new Date(alert.timestamp).toLocaleString()}
                </div>

                {/* Add face section — only for unknown faces */}
                {isDanger && !isAddingFace && (
                  <button
                    className="toast-btn toast-btn--primary"
                    style={{ width: "100%", marginTop: 4 }}
                    onClick={() => {
                      setAddingFace(id)
                      setFaceName("")
                    }}
                    disabled={!alert.descriptor || !alert.cameraId}
                  >
                    + Authorize this person
                  </button>
                )}

                {/* Name input */}
                {isAddingFace && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    <input
                      className="auth-input"
                      type="text"
                      placeholder="Enter person's name..."
                      value={faceName}
                      onChange={e => setFaceName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleAddFace(alert)}
                      autoFocus
                      style={{ fontSize: 11, padding: "6px 10px" }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="toast-btn toast-btn--primary"
                        style={{ flex: 1 }}
                        onClick={() => handleAddFace(alert)}
                        disabled={!faceName.trim() || saving}
                      >
                        {saving ? "Saving..." : "✓ Save"}
                      </button>
                      <button
                        className="toast-btn"
                        onClick={() => { setAddingFace(null); setFaceName("") }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete button */}
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
        )
      })}
    </div>
  )
}
