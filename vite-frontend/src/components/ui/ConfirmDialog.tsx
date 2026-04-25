import React from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
  loading?: boolean
  variant?: 'danger' | 'default'
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = 'Confirm', onConfirm, loading, variant = 'danger',
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={variant === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
