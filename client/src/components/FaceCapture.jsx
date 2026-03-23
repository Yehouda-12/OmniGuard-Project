import { useRef, useState } from "react"
import * as faceapi from "face-api.js"
import useFaceApi from "../hooks/useFaceApi"

export default function FaceCapture({ onCapture, onCancel }) {
     const { ready, progress } = useFaceApi() 
  const videoRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [status, setStatus] = useState("idle") // idle | capturing | done | error
  const [faceName, setFaceName] = useState("")

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
        await videoRef.current.play()
      }
      setStatus("capturing")
    } catch (e) {
      setStatus("error")
    }
  }

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop())
    setStream(null)
    setStatus("idle")
  }

  const capture = async () => {
   
         if (!ready) return alert("AI models still loading, please wait...")
  if (!faceName.trim()) return alert("Enter a name first!")
    const video = videoRef.current
    if (!video) return

    setStatus("processing")

    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
    const detection = await faceapi
      .detectSingleFace(video, options)
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!detection) {
      setStatus("capturing")
      return alert("No face detected — look at the camera!")
    }

    const descriptor = Array.from(detection.descriptor)
    stopCamera()
    setStatus("done")
    onCapture({ name: faceName.trim(), descriptor })
  }

  const handleCancel = () => {
    stopCamera()
    onCancel()
  }

  return (
    <div className="face-capture">
      <div className="face-capture-head">
        <div className="settings-card-title">Add Authorized Face</div>
      </div>
      {!ready && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: 8 }}>
          ⏳ {progress}
        </div>
      )}

      <div className="auth-field">
        <label className="auth-label">Person Name</label>
        <input
          className="auth-input"
          type="text"
          placeholder="e.g. Yehouda"
          value={faceName}
          onChange={e => setFaceName(e.target.value)}
        />
      </div>

      {/* Video preview */}
      <div className="face-capture-video">
        {status === "idle" && (
          <div className="cam-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1">
              <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
            <p>Camera inactive</p>
          </div>
        )}
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ display: status === "capturing" || status === "processing" ? "block" : "none", width: "100%", borderRadius: 6 }}
        />
        {status === "done" && (
          <div className="cam-placeholder" style={{ color: "var(--accent-green)" }}>
            ✓ Face captured successfully!
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="face-capture-actions">
        {status === "idle" && (
          <button className="auth-btn" style={{ width: "auto" }} onClick={startCamera}>
            ▶ Open Camera
          </button>
        )}
        {(status === "capturing" || status === "processing") && (
          <button
            className="auth-btn"
            style={{ width: "auto" }}
            onClick={capture}
            disabled={status === "processing"}
          >
            {status === "processing" ? "Processing..." : "📸 Capture Face"}
          </button>
        )}
        <button
          className="auth-btn"
          style={{ width: "auto", background: "transparent", borderColor: "var(--border)", color: "var(--text-secondary)" }}
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}