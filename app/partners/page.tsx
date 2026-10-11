import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  Eye,
  KeyRound,
  Link2,
  Megaphone,
  MessageCircle,
  PenTool,
  Percent,
  ShieldCheck,
  Share2,
  Users,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { TELEGRAM_PARTNER_START_URL, formatRub } from '@/lib/home-content'
import { getReferralCodeFromCookies, resolveTelegramOrderUrl } from '@/lib/referral-attribution'
import { cn } from '@/lib/utils'

// Public partner-program page. Reuses the same referral-attribution helper as the homepage
// (lib/referral-attribution.ts) for its own "Заказать уборку" CTA — no duplicate logic. The
// "Стать партнёром" CTA is always the fixed /start=partner deep link, never referral-wired.
// No new backend, no partner self-service signup: becoming a partner is still a Telegram
// conversation with the admin, same as before this PR.

export const metadata: Metadata = {
  title: 'Партнёрская программа CleanTrack — 10% с выполненных заказов',
  description:
    'Рекомендуйте CleanTrack клиентам, жителям дома или подписчикам и получайте 10% с каждого выполненного заказа.',
  alternates: { canonical: 'https://cleantrack.ru/partners' },
}

const AUDIENCE = [
  { icon: Building2, text: 'Администраторам Telegram-чатов ЖК' },
  { icon: KeyRound, text: 'Управляющим и консьержам' },
  { icon: Users, text: 'Риелторам' },
  { icon: Building2, text: 'Управляющим квартирами и апартаментами' },
  { icon: PenTool, text: 'Дизайнерам и ремонтным компаниям' },
  { icon: Megaphone, text: 'Локальным блогерам' },
  { icon: Share2, text: 'Тем, кто регулярно рекомендует сервисы знакомым и клиентам' },
]

const HOW_IT_WORKS = [
  {
    icon: Link2,
    title: 'Получаете персональные ссылки',
    text: 'Партнёр получает ссылку на Telegram для клиентов, ссылку на сайт и личную ссылку со статистикой.',
  },
  {
    icon: Share2,
    title: 'Рекомендуете CleanTrack',
    text: 'Клиент оформляет заказ по вашей ссылке — через сайт или сразу в Telegram.',
  },
  {
    icon: Percent,
    title: 'Получаете 10%',
    text: 'Комиссия начисляется после выполнения заказа.',
  },
]

const VISIBLE_TO_PARTNER = [
  'Количество заказов',
  'Статус каждого заказа',
  'Сумму заказа',
  'Выполнен заказ или нет',
  'Размер начисленной комиссии',
]

const TERMS = [
  'Стандартная комиссия — 10%',
  'Комиссия считается только по выполненным заказам',
  'Отменённые и невыполненные заказы не учитываются',
  'Статистика доступна по персональной ссылке',
  'CleanTrack может остановить участие партнёра при злоупотреблениях',
  'Порядок выплат и юридические условия будут определяться правилами партнёрской программы',
]

const FAQ = [
  { q: 'Сколько я получаю?', a: '10% от суммы выполненного заказа.' },
  { q: 'Когда комиссия считается начисленной?', a: 'Когда заказ получает статус выполненного.' },
  { q: 'Вижу ли я данные клиента?', a: 'Нет, только номер заказа, дату, сумму, статус и комиссию.' },
  { q: 'Как отслеживаются мои клиенты?', a: 'Через персональную ссылку на сайт или в Telegram.' },
  {
    q: 'Если клиент перешёл на сайт, а потом заказал через Telegram?',
    a: 'Referral-атрибуция сохраняется и переходит в Telegram-ссылку заказа.',
  },
  { q: 'Можно ли делиться ссылкой в чате дома?', a: 'Да.' },
  { q: 'Как стать партнёром?', a: 'Нажать кнопку «Стать партнёром» и написать нам в Telegram.' },
]

function Shell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-5xl px-5 sm:px-8', className)}>{children}</div>
}

function SectionHeading({ title, className }: { title: string; className?: string }) {
  return (
    <h2 className={cn('text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl', className)}>
      {title}
    </h2>
  )
}

export default async function PartnersPage() {
  const referralCode = await getReferralCodeFromCookies()
  const telegramUrl = resolveTelegramOrderUrl(referralCode)

  return (
    <main className="flex min-h-dvh w-full flex-col overflow-x-hidden">
      <Header telegramUrl={telegramUrl} />
      <Hero telegramUrl={telegramUrl} />
      <Audience />
      <HowItWorks />
      <WhatPartnerSees />
      <Example />
      <Terms />
      <Faq />
      <FinalCta telegramUrl={telegramUrl} />
      <Footer telegramUrl={telegramUrl} />
    </main>
  )
}

function Header({ telegramUrl }: { telegramUrl: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
      <Shell className="flex items-center justify-between py-3.5">
        <Link href="/" aria-label="CleanTrack — на главную">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <a href={telegramUrl} target="_blank" rel="noreferrer" className="hidden text-sm text-foreground/90 hover:text-foreground sm:inline">
            Заказать уборку
          </a>
          <a href={TELEGRAM_PARTNER_START_URL} target="_blank" rel="noreferrer">
            <Button size="sm" className="rounded-full px-4">
              Стать партнёром
            </Button>
          </a>
        </div>
      </Shell>
    </header>
  )
}

