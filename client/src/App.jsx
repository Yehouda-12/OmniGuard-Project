import Dashboard from "./pages/Dashboard"

export default function App() {
  const fakeUser = { _id: "test123", name: "Yehouda" }
  return <Dashboard user={fakeUser} onLogout={() => console.log("logout")} />
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