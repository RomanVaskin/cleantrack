'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Lock,
  MapPin,
  Pencil,
  User,
} from 'lucide-react'
import { uploadCleaningPhoto } from '@/lib/photo-upload'
import { PhotoViewer } from '@/components/photo-viewer'
import { Logo } from '@/components/logo'
import { ProgressBar } from '@/components/progress-bar'
import { BottomNav } from '@/components/bottom-nav'
import { Button } from '@/components/ui/button'
import { completeCleaning, updateChecklistItem } from '@/lib/data/cleaning-actions'
import { cabinetOptions, countProgress, moveOptions } from '@/lib/mock-data'
import type { ChecklistItem, Cleaning, CleaningStatus, ClientRules, Photo } from '@/lib/types'
import { cn } from '@/lib/utils'

interface CleanerViewProps {
  cleaning: Cleaning
  checklist: ChecklistItem[]
  clientRules: ClientRules
  photos: Photo[]
}

export function CleanerView({
  cleaning,
  checklist: initialChecklist,
  clientRules,
  photos: initialPhotos,
}: CleanerViewProps) {
  const [photos, setPhotos] = useState(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const [viewer, setViewer] = useState<Photo | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const photoTarget = useRef<string | null>(null)
  const uploadBusy = useRef(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist)
  const [status, setStatus] = useState<CleaningStatus>(cleaning.status)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)

  const { total, done, percent } = useMemo(() => countProgress(checklist), [checklist])
  const active = useMemo(() => checklist.filter((s) => s.included), [checklist])
  const includedCount = active.length

  useEffect(() => {
    if (!saveError) return
    const timer = setTimeout(() => setSaveError(false), 4000)
    return () => clearTimeout(timer)
  }, [saveError])

  function toggleIncluded(id: string) {
    setChecklist((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, included: !s.included, done: false, photo: null } : s,
      ),
    )
  }

  async function toggleDone(id: string) {
    const current = checklist.find((s) => s.id === id)
    if (!current) return
    const nextDone = !current.done

    setChecklist((prev) => prev.map((s) => (s.id === id ? { ...s, done: nextDone } : s)))
    setSaveError(false)

    const result = await updateChecklistItem(id, nextDone)
    if (!result.ok) {
      setChecklist((prev) => prev.map((s) => (s.id === id ? { ...s, done: current.done } : s)))
      setSaveError(true)
    }
  }

  async function finishCleaning() {
    const previousStatus = status
    setStatus('completed')
    setSaveError(false)

    const result = await completeCleaning(cleaning.id)
    if (!result.ok) {
      setStatus(previousStatus)
      setSaveError(true)
    }
  }

  function choosePhoto(serviceId: string | null) {
    photoTarget.current = serviceId
    fileInput.current?.click()
  }

  async function attachPhoto(file: File) {
    if (uploadBusy.current) return
    uploadBusy.current = true
    const serviceId = photoTarget.current
    setUploading(true)
    setPhotoError(false)
    try {
      const photo = await uploadCleaningPhoto(file, serviceId)
      setPhotos((previous) => [...previous, photo])
      if (serviceId) {
        setChecklist((previous) => previous.map((item) => item.id === serviceId ? { ...item, photo } : item))
      }
    } catch {
      setPhotoError(true)
    } finally {
      uploadBusy.current = false
      setUploading(false)
    }
  }

  function updateNote(id: string, value: string) {
    setChecklist((prev) => prev.map((s) => (s.id === id ? { ...s, note: value } : s)))
  }

  if (status === 'completed') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-accent text-primary">
          <CheckCircle2 className="size-10" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Уборка завершена</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {done} из {total} услуг выполнено
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

        {/* Client rules */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-primary" />
            <h2 className="text-base font-semibold tracking-tight">Правила клиента</h2>
          </div>

          <div className="mt-4 space-y-4 text-sm">
            <RuleRow
              question="Открывать шкафы, гардеробные и тумбочки?"
              answer={cabinetOptions[clientRules.cabinets]}
            />
            <RuleRow
              question="Перемещать личные вещи?"
              answer={moveOptions[clientRules.moveItems]}
            />
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                Категорически не трогать
              </p>
              <p className="mt-1 text-sm text-foreground">{clientRules.doNotTouch}</p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Особые пожелания
              </p>
              <p className="mt-1 text-sm text-foreground">{clientRules.wishes}</p>
            </div>
          </div>
        </section>

        {/* What's included — selection */}
        <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            aria-expanded={pickerOpen}
          >
            <span>
              <span className="block text-base font-semibold tracking-tight">Что входит в уборку</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Выбрано услуг: {includedCount}
              </span>
            </span>
            <ChevronDown
              className={cn('size-5 text-muted-foreground transition-transform', pickerOpen && 'rotate-180')}
            />
          </button>

          {pickerOpen && (
            <ul className="border-t border-border">
              {checklist.map((s) => (
                <li key={s.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleIncluded(s.id)}
                    aria-pressed={s.included}
                    className="flex min-h-[56px] w-full items-center gap-3 px-5 py-2 text-left"
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                        s.included ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
                      )}
                    >
                      {s.included && <Check className="size-4" />}
                    </span>
                    <span className={cn('text-[15px] leading-snug', !s.included && 'text-muted-foreground')}>
                      {s.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
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

        {/* Active checklist */}
        <section className="mt-6">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Чек-лист уборки
          </h2>
          {includedCount === 0 ? (
            <p className="mt-2 rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              Выберите услуги в блоке «Что входит в уборку»
            </p>
          ) : (
            <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
              {active.map((item, idx) => (
                <li key={item.id} className={cn(idx > 0 && 'border-t border-border')}>
                  <div className="flex min-h-[60px] items-center gap-3 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => toggleDone(item.id)}
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
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block text-[15px] leading-snug',
                            item.done && 'text-muted-foreground line-through',
                          )}
                        >
                          {item.label}
                        </span>
                        {item.done && (
                          <span className="mt-0.5 block text-xs font-medium text-primary no-underline">
                            Выполнено
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNoteOpen((v) => (v === item.id ? null : item.id))}
                        className={cn(
                          'flex size-11 items-center justify-center rounded-lg border border-border',
                          item.note ? 'text-primary' : 'text-muted-foreground',
                        )}
                        aria-label="Примечание"
                      >
                        <Pencil className="size-4" />
                      </button>
                      {item.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photo?.src || '/placeholder.svg'}
                          alt="Фото услуги"
                          className="size-11 rounded-lg object-cover"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => choosePhoto(item.id)}
                          disabled={uploading}
                          className="flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground"
                          aria-label="Добавить фото"
                        >
                          <Camera className="size-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {(noteOpen === item.id || item.note) && (
                    <div className="px-4 pb-3">
                      {noteOpen === item.id ? (
                        <input
                          type="text"
                          autoFocus
                          value={item.note ?? ''}
                          onChange={(e) => updateNote(item.id, e.target.value)}
                          onBlur={() => setNoteOpen(null)}
                          placeholder="Добавить примечание…"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        <p className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
                          {item.note}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="mt-6">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Фото уборки</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <button key={photo.src} type="button" onClick={() => setViewer(photo)} className="aspect-square overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.src} alt={photo.alt} className="size-full object-cover" />
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" disabled={uploading} onClick={() => choosePhoto(null)} className="mt-3 rounded-xl">
            <Camera className="size-4" /> Добавить фото
          </Button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" aria-label="Выбрать фото" onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void attachPhoto(file)
          }} />
        </section>
      </main>

      {viewer && <PhotoViewer src={viewer.src} alt={viewer.alt} onClose={() => setViewer(null)} />}

      {/* Sticky actions */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md">
        <div className="border-t border-border bg-background/95 px-5 pb-2 pt-3 backdrop-blur">
          {uploading && <p role="status" className="mb-2 text-center text-xs text-muted-foreground">Загрузка фото…</p>}
          {photoError && <p role="alert" className="mb-2 text-center text-xs text-destructive">Не удалось загрузить фото</p>}
          {saveError && (
            <p className="mb-2 text-center text-xs text-destructive">Не удалось сохранить изменение</p>
          )}
          <Button
            size="lg"
            disabled={includedCount === 0 || done < total}
            onClick={finishCleaning}
            className="h-14 w-full rounded-2xl text-base"
          >
            Завершить уборку
          </Button>
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

function RuleRow({ question, answer }: { question: string; answer: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{question}</p>
      <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
        <Check className="size-4 text-primary" />
        {answer}
      </p>
    </div>
  )
}