function Hero({ telegramUrl }: { telegramUrl: string }) {
  return (
    <section className="pt-10 sm:pt-16">
      <Shell className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1.5 text-sm text-foreground">
          <Users className="size-3.5 text-primary" /> Партнёрская программа
        </span>
        <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
          Партнёрская программа CleanTrack
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          Получайте 10% с каждого выполненного заказа, который пришёл по вашей персональной ссылке.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={TELEGRAM_PARTNER_START_URL} target="_blank" rel="noreferrer">
            <Button size="lg" className="h-12 w-full rounded-full px-7 text-base sm:w-auto">
              Стать партнёром
            </Button>
          </a>
          <a href={telegramUrl} target="_blank" rel="noreferrer">
            <Button size="lg" variant="outline" className="h-12 w-full gap-2 rounded-full px-7 text-base sm:w-auto">
              <MessageCircle className="size-4" /> Заказать уборку
            </Button>
          </a>
        </div>
      </Shell>
    </section>
  )
}

function Audience() {
  return (
    <section className="py-16 sm:py-20">
      <Shell>
        <SectionHeading title="Кому подходит" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIENCE.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <p className="pt-1.5 text-sm font-medium leading-relaxed text-foreground">{text}</p>
            </div>
          ))}
        </div>
      </Shell>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="py-16 sm:py-20">
      <Shell>
        <SectionHeading title="Как это работает" />
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="relative rounded-2xl border border-border bg-card p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span className="mt-4 flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              <p className="mt-3 font-medium text-foreground">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </Shell>
    </section>
  )
}

function WhatPartnerSees() {
  return (
    <section className="py-16 sm:py-20">
      <Shell>
        <SectionHeading title="Что видно партнёру" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
          <ul className="grid gap-3 sm:grid-cols-2">
            {VISIBLE_TO_PARTNER.map((item) => (
              <li key={item} className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-medium text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-primary" /> {item}
              </li>
            ))}
          </ul>
          <div className="flex items-start gap-3 rounded-2xl border-2 border-primary bg-card p-5 lg:max-w-xs">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm font-medium text-foreground">
              Персональные данные клиента партнёру не показываются.
            </p>
          </div>
        </div>
      </Shell>
    </section>
  )
}

function Example() {
  const orders = 10
  const avgPrice = 5000
  const totalOrders = orders * avgPrice
  const commission = Math.round(totalOrders * 0.1)
  return (
    <section className="py-16 sm:py-20">
      <Shell>
        <SectionHeading title="Пример" />
        <div className="mt-8 max-w-xl rounded-3xl border border-border bg-card p-6 sm:p-8">
          <p className="text-sm text-muted-foreground">
            {orders} выполненных заказов × {formatRub(avgPrice)}
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">= {formatRub(totalOrders)} заказов</p>
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm text-muted-foreground">10% партнёру</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">= {formatRub(commission)}</p>
          </div>
        </div>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          Это пример расчёта, а не гарантированный доход — сумма зависит от количества и стоимости
          заказов ваших клиентов.
        </p>
      </Shell>
    </section>
  )
}

function Terms() {
  return (
    <section className="py-16 sm:py-20">
      <Shell>
        <SectionHeading title="Условия" />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {TERMS.map((term) => (
            <li key={term} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> {term}
            </li>
          ))}
        </ul>
      </Shell>
    </section>
  )
}

function Faq() {
  return (
    <section className="py-16 sm:py-20">
      <Shell className="max-w-3xl">
        <SectionHeading title="Вопросы и ответы" />
        <div className="mt-8 space-y-3">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="rounded-2xl border border-border bg-card p-5">
              <p className="font-medium text-foreground">{q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </Shell>
    </section>
  )
}

function FinalCta({ telegramUrl }: { telegramUrl: string }) {
  return (
    <section className="py-16 sm:py-24">
      <Shell className="rounded-3xl border border-border bg-card px-6 py-14 text-center sm:px-12">
        <Users className="mx-auto size-8 text-primary" />
        <h2 className="mx-auto mt-5 max-w-xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Готовы рекомендовать CleanTrack?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
          Напишите нам в Telegram — пришлём персональные ссылки.
        </p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <a href={TELEGRAM_PARTNER_START_URL} target="_blank" rel="noreferrer">
            <Button size="lg" className="h-12 w-full gap-1.5 rounded-full px-7 text-base sm:w-auto">
              Стать партнёром <ArrowRight className="size-4" />
            </Button>
          </a>
          <a href={telegramUrl} target="_blank" rel="noreferrer">
            <Button size="lg" variant="outline" className="h-12 w-full gap-2 rounded-full px-7 text-base sm:w-auto">
              <MessageCircle className="size-4" /> Заказать уборку
            </Button>
          </a>
        </div>
      </Shell>
    </section>
  )
}

function Footer({ telegramUrl }: { telegramUrl: string }) {
  return (
    <footer className="border-t border-border py-10">
      <Shell className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <Link href="/">
          <Logo />
        </Link>
        <p className="text-sm text-muted-foreground">cleantrack.ru</p>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <a href={telegramUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
            Telegram
          </a>
          <Link href="/" className="hover:text-foreground">
            На главную
          </Link>
        </div>
      </Shell>
    </footer>
  )
}
