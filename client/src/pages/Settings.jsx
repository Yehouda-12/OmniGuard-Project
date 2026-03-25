import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import axios from "axios"
import FaceCapture from "../components/FaceCapture"

export default function Settings() {
  const navigate = useNavigate()
  const token = localStorage.getItem("token")
  const config = { headers: { Authorization: `Bearer ${token}` } }

  const [cameras, setCameras] = useState([])
  const [newCamera, setNewCamera] = useState({ name: "", url: "" })
  const [alerts, setAlerts] = useState({ unknownFace: true, motion: true, multiplePeople: false })
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [capturingForCam, setCapturingForCam] = useState(null) // camera id

  useEffect(() => {
    if (!token) { navigate("/login"); return }
    fetchCameras()
  }, [])

  const fetchCameras = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/cameras`, config)
      setCameras(res.data)
    } catch (e) { console.error("Error loading cameras", e) }
  }

  const addCamera = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/cameras`, newCamera, config)
      setCameras([...cameras, res.data])
      setNewCamera({ name: "", url: "" })
      setMessage("Camera added!")
      setError("")
    } catch (e) { setError("Error adding camera") }
  }

  const removeCamera = async (id) => {
    if (!window.confirm("Remove this camera?")) return
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/cameras/${id}`, config)
      setCameras(cameras.filter(c => c.id !== id))
      setMessage("Camera removed")
    } catch (e) { setError("Error removing camera") }
  }

  const handleFaceCaptured = async ({ name, descriptor }) => {
    const cam = cameras.find(c => c.id === capturingForCam)
    if (!cam) return

    const updatedFaces = [
      ...(cam.authorizedFaces || []),
      { name, descriptor }
    ]

    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/cameras/${cam.id}`, {
        name: cam.name,
        url: cam.url,
        authorizedFaces: updatedFaces
      }, config)

      setCameras(cameras.map(c =>
        c.id === cam.id ? { ...c, authorizedFaces: updatedFaces } : c
      ))
      setCapturingForCam(null)
      setMessage(`Face "${name}" added to ${cam.name}!`)
    } catch (e) {
      setError("Error saving face")
    }
  }

  const removeFace = async (camId, faceIndex) => {
    const cam = cameras.find(c => c.id === camId)
    if (!cam) return

    const updatedFaces = cam.authorizedFaces.filter((_, i) => i !== faceIndex)

    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/cameras/${camId}`, {
        name: cam.name,
        url: cam.url,
        authorizedFaces: updatedFaces
      }, config)

      setCameras(cameras.map(c =>
        c.id === camId ? { ...c, authorizedFaces: updatedFaces } : c
      ))
      setMessage("Face removed")
    } catch (e) { setError("Error removing face") }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-title">System Configuration</div>
        <button className="topbar-user" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </button>
      </div>

      {message && <div className="settings-msg settings-msg--success">{message}</div>}
      {error   && <div className="settings-msg settings-msg--error">{error}</div>}

      {/* ── Face Capture Modal ── */}
      {capturingForCam && (
        <div className="face-capture-overlay">
          <FaceCapture
            onCapture={handleFaceCaptured}
            onCancel={() => setCapturingForCam(null)}
          />
        </div>
      )}

      <div className="settings-grid">

        {/* ── Alert Triggers ── */}
        <div className="settings-card">
          <div className="settings-card-title">Alert Triggers</div>
          <div className="settings-checks">
            {[
              { name: "unknownFace",    label: "Unknown face detected" },
              { name: "motion",         label: "Motion detected" },
              { name: "multiplePeople", label: "Multiple people (crowd)" },
            ].map(({ name, label }) => (
              <label key={name} className="settings-check-row">
                <input
                  type="checkbox"
                  name={name}
                  checked={alerts[name]}
                  onChange={e => setAlerts({ ...alerts, [name]: e.target.checked })}
                  className="settings-checkbox"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* ── Add Camera ── */}
        <div className="settings-card">
          <div className="settings-card-title">Add Camera</div>
          <form onSubmit={addCamera} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="auth-field">
              <label className="auth-label">Camera Name</label>
              <input
                className="auth-input"
                type="text"
                placeholder="e.g. Salon"
                value={newCamera.name}
                onChange={e => setNewCamera({ ...newCamera, name: e.target.value })}
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">URL</label>
              <input
                className="auth-input"
                type="text"
               placeholder="http://192.168.x.x:8080/video — leave empty for built-in webcam"
                value={newCamera.url}
                onChange={e => setNewCamera({ ...newCamera, url: e.target.value })}
                
              />
            </div>
            <button className="auth-btn" type="submit">+ Add Camera</button>
          </form>
        </div>

        {/* ── Camera list with faces ── */}
        <div className="settings-card settings-card--full">
          <div className="settings-card-title">Cameras & Authorized Faces</div>

          {cameras.length === 0 && (
            <div className="settings-empty">No cameras added yet</div>
          )}

          {cameras.map(cam => (
            <div key={cam.id} className="settings-cam-block">
              {/* Camera header */}
              <div className="settings-cam-item">
                <div className="settings-cam-info">
                  <div className="settings-cam-name">{cam.name}</div>
                  <div className="settings-cam-url">{cam.url}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="auth-btn"
                    style={{ width: "auto", padding: "5px 12px", fontSize: 11 }}
                    onClick={() => setCapturingForCam(cam.id)}
                  >
                    + Add Face
                  </button>
                  <button
                    className="settings-btn-danger"
                    onClick={() => removeCamera(cam.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Authorized faces */}
              <div className="settings-faces">
                {(!cam.authorizedFaces || cam.authorizedFaces.length === 0) && (
                  <div className="settings-faces-empty">
                    No authorized faces — everyone triggers alerts
                  </div>
                )}
                {cam.authorizedFaces?.map((face, i) => (
                  <div key={i} className="settings-face-item">
                    <div className="settings-face-avatar">
                      {face.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="settings-face-name">{face.name}</div>
                    <button
                      className="settings-btn-danger"
                      onClick={() => removeFace(cam.id, i)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}