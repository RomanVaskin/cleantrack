import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({
  withTagline = false,
  className,
}: {
  withTagline?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="size-4" />
      </span>
      <div className="leading-tight">
        <span className="text-base font-semibold tracking-tight text-foreground">
          CleanTrack
        </span>
        {withTagline && (
          <span className="block text-xs text-muted-foreground">Уборка под контролем</span>
        )}
      </div>
    </div>
  )
}
