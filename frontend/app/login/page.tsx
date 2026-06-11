"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Lock, Mail } from "lucide-react"

const DEMO_CREDENTIALS = {
  email: "demo@xenocrm.com",
  password: "elara2026",
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("demo@xenocrm.com")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)

  // Redirect to dashboard if already logged in
  useEffect(() => {
    const token = localStorage.getItem("xeno_auth")
    if (token === "demo_token_2026") {
      router.replace("/dashboard")
    }
  }, [router])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Brief timeout for visual feedback and premium feel
    setTimeout(() => {
      if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
        localStorage.setItem("xeno_auth", "demo_token_2026")
        router.push("/dashboard")
      } else {
        setError("Invalid credentials — use the demo password shown below")
        setShake(true)
        setLoading(false)
        setTimeout(() => setShake(false), 500)
      }
    }, 400)
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-bg-primary text-text-primary px-4 selection:bg-accent-purple/30">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center space-x-2">
          <span className="h-3 w-3 rounded-full bg-accent-purple animate-pulse" />
          <span className="text-2xl font-bold tracking-tight text-text-primary">Xeno CRM</span>
        </div>
        <p className="text-xs text-text-secondary mt-1.5 font-medium tracking-wide">
          AI-native Shopper Engagement
        </p>
      </div>

      {/* Login Card */}
      <div 
        className={`w-full max-w-[420px] bg-bg-secondary border border-border-default rounded-2xl p-8 shadow-2xl transition-all duration-300 ${
          shake ? "shake border-accent-red/50 shadow-accent-red/5" : ""
        } animate-in fade-in zoom-in-95 duration-300`}
      >
        <div className="space-y-1 mb-6">
          <h2 className="text-lg font-bold text-text-primary">Welcome back</h2>
          <p className="text-xs text-text-secondary">Sign in to your workspace</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3 text-xs bg-accent-red/10 border border-accent-red/25 text-accent-red rounded-lg animate-in fade-in duration-200">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-tertiary block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@xenocrm.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-tertiary block">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border-default bg-bg-primary text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent-purple focus:ring-1 focus:ring-accent-purple transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-accent-purple hover:bg-accent-purple/95 disabled:opacity-50 text-text-primary text-xs font-bold transition-all shadow-lg shadow-accent-purple/20 cursor-pointer mt-2"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo hints below form */}
        <p className="text-center text-[10px] text-text-tertiary mt-6 leading-relaxed pt-4 border-t border-border-subtle/50">
          Demo credentials · email: <span className="text-text-secondary select-all">demo@xenocrm.com</span> &bull; password: <span className="text-text-secondary select-all">elara2026</span>
        </p>
      </div>

      {/* Footer footer */}
      <p className="text-center text-[10px] text-text-tertiary mt-8 font-medium">
        Built for Xeno Engineering &middot; 2026
      </p>
    </div>
  )
}
