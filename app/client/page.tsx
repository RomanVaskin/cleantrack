import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

export default function ClientPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
        Откройте персональную ссылку на уборку, которую вам отправил клинер.
      </p>
      <Link href="/" className="mt-8 w-full">
        <Button size="lg" className="h-14 w-full rounded-2xl text-base">
          На главную
        </Button>
      </Link>
    </main>
  )
}
