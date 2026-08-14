import * as React from 'react'
import { cn } from '@/lib/utils'

const fieldBase = [
  'w-full rounded-md border border-input bg-surface text-sm text-foreground',
  'placeholder:text-muted-foreground/70',
  'transition-colors duration-150 ease-[var(--ease-ui)]',
  'hover:border-border-strong',
  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
  'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
  'aria-[invalid=true]:border-danger-border aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger-border',
].join(' ')

function Input({ className, type = 'text', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type={type} className={cn(fieldBase, 'h-8 px-2.5', className)} {...props} />
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, 'min-h-20 px-2.5 py-2 leading-relaxed', className)} {...props} />
}

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, 'h-8 appearance-none pl-2.5 pr-7', className)} {...props}>
      {children}
    </select>
  )
}

function Label({
  className,
  hint,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label
      className={cn(
        'flex items-baseline justify-between gap-2 text-micro font-medium tracking-wide text-muted-foreground uppercase',
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {hint ? <span className="normal-case tracking-normal opacity-70">{hint}</span> : null}
    </label>
  )
}

/** Label + control + help/error, stacked on a 4px rhythm. */
function Field({
  label,
  hint,
  error,
  help,
  htmlFor,
  className,
  children,
}: {
  label?: string
  hint?: string
  error?: string
  help?: string
  htmlFor?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <Label htmlFor={htmlFor} hint={hint}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-micro text-danger">
          {error}
        </p>
      ) : help ? (
        <p className="text-micro text-muted-foreground">{help}</p>
      ) : null}
    </div>
  )
}

/** Checkbox sized for table row selection. Forwards a ref so callers can drive `indeterminate`. */
const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'size-3.5 cursor-pointer appearance-none rounded-sm border border-border-strong bg-surface',
        'checked:border-primary checked:bg-primary',
        "checked:bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M2.5 6.4 4.8 8.7 9.5 3.6'/></svg>\")] checked:bg-center checked:bg-no-repeat",
        'indeterminate:border-primary indeterminate:bg-primary',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  )
})

export { Input, Textarea, Select, Label, Field, Checkbox, fieldBase }
