import Link from 'next/link'
import { ArrowRight, ClipboardCheck, Eye } from 'lucide-react'
import { Logo } from '@/components/logo'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-10">
      <Logo withTagline />

      <div className="mt-14 flex-1">
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight">
          Уборка под контролем
        </h1>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
          Клинер отмечает пункты чек-листа, а клиент видит прогресс уборки в реальном времени.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <RoleCard
            href="/cleaner"
            icon={<ClipboardCheck className="size-6" />}
            title="Я клинер"
            subtitle="Отмечаю пункты и завершаю уборку"
          />
          <RoleCard
            href="/client"
            icon={<Eye className="size-6" />}
            title="Я клиент"
            subtitle="Смотрю прогресс и принимаю работу"
          />
        </div>
      </div>

      <p className="pt-8 text-center text-sm text-muted-foreground">CleanTrack.ru</p>
    </main>
  )
}

function RoleCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors active:bg-accent"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-medium">{title}</span>
        <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}
