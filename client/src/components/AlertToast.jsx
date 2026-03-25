import { useState } from "react"
import axios from "axios"
import { apiUrl } from "../lib/api"

export default function AlertToast({ alert, onDismiss, onAuthorized, token }) {
  const [step, setStep] = useState("alert") // alert | naming
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAuthorize = async () => {
    if (!name.trim()) return
    if (!alert.descriptor || !alert.cameraId) {
      // descriptor not available yet (waiting for Pini's update)
      console.log("descriptor not available")
return
    }

    setLoading(true)
    try {
      // Get current camera data
      const res = await axios.get(
        apiUrl("/api/cameras"),
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const camera = res.data.find(c => c.id === alert.cameraId)
      if (!camera) return

      const updatedFaces = [
        ...(camera.authorizedFaces || []),
        { name: name.trim(), descriptor: alert.descriptor }
      ]

      const alreadyAuthorized = (camera.authorizedFaces || []).some((face) => {
        const current = JSON.stringify(face.descriptor || [])
        const incoming = JSON.stringify(alert.descriptor || [])
        return current === incoming
      })
      if (alreadyAuthorized) {
        onAuthorized(name.trim())
        return
      }

      await axios.put(
        apiUrl(`/api/cameras/${alert.cameraId}`),
        { name: camera.name, url: camera.url, authorizedFaces: updatedFaces },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      onAuthorized(name.trim())
    } catch (e) {
      console.error("Error authorizing face:", e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="toast toast--danger">
      <div className="toast-header">
        <div className="toast-dot"></div>
        <span className="toast-title">Unknown face detected</span>
        <button className="toast-close" onClick={onDismiss}>×</button>
      </div>

      <div className="toast-info">
        <span>{alert.cameraName}</span>
        <span>·</span>
        <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
      </div>

      {alert.image && (
        <img src={alert.image} alt="intruder" className="toast-img" />
      )}

      {step === "alert" && (
        <div className="toast-actions">
          <button
            className="toast-btn toast-btn--primary"
            onClick={() => setStep("naming")}
          >
            + Authorize this person
          </button>
          <button className="toast-btn" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      )}

      {step === "naming" && (
        <div className="toast-naming">
          <input
            className="auth-input"
            type="text"
            placeholder="Enter person's name..."
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAuthorize()}
            autoFocus
            style={{ fontSize: 12, padding: "6px 10px" }}
          />
          <div className="toast-actions">
            <button
              className="toast-btn toast-btn--primary"
              onClick={handleAuthorize}
              disabled={!name.trim() || loading}
            >
              {loading ? "Saving..." : "✓ Save"}
            </button>
            <button className="toast-btn" onClick={() => setStep("alert")}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
