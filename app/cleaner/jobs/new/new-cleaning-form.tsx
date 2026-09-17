'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { cabinetOptions, moveOptions } from '@/lib/mock-data'
import { createCleaning } from '@/lib/data/cleaning-actions'
import type { CatalogService } from '@/lib/data/cleanings'
import type { CabinetRule, MoveRule } from '@/lib/types'
import { cn } from '@/lib/utils'

export function NewCleaningForm({ services }: { services: CatalogService[] }) {
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [address, setAddress] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [cabinets, setCabinets] = useState<CabinetRule>('none')
  const [moveItems, setMoveItems] = useState<MoveRule>('none')
  const [doNotTouch, setDoNotTouch] = useState('')
  const [wishes, setWishes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function toggleService(id: string) {
    setSelectedServiceIds((current) => current.includes(id)
      ? current.filter((serviceId) => serviceId !== id)
      : [...current, id])
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanName = clientName.trim()
    const cleanAddress = address.trim()
    if (!cleanName || cleanName.length > 120) return setError('Укажите имя клиента')
    if (!cleanAddress || cleanAddress.length > 300) return setError('Укажите адрес')
    if (selectedServiceIds.length === 0) return setError('Выберите хотя бы одну услугу')

    setSaving(true)
    setError(null)
    const result = await createCleaning({
      clientName: cleanName,
      clientPhone,
      address: cleanAddress,
      selectedServiceIds,
      cabinets,
      moveItems,
      doNotTouch,
      wishes,
    })
    if (result.ok && result.cleaningId) {
      window.location.href = `/cleaner/jobs/${result.cleaningId}`
      return
    }
    setSaving(false)
    if (result.field === 'clientName') setError('Укажите имя клиента')
    else if (result.field === 'address') setError('Укажите адрес')
    else if (result.field === 'services') setError('Выберите хотя бы одну услугу')
    else setError('Не удалось создать уборку')
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-background px-5 pb-10 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/cleaner/jobs" aria-label="Назад" className="rounded-lg p-1 text-muted-foreground active:bg-muted">
          <ArrowLeft className="size-5" />
        </Link>
        <Logo />
        <h1 className="ml-auto text-xl font-semibold tracking-tight">Новая уборка</h1>
      </header>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Данные клиента</h2>
          <Field label="Имя клиента" value={clientName} onChange={setClientName} required maxLength={120} />
          <Field label="Телефон" value={clientPhone} onChange={setClientPhone} maxLength={40} type="tel" />
          <Field label="Адрес" value={address} onChange={setAddress} required maxLength={300} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="px-5 pt-5">
            <h2 className="text-base font-semibold">Услуги</h2>
            <p className="mt-1 text-sm text-muted-foreground">Выберите хотя бы одну</p>
          </div>
          <ul className="mt-4 border-t border-border">
            {services.map((service) => {
              const selected = selectedServiceIds.includes(service.id)
              return (
                <li key={service.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleService(service.id)}
                    aria-pressed={selected}
                    className="flex min-h-[58px] w-full items-center gap-3 px-5 py-3 text-left"
                  >
                    <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md border-2', selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                      {selected && <Check className="size-4" />}
                    </span>
                    <span className={cn('text-[15px] leading-snug', !selected && 'text-muted-foreground')}>{service.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Правила клиента</h2>
          <SelectField label="Открывать шкафы/гардеробные/тумбочки?" value={cabinets} onChange={setCabinets} options={cabinetOptions} />
          <SelectField label="Перемещать личные вещи?" value={moveItems} onChange={setMoveItems} options={moveOptions} />
          <TextArea label="Категорически не трогать" value={doNotTouch} onChange={setDoNotTouch} maxLength={1000} />
          <TextArea label="Особые пожелания" value={wishes} onChange={setWishes} maxLength={1000} />
        </section>

        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving} size="lg" className="h-14 w-full rounded-2xl text-base">
          {saving ? 'Создаём…' : 'Создать уборку'}
        </Button>
      </form>
    </main>
  )
}

function Field({ label, value, onChange, required, maxLength, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; maxLength: number; type?: string }) {
  return <label className="block text-sm font-medium">{label}{required && <span className="text-destructive"> *</span>}<input required={required} maxLength={maxLength} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-base font-normal outline-none focus:border-ring focus:ring-3 focus:ring-ring/20" /></label>
}

function TextArea({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return <label className="block text-sm font-medium">{label}<textarea maxLength={maxLength} value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-3 py-3 text-base font-normal outline-none focus:border-ring focus:ring-3 focus:ring-ring/20" /></label>
}

function SelectField<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: Record<T, string> }) {
  return <label className="block text-sm font-medium">{label}<select value={value} onChange={(event) => onChange(event.target.value as T)} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-base font-normal outline-none focus:border-ring focus:ring-3 focus:ring-ring/20">{Object.entries(options).map(([option, text]) => <option key={option} value={option}>{text as string}</option>)}</select></label>
}
