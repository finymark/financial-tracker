import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export function NativeSelect({
  className,
  ...props
}: ComponentProps<'select'>) {
  return (
    <div className="relative w-full" data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className={cn(
          'h-10 w-full min-w-0 appearance-none rounded-md border border-input bg-card px-3 py-2 pr-9 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  )
}
