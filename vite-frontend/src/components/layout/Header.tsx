import React from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'

interface HeaderProps {
  onMenuClick: () => void
}

const ROUTE_TITLES: Record<string, string> = {
  '/patient/health-passport': 'Health Passport',
  '/doctor/dashboard': 'Clinical Dashboard',
  '/receptionist/dashboard': 'Receptionist Portal',
  '/admin-hospital/staff': 'Staff Management',
  '/admin/facilities': 'Facility Management',
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const title = ROUTE_TITLES[location.pathname] ?? 'NFC Healthcare'
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  const displayName = user?.name ?? (fullName || (user?.email ?? 'User'))

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Notifications"
          onClick={() => toast({ title: 'No new notifications', variant: 'default' })}
        >
          <Bell className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0055BB] text-white text-sm font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
            {displayName}
          </span>
        </div>
      </div>
    </header>
  )
}
