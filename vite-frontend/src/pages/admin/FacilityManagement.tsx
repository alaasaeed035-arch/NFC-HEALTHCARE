import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Building2, UserPlus, Pencil, Trash2, Phone, MapPin, Mail,
  Users, Stethoscope, UserCog, LayoutDashboard, CreditCard, Wifi, CheckCircle2, AlertCircle
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/Dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Hospital, Patient, Doctor } from '@/types'
import client from '@/api/client'
import { useToast } from '@/components/ui/Toast'

interface ReceptionistRow {
  _id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  hospitalId?: { _id: string; name: string }
}

interface HospitalForm {
  name: string; address: string; phoneNumber: string; email: string; hotline: string; licenseNumber: string
}
interface AdminForm {
  fullName: string; email: string; password: string; phoneNumber: string; hospitalId: string
}

interface NfcCard {
  _id: string
  cardNumber: string
  nfcUid?: string | null
  isLinked: boolean
  patientId?: { _id: string; firstName: string; lastName: string; nationalId: string } | null
  createdAt: string
}

export default function FacilityManagement() {
  const location = useLocation()
  const navigate = useNavigate()
  const VALID_TABS = ['overview', 'hospitals', 'admins', 'cards']
  const hashTab = location.hash.replace('#', '')
  const activeTab = VALID_TABS.includes(hashTab) ? hashTab : 'hospitals'
  const { toast } = useToast()
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [hospitalAdmins, setHospitalAdmins] = useState<{ _id: string; fullName: string; email: string; phoneNumber?: string; hospitalId?: { _id: string; name: string } }[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [receptionists, setReceptionists] = useState<ReceptionistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [hospitalDialogOpen, setHospitalDialogOpen] = useState(false)
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteAdminId, setDeleteAdminId] = useState<string | null>(null)
  const [deletingAdmin, setDeletingAdmin] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [nfcCards, setNfcCards] = useState<NfcCard[]>([])
  const [cardStatusFilter, setCardStatusFilter] = useState<'all' | 'linked' | 'available'>('all')
  const [generateCount, setGenerateCount] = useState(1)
  const [generatingCards, setGeneratingCards] = useState(false)
  const [scanTarget, setScanTarget] = useState<NfcCard | null>(null)
  type ScanStatus = 'idle' | 'scanning' | 'confirm' | 'saving' | 'success' | 'error'
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [scanUid, setScanUid] = useState('')
  const [scanError, setScanError] = useState('')
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking')
  const [manualUid, setManualUid] = useState('')
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastScanUidRef = useRef<string | null>(null)

  const [hospitalForm, setHospitalForm] = useState<HospitalForm>({
    name: '', address: '', phoneNumber: '', email: '', hotline: '', licenseNumber: '',
  })
  const [adminForm, setAdminForm] = useState<AdminForm>({
    fullName: '', email: '', password: '', phoneNumber: '', hospitalId: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchHospitals()
  }, [])

  const fetchHospitals = async () => {
    setLoading(true)
    try {
      const [hRes, aRes, pRes, dRes, rRes, cRes] = await Promise.allSettled([
        client.get('/hospital'),
        client.get('/admin/hospital-admins'),
        client.get('/auth/patients'),
        client.get('/auth/doctors'),
        client.get('/auth/receptionists'),
        client.get('/admin/cards'),
      ])
      if (hRes.status === 'fulfilled') {
        const d = hRes.value.data
        setHospitals(Array.isArray(d) ? d : d.data ?? [])
      }
      if (aRes.status === 'fulfilled') {
        const d = aRes.value.data
        setHospitalAdmins(Array.isArray(d) ? d : d.data ?? [])
      }
      if (pRes.status === 'fulfilled') {
        const d = pRes.value.data
        setPatients(Array.isArray(d) ? d : d.data ?? [])
      }
      if (dRes.status === 'fulfilled') {
        const d = dRes.value.data
        setDoctors(Array.isArray(d) ? d : d.data ?? [])
      }
      if (rRes.status === 'fulfilled') {
        const d = rRes.value.data
        setReceptionists(Array.isArray(d) ? d : d.data ?? [])
      }
      if (cRes.status === 'fulfilled') {
        const d = cRes.value.data
        setNfcCards(Array.isArray(d) ? d : d.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchCards = async () => {
    try {
      const res = await client.get('/admin/cards')
      const d = res.data
      setNfcCards(Array.isArray(d) ? d : d.data ?? [])
    } catch {
      // silent
    }
  }

  const handleGenerateCards = async () => {
    if (generateCount < 1 || generateCount > 100) return
    setGeneratingCards(true)
    try {
      const res = await client.post('/admin/cards/generate', { count: generateCount })
      toast({ title: `${res.data.count} card(s) generated successfully`, variant: 'success' })
      await fetchCards()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to generate cards', variant: 'error' })
    } finally {
      setGeneratingCards(false)
    }
  }

  const validateHospital = () => {
    const errs: Record<string, string> = {}
    if (!hospitalForm.name.trim()) errs.name = 'Required'
    if (!hospitalForm.address.trim()) errs.address = 'Required'
    if (!hospitalForm.phoneNumber.trim()) errs.phoneNumber = 'Required'
    if (!hospitalForm.email.trim()) errs.email = 'Required'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }
  const validateAdmin = () => {
    const errs: Record<string, string> = {}
    if (!adminForm.fullName.trim()) errs.fullName = 'Required'
    if (!adminForm.email.trim()) errs.email = 'Required'
    if (!adminForm.password || adminForm.password.length < 6) errs.password = 'Min 6 characters'
    if (!adminForm.hospitalId) errs.hospitalId = 'Required'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSaveHospital = async () => {
    if (!validateHospital()) return
    setSubmitting(true)
    try {
      if (editingHospital) {
        await client.put(`/hospital/update/${editingHospital._id}`, hospitalForm)
        toast({ title: 'Hospital updated successfully', variant: 'success' })
      } else {
        await client.post('/hospital/create', hospitalForm)
        toast({ title: 'Hospital onboarded successfully', variant: 'success' })
      }
      setHospitalDialogOpen(false)
      setEditingHospital(null)
      setHospitalForm({ name: '', address: '', phoneNumber: '', email: '', hotline: '', licenseNumber: '' })
      fetchHospitals()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to save hospital', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteHospital = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await client.delete(`/hospital/delete/${deleteId}`)
      toast({ title: 'Hospital deleted', variant: 'success' })
      setHospitals(prev => prev.filter(h => h._id !== deleteId))
      setDeleteId(null)
    } catch {
      toast({ title: 'Failed to delete hospital', variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteAdmin = async () => {
    if (!deleteAdminId) return
    setDeletingAdmin(true)
    try {
      await client.delete(`/admin/hospital-admin/${deleteAdminId}`)
      toast({ title: 'Hospital admin deleted', variant: 'success' })
      setHospitalAdmins(prev => prev.filter(a => a._id !== deleteAdminId))
      setDeleteAdminId(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to delete admin', variant: 'error' })
    } finally {
      setDeletingAdmin(false)
    }
  }

  const handleEditHospital = (h: Hospital) => {
    setEditingHospital(h)
    setHospitalForm({
      name: h.name, address: h.address, phoneNumber: h.phoneNumber,
      email: h.email, hotline: h.hotline ?? '', licenseNumber: h.licenseNumber ?? '',
    })
    setHospitalDialogOpen(true)
  }

  const handleCreateAdmin = async () => {
    if (!validateAdmin()) return
    setSubmitting(true)
    try {
      await client.post('/admin/create-hospital-admin', {
        fullName: adminForm.fullName,
        email: adminForm.email,
        password: adminForm.password,
        phoneNumber: adminForm.phoneNumber || undefined,
        hospitalId: adminForm.hospitalId,
      })
      toast({ title: 'Hospital admin created', variant: 'success' })
      setAdminDialogOpen(false)
      setAdminForm({ fullName: '', email: '', password: '', phoneNumber: '', hospitalId: '' })
      fetchHospitals()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to create admin', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const openScanDialog = (card: NfcCard) => {
    setScanTarget(card)
    setScanStatus('idle')
    setScanUid('')
    setScanError('')
    setManualUid('')
    setBridgeStatus('checking')
  }

  const closeScanDialog = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    scanIntervalRef.current = null
    lastScanUidRef.current = null
    setScanTarget(null)
    setScanStatus('idle')
    setScanUid('')
    setScanError('')
    setManualUid('')
  }

  const handleScanNfc = () => {
    setScanStatus('scanning')
    setScanError('')
    setScanUid('')
    lastScanUidRef.current = null
    setBridgeStatus('checking')

    const poll = async () => {
      try {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 1000)
        const res = await fetch('http://localhost:8002/nfc/card', { signal: controller.signal })
        clearTimeout(t)
        const data: { uid: string | null; present: boolean; reader_available: boolean } = await res.json()

        if (!data.reader_available) {
          setBridgeStatus('unavailable')
          return
        }
        setBridgeStatus('connected')

        if (data.present && data.uid && data.uid !== lastScanUidRef.current) {
          lastScanUidRef.current = data.uid
          if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
          scanIntervalRef.current = null
          setScanUid(data.uid)
          setScanStatus('confirm')
        } else if (!data.present) {
          lastScanUidRef.current = null
        }
      } catch {
        setBridgeStatus('unavailable')
      }
    }

    poll()
    scanIntervalRef.current = setInterval(poll, 500)
  }

  const handleSaveUid = async () => {
    if (!scanTarget) return
    const uid = scanUid || manualUid.trim().toUpperCase()
    if (!uid) return
    setScanStatus('saving')
    try {
      await client.put(`/admin/cards/${scanTarget._id}/scan`, { nfcUid: uid })
      setNfcCards(prev => prev.map(c => c._id === scanTarget._id ? { ...c, nfcUid: uid } : c))
      setScanStatus('success')
      toast({ title: 'NFC chip assigned successfully', variant: 'success' })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      setScanError(e?.response?.data?.message ?? 'Failed to save NFC UID.')
      setScanStatus('error')
    }
  }

  const hf = (field: keyof HospitalForm, value: string) => {
    setHospitalForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: '' }))
  }
  const af = (field: keyof AdminForm, value: string) => {
    setAdminForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: '' }))
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={tab => navigate(`${location.pathname}#${tab}`, { replace: true })}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="hospitals">
            <Building2 className="h-4 w-4 mr-1.5" />Hospitals
          </TabsTrigger>
          <TabsTrigger value="admins">
            <UserPlus className="h-4 w-4 mr-1.5" />Hospital Admins
          </TabsTrigger>
          <TabsTrigger value="cards">
            <CreditCard className="h-4 w-4 mr-1.5" />NFC Cards
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Hospitals', value: hospitals.length, icon: Building2, color: 'bg-blue-50 text-[#0055BB]' },
              { label: 'Total Patients', value: patients.length, icon: Users, color: 'bg-indigo-50 text-indigo-600' },
              { label: 'Total Doctors', value: doctors.length, icon: Stethoscope, color: 'bg-green-50 text-green-600' },
              { label: 'Receptionists', value: receptionists.length, icon: UserCog, color: 'bg-purple-50 text-purple-600' },
            ].map(stat => {
              const Icon = stat.icon
              return (
                <Card key={stat.label}>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">{stat.label}</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">
                          {loading ? <span className="h-8 w-16 bg-gray-100 rounded animate-pulse inline-block" /> : stat.value}
                        </p>
                      </div>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Hospitals Tab */}
        <TabsContent value="hospitals">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Healthcare Facilities ({hospitals.length})</CardTitle>
                <Button onClick={() => { setEditingHospital(null); setHospitalForm({ name: '', address: '', phoneNumber: '', email: '', hotline: '', licenseNumber: '' }); setHospitalDialogOpen(true) }} size="sm">
                  <Building2 className="h-4 w-4 mr-1.5" />Onboard Hospital
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : hospitals.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No hospitals registered yet</p>
                  <Button className="mt-4" onClick={() => setHospitalDialogOpen(true)}>
                    Onboard First Hospital
                  </Button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {hospitals.map(h => (
                    <div key={h._id} className="rounded-xl border border-gray-200 p-4 hover:border-[#0055BB]/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                            <Building2 className="h-5 w-5 text-[#0055BB]" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{h.name}</p>
                            {h.licenseNumber && (
                              <p className="text-xs text-gray-400">License: {h.licenseNumber}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditHospital(h)}>
                            <Pencil className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            aria-label="Delete hospital"
                            onClick={() => setDeleteId(h._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />{h.address}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />{h.phoneNumber}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail className="h-3 w-3" />{h.email}
                        </div>
                        {h.hotline && (
                          <div className="text-xs font-medium text-red-500">Emergency: {h.hotline}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NFC Cards Tab */}
        <TabsContent value="cards">
          <div className="space-y-4">
            {/* Generate form */}
            <Card>
              <CardHeader>
                <CardTitle>Generate NFC Cards</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3">
                  <div className="space-y-1">
                    <Label>Number of cards (1–100)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={generateCount}
                      onChange={e => setGenerateCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-32"
                    />
                  </div>
                  <Button onClick={handleGenerateCards} disabled={generatingCards}>
                    {generatingCards ? <Spinner size="sm" /> : <><CreditCard className="h-4 w-4 mr-1.5" />Generate</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Cards table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle>All NFC Cards ({nfcCards.length})</CardTitle>
                  <div className="flex gap-1">
                    {(['all', 'available', 'linked'] as const).map(f => (
                      <Button
                        key={f}
                        size="sm"
                        variant={cardStatusFilter === f ? 'default' : 'outline'}
                        onClick={() => setCardStatusFilter(f)}
                        className="capitalize"
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Card Number</TableHead>
                        <TableHead>NFC Chip</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>National ID</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nfcCards
                        .filter(c => cardStatusFilter === 'all' || (cardStatusFilter === 'linked' ? c.isLinked : !c.isLinked))
                        .length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                            No cards found
                          </TableCell>
                        </TableRow>
                      ) : nfcCards
                        .filter(c => cardStatusFilter === 'all' || (cardStatusFilter === 'linked' ? c.isLinked : !c.isLinked))
                        .map(c => (
                          <TableRow key={c._id}>
                            <TableCell className="font-mono font-medium">{c.cardNumber}</TableCell>
                            <TableCell>
                              {c.nfcUid
                                ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-mono">{c.nfcUid}</span>
                                : <span className="text-xs text-gray-400 italic">Not scanned</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant={c.isLinked ? 'default' : 'secondary'}>
                                {c.isLinked ? 'Linked' : 'Available'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {c.patientId
                                ? `${c.patientId.firstName} ${c.patientId.lastName}`
                                : <span className="text-gray-400">—</span>}
                            </TableCell>
                            <TableCell className="text-gray-500">
                              {c.patientId?.nationalId ?? <span className="text-gray-400">—</span>}
                            </TableCell>
                            <TableCell className="text-gray-400 text-xs">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant={c.nfcUid ? 'outline' : 'default'}
                                className="h-7 text-xs gap-1.5"
                                onClick={() => openScanDialog(c)}
                              >
                                <Wifi className="h-3 w-3" />{c.nfcUid ? 'Re-scan' : 'Scan'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Admins Tab */}
        <TabsContent value="admins">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle>Hospital Administrators</CardTitle>
                <Button onClick={() => setAdminDialogOpen(true)} size="sm">
                  <UserPlus className="h-4 w-4 mr-1.5" />Create Admin
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Hospital</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hospitalAdmins.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                          No hospital admins yet
                        </TableCell>
                      </TableRow>
                    ) : hospitalAdmins.map(a => (
                      <TableRow key={a._id}>
                        <TableCell className="font-medium">{a.fullName}</TableCell>
                        <TableCell className="text-gray-500">{a.email}</TableCell>
                        <TableCell className="text-gray-500">{a.phoneNumber ?? '—'}</TableCell>
                        <TableCell>{a.hospitalId?.name ?? <span className="text-gray-400">—</span>}</TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:text-red-600"
                            aria-label="Delete admin"
                            onClick={() => setDeleteAdminId(a._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => { if (!open) setDeleteId(null) }}
        title="Delete Hospital"
        description="This will permanently remove the hospital and cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteHospital}
        loading={deleting}
      />

      <ConfirmDialog
        open={!!deleteAdminId}
        onOpenChange={open => { if (!open) setDeleteAdminId(null) }}
        title="Delete Hospital Admin"
        description="This will permanently remove the hospital admin account and cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteAdmin}
        loading={deletingAdmin}
      />

      {/* Hospital Dialog */}
      <Dialog
        open={hospitalDialogOpen}
        onOpenChange={v => {
          setHospitalDialogOpen(v)
          if (!v) {
            setEditingHospital(null)
            setHospitalForm({ name: '', address: '', phoneNumber: '', email: '', hotline: '', licenseNumber: '' })
            setFormErrors({})
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingHospital ? 'Edit Hospital' : 'Onboard New Hospital'}</DialogTitle>
            <DialogDescription>
              {editingHospital ? 'Update hospital details' : 'Register a new healthcare facility'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Hospital Name *</Label>
              <Input value={hospitalForm.name} onChange={e => hf('name', e.target.value)} placeholder="City Medical Center" />
              {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
            </div>
            <div className="space-y-1">
              <Label>Address *</Label>
              <Input value={hospitalForm.address} onChange={e => hf('address', e.target.value)} placeholder="123 Medical Drive, City" />
              {formErrors.address && <p className="text-xs text-red-500">{formErrors.address}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone *</Label>
                <Input value={hospitalForm.phoneNumber} onChange={e => hf('phoneNumber', e.target.value)} placeholder="+1 555-0100" />
                {formErrors.phoneNumber && <p className="text-xs text-red-500">{formErrors.phoneNumber}</p>}
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" value={hospitalForm.email} onChange={e => hf('email', e.target.value)} placeholder="info@hospital.com" />
                {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Emergency Hotline</Label>
                <Input value={hospitalForm.hotline} onChange={e => hf('hotline', e.target.value)} placeholder="911" />
              </div>
              <div className="space-y-1">
                <Label>License Number</Label>
                <Input value={hospitalForm.licenseNumber} onChange={e => hf('licenseNumber', e.target.value)} placeholder="HOSP-12345" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHospitalDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveHospital} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : editingHospital ? 'Update' : 'Onboard Hospital'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Dialog */}
      <Dialog
        open={adminDialogOpen}
        onOpenChange={v => {
          setAdminDialogOpen(v)
          if (!v) {
            setAdminForm({ fullName: '', email: '', password: '', phoneNumber: '', hospitalId: '' })
            setFormErrors({})
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Hospital Admin</DialogTitle>
            <DialogDescription>Add an admin for a hospital facility</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full Name *</Label>
              <Input value={adminForm.fullName} onChange={e => af('fullName', e.target.value)} placeholder="Admin full name" />
              {formErrors.fullName && <p className="text-xs text-red-500">{formErrors.fullName}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" value={adminForm.email} onChange={e => af('email', e.target.value)} placeholder="admin@hospital.com" />
              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
            </div>
            <div className="space-y-1">
              <Label>Password *</Label>
              <Input type="password" value={adminForm.password} onChange={e => af('password', e.target.value)} placeholder="Min 6 characters" />
              {formErrors.password && <p className="text-xs text-red-500">{formErrors.password}</p>}
            </div>
            <div className="space-y-1">
              <Label>Phone Number</Label>
              <Input value={adminForm.phoneNumber} onChange={e => af('phoneNumber', e.target.value)} placeholder="Phone number" />
            </div>
            <div className="space-y-1">
              <Label>Hospital *</Label>
              <Select value={adminForm.hospitalId} onValueChange={v => af('hospitalId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select hospital..." />
                </SelectTrigger>
                <SelectContent>
                  {hospitals.map(h => (
                    <SelectItem key={h._id} value={h._id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.hospitalId && <p className="text-xs text-red-500">{formErrors.hospitalId}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAdmin} disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Create Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scan NFC Chip Dialog */}
      <Dialog open={!!scanTarget} onOpenChange={open => { if (!open) closeScanDialog() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan NFC Chip</DialogTitle>
            <DialogDescription>
              Tap the physical NFC card to read its chip ID and assign it to <span className="font-mono font-medium">{scanTarget?.cardNumber}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing chip warning */}
            {scanTarget?.nfcUid && scanStatus === 'idle' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-xs font-medium text-amber-700 mb-0.5">Already assigned</p>
                <p className="font-mono text-sm text-amber-800">{scanTarget.nfcUid}</p>
                <p className="text-xs text-amber-600 mt-1">Scanning a new card will replace this assignment.</p>
              </div>
            )}

            {/* Idle */}
            {scanStatus === 'idle' && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-600 space-y-0.5">
                <p className="font-medium text-sm text-blue-700 mb-1">How to scan:</p>
                <p>1. Make sure the NFC bridge is running (<span className="font-mono">python nfc_bridge.py</span>)</p>
                <p>2. Click "Start Scan" and place the NFC card on the ACR122U reader</p>
                <p>3. The chip ID will be read automatically — confirm to save it</p>
              </div>
            )}

            {/* Scanning — NFC animation + bridge status */}
            {scanStatus === 'scanning' && (
              <div className="flex flex-col items-center py-4 gap-3">
                <div className="relative flex items-center justify-center">
                  {bridgeStatus === 'connected' && (
                    <>
                      <span className="absolute inline-flex h-20 w-20 rounded-full bg-blue-100 opacity-75 animate-ping" />
                      <span className="absolute inline-flex h-14 w-14 rounded-full bg-blue-200 opacity-60 animate-ping [animation-delay:0.3s]" />
                    </>
                  )}
                  <div className={`relative flex h-10 w-10 items-center justify-center rounded-full ${bridgeStatus === 'unavailable' ? 'bg-gray-300' : 'bg-[#0055BB]'}`}>
                    <Wifi className="h-5 w-5 text-white rotate-90" />
                  </div>
                </div>

                {bridgeStatus === 'checking' && (
                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full border-2 border-gray-300 border-t-gray-500 animate-spin inline-block" />
                    Connecting to NFC bridge…
                  </p>
                )}
                {bridgeStatus === 'connected' && (
                  <div className="text-center space-y-0.5">
                    <p className="text-xs text-green-600 flex items-center gap-1 justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5" />NFC reader connected
                    </p>
                    <p className="text-sm font-medium text-gray-600 animate-pulse">Place card on the reader…</p>
                  </div>
                )}
                {bridgeStatus === 'unavailable' && (
                  <div className="w-full space-y-3">
                    <p className="text-xs text-amber-600 flex items-center gap-1 justify-center">
                      <AlertCircle className="h-3.5 w-3.5" />NFC reader not detected
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Enter UID manually</label>
                      <Input
                        placeholder="e.g. 04ABCDEF123456"
                        value={manualUid}
                        onChange={e => setManualUid(e.target.value.toUpperCase())}
                        autoFocus
                        spellCheck={false}
                        className="font-mono"
                      />
                      <p className="text-xs text-gray-400">Make sure <span className="font-mono">nfc_bridge.py</span> is running, or enter the UID from the card label.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Confirm */}
            {scanStatus === 'confirm' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <div>
                    <p className="text-xs text-green-600 font-medium">Card detected</p>
                    <p className="font-mono text-sm font-semibold text-green-800 mt-0.5">{scanUid}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">
                  Assign this chip to <span className="font-mono font-medium">{scanTarget?.cardNumber}</span>?
                </p>
              </div>
            )}

            {/* Saving */}
            {scanStatus === 'saving' && (
              <div className="flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-4">
                <div className="h-5 w-5 rounded-full border-2 border-blue-300 border-t-blue-500 animate-spin shrink-0" />
                <p className="text-sm text-blue-700">Saving…</p>
              </div>
            )}

            {/* Success */}
            {scanStatus === 'success' && (
              <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-4">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700">Chip assigned successfully</p>
                  <p className="font-mono text-xs text-green-600 mt-0.5">{scanUid || manualUid}</p>
                </div>
              </div>
            )}

            {/* Error */}
            {scanStatus === 'error' && (
              <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-4">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700">Failed</p>
                  <p className="text-xs text-red-500 mt-0.5">{scanError}</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeScanDialog}>
              {scanStatus === 'success' ? 'Done' : 'Cancel'}
            </Button>
            {scanStatus === 'idle' && (
              <Button onClick={handleScanNfc}>
                <Wifi className="h-4 w-4 mr-1.5" />Start Scan
              </Button>
            )}
            {scanStatus === 'scanning' && bridgeStatus !== 'unavailable' && (
              <Button disabled>
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin mr-2" />Scanning…
              </Button>
            )}
            {scanStatus === 'scanning' && bridgeStatus === 'unavailable' && manualUid.trim() && (
              <Button onClick={handleSaveUid}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />Confirm
              </Button>
            )}
            {scanStatus === 'confirm' && (
              <Button onClick={handleSaveUid}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />Confirm
              </Button>
            )}
            {scanStatus === 'saving' && (
              <Button disabled>
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin mr-2" />Saving…
              </Button>
            )}
            {scanStatus === 'error' && (
              <Button onClick={handleScanNfc}>
                <Wifi className="h-4 w-4 mr-1.5" />Try Again
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
