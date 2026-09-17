'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, Circle, Clock, Lock, MapPin } from 'lucide-react'
import { Logo } from '@/components/logo'
import { ProgressBar } from '@/components/progress-bar'
import { PhotoViewer } from '@/components/photo-viewer'
import { Button } from '@/components/ui/button'
import { acceptCleaning } from '@/lib/data/cleaning-actions'
import { cabinetOptions, countProgress, moveOptions } from '@/lib/mock-data'
import type { ChecklistItem, Cleaning, CleaningStatus, ClientRules, Photo } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ClientViewProps {
  cleaning: Cleaning
  checklist: ChecklistItem[]
  clientRules: ClientRules
  photos: Photo[]
}

export function ClientView({ cleaning, checklist, clientRules, photos }: ClientViewProps) {
  const [status, setStatus] = useState<CleaningStatus>(cleaning.status)
  const [acceptedAt, setAcceptedAt] = useState(cleaning.acceptedAt)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState(false)
  const [viewer, setViewer] = useState<{ src: string; alt: string } | null>(null)
  const completed = status === 'completed'
  const accepted = status === 'accepted'
  const finished = completed || accepted

  const active: ChecklistItem[] = useMemo(() => {
    const included = checklist.filter((s) => s.included)
    return finished ? included.map((s) => ({ ...s, done: true })) : included
  }, [checklist, finished])

  async function accept() {
    setAccepting(true)
    setAcceptError(false)
    const result = await acceptCleaning(cleaning.id)
    setAccepting(false)
    if (!result.ok) {
      setAcceptError(true)
      return
    }
    setAcceptedAt(result.acceptedAt ?? acceptedAt)
    setStatus('accepted')
  }

  const { total, done, percent } = countProgress(active)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Назад" className="-ml-2 flex size-9 items-center justify-center rounded-full text-muted-foreground">
            <ChevronLeft className="size-6" />
          </Link>
          <Logo />
          <span className="size-9" />
        </div>
      </header>

      <main className="flex-1 px-5 pb-12 pt-4">
        {/* Demo state switch */}
        <div className="flex rounded-full bg-secondary p-1 text-sm">
          <button
            type="button"
            onClick={() => setStatus('in_progress')}
            className={cn(
              'flex-1 rounded-full py-2 font-medium transition-colors',
              !finished ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            В процессе
          </button>
          <button
            type="button"
            onClick={() => setStatus('completed')}
            className={cn(
              'flex-1 rounded-full py-2 font-medium transition-colors',
              finished ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            Завершена
          </button>
        </div>

        {/* Status */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-primary">
            {accepted ? 'Работа принята' : completed ? 'Уборка завершена' : 'Уборка в процессе'}
          </p>
          <div className="mt-3 flex flex-col items-center">
            <span className="text-6xl font-semibold tabular-nums tracking-tight text-primary">
              {percent}%
            </span>
          </div>
          <ProgressBar percent={percent} className="mx-auto mt-5 max-w-xs" />
          <p className="mt-3 text-sm text-muted-foreground">
            {done} из {total} услуг выполнено
          </p>
          <p className="mt-4 text-base font-medium">
            {finished ? 'Все услуги выполнены' : 'Уборка идёт по плану'}
          </p>

          <dl className="mt-5 flex justify-center gap-6 border-t border-border pt-4 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              <span className="font-medium">{cleaning.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="font-medium">{cleaning.startedAt}</span>
            </div>
          </dl>
        </section>

        {/* Active services (read-only live status) */}
        <section className="mt-6">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Услуги уборки
          </h2>
          <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
            {active.map((item, idx) => (
              <li
                key={item.id}
                className={cn(
                  'flex min-h-[56px] items-center gap-3 px-4 py-3',
                  idx > 0 && 'border-t border-border',
                )}
              >
                {item.done ? (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" />
                  </span>
                ) : (
                  <Circle className="size-6 shrink-0 text-border" strokeWidth={2} />
                )}
                <span
                  className={cn(
                    'text-[15px] leading-snug',
                    item.done ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Client rules summary (read-only) */}
        <section className="mt-6">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Ваши правила
          </h2>
          <div className="mt-2 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <p className="text-sm font-medium">Клинер видит эти правила</p>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Шкафы и тумбочки</dt>
                <dd className="text-right font-medium">{cabinetOptions[clientRules.cabinets]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Личные вещи</dt>
                <dd className="text-right font-medium">{moveOptions[clientRules.moveItems]}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Photos */}
        <section className="mt-6">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Фото уборки
          </h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <button
                key={p.src}
                type="button"
                onClick={() => setViewer(p)}
                className="aspect-square overflow-hidden rounded-xl border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src || '/placeholder.svg'} alt={p.alt} className="size-full object-cover" />
              </button>
            ))}
          </div>
        </section>

        {finished && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-lg font-semibold">
              {accepted ? 'Работа принята' : 'Уборка завершена'}
            </p>
            {accepted && acceptedAt && (
              <p className="mt-2 text-sm text-muted-foreground">
                {new Intl.DateTimeFormat('ru-RU', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                  timeZone: 'Europe/Moscow',
                }).format(new Date(acceptedAt))}
              </p>
            )}
            {completed && (
              <Button
                size="lg"
                disabled={accepting}
                onClick={accept}
                className="mt-5 h-14 w-full rounded-2xl text-base"
              >
                {accepting ? 'Принимаем…' : 'Принять работу'}
              </Button>
            )}
            {acceptError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                Не удалось принять работу
              </p>
            )}
          </section>
        )}
      </main>

      {viewer && (
        <PhotoViewer src={viewer.src} alt={viewer.alt} onClose={() => setViewer(null)} />
      )}
    </div>
  )
}
