import { DEMO_CLEANING_ID, getCleaningData } from '@/lib/data/cleanings'
import { CleanerView } from './cleaner-view'

export default async function CleanerPage() {
  const data = await getCleaningData(DEMO_CLEANING_ID)
  return <CleanerView {...data} />
}
