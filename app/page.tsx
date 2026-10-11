import Link from 'next/link'
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  Eye,
  Link2,
  MessageCircle,
  PhoneOff,
  Percent,
  Share2,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { PriceQuiz } from '@/components/home/price-quiz'
import { TrackerMockup } from '@/components/home/tracker-mockup'
import {
  DIFFERENCE_CLEANTRACK,
  DIFFERENCE_PLAIN,
  HOME_CHECKLIST_GROUPS,
  HOW_IT_WORKS_STEPS,
  TELEGRAM_PARTNER_START_URL,
  TRUST_POINTS,
} from '@/lib/home-content'
import { getReferralCodeFromCookies, resolveTelegramOrderUrl } from '@/lib/referral-attribution'
import { cn } from '@/lib/utils'

// Commercial landing page for cleantrack.ru. Everything here is new, homepage-only content —
// /client and /cleaner, the tracker flows, the Telegram bot, the DB and the photo pipeline are
// untouched. The price quiz (components/home/price-quiz.tsx) is a frontend-only prototype: it
// never calls an API and never creates an order, so the existing order/Telegram flow stays as-is.
//
// Every "order" CTA (header, hero, price quiz result, final CTA, footer) resolves its Telegram
// link once here, server-side, from the referral_code cookie /r/[code] may have set — see
// lib/referral-attribution.ts. The partner-application link is deliberately NOT referral-wired:
// it's a fixed /start=partner deep link, unrelated to who referred this visitor.

const TRUST_ICONS = [ClipboardList, ScrollText, Camera, Eye, CheckCircle2, PhoneOff]

const PARTNER_STEPS = [
  { icon: Link2, title: 'Получаете персональные ссылки' },
  { icon: Share2, title: 'Делитесь ими с клиентами' },
  { icon: Percent, title: 'Получаете 10% с выполненных заказов' },
]

const NAV_LINKS = [
  { href: '#how-it-works', label: 'Как это работает' },
  { href: '#benefits', label: 'Преимущества' },
  { href: '#tracker', label: 'Трекер' },
  { href: '#price', label: 'Стоимость' },
]

const PROOF_CHIPS = [
  { icon: Smartphone, label: 'Без приложения' },
  { icon: ShieldCheck, label: 'Без регистрации' },
  { icon: Camera, label: 'Фотоотчёт' },
  { icon: Link2, label: 'Персональная ссылка' },
]

export default async function HomePage() {
  const referralCode = await getReferralCodeFromCookies()
  const telegramUrl = resolveTelegramOrderUrl(referralCode)

  return (
    <main className="flex min-h-dvh w-full flex-col overflow-x-hidden">
      <Header telegramUrl={telegramUrl} />
      <Hero telegramUrl={telegramUrl} />
      <HowItWorks />
      <Difference />
      <TrackerDemo />
      <ChecklistPreview />
      <PriceSection telegramUrl={telegramUrl} />
      <Trust />
      <ReferralTeaser />
      <FinalCta telegramUrl={telegramUrl} />
      <Footer telegramUrl={telegramUrl} />
    </main>
  )
}

function Shell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-8', className)}>{children}</div>
}

function SectionHeading({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  return (
    <h2 className={cn('text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl', className)}>
      {title}
    </h2>
  )
}

function Header({ telegramUrl }: { telegramUrl: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
      <Shell className="flex items-center justify-between py-3.5">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-foreground/80 hover:text-foreground">
              {link.label}
            </a>
          ))}
          <Link href="/partners" className="text-sm text-foreground/80 hover:text-foreground">
            Партнёрам
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <a
            href={telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden text-sm text-foreground/90 hover:text-foreground sm:inline"
          >
            Заказать
          </a>
          <a href="#price">
            <Button size="sm" className="rounded-full px-4">
              Рассчитать стоимость
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
      <Shell className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1.5 text-sm text-foreground">
            <span className="size-1.5 rounded-full bg-primary" /> Контроль результата в реальном времени
          </span>

          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
            Уборка квартиры<br />
            с <span className="text-primary">контролем</span><br />
            <span className="text-primary">результата</span>
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Закажите уборку за пару минут. Клинер работает по чек-листу, а вы видите статус,
            выполненные работы и фото в персональном трекере.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#price">
              <Button size="lg" className="h-12 w-full gap-1.5 rounded-full px-7 text-base sm:w-auto">
                Рассчитать стоимость <ArrowRight className="size-4" />
              </Button>
            </a>
            <a href={telegramUrl} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="h-12 w-full gap-2 rounded-full px-7 text-base sm:w-auto">
                <MessageCircle className="size-4" /> Заказать в Telegram
              </Button>
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap gap-2 text-sm text-foreground/80">
            {PROOF_CHIPS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5">
                <Icon className="size-3.5 text-foreground/70" /> {label}
              </li>
            ))}
          </ul>
        </div>

        <TrackerMockup className="lg:justify-self-end" floating />
      </Shell>
    </section>
  )
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-28">
      <Shell>
        <SectionHeading title="Как работает CleanTrack" className="text-center" />
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <div key={step.title} className="relative rounded-2xl border border-border bg-card p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <p className="mt-4 font-medium text-foreground">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </Shell>
    </section>
  )
}

