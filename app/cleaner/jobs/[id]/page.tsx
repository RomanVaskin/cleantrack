import { notFound } from 'next/navigation'
import { getCleaningData } from '@/lib/data/cleanings'
import { CleanerView } from '../../cleaner-view'

export default async function CleanerJobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getCleaningData(id)
  if (!data || data.cleaning.id !== id) notFound()

  return <CleanerView {...data} />
}
