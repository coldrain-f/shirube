'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { staging_words } from '@prisma/client'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { addWordToDictionary, clearAllStagingWords, getAllStagingWordsForExport, importStagingWords, getJPDBUpdatesNeeded, bulkUpdateFrequencies, deleteStagingWord, updateStagingWord, getPosUpdatesFromReference, bulkApplyPosUpdates, getAllReadyStagingWords, bulkRegisterChunkToDictionary } from '@/app/actions/staging'
import { toast } from 'sonner'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronLeft, ChevronRight, Trash2, Download, Upload, RefreshCw, Pencil, Tag, BookCheck } from 'lucide-react'

const POS_RULES = ['v1', 'v5', 'vk', 'vs', 'adj-i'] as const
const VALID_RULES = new Set(POS_RULES)

function isValidRules(pos: string): boolean {
  if (!pos) return true
  return pos.split(' ').filter(Boolean).every(r => VALID_RULES.has(r as typeof POS_RULES[number]))
}

function togglePosRule(current: string, rule: string): string {
  const rules = new Set(current.split(' ').filter(Boolean))
  if (rules.has(rule)) rules.delete(rule)
  else rules.add(rule)
  return [...rules].join(' ')
}

function PosToggleGroup({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = new Set(value.split(' ').filter(Boolean))
  return (
    <div className="flex flex-wrap gap-1">
      {POS_RULES.map(rule => (
        <Toggle
          key={rule}
          size="sm"
          variant="outline"
          pressed={selected.has(rule)}
          onPressedChange={() => onChange(togglePosRule(value, rule))}
          className={cn('font-mono', selected.has(rule) && '!bg-primary text-primary-foreground hover:!bg-primary/90 hover:text-primary-foreground border-primary')}
        >
          {rule}
        </Toggle>
      ))}
    </div>
  )
}

type DictionaryOption = {
  id: number
  name: string
  _count: { entries: number }
}

export default function StagingClientView({
  initialWords,
  initialQuery = '',
  totalCount,
  currentPage,
  pageSize,
  dictionaries = [],
}: {
  initialWords: staging_words[]
  initialQuery?: string
  totalCount: number
  currentPage: number
  pageSize: number
  dictionaries?: DictionaryOption[]
}) {
  const [words, setWords] = useState<staging_words[]>(initialWords)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchInput, setSearchInput] = useState(initialQuery)
  const [isEditingPage, setIsEditingPage] = useState(false)
  const [pageInput, setPageInput] = useState(String(currentPage))
  const [importOpen, setImportOpen] = useState(false)
  const [importData, setImportData] = useState<{ term: string; reading?: string | null; meaning?: string | null; frequency: number; part_of_speech?: string | null; source: string }[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [clearOpen, setClearOpen] = useState(false)
  const [bulkAllOpen, setBulkAllOpen] = useState(false)
  const [isBulkAllRegistering, setIsBulkAllRegistering] = useState(false)
  const [bulkAllProgress, setBulkAllProgress] = useState(0)
  const [bulkAllTotal, setBulkAllTotal] = useState(0)
  const [deleteWordOpen, setDeleteWordOpen] = useState(false)
  const [deleteWordTarget, setDeleteWordTarget] = useState<{ id: number; term: string } | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<staging_words | null>(null)
  const [editFormData, setEditFormData] = useState({ term: '', reading: '', meaning: '', part_of_speech: '' })
  const [selectedDictionaryId, setSelectedDictionaryId] = useState<number | undefined>(dictionaries[0]?.id)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(0)
  const [isBulkRegistering, setIsBulkRegistering] = useState(false)
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  
  // Sync words if initialWords changes (page navigation)
  useEffect(() => {
    setWords(initialWords)
    setSelectedIndex(0)
    setPageInput(String(currentPage))
  }, [initialWords, currentPage])

  const selectedWord = words[selectedIndex]

  // Focus effect to reset form & scroll to item
  useEffect(() => {
    if (selectedWord) {
      // Auto-extract or default pos (Yomitan rules: v1, v5, vk, vs, adj-i, '' for non-conjugating)
      let pos = selectedWord.part_of_speech || ''
      if (!isValidRules(pos)) {
        if (pos.includes('형용사')) pos = 'adj-i'
        else if (pos.includes('동사')) pos = 'v1'
        else pos = ''
      }

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

  const parseCSV = useCallback((text: string) => {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('CSV 파일에 데이터가 없습니다.')
    
    const header = lines[0].toLowerCase()
    if (!header.includes('term')) throw new Error('CSV 파일에 term 컬럼이 필요합니다.')
    
    // Parse header
    const cols = header.split(',')
    const idx = {
      term: cols.indexOf('term'),
      reading: cols.indexOf('reading'),
      meaning: cols.indexOf('meaning'),
      frequency: cols.indexOf('frequency'),
      part_of_speech: cols.indexOf('part_of_speech'),
      source: cols.indexOf('source'),
    }
    
    return lines.slice(1).map(line => {
      // Handle quoted fields (CSV with commas inside quotes)
      const fields: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
          else inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) {
          fields.push(current); current = ''
        } else {
          current += ch
        }
      }
      fields.push(current)
      
      return {
        term: fields[idx.term]?.trim() || '',
        reading: idx.reading >= 0 ? fields[idx.reading]?.trim() || null : null,
        meaning: idx.meaning >= 0 ? fields[idx.meaning]?.trim() || null : null,
        frequency: idx.frequency >= 0 ? parseInt(fields[idx.frequency], 10) || 0 : 0,
        part_of_speech: idx.part_of_speech >= 0 ? fields[idx.part_of_speech]?.trim() || null : null,
        source: idx.source >= 0 ? fields[idx.source]?.trim() || 'import' : 'import',
      }
    }).filter(w => w.term)
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImportFileName(file.name)
    try {
      const text = await file.text()
      let parsed: typeof importData
      
      if (file.name.endsWith('.json')) {
        const json = JSON.parse(text)
        const arr = Array.isArray(json) ? json : [json]
        parsed = arr.map((w: Record<string, unknown>) => ({
          term: String(w.term || ''),
          reading: w.reading ? String(w.reading) : null,
          meaning: w.meaning ? String(w.meaning) : null,
          frequency: Number(w.frequency) || 0,
          part_of_speech: w.part_of_speech ? String(w.part_of_speech) : null,
          source: String(w.source || 'import'),
        })).filter((w: { term: string }) => w.term)
      } else {
        parsed = parseCSV(text)
      }
      
      if (!parsed.length) {
        toast.error('파일에서 유효한 데이터를 찾을 수 없습니다.')
        return
      }
      setImportData(parsed)
    } catch (err) {
      toast.error(`파일 파싱 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
      setImportData([])
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [parseCSV])

  const handleImport = useCallback(async () => {
    if (!importData.length) return
    setIsImporting(true)
    setImportProgress(0)
    
    const CHUNK_SIZE = 500
    let totalImported = 0
    let totalSkipped = 0
    
    try {
      for (let i = 0; i < importData.length; i += CHUNK_SIZE) {
        const chunk = importData.slice(i, i + CHUNK_SIZE)
        const result = await importStagingWords(chunk, skipDuplicates)
        totalImported += result.imported
        totalSkipped += result.skipped || 0
        setImportProgress(Math.round(((i + chunk.length) / importData.length) * 100))
      }
      
      const msg = totalSkipped
        ? `${totalImported}개 단어 추가, ${totalSkipped}개 중복 건너뜀`
        : `${totalImported}개 단어가 추가되었습니다.`
      toast.success(msg)
      setImportOpen(false)
      setImportData([])
      setImportFileName('')
      router.push(pathname)
    } catch {
      toast.error('불러오기에 실패했습니다.')
    } finally {
      setIsImporting(false)
      setImportProgress(0)
    }
  }, [importData, skipDuplicates, router, pathname])

  const handleClearAll = async () => {
    try {
      const result = await clearAllStagingWords()
      toast.success(`${result.deleted}개 단어가 삭제되었습니다.`)
      setClearOpen(false)
      router.push(pathname)
    } catch { 
      toast.error('삭제에 실패했습니다.') 
    }
  }

  const handleDeleteWord = (id: number, term: string) => {
    setDeleteWordTarget({ id, term })
    setDeleteWordOpen(true)
  }

  const handleDeleteWordConfirm = async () => {
    if (!deleteWordTarget) return
    try {
      await deleteStagingWord(deleteWordTarget.id)
      const newWords = words.filter(w => w.id !== deleteWordTarget.id)
      setWords(newWords)
      setSelectedIndex(prev => Math.min(prev, newWords.length - 1))
      toast.success('단어가 삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setDeleteWordOpen(false)
      setDeleteWordTarget(null)
    }
  }

  const openEditDialog = (word: staging_words) => {
    setEditingWord(word)
    setEditFormData({
      term: word.term,
      reading: word.reading || '',
      meaning: word.meaning || '',
      part_of_speech: word.part_of_speech || '',
    })
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!editingWord) return
    try {
      await updateStagingWord(editingWord.id, {
        term: editFormData.term,
        reading: editFormData.reading || null,
        meaning: editFormData.meaning || null,
        part_of_speech: editFormData.part_of_speech || null,
      })
      setWords(words.map(w => w.id === editingWord.id ? { ...w, ...editFormData } : w))
      setEditOpen(false)
      toast.success('단어가 수정되었습니다.')
    } catch {
      toast.error('수정에 실패했습니다.')
    }
  }

  const handleBulkAllRegister = async () => {
    setIsBulkAllRegistering(true)
    setBulkAllProgress(0)
    try {
      const allWords = await getAllReadyStagingWords()
      if (allWords.length === 0) {
        toast.error('등록할 단어가 없습니다. (요미가나·뜻이 입력된 단어 없음)')
        setBulkAllOpen(false)
        return
      }
      setBulkAllTotal(allWords.length)

      const CHUNK_SIZE = 100
      let registered = 0
      for (let i = 0; i < allWords.length; i += CHUNK_SIZE) {
        const chunk = allWords.slice(i, i + CHUNK_SIZE)
        const result = await bulkRegisterChunkToDictionary(chunk, selectedDictionaryId)
        registered += result.registered
        setBulkAllProgress(Math.round(((i + chunk.length) / allWords.length) * 100))
      }

      toast.success(`${registered.toLocaleString()}개 단어를 사전에 등록했습니다.`)
      setBulkAllOpen(false)
      router.push(pathname)
    } catch {
      toast.error('전체 일괄 등록 중 오류가 발생했습니다.')
    } finally {
      setIsBulkAllRegistering(false)
      setBulkAllProgress(0)
      setBulkAllTotal(0)
    }
  }

  const handleBulkRegister = async () => {
    const toRegister = words.filter(w => w.reading && w.meaning)
    if (!toRegister.length) {
      toast.error('요미가나와 뜻이 모두 입력된 단어가 없습니다.')
      return
    }
    setIsBulkRegistering(true)
    setBulkProgress(0)
    let registered = 0
    try {
      for (let i = 0; i < toRegister.length; i++) {
        const w = toRegister[i]
        let pos = w.part_of_speech || ''
        if (!isValidRules(pos)) {
          if (pos.includes('형용사')) pos = 'adj-i'
          else if (pos.includes('동사')) pos = 'v1'
          else pos = ''
        }

        const rawTerm = w.term || ''
        const parts = rawTerm.split('|')

        await addWordToDictionary({
          term: parts[0],
          reading: w.reading!,
          meaning: w.meaning!,
          part_of_speech: pos,
          dictionary_id: selectedDictionaryId,
          staging_id: w.id,
        })
        registered++
        setBulkProgress(Math.round(((i + 1) / toRegister.length) * 100))
      }
      toast.success(`${registered}개 단어를 사전에 등록했습니다.`)
      setBulkOpen(false)
      router.push(pathname)
    } catch {
      toast.error('일괄 등록 중 오류가 발생했습니다.')
    } finally {
      setIsBulkRegistering(false)
      setBulkProgress(0)
    }
  }

  const handleBulkUpdatePos = async () => {
    const toastId = toast.loading('품사 업데이트 대상 계산 중...')
    try {
      const { updates, notFound } = await getPosUpdatesFromReference()
      if (updates.length === 0) {
        toast.success(`업데이트할 단어가 없습니다. (미발견 ${notFound}개)`, { id: toastId })
        return
      }

      const CHUNK_SIZE = 500
      let totalUpdated = 0
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE)
        const result = await bulkApplyPosUpdates(chunk)
        totalUpdated += result.updated
        const progress = Math.round((totalUpdated / updates.length) * 100)
        toast.loading(`품사 업데이트 중... (${progress}%)`, { id: toastId })
      }

      toast.success(`${totalUpdated}개 품사 업데이트 완료, ${notFound}개 미발견`, { id: toastId })
      router.push(pathname)
    } catch {
      toast.error('품사 자동 채우기에 실패했습니다.', { id: toastId })
    }
  }

  const handleUpdateJPDB = async () => {
    const toastId = toast.loading('JPDB 업데이트 대상 계산 중...')
    try {
      const updates = await getJPDBUpdatesNeeded()
      if (updates.length === 0) {
        toast.success('모든 단어의 빈도수가 최신 상태입니다.', { id: toastId })
        return
      }

      const CHUNK_SIZE = 500
      let totalUpdated = 0

      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE)
        const result = await bulkUpdateFrequencies(chunk)
        totalUpdated += result.updated
        const progress = Math.round((totalUpdated / updates.length) * 100)
        toast.loading(`JPDB 업데이트 처리 중... (${progress}%)`, { id: toastId })
      }

      toast.success(`${totalUpdated}개 단어의 빈도수가 성공적으로 업데이트되었습니다.`, { id: toastId })
    } catch (e: any) {
      toast.error(e.message || '업데이트에 실패했습니다.', { id: toastId })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWord) return

    try {
      await addWordToDictionary({
        term: formData.term,
        reading: formData.reading,
        meaning: formData.meaning,
        part_of_speech: formData.part_of_speech,
        dictionary_id: selectedDictionaryId,
        staging_id: selectedWord.id,
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
      orientation="horizontal" 
      className="h-[calc(100vh-3.5rem)] rounded-none"
    >
      <ResizablePanel defaultSize={30} minSize={15}>
        <div className="flex flex-col h-full overflow-hidden border-r">
        {/* 검색 영역 — 상단 고정 */}
        <div className="p-4 pb-3 space-y-3 border-b bg-background shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">대기열 ({totalCount})</h2>
            <div className="flex gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" title="내보내기">
                    <Download className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={async () => {
                    try {
                      toast.info('내보내기 준비 중...')
                      const data = await getAllStagingWordsForExport()
                      const csv = [
                        'term,reading,meaning,frequency,part_of_speech,source',
                        ...data.map(w => 
                          [w.term, w.reading || '', `"${(w.meaning || '').replace(/"/g, '""')}"`, w.frequency, w.part_of_speech || '', w.source].join(',')
                        )
                      ].join('\n')
                      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = `shirube_dict_staging_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.csv`
                      a.click(); URL.revokeObjectURL(url)
                      toast.success(`${data.length}개 단어를 CSV로 내보냈습니다.`)
                    } catch { toast.error('내보내기에 실패했습니다.') }
                  }}>
                    CSV로 내보내기
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    try {
                      toast.info('내보내기 준비 중...')
                      const data = await getAllStagingWordsForExport()
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = `shirube_dict_staging_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`
                      a.click(); URL.revokeObjectURL(url)
                      toast.success(`${data.length}개 단어를 JSON으로 내보냈습니다.`)
                    } catch { toast.error('내보내기에 실패했습니다.') }
                  }}>
                    JSON으로 내보내기
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                title="불러오기 (CSV/JSON)"
                onClick={() => { setImportOpen(true); setImportData([]); setImportFileName('') }}
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                title="전체 일괄 사전 등록"
                onClick={() => setBulkAllOpen(true)}
              >
                <BookCheck className="h-4 w-4" />
              </button>
              <button
                className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                title="품사 자동 채우기 (yomitan_pos_reference)"
                onClick={handleBulkUpdatePos}
              >
                <Tag className="h-4 w-4" />
              </button>
              <button
                className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                title="JPDB 빈도수 자동 채우기"
                onClick={handleUpdateJPDB}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-destructive hover:text-destructive" 
                title="대기열 초기화"
                onClick={() => setClearOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
        </div>

        {/* 단어 리스트 — 스크롤 영역 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 space-y-2">
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
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-bold text-lg flex-1 min-w-0 truncate">{word.term}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">Freq: {word.frequency}</span>
                      <button
                        className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        title="수정"
                        onClick={(e) => { e.stopPropagation(); openEditDialog(word) }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600"
                        title="삭제"
                        onClick={(e) => { e.stopPropagation(); handleDeleteWord(word.id, word.term) }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {word.part_of_speech && <div className="text-sm text-muted-foreground mt-1">{word.part_of_speech}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 페이지네이션 — 하단 고정 */}
        {totalCount > pageSize && (() => {
          const totalPages = Math.ceil(totalCount / pageSize)
          const queryParam = searchInput ? `q=${encodeURIComponent(searchInput)}&` : ''
          return (
            <div className="p-3 border-t bg-background flex items-center justify-between text-sm shrink-0">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => router.push(`${pathname}?${queryParam}page=${currentPage - 1}`)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                이전
              </Button>
              {isEditingPage ? (
                <form onSubmit={(e) => {
                  e.preventDefault()
                  const p = Math.max(1, Math.min(totalPages, parseInt(pageInput, 10) || 1))
                  setIsEditingPage(false)
                  router.push(`${pathname}?${queryParam}page=${p}`)
                }} className="flex items-center gap-1">
                  <Input
                    className="w-16 h-7 text-center text-sm"
                    value={pageInput}
                    onChange={e => setPageInput(e.target.value)}
                    onBlur={() => setIsEditingPage(false)}
                    autoFocus
                  />
                  <span className="text-muted-foreground">/ {totalPages}</span>
                </form>
              ) : (
                <button
                  onClick={() => { setPageInput(String(currentPage)); setIsEditingPage(true) }}
                  className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors"
                >
                  {currentPage} / {totalPages}
                </button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => router.push(`${pathname}?${queryParam}page=${currentPage + 1}`)}
              >
                다음
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )
        })()}
        </div>
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize={30} minSize={25} className="bg-muted/10 p-4 overflow-y-auto">
        {selectedWord ? (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 min-h-full flex flex-col">
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
                  <Label htmlFor="meaning">뜻 (Meaning) <span className="text-red-500">*</span></Label>
                  <RichTextEditor 
                    value={formData.meaning}
                    onChange={(html) => setFormData({...formData, meaning: html})}
                  />
                </div>
                
                <div className="space-y-2 pb-2">
                  <Label>품사 (Yomitan rules) <span className="text-muted-foreground text-xs font-normal">— 없으면 활용 없음</span></Label>
                  <PosToggleGroup
                    value={formData.part_of_speech}
                    onChange={(v) => setFormData({...formData, part_of_speech: v})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>등록할 사전 <span className="text-red-500">*</span></Label>
                  {dictionaries.length === 0 ? (
                    <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                      등록된 사전이 없습니다.{' '}
                      <a href="/dictionaries" className="underline hover:text-foreground">사전 관리</a>에서 먼저 사전을 생성하세요.
                    </p>
                  ) : (
                    <Select
                      value={selectedDictionaryId !== undefined ? String(selectedDictionaryId) : '__none__'}
                      onValueChange={v => setSelectedDictionaryId(v === '__none__' ? undefined : Number(v))}
                    >
                      <SelectTrigger>
                        <span className="flex flex-1 text-left truncate">
                          {selectedDictionaryId !== undefined
                            ? (dictionaries.find(d => d.id === selectedDictionaryId)?.name ?? String(selectedDictionaryId))
                            : '사전 선택 안 함'}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">사전 선택 안 함</SelectItem>
                        {dictionaries.map(d => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button type="submit" className="flex-1" disabled={selectedDictionaryId === undefined}>사전에 등록</Button>
                  <Button type="button" variant="outline" onClick={() => setBulkOpen(true)} title="현재 페이지 단어 일괄 등록" disabled={selectedDictionaryId === undefined}>
                    일괄 등록
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground text-sm">
                <p>선택된 단어가 없습니다.</p>
                <p>대기열에 단어를 추가해주세요.</p>
              </div>
            )}
      </ResizablePanel>
      
      <ResizableHandle withHandle />
      
      <ResizablePanel defaultSize={40} minSize={25} className="relative">
        {selectedWord ? (
          <iframe 
            src={`https://ja.dict.naver.com/#/search?query=${encodeURIComponent(selectedWord.term)}`}
            className="absolute inset-0 w-full h-full border-0"
            title="Naver Dictionary"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted/10 text-muted-foreground">
            우측에 사전 화면이 표시됩니다.
          </div>
        )}
      </ResizablePanel>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>대기열 데이터 불러오기</DialogTitle>
            <DialogDescription>CSV 또는 JSON 파일을 업로드하여 대기열에 단어를 추가합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
              <span className="text-sm text-muted-foreground flex-1">템플릿 다운로드</span>
              <Button variant="outline" size="sm" onClick={() => {
                const csv = 'term,reading,meaning,frequency,part_of_speech,source\n勉強,べんきょう,공부,1,v5,example'
                const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'template.csv'; a.click(); URL.revokeObjectURL(a.href)
              }}>CSV</Button>
              <Button variant="outline" size="sm" onClick={() => {
                const json = JSON.stringify([{ term: '勉強', reading: 'べんきょう', meaning: '공부', frequency: 1, part_of_speech: 'v5', source: 'example' }], null, 2)
                const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'template.json'; a.click(); URL.revokeObjectURL(a.href)
              }}>JSON</Button>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground file:cursor-pointer hover:file:bg-primary/90"
              />
            </div>
            
            {importData.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{importFileName}</span>에서 <span className="font-bold text-foreground">{importData.length}개</span> 단어를 발견했습니다.
                </p>
                <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Term</th>
                        <th className="text-left p-2 font-medium">Reading</th>
                        <th className="text-right p-2 font-medium">Freq</th>
                        <th className="text-left p-2 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importData.slice(0, 5).map((w, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-medium">{w.term}</td>
                          <td className="p-2 text-muted-foreground">{w.reading || '-'}</td>
                          <td className="p-2 text-right">{w.frequency}</td>
                          <td className="p-2 text-muted-foreground">{w.source}</td>
                        </tr>
                      ))}
                      {importData.length > 5 && (
                        <tr className="border-t">
                          <td colSpan={4} className="p-2 text-center text-muted-foreground text-xs">외 {importData.length - 5}개...</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="skipDuplicates" 
                    checked={skipDuplicates} 
                    onCheckedChange={(v) => setSkipDuplicates(v === true)} 
                  />
                  <Label htmlFor="skipDuplicates" className="text-sm cursor-pointer">중복된 단어(term) 건너뛰기</Label>
                </div>
              </>
            )}
          </div>
          {isImporting && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>불러오는 중...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={isImporting}>취소</Button>
            <Button onClick={handleImport} disabled={!importData.length || isImporting}>
              {isImporting ? `${importProgress}% 처리 중...` : `${importData.length}개 단어 불러오기`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk ALL Register Dialog */}
      <AlertDialog open={bulkAllOpen} onOpenChange={setBulkAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전체 일괄 사전 등록</AlertDialogTitle>
            <AlertDialogDescription>
              요미가나와 뜻이 입력된 <strong>모든 대기열 단어</strong>를{' '}
              {selectedDictionaryId
                ? <><strong>{dictionaries.find(d => d.id === selectedDictionaryId)?.name}</strong> 사전에</>
                : ' 사전 연결 없이'
              } 등록합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 px-1">
            <div className="space-y-1">
              <Label>등록할 사전</Label>
              {dictionaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">등록된 사전이 없습니다.</p>
              ) : (
                <Select
                  value={selectedDictionaryId !== undefined ? String(selectedDictionaryId) : '__none__'}
                  onValueChange={v => setSelectedDictionaryId(v === '__none__' ? undefined : Number(v))}
                >
                  <SelectTrigger>
                    <span className="flex flex-1 text-left truncate">
                      {selectedDictionaryId !== undefined
                        ? (dictionaries.find(d => d.id === selectedDictionaryId)?.name ?? String(selectedDictionaryId))
                        : '사전 선택 안 함'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">사전 선택 안 함</SelectItem>
                    {dictionaries.map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {isBulkAllRegistering && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>등록 중... ({bulkAllTotal.toLocaleString()}개)</span>
                  <span>{bulkAllProgress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${bulkAllProgress}%` }} />
                </div>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkAllRegistering}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkAllRegister} disabled={isBulkAllRegistering}>
              {isBulkAllRegistering ? `${bulkAllProgress}% 처리 중...` : '전체 등록'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Register Dialog */}
      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>일괄 사전 등록</AlertDialogTitle>
            <AlertDialogDescription>
              현재 페이지에서 요미가나와 뜻이 입력된 <strong>{words.filter(w => w.reading && w.meaning).length}개</strong> 단어를
              {selectedDictionaryId
                ? <> <strong>{dictionaries.find(d => d.id === selectedDictionaryId)?.name}</strong> 사전에</>
                : ' 사전 연결 없이'
              } 등록합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {isBulkRegistering && (
            <div className="space-y-1 px-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>등록 중...</span>
                <span>{bulkProgress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${bulkProgress}%` }} />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkRegistering}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkRegister} disabled={isBulkRegistering}>
              {isBulkRegistering ? `${bulkProgress}% 처리 중...` : '등록'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Staging Word Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>대기열 단어 수정</DialogTitle>
            <DialogDescription>표제어, 요미가나, 뜻, 품사를 수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div className="space-y-1">
              <Label htmlFor="edit-term">표제어</Label>
              <Input id="edit-term" value={editFormData.term} onChange={e => setEditFormData({ ...editFormData, term: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-reading">요미가나</Label>
              <Input id="edit-reading" value={editFormData.reading} onChange={e => setEditFormData({ ...editFormData, reading: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>뜻</Label>
              <RichTextEditor value={editFormData.meaning} onChange={html => setEditFormData({ ...editFormData, meaning: html })} />
            </div>
            <div className="space-y-1">
              <Label>품사 (Yomitan rules)</Label>
              <PosToggleGroup
                value={editFormData.part_of_speech}
                onChange={(v) => setEditFormData({ ...editFormData, part_of_speech: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>취소</Button>
            <Button onClick={handleEditSave}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteWordOpen} onOpenChange={setDeleteWordOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>단어 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteWordTarget?.term}</strong>을(를) 대기열에서 삭제하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWordConfirm} className="bg-destructive text-white hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>대기열 초기화</AlertDialogTitle>
            <AlertDialogDescription>
              대기열의 미처리 단어 <strong>{totalCount}개</strong>를 모두 삭제하시겠습니까?
              이 작업은 <strong>되돌릴 수 없습니다</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-white hover:bg-destructive/90">
              전체 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResizablePanelGroup>
  )
}
