import React, { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { FloatingChat } from '@/components/chat/FloatingChat'
import { useAuth } from '@/hooks/useAuth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-60 z-50 flex flex-col shadow-xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Floating chat — show for patient only */}
      {user?.role === 'patient' && <FloatingChat />}
    </div>
  )
}
