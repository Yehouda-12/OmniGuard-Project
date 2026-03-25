import { useState } from "react"
import { useNavigate } from "react-router"
import axios from "axios"

export default function Register() {
  const [inputs, setInputs] = useState({ name: "", email: "", password: "", alertEmail: "" })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/register`, inputs)
      localStorage.setItem("token", res.data.jwt)  
      localStorage.setItem("user", JSON.stringify(res.data.user))
      navigate("/dashboard")
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
        <div className="auth-sub">AI Security System — Create Account</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">Full Name</label>
            <input
              className="auth-input"
              type="text"
              value={inputs.name}
              onChange={e => setInputs({ ...inputs, name: e.target.value })}
              placeholder="Your name"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Email (login)</label>
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
          <div className="auth-field">
            <label className="auth-label">Alert Email <span style={{color:"var(--text-muted)",fontWeight:400}}>(receive intrusion alerts)</span></label>
            <input
              className="auth-input"
              type="email"
              value={inputs.alertEmail}
              onChange={e => setInputs({ ...inputs, alertEmail: e.target.value })}
              placeholder="alerts@email.com (can be same as login)"
            />
          </div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "→ Create Account"}
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