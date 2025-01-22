import { WebSocketServer } from "ws"
import os from "os"

// Get your local IP address
const interfaces = os.networkInterfaces()
let localIP = "localhost"
for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === "IPv4" && !iface.internal) {
      localIP = iface.address
    }
  }
}

// Create a WebSocket server
const wss = new WebSocketServer({ host: localIP, port: 8080 })

console.log(`WebSocket server is running at ws://${localIP}:8080`)

wss.on("connection", (ws) => {
  console.log("New client connected")

  // Handle incoming messages
  ws.on("message", (message) => {
    console.log(`Received: ${message}`)
    ws.send(`Server echo: ${message}`)
  })

  // Handle disconnection
  ws.on("close", () => {
    console.log("Client disconnected")
  })
})
