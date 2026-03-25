import { io } from "socket.io-client"
import { API_BASE_URL } from "./lib/api"

const socket = io(API_BASE_URL || undefined, {
  autoConnect: true,
  reconnection: true,
  path: "/socket.io",
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
