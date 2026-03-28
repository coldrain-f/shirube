export default function DictionaryLoading() {
  return (
    <div className="h-full w-full p-6 bg-background overflow-y-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">내 사전 (Dictionary Entries)</h1>
          <p className="text-muted-foreground mt-2">완성된 단어장 데이터를 관리하고 검수합니다.</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm">단어 목록을 불러오는 중...</p>
        </div>
      </div>
    </div>
  )
}
