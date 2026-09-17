import { notFound } from 'next/navigation'
import { getCleaningDataByClientToken } from '@/lib/data/cleanings'
import { ClientView } from '../client-view'

export default async function ClientCleaningPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getCleaningDataByClientToken(token)
  if (!data) notFound()

  return <ClientView {...data} />
}
