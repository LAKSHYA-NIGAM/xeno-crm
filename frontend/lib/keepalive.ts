// Ping backend every 10 minutes to prevent cold starts
if (typeof window !== "undefined") {
  setInterval(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`).catch(() => {})
  }, 10 * 60 * 1000)
}
export {}
