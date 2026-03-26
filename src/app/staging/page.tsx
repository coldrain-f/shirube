import { getStagingWords } from '@/app/actions/staging'
import StagingClientView from './client-view'

export const dynamic = 'force-dynamic'

export default async function StagingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const words = await getStagingWords(params.q || '')
  
  return (
    <div className="h-full w-full">
      <StagingClientView initialWords={words} initialQuery={params.q || ''} />
    </div>
  )
}
