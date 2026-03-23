
import { useState, useEffect } from "react"
import axios from "axios"
import "./Settings.css"

export default function Settings() {
  // State for user profile (Name, Email, Password)
  const [profile, setProfile] = useState({ name: "", email: "", password: "" })
    // State for cameras list and new camera input
  const [cameras, setCameras] = useState([])
  const [newCamera, setNewCamera] = useState({ name: "", url: "" })

  // State for alert checkboxes
  // הערה: אנחנו מאתחלים את זה כאובייקט עם ערכים בוליאניים (אמת/שקר)
  const [alerts, setAlerts] = useState({
    unknownFace: false,
    motion: false,    multiplePeople: false
  })

  const [message, setMessage] = useState("")

  // useEffect: טעינת נתונים ראשונית (Get Initial Data)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token")
        const config = { headers: { Authorization: `Bearer ${token}` } }

        // 1. קבלת פרטי משתמש והגדרות התראה        const userRes = await axios.get("http://localhost:8000/api/users/me", config)
        setProfile({ ...profile, name: userRes.data.name, email: userRes.data.email })
        if (userRes.data.alertSettings) setAlerts(userRes.data.alertSettings)

        // 2. קבלת רשימת המצלמות
        const camRes = await axios.get("http://localhost:8000/api/cameras", config)
        setCameras(camRes.data)
      } catch (err) {
        console.error("Error loading settings", err)
      }
    }
    fetchData()
  }, [])

  // Handle Checkbox Change (טיפול בשינוי צ'קבוקס)
  const handleAlertChange = async (e) => {
    const { name, checked } = e.target
    
    // עדכון ה-State המקומי
    // ב-Checkbox אנחנו משתמשים ב-checked במקום ב-value!
    const updatedAlerts = { ...alerts, [name]: checked }
    setAlerts(updatedAlerts)

    // שליחת העדכון לשרת (API)
    try {
      const token = localStorage.getItem("token")
      await axios.put("http://localhost:8000/api/users/settings", { alertSettings: updatedAlerts }, {
        headers: { Authorization: `Bearer ` }
      })    } catch (err) {
      console.error("Failed to update alert settings")
    }
  }

  // Handle Add Camera
  const addCamera = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem("token")
      const res = await axios.post("http://localhost:8000/api/cameras", newCamera, {
        headers: { Authorization: `Bearer ` }
      })
      setCameras([...cameras, res.data]) // הוספה לרשימה הקיימת
      setNewCamera({ name: "", url: "" }) // איפוס השדות
      setMessage("Camera added successfully!")
    } catch (err) {
      setMessage("Error adding camera")
    }
  }

  // Handle Remove Camera
  const removeCamera = async (id) => {
    if (!window.confirm("Remove this camera?")) return
    try {
      const token = localStorage.getItem("token")
      await axios.delete(`http://localhost:8000/api/cameras.${id}`, {
        headers: { Authorization: `Bearer ${token} ` }
      })
      setCameras(cameras.filter(cam => cam._id !== id))
    } catch (err) {
      alert("Error removing camera")
    }
  }

  return (
    <div className="settings-container">
      <h1 className="settings-title">System Configuration</h1>
      {message && <div className="status-message">{message}</div>}

      <div className="settings-grid">
        {/* Section 1: User Profile & Email */}
        <div className="settings-card">
          <h2>User Profile</h2>
          <div className="input-group">
            <label>Display Name</label>
            <input 
              type="text" 
              value={profile.name} 
              onChange={e => setProfile({...profile, name: e.target.value})} 
            />
          </div>
          <div className="input-group">
            <label>Email (Alerts Destination)</label>
            <input 
              type="email" 
              value={profile.email} 
              onChange={e => setProfile({...profile, email: e.target.value})} 
            />
          </div>
          <button className="action-btn">Update Profile</button>
        </div>

        {/* Section 2: Alert Notifications (Checkboxes) */}
        <div className="settings-card">
          <h2>Alert Triggers</h2>
          <div className="checkbox-group">
            <label>
              <input type="checkbox" name="unknownFace" checked={alerts.unknownFace} onChange={handleAlertChange} />
              Unknown Face Detection
            </label>
            <label>
              <input type="checkbox" name="motion" checked={alerts.motion} onChange={handleAlertChange} />
              Motion Detected
            </label>
            <label>
              <input type="checkbox" name="multiplePeople" checked={alerts.multiplePeople} onChange={handleAlertChange} />
              Multiple People (Crowd)
            </label>
          </div>
        </div>

        {/* Section 3: Camera Management */}
        <div className="settings-card full-width">
          <h2>Camera Management</h2>
          <form className="add-camera-form" onSubmit={addCamera}>
            <input type="text" placeholder="Camera Name (e.g. Hallway)" value={newCamera.name} onChange={e => setNewCamera({...newCamera, name: e.target.value})} required />
            <input type="text" placeholder="RTSP / IP URL" value={newCamera.url} onChange={e => setNewCamera({...newCamera, url: e.target.value})} required />
            <button type="submit" className="action-btn green-btn">Add Camera</button>
          </form>
          
          <div className="camera-list">
            {cameras.map(cam => (
              <div key={cam._id} className="camera-item">
                <span>{cam.name} <small>({cam.url})</small></span>
                <button onClick={() => removeCamera(cam._id)} className="remove-btn">REMOVE</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
