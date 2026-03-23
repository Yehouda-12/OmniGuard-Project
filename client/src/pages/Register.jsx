
import { useState } from "react"
import { useNavigate } from "react-router"
import axios from "axios"

export default function Register() {
  // State for holding form inputs
  const [inputs, setInputs] = useState({ name: "", email: "", password: "" })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // POST request to register endpoint
      await axios.post("http://localhost:8000/api/auth/register", inputs)
      // Redirect to Login on success
      navigate("/login")
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">OmniGuard</div>
        <div className="auth-sub">AI Security System — New Account</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">Name</label>
            <input
              className="auth-input"
              type="text"
              value={inputs.name}
              onChange={e => setInputs({ ...inputs, name: e.target.value })}
              placeholder="Your Name"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              value={inputs.email}
              onChange={e => setInputs({ ...inputs, email: e.target.value })}
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              value={inputs.password}
              onChange={e => setInputs({ ...inputs, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Processing..." : "→ Initialize Account"}
          </button>
        </form>

        <div className="auth-link">
          Already have an account?
          <button onClick={() => navigate("/login")}>Sign In</button>
        </div>
      </div>
    </div>
  )
}
