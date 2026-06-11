"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("xeno_auth")
    if (!token) {
      router.replace("/login")
    }
  }, [router])

  const token = typeof window !== "undefined"
    ? localStorage.getItem("xeno_auth")
    : null

  if (!token) return null
  return <>{children}</>
}
