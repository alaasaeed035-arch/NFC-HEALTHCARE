import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Filter } from 'lucide-react'
import { SeverityBadge } from './SeverityBadge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { DDIReport, DDISeverity } from '@/types'
import client from '@/api/client'

interface DDITableProps {
  patientId?: string
  patientIds?: string[]
  reports?: DDIReport[]
  hideAutoFetch?: boolean
}

const ALL_SEVERITIES: DDISeverity[] = ['critical', 'high', 'moderate', 'low', 'none', 'unknown']

export function DDITable({ patientId, patientIds, reports: propReports, hideAutoFetch }: DDITableProps) {
  const [reports, setReports] = useState<DDIReport[]>(propReports ?? [])
  const [loading, setLoading] = useState(!propReports && !hideAutoFetch)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [severityFilter, setSeverityFilter] = useState<DDISeverity | 'all'>('all')

  useEffect(() => {
    if (propReports) {
      setReports(propReports)
      return
    }
    if (hideAutoFetch) return
    setLoading(true)
    client
      .get('/api/ddi-reports')
      .then(res => {
        const d = res.data
        setReports(Array.isArray(d) ? d : d.data ?? [])
      })
      .catch(() => setError('Failed to load DDI reports'))
      .finally(() => setLoading(false))
  }, [propReports, hideAutoFetch])

  const filtered = reports.filter(r => {
    if (patientId && r.patient_id !== patientId) return false
    if (patientIds && patientIds.length > 0 && !patientIds.includes(r.patient_id)) return false
    if (severityFilter !== 'all' && r.analysis.severity !== severityFilter) return false
    return true
  })

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return (
    <div className="flex justify-center py-10">
      <Spinner size="lg" />
    </div>
  )
  if (error) return <p className="text-red-600 text-sm py-4">{error}</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-gray-400" />
        <Button
          size="sm"
          variant={severityFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setSeverityFilter('all')}
        >
          All
        </Button>
        {ALL_SEVERITIES.map(s => (
          <Button
            key={s}
            size="sm"
            variant={severityFilter === s ? 'default' : 'secondary'}
            onClick={() => setSeverityFilter(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">No DDI reports found</div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-8"></TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Existing Meds</TableHead>
                <TableHead>New Drug</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Analysis</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <React.Fragment key={r._id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => toggleExpand(r._id)}
                  >
                    <TableCell>
                      {expanded.has(r._id)
                        ? <ChevronDown className="h-4 w-4 text-gray-400" />
                        : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{r.patient_name}</div>
                      <div className="text-xs text-gray-500">Age: {r.patient_age}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.current_medications.slice(0, 3).map((m, i) => (
                          <span key={i} className="inline-block bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 text-xs">
                            {m.name}
                          </span>
                        ))}
                        {r.current_medications.length > 3 && (
                          <span className="text-xs text-gray-400">+{r.current_medications.length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{r.new_treatment.name}</span>
                      <div className="text-xs text-gray-500">{r.new_treatment.dosage}</div>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={r.analysis.severity} />
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-gray-600 max-w-xs truncate">{r.analysis.analysis}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                  </TableRow>
                  {expanded.has(r._id) && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 uppercase mb-1">Full Analysis</h4>
                            <p className="text-sm text-gray-700">{r.analysis.analysis}</p>
                          </div>
                          {r.analysis.interactions.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-1">Interactions</h4>
                              <ul className="list-disc list-inside space-y-1">
                                {r.analysis.interactions.map((int, i) => (
                                  <li key={i} className="text-sm text-gray-700">{int}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {r.analysis.recommendations.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-1">Recommendations</h4>
                              <ul className="list-disc list-inside space-y-1">
                                {r.analysis.recommendations.map((rec, i) => (
                                  <li key={i} className="text-sm text-gray-700">{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="text-xs text-gray-400">
                            Model: {r.groq_model ?? 'N/A'} · {new Date(r.created_at).toLocaleString()}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
