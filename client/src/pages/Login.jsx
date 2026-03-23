import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import axios from "axios"
import './Login.css'

function Login() {
    // הגדרת משתנים (State)
    const [inputs, setInputs] = useState({ email: "", password: "" })
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    // פונקציה לטיפול שליחת הטופס
    const handleSubmit = async (e) => {
        e.preventDefault() // מניעת רענון עמוד
        setError(null)     // איפוס שגיאות קודמות

        try {
            const response = await axios.post("http://localhost:8000/api/auth/login", {
                email: inputs.email,
                password: inputs.password
            })

            // שמירת הטוקן ופרטי המשתמש
            localStorage.setItem("token", response.data.token)
            localStorage.setItem("user", JSON.stringify(response.data.user))

            // מעבר לעמוד הראשי
            navigate("/dashboard")

        } catch (err) {
            // טיפול בשגיאה - הצגת הודעה מהשרת או הודעה כללית
            setError(err.response?.data?.message || "Login failed")
        }
    }

    return (
        <div className="login-container">
            <h1 className="login-title">OmniGuard_Login</h1>

            <form className="login-form" onSubmit={handleSubmit}>
                {/* שורה 46: הצגת שגיאה אם קיימת */}
                {error && <p className="error-message">{error}</p>}

                <label htmlFor="Email">Email</label>
                <input
                    onChange={(e) => setInputs({ ...inputs, email: e.target.value })}
                    type="email"
                    id='Email'
                    value={inputs.email}
                    required
                />

                <label htmlFor="password">Password</label>
                {/* שורות 65-66 ו-78: טיפול בשדה סיסמה */}
                <input
                    onChange={(e) => setInputs({ ...inputs, password: e.target.value })}
                    type="password"
                    id='password'
                    value={inputs.password}
                    required
                />

                <button className="login-button" type='submit'>{'>'} ACCESS SYSTEM</button>
            </form>
        </div>
    )
}

export default Login

