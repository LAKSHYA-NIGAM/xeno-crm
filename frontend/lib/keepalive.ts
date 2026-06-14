const INTERVAL = 4 * 60 * 1000 // 4 minutes (Render sleeps after 15 min)

const ping = () => {
  fetch("https://xeno-crm-ry0s.onrender.com/api/health").catch(() => {})
  fetch("https://xeno-channel-service-ra2k.onrender.com/health").catch(() => {})
  console.log("[KEEPALIVE] Services pinged at", new Date().toLocaleTimeString())
}

if (typeof window !== "undefined") {
  ping() // immediate on load
  setInterval(ping, INTERVAL)
}
export {}
