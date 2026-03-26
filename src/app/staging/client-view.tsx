'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { staging_words } from '@prisma/client'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { addWordToDictionary } from '@/app/actions/staging'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function StagingClientView({ 
  initialWords, 
  initialQuery = '' 
}: { 
  initialWords: staging_words[],
  initialQuery?: string 
}) {
  const [words, setWords] = useState<staging_words[]>(initialWords)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchInput, setSearchInput] = useState(initialQuery)
  const [showPreview, setShowPreview] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const [formData, setFormData] = useState({
    term: '',
    reading: '',
    meaning: '',
    part_of_speech: '',
    tags: ''
  })
  
  const formRef = useRef<HTMLFormElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  
  // Sync words if initialWords changes
  useEffect(() => {
    setWords(initialWords)
  }, [initialWords])

  const selectedWord = words[selectedIndex]

  // Focus effect to reset form & scroll to item
  useEffect(() => {
    if (selectedWord) {
      // Auto-extract or default pos
      let pos = selectedWord.part_of_speech || ''
      // Basic heuristics to map korean POS to standard tags if possible
      if (pos.includes('명사')) pos = 'n'
      else if (pos.includes('형용사')) pos = 'adj-i'
      else if (pos.includes('동사')) pos = 'v1' // default
      else if (pos.includes('부사')) pos = 'adv'
      else if (pos.includes('감동사')) pos = 'int'
      else pos = 'n'

      const rawTerm = selectedWord.term || ''
      const parts = rawTerm.split('|')
      
      setFormData({
        term: parts[0],
        reading: selectedWord.reading || '',
        meaning: selectedWord.meaning || '',
        part_of_speech: pos,
        tags: parts.length > 1 ? parts.slice(1).join(', ') : ''
      })
      
      // Auto scroll to selected item
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [selectedWord, selectedIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        formRef.current?.requestSubmit()
      }
      
      // Arrow Up/Down to navigate
      if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, words.length - 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [words.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWord) return

    try {
      await addWordToDictionary({
        term: formData.term,
        reading: formData.reading,
        meaning: formData.meaning,
        part_of_speech: formData.part_of_speech,
        source: selectedWord.source,
        staging_id: selectedWord.id
      })
      
      toast.success(`${selectedWord.term} 사전에 등록되었습니다.`)
      
      // Remove from local state and move to next
      const newWords = words.filter(w => w.id !== selectedWord.id)
      setWords(newWords)
      setSelectedIndex(prev => Math.min(prev, newWords.length - 1))
    } catch (error) {
      toast.error('등록에 실패했습니다.')
      console.error(error)
    }
  }

  return (
    <ResizablePanelGroup 
      // @ts-expect-error shadcn internal type mismatch
      direction="horizontal" 
      className="h-[calc(100vh-3.5rem)] rounded-none"
    >
      <ResizablePanel defaultSize={30} minSize={15} className="flex flex-col border-r">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
                <h2 className="font-semibold">대기열 ({words.length})</h2>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  router.push(`${pathname}?q=${encodeURIComponent(searchInput)}`);
                }} className="flex gap-2">
                  <Input 
                    placeholder="단어 검색 (엔터)" 
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                  />
                  <Button type="submit" variant="secondary">검색</Button>
                </form>
                
                <div className="space-y-2 mt-4">
                {words.length === 0 ? (
                  <p className="text-sm text-muted-foreground">대기열이 비어있거나 검색 결과가 없습니다.</p>
                ) : (
                  words.map((word, idx) => (
                    <div 
                      key={word.id} 
                      ref={(el) => { itemRefs.current[idx] = el }}
                      onClick={() => setSelectedIndex(idx)}
                      className={`p-3 border rounded-md cursor-pointer transition-colors ${
                        idx === selectedIndex ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">{word.term}</span>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">Freq: {word.frequency}</span>
                      </div>
                      {word.part_of_speech && <div className="text-sm text-muted-foreground mt-1">{word.part_of_speech}</div>}
                    </div>
                  ))
                )}
                </div>
              </div>
            </ScrollArea>
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize={30} minSize={25} className="bg-muted/10 p-4 overflow-y-auto">
        {selectedWord ? (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xl">{selectedWord.term} 등록</h3>
                  <span className="text-xs text-muted-foreground font-mono bg-background px-2 py-1 rounded border shadow-sm">Cmd+Enter로 저장</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="term">표제어 (Term) <span className="text-red-500">*</span></Label>
                    {formData.tags && <span className="text-xs text-muted-foreground">대체 표기: {formData.tags}</span>}
                  </div>
                  <Input 
                    id="term" 
                    value={formData.term}
                    onChange={e => setFormData({...formData, term: e.target.value})}
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reading">요미가나 (Reading) <span className="text-red-500">*</span></Label>
                  <Input 
                    id="reading" 
                    value={formData.reading}
                    onChange={e => setFormData({...formData, reading: e.target.value})}
                    required 
                    autoFocus
                  />
                </div>
                
                <div className="space-y-2 flex-col flex flex-1 min-h-[150px]">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="meaning">뜻 (Meaning) <span className="text-red-500">*</span></Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? '에디터 보기' : 'HTML 미리보기'}
                    </Button>
                  </div>
                  {showPreview ? (
                    <div 
                      className="flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: formData.meaning || '<span class="text-muted-foreground">내용이 없습니다.</span>' }}
                    />
                  ) : (
                    <Textarea 
                      id="meaning" 
                      value={formData.meaning}
                      onChange={e => setFormData({...formData, meaning: e.target.value})}
                      required 
                      className="flex-1 resize-none"
                    />
                  )}
                </div>
                
                <div className="space-y-2 pb-2">
                  <Label htmlFor="pos">품사 태그 (Part of Speech) <span className="text-red-500">*</span></Label>
                  <Select value={formData.part_of_speech} onValueChange={(v) => setFormData({...formData, part_of_speech: v || ''})}>
                    <SelectTrigger>
                      <SelectValue placeholder="품사 선택 (예: n)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="n">명사 (n)</SelectItem>
                      <SelectItem value="v1">상하1단 동사 (v1)</SelectItem>
                      <SelectItem value="v5k">5단 동사 -ku (v5k)</SelectItem>
                      <SelectItem value="v5s">5단 동사 -su (v5s)</SelectItem>
                      <SelectItem value="v5t">5단 동사 -tsu (v5t)</SelectItem>
                      <SelectItem value="v5n">5단 동사 -nu (v5n)</SelectItem>
                      <SelectItem value="v5m">5단 동사 -mu (v5m)</SelectItem>
                      <SelectItem value="v5r">5단 동사 -ru (v5r)</SelectItem>
                      <SelectItem value="v5w">5단 동사 -u (v5w)</SelectItem>
                      <SelectItem value="v5g">5단 동사 -gu (v5g)</SelectItem>
                      <SelectItem value="v5b">5단 동사 -bu (v5b)</SelectItem>
                      <SelectItem value="vk">くる 동사 (vk)</SelectItem>
                      <SelectItem value="vs">する 동사 (vs)</SelectItem>
                      <SelectItem value="adj-i">い 형용사 (adj-i)</SelectItem>
                      <SelectItem value="adj-na">な 형용사 (adj-na)</SelectItem>
                      <SelectItem value="adv">부사 (adv)</SelectItem>
                      <SelectItem value="exp">표현/숙어 (exp)</SelectItem>
                      <SelectItem value="int">감동사 (int)</SelectItem>
                      <SelectItem value="prt">조사 (prt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button type="submit" className="w-full mt-auto">사전에 등록</Button>
              </form>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground text-sm">
                <p>선택된 단어가 없습니다.</p>
                <p>대기열에 단어를 추가해주세요.</p>
              </div>
            )}
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize={40} minSize={25}>
        {selectedWord ? (
          <iframe 
            src={`https://ja.dict.naver.com/#/search?query=${encodeURIComponent(selectedWord.term)}`}
            className="w-full h-full border-0"
            title="Naver Dictionary"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted/10 text-muted-foreground">
            우측에 사전 화면이 표시됩니다.
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
