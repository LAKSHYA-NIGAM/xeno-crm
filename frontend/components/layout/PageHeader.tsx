import React from "react"

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="px-8 py-6 border-b border-border-subtle flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold text-text-primary leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[14px] text-text-secondary mt-1">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0 md:self-center">
          {action}
        </div>
      )}
    </div>
  )
}
