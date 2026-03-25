import { io } from "socket.io-client"

const socket = io(`${import.meta.env.VITE_API_URL}`, {
  autoConnect: true,
  reconnection: true,
})

socket.on("connect", () => {
  console.log("✅ Socket.io connected:", socket.id)
})

socket.on("disconnect", () => {
  console.log("❌ Socket.io disconnected")
})

socket.on("alert_received", (data) => {
  console.log("✅ Alert confirmed by server:", data)
})

export default socket