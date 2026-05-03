import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Heart,
  LayoutDashboard,
  FileText,
  Building2,
  ShieldCheck,
  UserPlus,
  Stethoscope,
  ClipboardList,
  AlertTriangle,
  LogOut,
  Activity,
  UserCog,
  Package,
  FlaskConical,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types'
import { Badge } from '@/components/ui/Badge'

interface NavItem {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  patient: [
    { label: 'Health Passport', to: '/patient/health-passport', icon: Heart },
  ],
  doctor: [
    { label: 'Dashboard', to: '/doctor/dashboard', icon: LayoutDashboard },
    { label: 'DDI Reports', to: '/doctor/dashboard#ddi-log', icon: AlertTriangle },
  ],
  receptionist: [
    { label: 'Queue Manager', to: '/receptionist/dashboard', icon: ClipboardList },
    { label: 'Doctors', to: '/receptionist/dashboard#doctors', icon: Stethoscope },
  ],
  admin_hospital: [
    { label: 'Staff Dashboard', to: '/admin-hospital/staff', icon: LayoutDashboard },
    { label: 'Receptionists', to: '/admin-hospital/staff#receptionists', icon: UserCog },
    { label: 'Pharmacists', to: '/admin-hospital/staff#pharmacists', icon: FlaskConical },
    { label: 'Doctors', to: '/admin-hospital/staff#doctors', icon: Stethoscope },
  ],
  admin: [
    { label: 'Overview', to: '/admin/facilities#overview', icon: LayoutDashboard },
    { label: 'Facilities', to: '/admin/facilities', icon: Building2 },
    { label: 'Hospital Admins', to: '/admin/facilities#admins', icon: UserCog },
  ],
  super_admin: [],
  pharmacist: [
    { label: 'Inventory', to: '/pharmacist/dashboard#inventory', icon: Package },
    { label: 'Dispense', to: '/pharmacist/dashboard#dispense', icon: ClipboardList },
    { label: 'History', to: '/pharmacist/dashboard#history', icon: FileText },
  ],
}

const ROLE_LABELS: Record<Role, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
  admin_hospital: 'Hospital Admin',
  admin: 'Administrator',
  super_admin: 'Super Admin',
  pharmacist: 'Pharmacist',
}

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname + location.hash
  const role = user?.role ?? 'patient'
  const items = NAV_ITEMS[role] ?? []

  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  const displayName = user?.name ?? (fullName || (user?.email ?? 'User'))

  return (
    <div className="flex h-full flex-col bg-[#0F172A] text-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0055BB]">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">NFC Healthcare</p>
          <p className="text-xs text-[#94A3B8]">Clinical System</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-3 mb-2 text-xs font-semibold text-[#475569] uppercase tracking-wider">
          Navigation
        </p>
        {items.map(item => {
          const Icon = item.icon
          const isHashLink = item.to.includes('#')
          if (isHashLink) {
            const isActive = currentPath === item.to
            return (
              <button
                key={item.to}
                onClick={() => {
                  navigate(item.to)
                  onClose?.()
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive
                    ? 'bg-[#0055BB] text-white font-medium'
                    : 'text-[#94A3B8] hover:bg-white/10 hover:text-white'
                  }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            )
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' })
                onClose?.()
              }}
              className={() => {
                const isActive = location.pathname === item.to && !location.hash
                return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive
                    ? 'bg-[#0055BB] text-white font-medium'
                    : 'text-[#94A3B8] hover:bg-white/10 hover:text-white'
                  }`
              }}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-white/10 p-4 space-y-3">
        <button
          onClick={() => { navigate('/profile'); onClose?.() }}
          className="w-full flex items-center gap-3 rounded-lg p-1 hover:bg-white/10 transition-colors text-left"
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#0055BB] text-white text-sm font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            <Badge variant="secondary" className="text-xs mt-0.5 bg-white/10 text-[#94A3B8] border-0">
              {ROLE_LABELS[role]}
            </Badge>
          </div>
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#94A3B8] hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
