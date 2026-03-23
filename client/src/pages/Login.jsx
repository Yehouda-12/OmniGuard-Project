import { useState } from "react"
import { useNavigate } from "react-router"
import axios from "axios"

export default function Login() {
  const [inputs, setInputs] = useState({ email: "", password: "" })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await axios.post("http://localhost:8000/api/auth/login", {
        email: inputs.email,
        password: inputs.password
      })
      localStorage.setItem("token", res.data.token)
      localStorage.setItem("user", JSON.stringify(res.data.user))
      navigate("/dashboard")
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">OmniGuard</div>
        <div className="auth-sub">AI Security System — Sign In</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
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
            {loading ? "Signing in..." : "→ Access System"}
          </button>
        </form>

        <div className="auth-link">
          No account?
          <button onClick={() => navigate("/register")}>Register</button>
        </div>
      </div>
    </div>
  )
}