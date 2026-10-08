'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CLEANING_TYPES,
  DATE_OPTIONS,
  EXTRA_OPTIONS,
  ROOM_OPTIONS,
  TELEGRAM_CONTACT_URL,
  TIME_OPTIONS,
  calculateQuizPrice,
  formatRub,
  type CleaningType,
  type DateOption,
  type RoomOption,
  type TimeOption,
} from '@/lib/home-content'

// Frontend-only visual prototype (per task scope): no backend call, no order created, no change
// to the existing Telegram/order flow. "Заказать уборку" hands the quiz summary off to the same
// Telegram contact as the rest of the page — it does not submit anywhere on its own.

const STEP_COUNT = 5

type QuizState = {
  step: number
  rooms: RoomOption | null
  cleaningType: CleaningType
  extraCounts: Record<string, number>
  date: DateOption | null
  time: TimeOption | null
  name: string
  phone: string
}

const INITIAL_STATE: QuizState = {
  step: 0,
  rooms: null,
  cleaningType: 'basic',
  extraCounts: {},
  date: null,
  time: null,
  name: '',
  phone: '',
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors',
        selected
          ? 'border-primary bg-accent text-accent-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted',
      )}
    >
      {children}
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
        )}
      >
        {selected && <Check className="size-3.5" />}
      </span>
    </button>
  )
}

export function PriceQuiz() {
  const [state, setState] = useState<QuizState>(INITIAL_STATE)
  const price = useMemo(() => calculateQuizPrice(state), [state])
  const isFinal = state.step >= STEP_COUNT

  function goNext() {
    setState((s) => ({ ...s, step: Math.min(s.step + 1, STEP_COUNT) }))
  }
  function goBack() {
    setState((s) => ({ ...s, step: Math.max(s.step - 1, 0) }))
  }
  function setExtraCount(id: string, count: number) {
    setState((s) => ({ ...s, extraCounts: { ...s.extraCounts, [id]: Math.max(0, count) } }))
  }

  const canAdvance =
    (state.step === 0 && state.rooms !== null) ||
    (state.step === 1 && true) ||
    (state.step === 2 && true) ||
    (state.step === 3 && state.date !== null) ||
    (state.step === 4 && state.time !== null)

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      {!isFinal && (
        <div className="mb-5 flex items-center gap-1.5">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span
              key={i}
              className={cn('h-1.5 flex-1 rounded-full', i <= state.step ? 'bg-primary' : 'bg-secondary')}
            />
          ))}
        </div>
      )}

      {state.step === 0 && !isFinal && (
        <fieldset>
          <legend className="mb-4 text-lg font-semibold text-foreground">Сколько комнат?</legend>
          <div className="flex flex-col gap-2.5">
            {ROOM_OPTIONS.map((option) => (
              <OptionButton
                key={option.rooms}
                selected={state.rooms?.rooms === option.rooms}
                onClick={() => setState((s) => ({ ...s, rooms: option }))}
              >
                <span>
                  <span className="block font-medium">
                    {option.label}
                    {option.areaLabel ? ` — ${option.areaLabel}` : ''}
                  </span>
                  <span className="block text-sm text-muted-foreground">{formatRub(option.price)}</span>
                </span>
              </OptionButton>
            ))}
          </div>
        </fieldset>
      )}

      {state.step === 1 && !isFinal && (
        <fieldset>
          <legend className="mb-4 text-lg font-semibold text-foreground">Какая уборка?</legend>
          <div className="flex flex-col gap-2.5">
            {CLEANING_TYPES.map((option) => (
              <OptionButton
                key={option.value}
                selected={state.cleaningType === option.value}
                onClick={() => setState((s) => ({ ...s, cleaningType: option.value }))}
              >
                <span className="block font-medium">
                  {option.label}
                  {option.extra > 0 ? ` +${formatRub(option.extra)}` : ''}
                </span>
              </OptionButton>
            ))}
          </div>
        </fieldset>
      )}

      {state.step === 2 && !isFinal && (
        <fieldset>
          <legend className="mb-4 text-lg font-semibold text-foreground">Что добавить?</legend>
          <div className="flex flex-col gap-2.5">
            {EXTRA_OPTIONS.map((extra) => {
              const count = state.extraCounts[extra.id] ?? 0
              return (
                <div
                  key={extra.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5"
                >
                  <span>
                    <span className="block font-medium text-foreground">{extra.label}</span>
                    <span className="block text-sm text-muted-foreground">
                      {formatRub(extra.price)} {extra.unitLabel.replace('₽', '').trim() || null}
                    </span>
                  </span>
                  <span className="flex items-center gap-2.5">
                    <button
                      type="button"
                      aria-label={`Убрать ${extra.label}`}
                      onClick={() => setExtraCount(extra.id, count - 1)}
                      disabled={count === 0}
                      className="flex size-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm font-medium tabular-nums">{count}</span>
                    <button
                      type="button"
                      aria-label={`Добавить ${extra.label}`}
                      onClick={() => setExtraCount(extra.id, count + 1)}
                      className="flex size-8 items-center justify-center rounded-full border border-border text-foreground"
                    >
                      +
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </fieldset>
      )}

      {state.step === 3 && !isFinal && (
        <fieldset>
          <legend className="mb-4 text-lg font-semibold text-foreground">Когда нужна уборка?</legend>
          <div className="flex flex-col gap-2.5">
            {DATE_OPTIONS.map((option) => (
              <OptionButton
                key={option.value}
                selected={state.date === option.value}
                onClick={() => setState((s) => ({ ...s, date: option.value }))}
              >
                <span className="font-medium">{option.label}</span>
              </OptionButton>
            ))}
          </div>
        </fieldset>
      )}

      {state.step === 4 && !isFinal && (
        <fieldset>
          <legend className="mb-4 text-lg font-semibold text-foreground">Во сколько удобно?</legend>
          <div className="flex flex-col gap-2.5">
            {TIME_OPTIONS.map((option) => (
              <OptionButton
                key={option.value}
                selected={state.time === option.value}
                onClick={() => setState((s) => ({ ...s, time: option.value }))}
              >
                <span className="font-medium">{option.label}</span>
              </OptionButton>
            ))}
          </div>
        </fieldset>
      )}

      {isFinal && (
        <div>
          <p className="text-sm font-medium text-muted-foreground">Предварительная стоимость</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground">{formatRub(price)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Точную стоимость подтвердит клинер перед началом уборки.</p>

          <div className="mt-5 flex flex-col gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Имя</span>
              <input
                type="text"
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                placeholder="Как вас зовут"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Телефон</span>
              <input
                type="tel"
                value={state.phone}
                onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))}
                placeholder="+7 ..."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <a href={TELEGRAM_CONTACT_URL} target="_blank" rel="noreferrer" className="mt-5 block">
            <Button size="lg" className="h-12 w-full rounded-xl text-base">
              Заказать уборку
            </Button>
          </a>
          <button
            type="button"
            onClick={() => setState(INITIAL_STATE)}
            className="mt-3 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Начать заново
          </button>
        </div>
      )}

      {!isFinal && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={state.step === 0}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground disabled:opacity-0"
          >
            <ArrowLeft className="size-4" /> Назад
          </button>
          <p className="text-sm text-muted-foreground">
            Шаг {state.step + 1} из {STEP_COUNT}
            {price > 0 && <span className="ml-2 font-medium text-foreground">{formatRub(price)}</span>}
          </p>
          <Button onClick={goNext} disabled={!canAdvance} size="lg" className="h-10 gap-1.5 rounded-xl px-4">
            Далее <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
