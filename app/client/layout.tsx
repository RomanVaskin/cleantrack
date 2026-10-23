import { privateRouteMetadata } from '@/lib/private-route-metadata'

export const metadata = privateRouteMetadata

export default function PrivateSectionLayout({ children }: { children: React.ReactNode }) {
  return children
}
