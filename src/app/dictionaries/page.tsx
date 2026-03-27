import { getDictionaries } from '@/app/actions/dictionary'
import DictionariesClientView from './client-view'

export default async function DictionariesPage() {
  const dictionaries = await getDictionaries()
  return (
    <div className="p-6">
      <DictionariesClientView initialDictionaries={dictionaries} />
    </div>
  )
}
