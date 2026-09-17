import Link from 'next/link'
import { ArrowRight, CalendarDays, MapPin, Plus } from 'lucide-react'
import { Logo } from '@/components/logo'
import { ProgressBar } from '@/components/progress-bar'
import { getCleanerCleanings } from '@/lib/data/cleanings'
import { formatCleaningDateTime } from '@/lib/date-format'
import type { CleanerCleaning } from '@/lib/data/cleanings'

export default async function CleanerJobsPage() {
  const cleanings = await getCleanerCleanings()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-5 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <Logo />
        <h1 className="text-xl font-semibold tracking-tight">Мои уборки</h1>
      </header>

      <Link
        href="/cleaner/jobs/new"
        className="mt-6 flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-semibold text-primary-foreground transition-opacity active:opacity-80"
      >
        <Plus className="size-5" />
        Новая уборка
      </Link>

      <section className="mt-8 space-y-3">
        {cleanings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Уборок пока нет
          </p>
        ) : cleanings.map((cleaning) => <CleaningCard key={cleaning.id} cleaning={cleaning} />)}
      </section>
    </main>
  )
}

function CleaningCard({ cleaning }: { cleaning: CleanerCleaning }) {
  return (
    <Link
      href={`/cleaner/jobs/${cleaning.id}`}
      className="block rounded-2xl border border-border bg-card p-5 transition-colors active:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tracking-tight">Уборка №{cleaning.number}</p>
          <p className="mt-1 font-medium">{cleaning.clientName || 'Клиент не указан'}</p>
        </div>
        <StatusBadge status={cleaning.status} />
      </div>
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <div className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0" /><span>{cleaning.address}</span></div>
        <div className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0" /><span>{cleaning.startedAt ? formatCleaningDateTime(cleaning.startedAt) : 'Дата начала не указана'}</span></div>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Прогресс</span>
          <span className="font-medium">{cleaning.progress.done} из {cleaning.progress.total}</span>
        </div>
        <ProgressBar percent={cleaning.progress.percent} className="mt-2" />
      </div>
      <div className="mt-4 flex items-center justify-end gap-1 text-sm font-medium text-primary">
        Открыть <ArrowRight className="size-4" />
      </div>
    </Link>
  )
}

function StatusBadge({ status }: { status: CleanerCleaning['status'] }) {
  const label = status === 'accepted' ? 'Принята' : status === 'completed' ? 'Завершена' : 'В процессе'
  return <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{label}</span>
}
