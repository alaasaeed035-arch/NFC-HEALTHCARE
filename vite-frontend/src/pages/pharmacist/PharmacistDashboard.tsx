import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Package, AlertTriangle, ClipboardList, Search, Plus, Edit2, Check,
  X, Pill, Clock, User, CheckCircle2, RefreshCw, Droplets, Calendar,
  ChevronRight, FileText, AlertCircle, Beaker, Wifi,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/Dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { NfcScanModal } from '@/components/nfc/NfcScanModal'
import type { Patient, PharmacyInventoryItem, Prescription } from '@/types'
import client from '@/api/client'

// ── helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isLow(item: PharmacyInventoryItem) {
  return item.quantityInStock < item.lowStockThreshold
}

function StatusBadge({ status }: { status: Prescription['status'] }) {
  const map = {
    pending_pickup: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
    dispensed: { label: 'Dispensed', className: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
  }
  const { label, className } = map[status] ?? map.pending_pickup
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}

function PatientCard({ patient }: { patient: Patient }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0055BB] to-[#003380] p-4 text-white">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
          <User className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold">{patient.firstName} {patient.lastName}</p>
          <p className="text-xs text-blue-200">ID: {patient.nationalId}</p>
          <div className="flex gap-3 mt-1 text-xs text-blue-100">
            {patient.bloodType && (
              <span className="flex items-center gap-1"><Droplets className="h-3 w-3" />{patient.bloodType}</span>
            )}
            {patient.gender && <span>{patient.gender}</span>}
            {patient.dateOfBirth && <span>{fmtDate(patient.dateOfBirth)}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AddDrugDialog ──────────────────────────────────────────────────────────

interface AddDrugDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

const BLANK_FORM = {
  name: '', genericName: '', dosageForms: '', quantityInStock: '',
  unit: '', manufacturer: '', expiryDate: '', lowStockThreshold: '10',
}

function AddDrugDialog({ open, onOpenChange, onSaved }: AddDrugDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)

  function set(k: keyof typeof BLANK_FORM, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit() {
    if (!form.name.trim()) { toast({ title: 'Drug name is required', variant: 'error' }); return }
    if (!form.quantityInStock) { toast({ title: 'Quantity is required', variant: 'error' }); return }
    setSaving(true)
    try {
      await client.post('/api/pharmacy/inventory', {
        name: form.name.trim(),
        genericName: form.genericName.trim() || undefined,
        dosageForms: form.dosageForms ? form.dosageForms.split(',').map(s => s.trim()).filter(Boolean) : [],
        quantityInStock: Number(form.quantityInStock),
        unit: form.unit.trim() || undefined,
        manufacturer: form.manufacturer.trim() || undefined,
        expiryDate: form.expiryDate || undefined,
        lowStockThreshold: Number(form.lowStockThreshold) || 10,
      })
      toast({ title: 'Drug added to inventory', variant: 'success' })
      setForm(BLANK_FORM)
      onOpenChange(false)
      onSaved()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Failed to add drug', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="h-4 w-4 text-[#0055BB]" />Add Drug to Inventory
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Drug Name *</Label>
              <Input placeholder="e.g., Amoxicillin" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Generic Name</Label>
              <Input placeholder="e.g., Amoxicillin trihydrate" value={form.genericName} onChange={e => set('genericName', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Quantity in Stock *</Label>
              <Input type="number" min="0" placeholder="e.g., 500" value={form.quantityInStock} onChange={e => set('quantityInStock', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Input placeholder="e.g., tablets, ml" value={form.unit} onChange={e => set('unit', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Dosage Forms <span className="text-gray-400 font-normal">(comma-separated)</span></Label>
              <Input placeholder="e.g., tablet, syrup, capsule" value={form.dosageForms} onChange={e => set('dosageForms', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Manufacturer</Label>
              <Input placeholder="e.g., Pfizer" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Low Stock Threshold</Label>
              <Input type="number" min="0" placeholder="10" value={form.lowStockThreshold} onChange={e => set('lowStockThreshold', e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <><Spinner size="sm" /> Saving...</> : 'Add Drug'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── EditQtyDialog ──────────────────────────────────────────────────────────

interface EditQtyDialogProps {
  item: PharmacyInventoryItem | null
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function EditQtyDialog({ item, onOpenChange, onSaved }: EditQtyDialogProps) {
  const { toast } = useToast()
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) setQty(String(item.quantityInStock))
  }, [item])

  async function handleSave() {
    if (!item) return
    setSaving(true)
    try {
      await client.patch(`/api/pharmacy/inventory/${item._id}`, { quantityInStock: Number(qty) })
      toast({ title: 'Stock updated', variant: 'success' })
      onOpenChange(false)
      onSaved()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Update failed', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={v => !v && onOpenChange(false)}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Update Stock — {item?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>New Quantity ({item?.unit ?? 'units'})</Label>
          <Input
            type="number" min="0"
            value={qty}
            onChange={e => setQty(e.target.value)}
            autoFocus
          />
          {item && Number(qty) < item.lowStockThreshold && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />Below low-stock threshold ({item.lowStockThreshold})
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || qty === ''}>
            {saving ? <><Spinner size="sm" /> Saving...</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── InventoryTab ───────────────────────────────────────────────────────────

interface InventoryTabProps {
  inventory: PharmacyInventoryItem[]
  loading: boolean
  onRefresh: () => void
}

function InventoryTab({ inventory, loading, onRefresh }: InventoryTabProps) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<PharmacyInventoryItem | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const filtered = inventory.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.genericName ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const lowStockItems = inventory.filter(isLow)

  async function toggleActive(item: PharmacyInventoryItem) {
    setTogglingId(item._id)
    try {
      await client.patch(`/api/pharmacy/inventory/${item._id}`, { isActive: !item.isActive })
      toast({ title: `${item.name} marked ${!item.isActive ? 'active' : 'inactive'}`, variant: 'success' })
      onRefresh()
    } catch {
      toast({ title: 'Failed to update item', variant: 'error' })
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4" id="inventory">
      {/* Low stock banner */}
      {lowStockItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-3.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {lowStockItems.length} drug{lowStockItems.length > 1 ? 's' : ''} below reorder threshold
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {lowStockItems.map(i => `${i.name} (${i.quantityInStock} ${i.unit ?? 'units'})`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search drugs…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Add Drug
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Package className="h-12 w-12 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">
            {inventory.length === 0 ? 'No drugs in inventory' : 'No results found'}
          </p>
          {inventory.length === 0 && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add first drug
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Drug</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Forms</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Expiry</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(item => (
                <tr key={item._id} className={`${!item.isActive ? 'opacity-50' : ''} hover:bg-gray-50 transition-colors`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.genericName && (
                      <p className="text-xs text-gray-400">{item.genericName}</p>
                    )}
                    {item.manufacturer && (
                      <p className="text-xs text-gray-400">{item.manufacturer}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(item.dosageForms ?? []).map(f => (
                        <span key={f} className="bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0.5 rounded">{f}</span>
                      ))}
                      {!item.dosageForms?.length && <span className="text-gray-300">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={`font-bold ${isLow(item) ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.quantityInStock}
                      </span>
                      <span className="text-xs text-gray-400">{item.unit ?? 'units'}</span>
                      {isLow(item) && (
                        <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />Low
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{fmtDate(item.expiryDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.isActive
                      ? <Badge variant="success">Active</Badge>
                      : <Badge variant="secondary">Inactive</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline" size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditItem(item)}
                      >
                        <Edit2 className="h-3 w-3 mr-1" />Qty
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        className={`h-7 px-2 text-xs ${item.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                        onClick={() => toggleActive(item)}
                        disabled={togglingId === item._id}
                      >
                        {togglingId === item._id
                          ? <Spinner size="sm" />
                          : item.isActive ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddDrugDialog open={addOpen} onOpenChange={setAddOpen} onSaved={onRefresh} />
      <EditQtyDialog item={editItem} onOpenChange={v => !v && setEditItem(null)} onSaved={onRefresh} />
    </div>
  )
}

// ── availability check ────────────────────────────────────────────────────

interface MedAvailability {
  drugName: string
  available: boolean
  reason: string
}

function checkMedAvailability(rx: Prescription, inventory: PharmacyInventoryItem[]): MedAvailability[] {
  return rx.medications.map(med => {
    const drugName = med.name ?? (typeof med.inventoryItemId === 'object' && med.inventoryItemId !== null
      ? (med.inventoryItemId as PharmacyInventoryItem).name
      : '') ?? 'Unknown'

    // Resolve inventory item
    let found: PharmacyInventoryItem | undefined
    if (typeof med.inventoryItemId === 'object' && med.inventoryItemId !== null) {
      found = med.inventoryItemId as PharmacyInventoryItem
    } else if (typeof med.inventoryItemId === 'string' && med.inventoryItemId) {
      found = inventory.find(i => i._id === med.inventoryItemId)
    }
    if (!found && med.name) {
      const lower = med.name.toLowerCase()
      found = inventory.find(i =>
        i.name.toLowerCase() === lower || i.genericName?.toLowerCase() === lower
      )
    }

    if (!found) return { drugName, available: false, reason: 'Not in inventory' }
    if (!found.isActive) return { drugName, available: false, reason: 'Marked inactive' }
    if (found.quantityInStock <= 0) return { drugName, available: false, reason: 'Out of stock' }
    return { drugName, available: true, reason: '' }
  })
}

// ── PrescriptionCard ───────────────────────────────────────────────────────

interface PrescriptionCardProps {
  rx: Prescription
  inventory: PharmacyInventoryItem[]
  onDispense: (rx: Prescription, unavailable: MedAvailability[]) => void
}

function PrescriptionCard({ rx, inventory, onDispense }: PrescriptionCardProps) {
  const doctor = typeof rx.doctorId === 'object' ? rx.doctorId : null
  const availability = checkMedAvailability(rx, inventory)
  const unavailable = availability.filter(a => !a.available)

  return (
    <div className="rounded-xl border p-4 hover:shadow-sm transition-shadow bg-white">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />{fmtDate(rx.createdAt)}
          </p>
          {doctor && (
            <p className="text-xs text-gray-500 mt-0.5">
              Dr. {doctor.firstName} {doctor.lastName}
              {doctor.specialization && ` · ${doctor.specialization}`}
            </p>
          )}
          {rx.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{rx.notes}"</p>}
        </div>
        <StatusBadge status={rx.status} />
      </div>

      <div className="space-y-1 mb-3">
        {rx.medications.map((med, i) => {
          const invItem = typeof med.inventoryItemId === 'object' ? med.inventoryItemId : null
          const drugName = med.name ?? invItem?.name ?? 'Unknown drug'
          const avail = availability[i]
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Pill className={`h-3.5 w-3.5 flex-shrink-0 ${avail.available ? 'text-[#0055BB]' : 'text-red-400'}`} />
              <span className={`font-medium ${avail.available ? '' : 'text-red-600'}`}>{drugName}</span>
              {med.dosage && <span className="text-gray-400">{med.dosage}</span>}
              {med.frequency && <span className="text-gray-400 hidden sm:inline">· {med.frequency}</span>}
              {med.duration && <span className="text-gray-400 hidden sm:inline">· {med.duration}</span>}
              {!avail.available && (
                <span className="ml-auto text-[10px] font-semibold text-red-500 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                  {avail.reason}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {unavailable.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            <span className="font-semibold">{unavailable.length} medication{unavailable.length > 1 ? 's' : ''} unavailable:</span>{' '}
            {unavailable.map(u => `${u.drugName} (${u.reason})`).join(', ')}
          </p>
        </div>
      )}

      {rx.status === 'pending_pickup' && (
        <Button
          className="w-full h-8 text-sm"
          onClick={() => onDispense(rx, unavailable)}
          disabled={unavailable.length > 0}
          title={unavailable.length > 0 ? 'Cannot dispense — some medications are unavailable' : undefined}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Dispense
        </Button>
      )}
    </div>
  )
}

// ── DispenseTab ────────────────────────────────────────────────────────────

interface DispenseTabProps {
  pendingRx: Prescription[]
  patientLoading: boolean
  rxLoading: boolean
  foundPatient: Patient | null
  inventory: PharmacyInventoryItem[]
  onPatientSearch: (id: string) => void
}

function DispenseTab({ pendingRx, patientLoading, rxLoading, foundPatient, inventory, onPatientSearch }: DispenseTabProps) {
  const [input, setInput] = useState('')
  const [nfcOpen, setNfcOpen] = useState(false)
  const [dispenseTarget, setDispenseTarget] = useState<Prescription | null>(null)
  const [dispensing, setDispensing] = useState(false)
  const { toast } = useToast()
  const [localRx, setLocalRx] = useState<Prescription[]>(pendingRx)

  useEffect(() => setLocalRx(pendingRx), [pendingRx])

  function handleDispenseClick(rx: Prescription, unavailable: MedAvailability[]) {
    if (unavailable.length > 0) return
    setDispenseTarget(rx)
  }

  async function handleDispense() {
    if (!dispenseTarget) return
    setDispensing(true)
    try {
      await client.patch(`/api/pharmacy/prescriptions/${dispenseTarget._id}/dispense`)
      toast({ title: 'Prescription dispensed successfully', variant: 'success' })
      setLocalRx(prev => prev.filter(r => r._id !== dispenseTarget._id))
      setDispenseTarget(null)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast({ title: e?.response?.data?.message ?? 'Dispense failed', variant: 'error' })
    } finally {
      setDispensing(false)
    }
  }

  const rxToDispense = dispenseTarget

  return (
    <div className="space-y-4" id="dispense">
      {/* Patient search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-[#0055BB]" />Find Patient
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">Scan the patient's NFC card or enter their ID manually</p>

          {/* NFC scan button */}
          <button
            onClick={() => setNfcOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#0055BB]/40 bg-blue-50/50 py-3 text-sm font-medium text-[#0055BB] hover:bg-blue-50 hover:border-[#0055BB]/70 transition-colors"
          >
            <Wifi className="h-4 w-4 rotate-90" />
            Scan NFC Card
          </button>


          {patientLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Spinner size="sm" />Searching…
            </div>
          )}

          {!patientLoading && foundPatient && (
            <PatientCard patient={foundPatient} />
          )}

          {!patientLoading && !foundPatient && input && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />Patient not found
            </p>
          )}
        </CardContent>
      </Card>

      <NfcScanModal
        open={nfcOpen}
        onOpenChange={setNfcOpen}
        onPatientFound={p => {
          setNfcOpen(false)
          onPatientSearch(p._id)
        }}
      />

      {/* Pending prescriptions */}
      {foundPatient && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-[#0055BB]" />
              Pending Prescriptions ({localRx.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rxLoading ? (
              <div className="flex justify-center py-8"><Spinner size="lg" /></div>
            ) : localRx.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">All prescriptions have been dispensed</p>
                <p className="text-xs text-gray-400 mt-1">No pending prescriptions for this patient</p>
              </div>
            ) : (
              <div className="space-y-3">
                {localRx.map(rx => (
                  <PrescriptionCard key={rx._id} rx={rx} inventory={inventory} onDispense={handleDispenseClick} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dispense confirmation */}
      <ConfirmDialog
        open={!!dispenseTarget}
        onOpenChange={v => { if (!v) setDispenseTarget(null) }}
        title="Confirm Dispense"
        description={rxToDispense ? `Dispense ${rxToDispense.medications.length} medication(s) for this patient? Stock will be deducted for linked inventory items.` : ''}
        confirmLabel={dispensing ? 'Dispensing…' : 'Yes, Dispense'}
        onConfirm={handleDispense}
        loading={dispensing}
        variant="default"
      />
    </div>
  )
}

// ── HistoryTab ─────────────────────────────────────────────────────────────

function HistoryTab() {
  const [input, setInput] = useState('')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [history, setHistory] = useState<Prescription[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const { toast } = useToast()

  async function handleSearch() {
    if (!input.trim()) return
    setSearching(true)
    setNotFound(false)
    setPatient(null)
    setHistory([])
    try {
      const res = await client.get(`/api/pharmacy/prescriptions/history/${encodeURIComponent(input.trim())}`)
      const data = res.data
      setHistory(Array.isArray(data.data) ? data.data : [])
      // Patient info comes from first prescription
      if (data.data?.length) {
        const p = data.data[0].patientId
        if (typeof p === 'object' && p !== null) setPatient(p as Patient)
      }
      if (!data.data?.length) {
        toast({ title: 'No prescription history found for this patient', variant: 'error' })
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string }; status?: number } }
      if (e?.response?.status === 404) {
        setNotFound(true)
      } else {
        toast({ title: e?.response?.data?.message ?? 'Search failed', variant: 'error' })
      }
    } finally {
      setSearching(false)
      setLoadingHistory(false)
    }
  }

  const grouped = {
    pending_pickup: history.filter(r => r.status === 'pending_pickup'),
    dispensed: history.filter(r => r.status === 'dispensed'),
    cancelled: history.filter(r => r.status === 'cancelled'),
  }

  return (
    <div className="space-y-4" id="history">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-[#0055BB]" />Prescription History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">Enter the patient's MongoDB ID, National ID, or NFC Card ID</p>
          <div className="flex gap-2">
            <Input
              placeholder="Patient ID / National ID / Card ID"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching || !input.trim()}>
              {searching ? <Spinner size="sm" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {notFound && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />Patient not found
            </p>
          )}

          {patient && <PatientCard patient={patient} />}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <div className="space-y-5">
          {(['pending_pickup', 'dispensed', 'cancelled'] as const).map(status => {
            const items = grouped[status]
            if (!items.length) return null
            const labels = { pending_pickup: 'Pending', dispensed: 'Dispensed', cancelled: 'Cancelled' }
            return (
              <div key={status}>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <StatusBadge status={status} />
                  {labels[status]} ({items.length})
                </h3>
                <div className="space-y-2">
                  {items.map(rx => {
                    const doctor = typeof rx.doctorId === 'object' ? rx.doctorId : null
                    const dispensedBy = typeof rx.dispensedBy === 'object' && rx.dispensedBy !== null
                      ? rx.dispensedBy
                      : null
                    return (
                      <div key={rx._id} className="rounded-xl border p-4 bg-white">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />{fmtDate(rx.createdAt)}
                            </p>
                            {doctor && (
                              <p className="text-xs text-gray-500">
                                Prescribed by Dr. {doctor.firstName} {doctor.lastName}
                              </p>
                            )}
                            {dispensedBy && rx.dispensedAt && (
                              <p className="text-xs text-green-600">
                                Dispensed by {dispensedBy.fullName} on {fmtDate(rx.dispensedAt)}
                              </p>
                            )}
                          </div>
                          <StatusBadge status={rx.status} />
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {rx.medications.map((med, i) => {
                            const invItem = typeof med.inventoryItemId === 'object' ? med.inventoryItemId : null
                            const name = med.name ?? invItem?.name ?? 'Unknown'
                            return (
                              <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 text-xs font-medium">
                                <Pill className="h-3 w-3" />
                                {name}{med.dosage ? ` · ${med.dosage}` : ''}
                              </span>
                            )
                          })}
                        </div>
                        {rx.notes && (
                          <p className="text-xs text-gray-400 italic mt-2">"{rx.notes}"</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── PharmacistDashboard (root) ─────────────────────────────────────────────

export default function PharmacistDashboard() {
  const location = useLocation()
  const { toast } = useToast()

  const [inventory, setInventory] = useState<PharmacyInventoryItem[]>([])
  const [loadingInventory, setLoadingInventory] = useState(true)

  const [foundPatient, setFoundPatient] = useState<Patient | null>(null)
  const [patientLoading, setPatientLoading] = useState(false)
  const [pendingRx, setPendingRx] = useState<Prescription[]>([])
  const [rxLoading, setRxLoading] = useState(false)
  const lastSearch = useRef('')

  // Map hash → tab value
  const hashTab = location.hash === '#dispense' ? 'dispense'
    : location.hash === '#history' ? 'history'
    : location.hash === '#inventory' ? 'inventory'
    : 'inventory'

  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true)
    try {
      const res = await client.get('/api/pharmacy/inventory')
      const d = res.data
      setInventory(Array.isArray(d.data) ? d.data : [])
    } catch {
      toast({ title: 'Failed to load inventory', variant: 'error' })
    } finally {
      setLoadingInventory(false)
    }
  }, [toast])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  const handlePatientSearch = useCallback(async (identifier: string) => {
    lastSearch.current = identifier
    setPatientLoading(true)
    setFoundPatient(null)
    setPendingRx([])
    try {
      const res = await client.get(`/api/pharmacy/prescriptions/patient/${encodeURIComponent(identifier)}`)
      const d = res.data
      const rxList: Prescription[] = Array.isArray(d.data) ? d.data : []
      setPendingRx(rxList)
      // Extract patient from first prescription
      if (rxList.length && typeof rxList[0].patientId === 'object') {
        setFoundPatient(rxList[0].patientId as Patient)
      } else {
        // Patient exists but has no pending prescriptions — try fetching by nationalId/cardId
        // We surface a "no pending prescriptions" state with a placeholder patient
        setFoundPatient({ _id: identifier, firstName: '—', lastName: '', nationalId: identifier, role: 'patient', gender: '', dateOfBirth: '' })
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string }; status?: number } }
      if (e?.response?.status === 404) {
        setFoundPatient(null)
      } else {
        toast({ title: e?.response?.data?.message ?? 'Search failed', variant: 'error' })
      }
    } finally {
      setPatientLoading(false)
    }
  }, [toast])

  const lowStockCount = inventory.filter(isLow).length
  const pendingCount = pendingRx.length

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pharmacy Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage inventory, dispense prescriptions, and track history</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Package className="h-5 w-5 text-[#0055BB]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{inventory.length}</p>
              <p className="text-xs text-gray-500">Total Drugs</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${lowStockCount > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <AlertTriangle className={`h-5 w-5 ${lowStockCount > 0 ? 'text-amber-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{lowStockCount}</p>
              <p className="text-xs text-gray-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
              <ClipboardList className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
              <p className="text-xs text-gray-500">Pending (loaded)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main tabs */}
      <Tabs defaultValue={hashTab} key={hashTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-3.5 w-3.5" />Inventory
          </TabsTrigger>
          <TabsTrigger value="dispense" className="gap-2">
            <ClipboardList className="h-3.5 w-3.5" />Dispense
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <FileText className="h-3.5 w-3.5" />History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <InventoryTab inventory={inventory} loading={loadingInventory} onRefresh={fetchInventory} />
        </TabsContent>

        <TabsContent value="dispense">
          <DispenseTab
            pendingRx={pendingRx}
            patientLoading={patientLoading}
            rxLoading={rxLoading}
            foundPatient={foundPatient}
            inventory={inventory}
            onPatientSearch={handlePatientSearch}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
