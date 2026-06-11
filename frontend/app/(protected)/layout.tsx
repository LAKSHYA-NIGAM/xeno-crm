"use client"

import React from "react"
import { AuthGuard } from "@/components/auth/AuthGuard"
import { Sidebar } from "@/components/layout/Sidebar"

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-bg-primary overflow-hidden w-full">
        <Sidebar />
        <main className="pl-[220px] flex-1 h-full flex flex-col bg-bg-primary overflow-y-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  )
}
