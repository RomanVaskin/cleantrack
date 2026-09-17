import { CalendarDays, ListChecks, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { key: 'today', label: 'Сегодня', icon: CalendarDays },
  { key: 'cleanings', label: 'Уборки', icon: ListChecks },
  { key: 'profile', label: 'Профиль', icon: User },
]

export function BottomNav({ active = 'today' }: { active?: string }) {
  return (
    <nav className="flex items-stretch border-t border-border bg-card">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" />
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
