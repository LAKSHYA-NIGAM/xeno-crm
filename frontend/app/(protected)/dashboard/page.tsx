"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { api, OverviewStats, Campaign } from "@/lib/api"
import { StatCard } from "@/components/ui/StatCard"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/PageHeader"
import { Users, TrendingUp, ShoppingBag, Megaphone, Plus, Sparkles, MapPin, BarChart3 } from "lucide-react"

// Channel Configuration
const CHANNEL_CONFIG: Record<string, { label: string; icon: string; dotColor: string }> = {
  email: { label: "Email", icon: "✉️", dotColor: "bg-accent-blue" },
  whatsapp: { label: "WhatsApp", icon: "📱", dotColor: "bg-accent-green" },
  sms: { label: "SMS", icon: "💬", dotColor: "bg-accent-amber" },
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(false)
        const overview = await api.getOverview()
        setData(overview)
        if (!overview || overview.total_customers === 0) {
          setError(true)
        }
      } catch (err: any) {
        console.error("Dashboard overview fetch failed:", err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    // Silently wake both Render services on dashboard load
    // This ensures callbacks work immediately when evaluator launches a campaign
    const warmUp = async () => {
      try {
        await Promise.all([
          fetch("https://xeno-crm-ry0s.onrender.com/api/health"),
          fetch("https://xeno-channel-service-ra2k.onrender.com/health"),
        ])
      } catch (e) {
        // Silent fail — user never sees this
      }
    }
    warmUp()
  }, [])

  // Greeting Logic
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) return "Good morning"
    if (hour >= 12 && hour < 17) return "Good afternoon"
    return "Good evening"
  }

  // Formatting Sales as Indian Rupees (INR)
  const formatINR = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  const overview = data || {
    total_customers: 0,
    total_revenue: 0,
    total_orders: 0,
    active_campaigns: 0,
    top_cities: [],
    channel_distribution: [],
    recent_campaigns: [],
  }

  const topCities = overview.top_cities.slice(0, 5)
  const maxCityCount = topCities.length > 0 ? Math.max(...topCities.map(c => c.count)) : 1

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-bg-primary pb-12">
      {/* Page Header */}
      <PageHeader
        title={`${getGreeting()}, Elara ✦`}
        description="Your brand at a glance"
        action={
          <Link
            href="/campaigns"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-accent-purple hover:bg-accent-purple/90 text-sm font-semibold text-text-primary transition-all shadow-md shadow-accent-purple/20"
          >
            <Plus className="h-4 w-4" />
            <span>New Campaign</span>
          </Link>
        }
      />

      {error && (
        <div className="mx-8 mt-6 -mb-2 px-4 py-3 rounded-lg border border-amber-800 bg-amber-950 text-amber-400 text-sm flex items-center gap-2">
          <span>⚠</span>
          <span>Cannot reach backend — make sure FastAPI is running on port 8000 and <code className="bg-amber-900 px-1 rounded">NEXT_PUBLIC_API_URL</code> is set correctly in <code className="bg-amber-900 px-1 rounded">.env.local</code></span>
        </div>
      )}

      <div className="px-8 py-8 space-y-8 max-w-7xl w-full mx-auto">
        {/* Aggregates Row */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Customers"
            value={overview.total_customers.toLocaleString()}
            sub="Seeded Indian customer profiles"
            accent="blue"
            icon={<Users className="h-4 w-4 text-accent-blue" />}
          />
          <StatCard
            label="Total Revenue"
            value={formatINR(overview.total_revenue)}
            sub="Lifetime sales across order logs"
            accent="purple"
            icon={<TrendingUp className="h-4 w-4 text-accent-purple" />}
          />
          <StatCard
            label="Total Orders"
            value={overview.total_orders.toLocaleString()}
            sub="Successful checkouts logged"
            accent="green"
            icon={<ShoppingBag className="h-4 w-4 text-accent-green" />}
          />
          <StatCard
            label="Active Campaigns"
            value={overview.active_campaigns}
            sub="Running engagement broadcasts"
            accent="amber"
            icon={<Megaphone className="h-4 w-4 text-accent-amber" />}
          />
        </div>

        {/* Double-column section */}
        <div className="grid gap-8 lg:grid-cols-10">
          {/* Left Column (60% width equivalent to 6 cols) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-bg-secondary border border-border-default rounded-xl p-6 shadow-xl">
              <div className="flex items-center space-x-2 pb-6">
                <Megaphone className="h-4.5 w-4.5 text-accent-purple" />
                <h3 className="text-sm font-semibold text-text-primary">Recent Engagement Campaigns</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-secondary font-medium">
                      <th className="py-3 px-4 font-semibold">Campaign Name</th>
                      <th className="py-3 px-4 font-semibold">Channel</th>
                      <th className="py-3 px-4 font-semibold">Audience</th>
                      <th className="py-3 px-4 font-semibold">Delivered %</th>
                      <th className="py-3 px-4 font-semibold">Created</th>
                      <th className="py-3 px-4 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {overview.recent_campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-text-secondary italic">
                          No campaigns yet — create your first one
                        </td>
                      </tr>
                    ) : (
                      overview.recent_campaigns.map((c) => {
                        const config = CHANNEL_CONFIG[c.channel] || { label: c.channel, icon: "✉️" }
                        const hasLaunched = c.status === "launched"
                        const deliveryRate = hasLaunched && c.audience_size > 0
                          ? (((c.delivered || 0) / c.audience_size) * 100).toFixed(1) + "%"
                          : "—"

                        return (
                          <tr
                            key={c.id}
                            onClick={() => router.push(`/campaigns/${c.id}`)}
                            className="hover:bg-bg-tertiary/50 transition-colors cursor-pointer group"
                          >
                            <td className="py-4 px-4 font-medium text-text-primary group-hover:text-accent-purple transition-colors">
                              <div>
                                <span className="block font-bold">{c.name}</span>
                                <span className="text-[10px] text-text-secondary block max-w-xs truncate mt-0.5">
                                  {c.objective}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="flex items-center space-x-1 capitalize text-text-secondary">
                                <span>{config.icon}</span>
                                <span>{config.label}</span>
                              </span>
                            </td>
                            <td className="py-4 px-4 text-text-secondary font-medium">
                              {c.audience_size.toLocaleString()}
                            </td>
                            <td className="py-4 px-4 text-text-secondary font-medium">
                              {deliveryRate}
                            </td>
                            <td className="py-4 px-4 text-text-tertiary">
                              {new Date(c.created_at).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                              })}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <StatusBadge status={c.status} />
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column (40% width equivalent to 4 cols) */}
          <div className="lg:col-span-4 flex flex-col space-y-6">
            {/* Top Cities Horizontal Bar Chart */}
            <div className="bg-bg-secondary border border-border-default rounded-xl p-6 shadow-xl flex-1">
              <div className="flex items-center space-x-2 pb-6 border-b border-border-subtle mb-4">
                <MapPin className="h-4.5 w-4.5 text-accent-blue" />
                <h3 className="text-sm font-semibold text-text-primary">Top Demographics</h3>
              </div>

              <div className="space-y-4">
                {topCities.length === 0 ? (
                  <p className="text-center text-text-secondary italic text-xs py-8">
                    No demographic data logged
                  </p>
                ) : (
                  topCities.map((city) => {
                    const relativeWidth = `${(city.count / maxCityCount) * 100}%`

                    return (
                      <div key={city.city} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-text-secondary">{city.city}</span>
                          <span className="font-bold text-text-primary">{city.count}</span>
                        </div>
                        {/* Horizontal Custom CSS Bar */}
                        <div className="h-2 w-full rounded-full bg-bg-tertiary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent-purple/80 hover:bg-accent-purple transition-all duration-300"
                            style={{ width: relativeWidth }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Channel Mix Breakdown */}
            <div className="bg-bg-secondary border border-border-default rounded-xl p-6 shadow-xl">
              <div className="flex items-center space-x-2 pb-6 border-b border-border-subtle mb-4">
                <BarChart3 className="h-4.5 w-4.5 text-accent-green" />
                <h3 className="text-sm font-semibold text-text-primary">Communication Channel Mix</h3>
              </div>

              <div className="space-y-3">
                {overview.channel_distribution.length === 0 ? (
                  <p className="text-center text-text-secondary italic text-xs py-4">
                    No channel distribution details
                  </p>
                ) : (
                  overview.channel_distribution.map((d) => {
                    const config = CHANNEL_CONFIG[d.channel] || { label: d.channel, dotColor: "bg-text-tertiary" }
                    return (
                      <div
                        key={d.channel}
                        className="flex items-center justify-between py-2 border-b border-border-subtle/40 last:border-b-0"
                      >
                        <div className="flex items-center space-x-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${config.dotColor}`} />
                          <span className="text-xs font-semibold text-text-secondary capitalize">
                            {config.label}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-text-primary">{d.count}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Full Dashboard Skeleton State Component
function DashboardSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-bg-primary pb-12 animate-pulse">
      {/* Header Skeleton */}
      <div className="px-8 py-6 border-b border-border-subtle flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <div className="px-8 py-8 space-y-8 max-w-7xl w-full mx-auto">
        {/* Aggregates Cards Skeleton */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-bg-secondary border border-border-default rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-6 rounded" />
              </div>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>

        {/* Columns Skeleton */}
        <div className="grid gap-8 lg:grid-cols-10">
          <div className="lg:col-span-6 bg-bg-secondary border border-border-default rounded-xl p-6 space-y-4">
            <Skeleton className="h-5 w-48" />
            <div className="space-y-3 pt-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-bg-secondary border border-border-default rounded-xl p-6 space-y-4">
              <Skeleton className="h-5 w-36" />
              <div className="space-y-3 pt-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
            <div className="bg-bg-secondary border border-border-default rounded-xl p-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
