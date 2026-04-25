import React from 'react'
import { ShieldAlert, AlertTriangle, Info, ShieldCheck, HelpCircle } from 'lucide-react'
import type { DDISeverity } from '@/types'

interface SeverityBadgeProps {
  severity: DDISeverity
  showIcon?: boolean
}

const config: Record<DDISeverity, { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
  critical: { label: 'Critical', className: 'severity-critical', Icon: ShieldAlert },
  high: { label: 'High', className: 'severity-high', Icon: ShieldAlert },
  moderate: { label: 'Moderate', className: 'severity-moderate', Icon: AlertTriangle },
  low: { label: 'Low', className: 'severity-low', Icon: Info },
  none: { label: 'None', className: 'severity-none', Icon: ShieldCheck },
  unknown: { label: 'Unknown', className: 'severity-unknown', Icon: HelpCircle },
}

export function SeverityBadge({ severity, showIcon = true }: SeverityBadgeProps) {
  const { label, className, Icon } = config[severity] ?? config['unknown']
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {showIcon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}
