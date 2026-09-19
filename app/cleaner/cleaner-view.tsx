'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  Copy,
  Link2,
  Lock,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  User,
} from 'lucide-react'
import { uploadCleaningPhoto } from '@/lib/photo-upload'
import { PhotoViewer } from '@/components/photo-viewer'
import { Logo } from '@/components/logo'
import { ProgressBar } from '@/components/progress-bar'
import { Button } from '@/components/ui/button'
import {
  completeCleaning,
  deleteCleaning,
  getOrCreateClientLink,
  updateCleaningClient,
  updateChecklistItem,
} from '@/lib/data/cleaning-actions'
import { formatCleaningDateTime, formatCleaningTime } from '@/lib/date-format'
import { getCleaningStatusLabel } from '@/lib/cleaning-status'
import { formatRequestedDate } from '@/lib/telegram-order-format'
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
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<Photo | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const photoTarget = useRef<string | null>(null)
  const uploadBusy = useRef(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist)
  const [status, setStatus] = useState<CleaningStatus>(cleaning.status)
  const [completedAt, setCompletedAt] = useState(cleaning.completedAt)
  const [clientToken, setClientToken] = useState(cleaning.clientToken)
  const [clientDetails, setClientDetails] = useState({
    clientName: cleaning.client,
    clientPhone: cleaning.clientPhone ?? '',
    address: cleaning.address,
  })
  const [clientDraft, setClientDraft] = useState(clientDetails)
  const [editingClient, setEditingClient] = useState(false)
  const [savingClient, setSavingClient] = useState(false)
  const [clientSaveError, setClientSaveError] = useState(false)
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

    const result = await updateChecklistItem(cleaning.id, id, nextDone)
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
      return
    }
    setCompletedAt(result.completedAt ?? completedAt)
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
    setPhotoError(null)
    try {
      const photo = await uploadCleaningPhoto(file, cleaning.id, serviceId)
      setPhotos((previous) => [...previous, photo])
      if (serviceId) {
        setChecklist((previous) => previous.map((item) => item.id === serviceId ? { ...item, photo } : item))
      }
    } catch (error) {
      setPhotoError(error instanceof Error && ['Фото слишком большое', 'Формат фото не поддерживается'].includes(error.message) ? error.message : 'Не удалось загрузить фото')
    } finally {
      uploadBusy.current = false
      setUploading(false)
    }
  }

  function updateNote(id: string, value: string) {
    setChecklist((prev) => prev.map((s) => (s.id === id ? { ...s, note: value } : s)))
  }

  async function saveClientDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextDetails = {
      clientName: clientDraft.clientName.trim(),
      clientPhone: clientDraft.clientPhone.trim(),
      address: clientDraft.address.trim(),
    }
    setSavingClient(true)
    setClientSaveError(false)
    const result = await updateCleaningClient(cleaning.id, nextDetails)
    setSavingClient(false)
    if (!result.ok) {
      setClientSaveError(true)
      return
    }
    setClientDetails(nextDetails)
    setClientDraft(nextDetails)
    setEditingClient(false)
  }

  function startEditingClient() {
    setClientDraft(clientDetails)
    setClientSaveError(false)
    setEditingClient(true)
  }

  const hasClientDetails = Boolean(clientDetails.clientName.trim() && clientDetails.address.trim())

  if (status !== 'in_progress') {
    return (
      <CompletedCleaningView
        cleaning={cleaning}
        checklist={checklist}
        clientRules={clientRules}
        photos={photos}
        status={status}
        completedAt={completedAt}
        clientToken={clientToken}
        clientDetails={clientDetails}
        hasClientDetails={hasClientDetails}
        onToken={setClientToken}
      />
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <Link href="/cleaner/jobs" aria-label="Назад" className="-ml-2 flex size-9 items-center justify-center rounded-full text-muted-foreground">
            <ChevronLeft className="size-6" />
          </Link>
          <Logo />
          <span className="size-9" />
        </div>
      </header>

      <main className="flex-1 px-5 pb-24 pt-4">
        {/* Cleaning info */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Уборка №{cleaning.number}</h1>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              {getCleaningStatusLabel(status)}
            </span>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            <InfoRow icon={<MapPin className="size-4" />} label="Адрес" value={clientDetails.address} />
            <InfoRow icon={<User className="size-4" />} label="Клиент" value={clientDetails.clientName} />
            <InfoRow
              icon={<Phone className="size-4" />}
              label="Телефон"
              value={clientDetails.clientPhone || 'Не указан'}
            />
            {!cleaning.requestedTime && <InfoRow icon={<Clock className="size-4" />} label="Начало" value={formatCleaningTime(cleaning.startedAt)} />}
            {cleaning.requestedDate && <InfoRow icon={<Clock className="size-4" />} label="Дата" value={formatRequestedDate(cleaning.requestedDate)} />}
            {cleaning.requestedTime && <InfoRow icon={<Clock className="size-4" />} label="Время" value={cleaning.requestedTime} />}
            <InfoRow
              icon={<Camera className="size-4" />}
              label="Фотоотчёт"
              value={cleaning.photoReportEnabled ? 'нужен' : 'не нужен'}
            />
          </dl>
          {editingClient ? (
            <form onSubmit={saveClientDetails} className="mt-5 space-y-3 border-t border-border pt-4">
              <ClientField
                label="Имя клиента"
                value={clientDraft.clientName}
                maxLength={120}
                required
                onChange={(clientName) => setClientDraft((current) => ({ ...current, clientName }))}
              />
              <ClientField
                label="Телефон"
                value={clientDraft.clientPhone}
                maxLength={40}
                type="tel"
                onChange={(clientPhone) => setClientDraft((current) => ({ ...current, clientPhone }))}
              />
              <ClientField
                label="Адрес"
                value={clientDraft.address}
                maxLength={300}
                required
                onChange={(address) => setClientDraft((current) => ({ ...current, address }))}
              />
              {clientSaveError && (
                <p role="alert" className="text-sm text-destructive">
                  Не удалось сохранить данные клиента
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={savingClient} className="flex-1 rounded-xl">
                  {savingClient ? 'Сохраняем…' : 'Сохранить'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingClient}
                  onClick={() => setEditingClient(false)}
                  className="flex-1 rounded-xl"
                >
                  Отмена
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={startEditingClient}
              className="mt-4 w-full rounded-xl"
            >
              <Pencil className="size-4" />
              Изменить данные клиента
            </Button>
          )}
        </section>

        <ClientLinkBlock
          cleaningId={cleaning.id}
          token={clientToken}
          onToken={setClientToken}
          canCreate={hasClientDetails}
          className="mt-4"
        />

        {/* Client rules */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-primary" />
            <h2 className="text-base font-semibold tracking-tight">Правила клиента</h2>
          </div>

          <ClientRulesDetails clientRules={clientRules} />
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
          <input ref={fileInput} type="file" accept="image/*" className="hidden" aria-label="Выбрать фото" onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void attachPhoto(file)
          }} />
        </section>
        <DeleteCleaningAction cleaningId={cleaning.id} cleaningNumber={cleaning.number} />
      </main>

      {viewer && <PhotoViewer src={viewer.src} alt={viewer.alt} onClose={() => setViewer(null)} />}

      {/* Sticky actions */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md">
        <div className="border-t border-border bg-background/95 px-5 pb-2 pt-3 backdrop-blur">
          {uploading && <p role="status" className="mb-2 text-center text-xs text-muted-foreground">Загрузка фото…</p>}
          {photoError && <p role="alert" className="mb-2 text-center text-xs text-destructive">{photoError}</p>}
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
      </div>
    </div>
  )
}

function CompletedCleaningView({
  cleaning,
  checklist,
  clientRules,
  photos,
  status,
  completedAt,
  clientToken,
  clientDetails,
  hasClientDetails,
  onToken,
}: {
  cleaning: Cleaning
  checklist: ChecklistItem[]
  clientRules: ClientRules
  photos: Photo[]
  status: Exclude<CleaningStatus, 'in_progress'>
  completedAt: string | null
  clientToken: string | null
  clientDetails: { clientName: string; clientPhone: string; address: string }
  hasClientDetails: boolean
  onToken: (token: string) => void
}) {
  const [viewer, setViewer] = useState<Photo | null>(null)
  const active = checklist.filter((item) => item.included)
  const { done, total, percent } = countProgress(checklist)
  const accepted = status === 'accepted'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <Link href="/cleaner/jobs" aria-label="Назад" className="-ml-2 flex size-9 items-center justify-center rounded-full text-muted-foreground">
            <ChevronLeft className="size-6" />
          </Link>
          <Logo />
          <span className="size-9" />
        </div>
      </header>

      <main className="flex-1 px-5 pb-10 pt-4">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight">Уборка №{cleaning.number}</h1>
            <span className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
              accepted ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground',
            )}>
              {getCleaningStatusLabel(status)}
            </span>
          </div>
          <dl className="mt-4 space-y-2.5 text-sm">
            <InfoRow icon={<User className="size-4" />} label="Клиент" value={clientDetails.clientName || 'Не указан'} />
            <InfoRow icon={<MapPin className="size-4" />} label="Адрес" value={clientDetails.address || 'Не указан'} />
            {clientDetails.clientPhone && <InfoRow icon={<Phone className="size-4" />} label="Телефон" value={clientDetails.clientPhone} />}
            {cleaning.requestedDate && <InfoRow icon={<Clock className="size-4" />} label="Дата" value={formatRequestedDate(cleaning.requestedDate)} />}
            {cleaning.requestedTime && <InfoRow icon={<Clock className="size-4" />} label="Время" value={cleaning.requestedTime} />}
            <InfoRow icon={<Check className="size-4" />} label="Прогресс" value={`${done} из ${total} услуг выполнено`} />
            <InfoRow icon={<Camera className="size-4" />} label="Фото" value={`${photos.length} фото`} />
          </dl>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <HistoryRow label="Начало" value={cleaning.startedAt} />
            <HistoryRow label="Завершено" value={completedAt} />
            {accepted && <HistoryRow label="Принято клиентом" value={cleaning.acceptedAt} />}
          </dl>
        </section>

        <Link href="/cleaner/jobs" className="mt-4 block">
          <Button type="button" variant="outline" className="w-full rounded-xl">
            К списку уборок
          </Button>
        </Link>

        <ClientLinkBlock
          cleaningId={cleaning.id}
          token={clientToken}
          onToken={onToken}
          canCreate={hasClientDetails}
          showWhenMissing={!accepted}
          className="mt-4"
        />

        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-primary" />
            <h2 className="text-base font-semibold tracking-tight">Правила клиента</h2>
          </div>
          <ClientRulesDetails clientRules={clientRules} />
        </section>

        <section className="mt-6">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Чек-лист уборки</h2>
          <p className="mt-1 px-1 text-sm text-muted-foreground">Выполнено: {done} из {total} ({percent}%)</p>
          {active.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Услуги не выбраны</p>
          ) : (
            <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
              {active.map((item, index) => (
                <li key={item.id} className={cn('px-4 py-3', index > 0 && 'border-t border-border')}>
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full', item.done ? 'bg-primary text-primary-foreground' : 'border-2 border-border text-muted-foreground')}>
                      {item.done && <Check className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] leading-snug">{item.label}</p>
                      <p className={cn('mt-1 text-xs font-medium', item.done ? 'text-primary' : 'text-muted-foreground')}>
                        {item.done ? 'Выполнено' : 'Не выполнено'}
                      </p>
                      {item.note && <p className="mt-2 rounded-xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">{item.note}</p>}
                    </div>
                    {item.photo && (
                      <button type="button" onClick={() => setViewer(item.photo)} className="size-11 shrink-0 overflow-hidden rounded-lg border border-border" aria-label={`Открыть фото услуги ${item.label}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.photo.src || '/placeholder.svg'} alt="Фото услуги" className="size-full object-cover" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Фото уборки</h2>
          {photos.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">Фотографий нет</p>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <button key={photo.id ?? photo.src} type="button" onClick={() => setViewer(photo)} className="aspect-square overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.src || '/placeholder.svg'} alt={photo.alt} className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>

        <DeleteCleaningAction cleaningId={cleaning.id} cleaningNumber={cleaning.number} />
      </main>

      {viewer && <PhotoViewer src={viewer.src} alt={viewer.alt} onClose={() => setViewer(null)} />}
    </div>
  )
}

function DeleteCleaningAction({ cleaningId, cleaningNumber }: { cleaningId: string; cleaningNumber: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(false)

  async function confirmDelete() {
    setDeleting(true)
    setError(false)
    const result = await deleteCleaning(cleaningId)
    if (!result.ok) {
      setDeleting(false)
      setError(true)
      return
    }
    router.replace('/cleaner/jobs')
  }

  return (
    <section className="mt-6 border-t border-border pt-6">
      <Button type="button" variant="destructive" onClick={() => setConfirming(true)} className="w-full rounded-xl">
        <Trash2 className="size-4" />
        Удалить уборку
      </Button>
      {error && <p role="alert" className="mt-2 text-center text-sm text-destructive">Не удалось удалить уборку</p>}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/30 p-4 sm:items-center" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-cleaning-title" className="w-full rounded-2xl border border-border bg-background p-5 shadow-xl">
            <h2 id="delete-cleaning-title" className="text-lg font-semibold tracking-tight">Удалить уборку №{cleaningNumber}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Будут удалены чек-лист, фотографии и ссылка клиента. Это действие нельзя отменить.</p>
            <div className="mt-5 flex gap-3">
              <Button type="button" variant="outline" disabled={deleting} onClick={() => setConfirming(false)} className="flex-1 rounded-xl">Отмена</Button>
              <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete} className="flex-1 rounded-xl">{deleting ? 'Удаляем…' : 'Удалить'}</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function ClientLinkBlock({
  cleaningId,
  token,
  onToken,
  canCreate,
  showWhenMissing = true,
  className,
}: {
  cleaningId: string
  token: string | null
  onToken: (token: string) => void
  canCreate: boolean
  showWhenMissing?: boolean
  className?: string
}) {
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  async function createLink() {
    setCreating(true)
    setError(false)
    const result = await getOrCreateClientLink(cleaningId)
    setCreating(false)
    if (!result.ok || !result.token) {
      setError(true)
      return
    }
    onToken(result.token)
  }

  async function copyLink() {
    if (!token) return
    const url = `${window.location.origin}/client/${token}`
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Скопируйте ссылку:', url)
    }
    setCopied(true)
  }

  if (!token && !showWhenMissing) return null

  return (
    <section className={cn('rounded-2xl border border-border bg-card p-5 text-left', className)}>
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-primary" />
        <h2 className="text-base font-semibold tracking-tight">Ссылка для клиента</h2>
      </div>
      {token ? (
        <Button type="button" variant="outline" onClick={copyLink} className="mt-4 w-full rounded-xl">
          <Copy className="size-4" />
          Скопировать ссылку
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={creating || !canCreate}
          onClick={createLink}
          className="mt-4 w-full rounded-xl"
        >
          {creating ? 'Создаём…' : 'Создать ссылку для клиента'}
        </Button>
      )}
      {!token && !canCreate && (
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Сначала заполните данные клиента
        </p>
      )}
      {copied && <p className="mt-2 text-center text-sm text-primary">Ссылка скопирована</p>}
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-destructive">
          Не удалось создать ссылку
        </p>
      )}
    </section>
  )
}

function ClientField({
  label,
  value,
  maxLength,
  required = false,
  type = 'text',
  onChange,
}: {
  label: string
  value: string
  maxLength: number
  required?: boolean
  type?: 'text' | 'tel'
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
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

function ClientRulesDetails({ clientRules }: { clientRules: ClientRules }) {
  const hasRules = clientRules.cabinets !== 'none'
    || clientRules.moveItems !== 'none'
    || Boolean(clientRules.doNotTouch.trim())

  return (
    <>
      {hasRules ? (
        <>
          <div className="mt-4 space-y-4 text-sm">
            <RuleRow question="Открывать шкафы, гардеробные и тумбочки?" answer={cabinetOptions[clientRules.cabinets]} />
            <RuleRow question="Перемещать личные вещи?" answer={moveOptions[clientRules.moveItems]} />
          </div>
          {clientRules.doNotTouch && (
            <div className="mt-4">
              <RuleText label="Категорически не трогать" value={clientRules.doNotTouch} destructive />
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Особых правил нет</p>
      )}
      {clientRules.wishes && (
        <div className="mt-4">
          <RuleText label="Особые пожелания" value={clientRules.wishes} />
        </div>
      )}
    </>
  )
}

function RuleText({
  label,
  value,
  destructive = false,
}: {
  label: string
  value: string
  destructive?: boolean
}) {
  return (
    <div className={cn('rounded-xl border p-3', destructive ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-secondary/60')}>
      <p className={cn('text-xs font-semibold uppercase tracking-wide', destructive ? 'text-destructive' : 'text-muted-foreground')}>
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground">{value || 'Не указано'}</p>
    </div>
  )
}

function HistoryRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ? formatCleaningDateTime(value) : '—'}</dd>
    </div>
  )
}
