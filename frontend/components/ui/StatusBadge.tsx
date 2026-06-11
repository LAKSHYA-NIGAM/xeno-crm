import React from "react"

export const STATUS_CONFIG = {
  pending:   { label: "Pending",   bg: "#1A1A1A", color: "#888888" },
  sent:      { label: "Sent",      bg: "#1E2A3A", color: "#3B82F6" },
  delivered: { label: "Delivered", bg: "#0D2419", color: "#10B981" },
  failed:    { label: "Failed",    bg: "#2A1010", color: "#EF4444" },
  opened:    { label: "Opened",    bg: "#1E2A1E", color: "#10B981" },
  read:      { label: "Read",      bg: "#1A1E2A", color: "#8B5CF6" },
  clicked:   { label: "Clicked",   bg: "#2A1E0A", color: "#F59E0B" },
} as const

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status?.toLowerCase() as keyof typeof STATUS_CONFIG
  const config = STATUS_CONFIG[normalized] || { label: status, bg: "#1A1A1A", color: "#888888" }

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  )
}
