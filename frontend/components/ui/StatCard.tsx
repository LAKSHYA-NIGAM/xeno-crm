import React from "react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: "purple" | "green" | "red" | "amber" | "blue"
  icon?: React.ReactNode
  compact?: boolean
}

const ACCENT_COLORS = {
  purple: "border-l-accent-purple",
  green: "border-l-accent-green",
  red: "border-l-accent-red",
  amber: "border-l-accent-amber",
  blue: "border-l-accent-blue",
}

export function StatCard({ label, value, sub, accent, icon, compact = false }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-bg-secondary border border-border-default rounded-xl transition-all duration-200 ease-in-out hover:scale-[1.01] hover:border-border-strong flex flex-col justify-between relative overflow-hidden",
        compact ? "p-3.5" : "p-5",
        accent && cn("border-l-4", ACCENT_COLORS[accent])
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn(
          "text-text-secondary uppercase tracking-wide font-medium",
          compact ? "text-[10px]" : "text-[12px]"
        )}>
          {label}
        </span>
        {icon && <div className="text-text-secondary">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className={cn(
          "font-semibold text-text-primary tracking-tight",
          compact ? "text-[16px] leading-tight" : "text-[28px]"
        )}>
          {value}
        </span>
      </div>
      {sub && !compact && (
        <span className="text-[12px] text-text-tertiary mt-1 block">
          {sub}
        </span>
      )}
    </div>
  )
}
