export const dynamic = 'force-dynamic'

import { getDictionaryEntries } from '@/app/actions/dictionary'
import DictionaryClientView from './client-view'

export default async function DictionaryPage() {
  const entries = await getDictionaryEntries()
  
  return (
    <div className="h-full w-full p-6 bg-background overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">내 사전 (Dictionary Entries)</h1>
          <p className="text-muted-foreground mt-2">완성된 단어장 데이터를 관리하고 검수합니다.</p>
        </div>
        <DictionaryClientView initialEntries={entries} />
      </div>
    </div>
  )
}
