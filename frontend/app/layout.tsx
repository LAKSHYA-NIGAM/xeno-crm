import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { Toaster } from "react-hot-toast"
import "@/lib/keepalive"


const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "Xeno CRM — AI-native Shopper Engagement",
  description: "AI-powered campaign management for D2C brands",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn("h-full dark antialiased", inter.variable)}>
      <body className={cn(inter.className, "h-full bg-bg-primary text-text-primary flex overflow-hidden")}>
        {/* Global Notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#111111",
              color: "#F2F2F2",
              border: "1px solid #2A2A2A",
              fontSize: "13px",
            },
          }}
        />
        {children}
      </body>
    </html>
  )
}
