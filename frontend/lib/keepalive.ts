// Ping both Render services every 10 minutes to prevent cold starts
if (typeof window !== "undefined") {
  const ping = () => {
    fetch("https://xeno-crm-ry0s.onrender.com/api/health").catch(() => {})
    fetch("https://xeno-channel-service-ra2k.onrender.com/health").catch(() => {})
  }
  ping() // immediate ping on page load
  setInterval(ping, 10 * 60 * 1000) // then every 10 min
}
export {}
