"use client"

import React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Users, Megaphone, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Segments",
      href: "/segments",
      icon: Users,
    },
    {
      label: "Campaigns",
      href: "/campaigns",
      icon: Megaphone,
    },
  ]

  return (
    <aside className="w-[220px] fixed inset-y-0 left-0 bg-bg-secondary border-r border-border-subtle flex flex-col z-20">
      {/* Logo Section */}
      <div className="h-16 px-6 border-b border-border-subtle flex items-center space-x-2">
        <span className="h-2 w-2 rounded-full bg-accent-purple" />
        <span className="text-[15px] font-medium text-text-primary">Xeno CRM</span>
      </div>

      {/* Workspace Label & Nav */}
      <div className="flex-1 px-4 py-6">
        <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold px-3 block mb-4">
          WORKSPACE
        </span>
        <nav className="space-y-1">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href)
            const Icon = link.icon

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group border-l-2",
                  isActive
                    ? "bg-bg-highlight text-text-primary border-accent-purple rounded-l-none"
                    : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary border-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px]",
                    isActive ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"
                  )}
                />
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Sign out and version badge */}
      <div className="p-4 border-t border-border-subtle flex flex-col space-y-2">
        <button
          onClick={() => {
            localStorage.removeItem("xeno_auth")
            router.push("/login")
          }}
          className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-all cursor-pointer"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span>Sign out</span>
        </button>
        <span className="text-[10px] text-text-tertiary font-medium block text-center pt-1">
          AI-native · v1.0
        </span>
      </div>
    </aside>
  )
}
