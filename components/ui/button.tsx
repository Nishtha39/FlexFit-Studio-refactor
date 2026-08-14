import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Dense back-office button.
 * `primary` is the ONLY place the saturated accent appears on a control —
 * one primary action per page region.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap',
    'rounded-md border font-medium transition-colors duration-150 ease-[var(--ease-ui)]',
    'outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-45',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover',
        secondary:
          'border-border bg-surface text-secondary-foreground hover:border-border-strong hover:bg-muted',
        ghost:
          'border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
        danger:
          'border-danger-border bg-danger-soft text-danger hover:border-danger hover:bg-danger-soft',
        link: 'border-transparent bg-transparent px-0 text-primary underline-offset-2 hover:underline',
      },
      size: {
        xs: 'h-6 px-2 text-micro',
        sm: 'h-7 px-2.5 text-sm',
        md: 'h-8 px-3 text-sm',
        lg: 'h-10 px-4 text-base',
        icon: 'size-7 px-0',
        'icon-sm': 'size-6 px-0',
        'icon-lg': 'size-9 px-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

/** Segmented row of buttons that share borders — used in toolbars and view switchers. */
function ButtonGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex items-center [&>*]:rounded-none',
        '[&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md',
        '[&>*:not(:first-child)]:-ml-px',
        className,
      )}
      {...props}
    />
  )
}

/** Icon-only action that appears on table-row hover. */
function RowAction({ className, ...props }: ButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn('opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100', className)}
      {...props}
    />
  )
}

export { Button, ButtonGroup, RowAction, buttonVariants }
