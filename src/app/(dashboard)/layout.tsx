"use client"
import React from "react"

import { AuthWrapper } from "@/components/auth/AuthWrapper"
import { Sidebar } from "@/components/ui/navigation/Sidebar"
import { cx } from "@/lib/utils"

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }
  
  return (
    <AuthWrapper requireAuth={true}>
      <div className="mx-auto max-w-screen-2xl">
        <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
        <main
          className={cx(
            isCollapsed ? "lg:pl-[60px]" : "lg:pl-64",
            "ease transform-gpu transition-all duration-100 will-change-transform lg:bg-gray-50 lg:py-3 lg:pr-3 lg:dark:bg-gray-950",
          )}
        >
          <div className="bg-white p-4 sm:p-6 lg:rounded-lg lg:border lg:border-gray-200 dark:bg-gray-925 lg:dark:border-gray-900">
            {children}
          </div>
        </main>
      </div>
    </AuthWrapper>
  )
}
