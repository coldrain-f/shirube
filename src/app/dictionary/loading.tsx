export default function DictionaryLoading() {
  return (
    <div className="h-full w-full p-6 bg-background overflow-y-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">내 사전 (Dictionary Entries)</h1>
          <p className="text-muted-foreground mt-2">완성된 단어장 데이터를 관리하고 검수합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-44 bg-muted animate-pulse rounded-md" />
          <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  )
}
