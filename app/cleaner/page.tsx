'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  MapPin,
  User,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { ProgressBar } from '@/components/progress-bar'
import { BottomNav } from '@/components/bottom-nav'
import { Button } from '@/components/ui/button'
import { cleaning, countProgress, initialZones, photos, type Zone } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export default function CleanerPage() {
  const [zones, setZones] = useState<Zone[]>(initialZones)
  const [finished, setFinished] = useState(false)

  const { total, done, percent } = useMemo(() => countProgress(zones), [zones])

  const requiredItems = useMemo(
    () => zones.flatMap((z) => z.items).filter((i) => i.photoRequired),
    [zones],
  )
  const canFinish = requiredItems.every((i) => i.done && i.photo)

  function toggleItem(zoneId: string, itemId: string) {
    setZones((prev) =>
      prev.map((z) =>
        z.id !== zoneId
          ? z
          : {
              ...z,
              items: z.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
            },
      ),
    )
  }

  function attachPhoto(zoneId: string, itemId: string, index: number) {
    const src = photos[index % photos.length].src
    setZones((prev) =>
      prev.map((z) =>
        z.id !== zoneId
          ? z
          : {
              ...z,
              items: z.items.map((i) => (i.id === itemId ? { ...i, photo: src } : i)),
            },
      ),
    )
  }

  function addNextPhoto() {
    for (const z of zones) {
      const item = z.items.find((i) => i.photoRequired && !i.photo)
      if (item) {
        attachPhoto(z.id, item.id, requiredItems.filter((r) => r.photo).length)
        return
      }
    }
  }

  if (finished) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-accent text-primary">
          <CheckCircle2 className="size-10" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Уборка завершена</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {total} из {total} пунктов выполнено
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Уборка №{cleaning.number}</p>
        <Link href="/" className="mt-10 w-full">
          <Button size="lg" className="h-14 w-full rounded-2xl text-base">
            На главную
          </Button>
        </Link>
        <Link href="/client" className="mt-3 text-sm text-muted-foreground underline">
          Открыть как видит клиент
        </Link>
      </main>
    )
  }

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

      <main className="flex-1 px-5 pb-44 pt-4">
        {/* Cleaning info */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Уборка №{cleaning.number}</h1>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              В процессе
            </span>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            <InfoRow icon={<MapPin className="size-4" />} label="Адрес" value={cleaning.address} />
            <InfoRow icon={<User className="size-4" />} label="Клиент" value={cleaning.client} />
            <InfoRow icon={<Clock className="size-4" />} label="Начало" value={cleaning.startedAt} />
          </dl>
        </section>

        {/* Progress */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Выполнено</p>
              <p className="text-2xl font-semibold tracking-tight">
                {done} из {total}
              </p>
            </div>
            <span className="text-4xl font-semibold tabular-nums text-primary">{percent}%</span>
          </div>
          <ProgressBar percent={percent} className="mt-4" />
        </section>

        {/* Checklist */}
        {zones.map((zone) => (
          <section key={zone.id} className="mt-6">
            <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {zone.title}
            </h2>
            <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
              {zone.items.map((item, idx) => (
                <li key={item.id} className={cn(idx > 0 && 'border-t border-border')}>
                  <div className="flex min-h-[60px] items-center gap-3 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => toggleItem(zone.id, item.id)}
                      aria-pressed={item.done}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors',
                          item.done
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background',
                        )}
                      >
                        {item.done && <Check className="size-5" />}
                      </span>
                      <span
                        className={cn(
                          'text-[15px] leading-snug',
                          item.done && 'text-muted-foreground line-through',
                        )}
                      >
                        {item.label}
                        {item.photoRequired && !item.photo && (
                          <span className="mt-0.5 block text-xs font-medium text-primary no-underline">
                            Фото обязательно
                          </span>
                        )}
                      </span>
                    </button>

                    {item.photoRequired &&
                      (item.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photo || '/placeholder.svg'}
                          alt="Фото пункта"
                          className="size-11 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => attachPhoto(zone.id, item.id, idx)}
                          className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
                          aria-label="Добавить фото"
                        >
                          <Camera className="size-5" />
                        </button>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      {/* Sticky actions */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md">
        <div className="border-t border-border bg-background/95 px-5 pb-2 pt-3 backdrop-blur">
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={addNextPhoto}
              className="h-14 flex-1 rounded-2xl text-base"
            >
              <Camera className="size-5" />
              Добавить фото
            </Button>
            <Button
              size="lg"
              disabled={!canFinish}
              onClick={() => setFinished(true)}
              className="h-14 flex-[1.4] rounded-2xl text-base"
            >
              Завершить уборку
            </Button>
          </div>
          {!canFinish && (
            <p className="pt-2 text-center text-xs text-muted-foreground">
              Отметьте обязательные пункты и добавьте фото
            </p>
          )}
        </div>
        <BottomNav active="today" />
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
