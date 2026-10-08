import { Camera, Check, ChevronRight, Clock, Sparkles } from 'lucide-react'
import { ProgressBar } from '@/components/progress-bar'
import { RULES_PREVIEW } from '@/lib/home-content'
import { cn } from '@/lib/utils'

// A phone-framed preview of the real tracker UI (status, progress, checklist, photos, client
// rules — the same shape as app/client/client-view.tsx), built fresh for the homepage so this
// patch never imports from or touches /client. Photos are the project's own existing demo assets
// (lib/mock-data.ts); rule text is copied from lib/home-content.ts (itself copied verbatim from
// lib/mock-data.ts's cabinetOptions/moveOptions) — nothing here is invented product UI.

const PROGRESS_PERCENT = 68

const CHECKLIST_ITEMS = [
  { label: 'Пыль с поверхностей', done: true },
  { label: 'Пылесос и мойка пола', done: true },
  { label: 'Кухня: рабочие зоны', done: true },
  { label: 'Санузел', done: false },
  { label: 'Зеркала и стёкла', done: false },
]

const PREVIEW_PHOTOS = [
  { src: '/photos/kitchen.png', alt: 'Кухня после уборки' },
  { src: '/photos/sink.png', alt: 'Раковина и зеркало' },
  { src: '/photos/room.png', alt: 'Комната после уборки' },
]

function FloatingCard({
  className,
  icon,
  title,
  value,
}: {
  className?: string
  icon: React.ReactNode
  title: string
  value: string
}) {
  return (
    <div
      className={cn(
        'absolute z-10 hidden items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-lg shadow-foreground/5 lg:flex',
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        {icon}
      </span>
      <span className="leading-tight">
        <span className="block text-[11px] text-muted-foreground">{title}</span>
        <span className="block text-sm font-semibold text-foreground">{value}</span>
      </span>
    </div>
  )
}

export function TrackerMockup({
  className,
  floating = false,
}: {
  className?: string
  floating?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      {floating && (
        <>
          <FloatingCard
            className="-left-14 top-8 -translate-x-1/2"
            icon={<Check className="size-4" />}
            title="Статус"
            value="Уборка идёт"
          />
          <FloatingCard
            className="-right-10 top-[24rem] translate-x-1/2"
            icon={<Camera className="size-4" />}
            title="Фотоотчёт"
            value="5 фото"
          />
        </>
      )}

      <div className="mx-auto w-full max-w-[344px] rounded-[2rem] border border-border bg-card p-2 shadow-xl shadow-foreground/5 lg:-mt-4">
        <div className="overflow-hidden rounded-[1.6rem] border border-border/60 bg-background">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-3.5" />
            </span>
            <p className="flex-1 text-sm font-semibold text-foreground">CleanTrack</p>
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" /> Идёт уборка
            </span>
          </div>

          <div className="space-y-3 px-4 py-4">
            <div className="rounded-xl border border-border bg-muted/50 p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-foreground">Прогресс уборки</span>
                <span className="text-lg font-semibold text-foreground">{PROGRESS_PERCENT}%</span>
              </div>
              <ProgressBar percent={PROGRESS_PERCENT} className="mt-2" />
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" /> Осталось ~40 мин
              </p>
            </div>

            <div className="rounded-xl border border-border p-3.5">
              <p className="text-sm font-medium text-foreground">Чек-лист работ</p>
              <ul className="mt-2 space-y-1.5">
                {CHECKLIST_ITEMS.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-xs">
                    <span
                      className={
                        item.done
                          ? 'flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'
                          : 'size-4 shrink-0 rounded-full border border-border'
                      }
                    >
                      {item.done && <Check className="size-3" />}
                    </span>
                    <span className={item.done ? 'truncate text-muted-foreground line-through' : 'truncate text-foreground'}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Camera className="size-3.5" /> Фотоотчёт
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {PREVIEW_PHOTOS.map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.src}
                    src={photo.src}
                    alt={photo.alt}
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border p-3.5 text-left">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Правила клиента</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{RULES_PREVIEW.wishes}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
