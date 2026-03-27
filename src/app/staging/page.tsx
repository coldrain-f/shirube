import { getStagingWords } from '@/app/actions/staging'
import { getDictionaries } from '@/app/actions/dictionary'
import StagingClientView from './client-view'

export const dynamic = 'force-dynamic'

export default async function StagingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const [{ words, totalCount, pageSize }, dictionaries] = await Promise.all([
    getStagingWords(params.q || '', page),
    getDictionaries(),
  ])

  return (
    <div className="h-full w-full">
      <StagingClientView
        initialWords={words}
        initialQuery={params.q || ''}
        totalCount={totalCount}
        currentPage={page}
        pageSize={pageSize}
        dictionaries={dictionaries}
      />
    </div>
  )
}
