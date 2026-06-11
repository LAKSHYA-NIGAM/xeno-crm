import React from "react"

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-border-default bg-bg-secondary/40 rounded-xl min-h-[220px]">
      <div className="text-text-tertiary text-[32px] mb-3 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-text-secondary">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] text-text-tertiary mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  )
}
