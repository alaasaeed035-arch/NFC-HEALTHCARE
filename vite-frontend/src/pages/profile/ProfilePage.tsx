import React, { useEffect, useState } from 'react'
import { User, Mail, Phone, MapPin, Briefcase, Building2, CreditCard, Calendar, Droplets, ShieldCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import client from '@/api/client'

const ROLE_LABELS: Record<string, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
  admin_hospital: 'Hospital Admin',
  admin: 'Administrator',
  super_admin: 'Super Admin',
}

interface ProfileField {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | undefined | null
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [hospitalName, setHospitalName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/auth/me')
      .then(res => {
        const data = res.data?.data ?? res.data
        setProfile(data)
        if (data?.hospitalId) {
          client.get(`/hospital/${data.hospitalId}`)
            .then(r => {
              const h = r.data?.data?.hospital ?? r.data?.data ?? r.data
              setHospitalName(h?.name ?? null)
            })
            .catch(() => {})
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [])

  const fullName = profile
    ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
      || (profile.fullName as string)
      || (profile.name as string)
      || '—'
    : '—'

  const role = (profile?.role ?? user?.role ?? '') as string
  const initials = fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  const fields: ProfileField[] = [
    { icon: Mail, label: 'Email', value: profile?.email as string },
    { icon: Phone, label: 'Phone', value: profile?.phoneNumber as string },
    { icon: MapPin, label: 'Address', value: profile?.address as string },
    { icon: CreditCard, label: 'National ID', value: profile?.nationalId as string },
    { icon: Calendar, label: 'Date of Birth', value: profile?.dateOfBirth ? new Date(profile.dateOfBirth as string).toLocaleDateString() : undefined },
    { icon: Droplets, label: 'Blood Type', value: profile?.bloodType as string },
    { icon: Briefcase, label: 'Specialization', value: profile?.specialization as string },
    { icon: Building2, label: 'Hospital', value: hospitalName ?? undefined },
    { icon: ShieldCheck, label: 'License Number', value: profile?.licenseNumber as string },
  ].filter(f => f.value)

  if (loading) return (
    <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0055BB] to-[#003380] text-white text-2xl font-bold">
              {initials}
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
              <Badge className="bg-[#0055BB]/10 text-[#0055BB] border-0 font-medium">
                {ROLE_LABELS[role] ?? role}
              </Badge>
              {(profile?.email as string) && (
                <p className="text-sm text-gray-500">{profile.email as string}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details card */}
      {fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4 text-[#0055BB]" />Account Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-gray-100">
              {fields.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-4 py-3">
                  <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <dt className="w-32 text-sm text-gray-500 flex-shrink-0">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {!profile && (
        <p className="text-center text-sm text-gray-400">Could not load profile data.</p>
      )}
    </div>
  )
}
