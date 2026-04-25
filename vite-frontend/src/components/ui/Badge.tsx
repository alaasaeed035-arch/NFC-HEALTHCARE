import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#0055BB] text-white',
        secondary: 'bg-gray-100 text-gray-700',
        destructive: 'bg-red-100 text-red-700',
        outline: 'border border-gray-300 text-gray-700',
        success: 'bg-green-100 text-green-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={twMerge(badgeVariants({ variant }), className)} {...props} />
}