function Difference() {
  return (
    <section className="py-20 sm:py-28">
      <Shell>
        <SectionHeading title="Вы видите, за что платите" className="text-center" />
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-6 opacity-80">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Обычная уборка</p>
            <ul className="mt-4 space-y-3">
              {DIFFERENCE_PLAIN.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border-2 border-primary bg-card p-6 shadow-lg shadow-primary/10">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">CleanTrack</p>
            <ul className="mt-4 space-y-3">
              {DIFFERENCE_CLEANTRACK.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm font-medium text-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Shell>
    </section>
  )
}

function TrackerDemo() {
  return (
    <section id="tracker" className="scroll-mt-20 py-20 sm:py-28">
      <Shell className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <TrackerMockup className="order-2 lg:order-1" />
        <div className="order-1 lg:order-2">
          <SectionHeading title="Вся уборка — в одной ссылке" />
          <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted-foreground">
            Клиенту ничего не нужно устанавливать. Открываете персональную ссылку и видите ход
            уборки: статус, чек-лист, правила клиента, фото и момент завершения.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              { icon: Eye, text: 'Статус заказа в реальном времени' },
              { icon: ClipboardList, text: 'Чек-лист работ по комнатам' },
              { icon: ScrollText, text: 'Правила клиента учтены клинером' },
              { icon: Camera, text: 'Фотоотчёт по завершению' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-medium text-foreground">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <Link href="/client" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <Link2 className="size-4" /> Посмотреть пример персональной ссылки
          </Link>
        </div>
      </Shell>
    </section>
  )
}

function ChecklistPreview() {
  return (
    <section className="py-20 sm:py-28">
      <Shell>
        <SectionHeading title="Что входит в базовую уборку" className="text-center" />
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2">
          {HOME_CHECKLIST_GROUPS.map((group) => (
            <div key={group.title} className="rounded-2xl border border-border bg-card p-5">
              <p className="font-medium text-foreground">{group.title}</p>
              <ul className="mt-3 space-y-1.5">
                {group.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-5xl text-center text-sm text-muted-foreground">
          Полный список привязан к конкретному заказу и виден в персональном трекере.
        </p>
      </Shell>
    </section>
  )
}

function PriceSection({ telegramUrl }: { telegramUrl: string }) {
  return (
    <section id="price" className="scroll-mt-20 py-20 sm:py-28">
      <Shell>
        <SectionHeading title="Рассчитайте стоимость за 1 минуту" className="text-center" />
        <div className="mt-10">
          <PriceQuiz telegramUrl={telegramUrl} />
        </div>
      </Shell>
    </section>
  )
}

function Trust() {
  return (
    <section id="benefits" className="scroll-mt-20 py-20 sm:py-28">
      <Shell>
        <SectionHeading title="Почему CleanTrack" className="text-center" />
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_POINTS.map((point, i) => {
            const Icon = TRUST_ICONS[i % TRUST_ICONS.length]
            return (
              <div key={point} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                <p className="pt-1.5 text-sm font-medium leading-relaxed text-foreground">{point}</p>
              </div>
            )
          })}
        </div>
      </Shell>
    </section>
  )
}

function ReferralTeaser() {
  return (
    <section className="py-20 sm:py-28">
      <Shell>
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card p-6 sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1.5 text-sm text-foreground">
            <Users className="size-3.5 text-primary" /> Партнёрская программа
          </span>
          <h2 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Зарабатывайте вместе с CleanTrack
          </h2>
          <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted-foreground">
            Рекомендуйте уборку жителям дома, клиентам, знакомым или подписчикам и получайте 10%
            с каждого выполненного заказа.
          </p>

          <ol className="mt-7 grid gap-4 sm:grid-cols-3">
            {PARTNER_STEPS.map(({ icon: Icon, title }, i) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="pt-1 text-sm font-medium leading-snug text-foreground">
                  {i + 1}. {title}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-sm text-muted-foreground">
            Все заказы, статусы, суммы и начисления видны по вашей персональной ссылке.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/partners">
              <Button size="lg" className="h-12 w-full rounded-full px-7 text-base sm:w-auto">
                Подробнее о партнёрской программе
              </Button>
            </Link>
            <a href={TELEGRAM_PARTNER_START_URL} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="h-12 w-full rounded-full px-7 text-base sm:w-auto">
                Стать партнёром
              </Button>
            </a>
          </div>
        </div>
      </Shell>
    </section>
  )
}

function FinalCta({ telegramUrl }: { telegramUrl: string }) {
  return (
    <section className="py-20 sm:py-28">
      <Shell className="rounded-3xl border border-border bg-card px-6 py-14 text-center sm:px-12">
        <Sparkles className="mx-auto size-8 text-primary" />
        <h2 className="mx-auto mt-5 max-w-xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Чистая квартира без лишнего контроля с вашей стороны
        </h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
          Оформите заказ — дальше всё видно в CleanTrack.
        </p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <a href="#price">
            <Button size="lg" className="h-12 w-full rounded-full px-7 text-base sm:w-auto">
              Рассчитать стоимость
            </Button>
          </a>
          <a href={telegramUrl} target="_blank" rel="noreferrer">
            <Button size="lg" variant="outline" className="h-12 w-full gap-2 rounded-full px-7 text-base sm:w-auto">
              <MessageCircle className="size-4" /> Заказать в Telegram
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
        <Logo />
        <p className="text-sm text-muted-foreground">cleantrack.ru</p>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <a href={telegramUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
            Telegram
          </a>
          <Link href="/partners" className="hover:text-foreground">
            Партнёрам
          </Link>
          <span>Privacy</span>
          <span>Оферта</span>
        </div>
      </Shell>
    </footer>
  )
}
