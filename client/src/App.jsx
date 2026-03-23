import { BrowserRouter, Routes, Route, Navigate } from "react-router"
import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import "./App.css"

// function PrivateRoute({ children }) {
//   const token = localStorage.getItem("token")
//   return token ? children : <Navigate to="/login" />
// }

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  )
}

// import { useState, useEffect } from "react"
// import Login from "./pages/Login"
// import Register from "./pages/Register"
// import Dashboard from "./pages/Dashboard"

// export default function App() {
//   const [page, setPage] = useState("login")
//   const [user, setUser] = useState(null)

//   useEffect(() => {
//     const token = localStorage.getItem("token")
//     const savedUser = localStorage.getItem("user")
//     if (token && savedUser) {
//       setUser(JSON.parse(savedUser))
//       setPage("dashboard")
//     }
//   }, [])

//   const handleLogin = (userData, token) => {
//     localStorage.setItem("token", token)
//     localStorage.setItem("user", JSON.stringify(userData))
//     setUser(userData)
//     setPage("dashboard")
//   }

//   const handleLogout = () => {
//     localStorage.removeItem("token")
//     localStorage.removeItem("user")
//     setUser(null)
//     setPage("login")
//   }

//   return (
//     <>
//       {page === "login" && <Login onLogin={handleLogin} onGoRegister={() => setPage("register")} />}
//       {page === "register" && <Register onGoLogin={() => setPage("login")} />}
//       {page === "dashboard" && <Dashboard user={user} onLogout={handleLogout} />}
//     </>
//   )
// }