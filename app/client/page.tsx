import { DEMO_CLEANING_ID, getCleaningData } from '@/lib/data/cleanings'
import { ClientView } from './client-view'

export default async function ClientPage() {
  const data = await getCleaningData(DEMO_CLEANING_ID)
  return <ClientView {...data} />
}
