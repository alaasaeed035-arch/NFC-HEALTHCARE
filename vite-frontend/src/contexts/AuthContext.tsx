import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { AuthUser, Role } from '@/types'
import client from '@/api/client'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

interface LoginCredentials {
  email?: string
  nationalId?: string
  password: string
  loginType: 'staff' | 'patient'
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getRoleHome(role: Role): string {
  switch (role) {
    case 'patient': return '/patient/health-passport'
    case 'doctor': return '/doctor/dashboard'
    case 'receptionist': return '/receptionist/dashboard'
    case 'admin_hospital': return '/admin-hospital/staff'
    case 'admin': return '/admin/facilities'
    case 'pharmacist': return '/pharmacist/dashboard'
    default: return '/login'
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('nfc_token')
    const storedUser = localStorage.getItem('nfc_user')
    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setToken(storedToken)
        setUser(parsed)
      } catch {
        localStorage.removeItem('nfc_token')
        localStorage.removeItem('nfc_user')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    if (credentials.loginType === 'patient') {
      const res = await client.post('/auth/login/patient', {
        email: credentials.email,
        password: credentials.password,
      })
      const tok: string = res.data.token
      if (!tok) throw new Error('No token received')
      localStorage.setItem('nfc_token', tok)
      // Fetch profile using /auth/me which works for all authenticated users
      const profileRes = await client.get('/auth/me')
      const patientData = profileRes.data.data
      const userData: AuthUser = {
        _id: patientData._id,
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        role: 'patient',
      }
      localStorage.setItem('nfc_user', JSON.stringify(userData))
      setToken(tok)
      setUser(userData)
    } else {
      const res = await client.post('/auth/login', {
        email: credentials.email,
        password: credentials.password,
      })
      const tok: string = res.data.token || res.data.data?.token
      if (!tok) throw new Error('No token received')
      localStorage.setItem('nfc_token', tok)
      const profileRes = await client.get('/auth/me')
      const profile = profileRes.data.data
      const userData: AuthUser = {
        _id: profile._id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        name: profile.name || profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || undefined,
        email: profile.email,
        role: profile.role as Role,
        hospitalId: profile.hospitalId,
        specialization: profile.specialization,
      }
      if (userData.role === 'super_admin') {
        localStorage.removeItem('nfc_token')
        throw new Error('Super Admin access is not available through this portal.')
      }
      localStorage.setItem('nfc_user', JSON.stringify(userData))
      setToken(tok)
      setUser(userData)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('nfc_token')
    localStorage.removeItem('nfc_user')
    setToken(null)
    setUser(null)
    window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}

export function useAuth(): AuthContextValue {
  return useAuthContext()
}

export { getRoleHome }
