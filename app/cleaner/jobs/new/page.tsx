import { getServices } from '@/lib/data/cleanings'
import { NewCleaningForm } from './new-cleaning-form'

export default async function NewCleaningPage() {
  const services = await getServices()
  return <NewCleaningForm services={services} />
}
