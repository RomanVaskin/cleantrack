import { cn } from '@/lib/utils'

export function ProgressBar({
  percent,
  className,
}: {
  percent: number
  className?: string
}) {
  return (
    <div
      className={cn('h-3 w-full overflow-hidden rounded-full bg-secondary', className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
