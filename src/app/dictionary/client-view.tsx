'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import { dictionary_entries } from '@prisma/client'
import { getDictionaryEntries } from '@/app/actions/dictionary'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { deleteDictionaryEntry, updateDictionaryEntry, bulkDeleteDictionaryEntries } from '@/app/actions/dictionary'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { toast } from 'sonner'
import { Trash2, Edit, Download, ChevronLeft, ChevronRight, Search, ChevronsUpDown, ChevronUp, ChevronDown, Filter } from 'lucide-react'

const PAGE_SIZE = 50

type DictionaryEntry = dictionary_entries & {
  dictionary?: { id: number; name: string } | null
}

type DictionaryOption = {
  id: number
  name: string
  _count: { entries: number }
}

const POS_RULES = ['v1', 'v5', 'vk', 'vs', 'adj-i'] as const

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

export default function DictionaryClientView({
  dictionaries = [],
}: {
  dictionaries?: DictionaryOption[]
}) {
  const [entries, setEntries] = useState<DictionaryEntry[]>([])
  const [hasQueried, setHasQueried] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterDictId, setFilterDictId] = useState<string>('all')
  const [editOpen, setEditOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<DictionaryEntry | null>(null)
  const [editForm, setEditForm] = useState({ term: '', reading: '', meaning: '', part_of_speech: '', pitch_accent: '', tags: '' })
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState<'term' | 'reading' | 'part_of_speech' | 'dictionary' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else setSortCol(null)
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  // Compute duplicate IDs: entries sharing the same term+reading+meaning
  const { duplicateIds, duplicateExtraIds } = (() => {
    const keyMap = new Map<string, number[]>()
    for (const e of entries) {
      const key = `${e.term}\t${e.reading}\t${e.meaning}`
      const ids = keyMap.get(key) ?? []
      ids.push(e.id)
      keyMap.set(key, ids)
    }
    const duplicateIds = new Set<number>()
    const duplicateExtraIds = new Set<number>() // all except first per group
    for (const ids of keyMap.values()) {
      if (ids.length > 1) {
        ids.forEach(id => duplicateIds.add(id))
        ids.slice(1).forEach(id => duplicateExtraIds.add(id))
      }
    }
    return { duplicateIds, duplicateExtraIds }
  })()

  const filteredEntries = entries.filter(e => {
    const matchSearch = !search || e.term.includes(search) || e.reading.includes(search) || e.meaning.includes(search)
    const matchDict = filterDictId === 'all'
      || (filterDictId === 'none' && !e.dictionary_id)
      || (e.dictionary_id !== null && String(e.dictionary_id) === filterDictId)
    const matchDuplicate = !showDuplicatesOnly || duplicateIds.has(e.id)
    return matchSearch && matchDict && matchDuplicate
  })

  const sortedEntries = sortCol ? [...filteredEntries].sort((a, b) => {
    let av = '', bv = ''
    if (sortCol === 'term') { av = a.term; bv = b.term }
    else if (sortCol === 'reading') { av = a.reading; bv = b.reading }
    else if (sortCol === 'part_of_speech') { av = a.part_of_speech; bv = b.part_of_speech }
    else if (sortCol === 'dictionary') { av = a.dictionary?.name ?? ''; bv = b.dictionary?.name ?? '' }
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  }) : filteredEntries

  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / PAGE_SIZE))
  const pagedEntries = sortedEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleQuery = async () => {
    if (isLoading) return
    flushSync(() => setIsLoading(true))
    try {
      const dictId = filterDictId !== 'all' && filterDictId !== 'none' ? Number(filterDictId) : undefined
      const data = await getDictionaryEntries(dictId)
      setEntries(data)
      setHasQueried(true)
      setPage(1)
      setSelectedIds(new Set())
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`선택한 ${selectedIds.size}개 항목을 삭제하시겠습니까?`)) return
    const count = selectedIds.size
    const ids = [...selectedIds]
    setIsBulkDeleting(true)
    try {
      await bulkDeleteDictionaryEntries(ids)
      setEntries(prev => prev.filter(e => !ids.includes(e.id)))
      setSelectedIds(new Set())
      toast.success(`${count}개 항목이 삭제되었습니다.`)
    } catch (e) {
      toast.error('일괄 삭제 실패')
      console.error(e)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allPageSelected = pagedEntries.length > 0 && pagedEntries.every(e => selectedIds.has(e.id))
  const somePageSelected = pagedEntries.some(e => selectedIds.has(e.id))

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await deleteDictionaryEntry(id)
      setEntries(entries.filter(e => e.id !== id))
      toast.success('제거되었습니다.')
    } catch (e) {
      toast.error('삭제 실패')
      console.error(e)
    }
  }

  const openEdit = (entry: DictionaryEntry) => {
    setEditEntry(entry)
    setEditForm({
      term: entry.term,
      reading: entry.reading,
      meaning: entry.meaning,
      part_of_speech: entry.part_of_speech,
      pitch_accent: entry.pitch_accent || '',
      tags: entry.tags || '',
    })
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!editEntry) return
    setSaving(true)
    try {
      await updateDictionaryEntry(editEntry.id, {
        term: editForm.term,
        reading: editForm.reading,
        meaning: editForm.meaning,
        part_of_speech: editForm.part_of_speech,
        pitch_accent: editForm.pitch_accent || undefined,
        tags: editForm.tags || undefined,
      })
      setEntries(entries.map(e => e.id === editEntry.id ? { ...e, ...editForm } : e))
      setEditOpen(false)
      toast.success('수정되었습니다.')
    } catch {
      toast.error('수정 실패')
    } finally {
      setSaving(false)
    }
  }

  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportType, setExportType] = useState<'yomitan' | 'kindle'>('yomitan')
  const [exportDictId, setExportDictId] = useState<string>(
    dictionaries.length > 0 ? String(dictionaries[0].id) : ''
  )

  const openExport = (type: 'yomitan' | 'kindle') => {
    setExportType(type)
    setExportDialogOpen(true)
  }

  const handleExport = () => {
    if (!exportDictId) return
    window.open(`/api/export/${exportType}?dictionaryId=${exportDictId}`, '_blank')
    setExportDialogOpen(false)
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          {dictionaries.length > 0 && (
            <Select value={filterDictId} onValueChange={v => setFilterDictId(v ?? 'all')}>
              <SelectTrigger className="w-44">
                <span className="flex flex-1 text-left truncate">
                  {filterDictId === 'all' ? '전체 사전' : filterDictId === 'none' ? '사전 미지정' : (dictionaries.find(d => String(d.id) === filterDictId)?.name ?? filterDictId)}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 사전</SelectItem>
                <SelectItem value="none">사전 미지정</SelectItem>
                {dictionaries.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleQuery}>
            {isLoading
              ? <><div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-muted border-t-primary-foreground" />불러오는 중...</>
              : <><Search className="h-4 w-4 mr-2" />조회</>
            }
          </Button>
          {hasQueried && (
            <Input
              placeholder="단어, 요미가나, 뜻 검색..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="max-w-xs"
            />
          )}
          {hasQueried && (
            <Button
              variant={showDuplicatesOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const next = !showDuplicatesOnly
                setShowDuplicatesOnly(next)
                setPage(1)
                setSelectedIds(next ? new Set(duplicateExtraIds) : new Set())
              }}
            >
              <Filter className="h-4 w-4 mr-1" />
              중복 필터
              {duplicateIds.size > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-destructive text-destructive-foreground">
                  {duplicateIds.size}
                </span>
              )}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              선택 삭제 ({selectedIds.size})
            </Button>
          )}
          {hasQueried && (
            <div className="text-sm text-muted-foreground">
              총 {filteredEntries.length.toLocaleString()}개
            </div>
          )}
          <div className="flex gap-2 border-l pl-4">
            <Button variant="outline" onClick={() => openExport('yomitan')}>
              <Download className="h-4 w-4 mr-1" />
              Yomitan 내보내기
            </Button>
            <Button variant="outline" onClick={() => openExport('kindle')}>
              <Download className="h-4 w-4 mr-1" />
              Kindle 내보내기
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-md bg-card overflow-hidden">
        <Table containerClassName="overflow-y-auto max-h-[calc(100vh-320px)]">
          <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allPageSelected}
                  data-state={somePageSelected && !allPageSelected ? 'indeterminate' : undefined}
                  onCheckedChange={checked => {
                    if (checked) setSelectedIds(prev => new Set([...prev, ...pagedEntries.map(e => e.id)]))
                    else setSelectedIds(prev => { const next = new Set(prev); pagedEntries.forEach(e => next.delete(e.id)); return next })
                  }}
                />
              </TableHead>
              {([
                { key: 'term', label: '단어 (Term)' },
                { key: 'reading', label: '요미가나 (Reading)' },
                { key: 'part_of_speech', label: '품사 (POS)' },
              ] as const).map(({ key, label }) => (
                <TableHead key={key} className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort(key)}>
                  <div className="flex items-center gap-1">
                    {label}
                    {sortCol === key
                      ? sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      : <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />}
                  </div>
                </TableHead>
              ))}
              <TableHead>뜻풀이 (Meaning)</TableHead>
              {dictionaries.length > 0 && (
                <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort('dictionary')}>
                  <div className="flex items-center gap-1">
                    사전
                    {sortCol === 'dictionary'
                      ? sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      : <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />}
                  </div>
                </TableHead>
              )}
              <TableHead className="w-[100px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasQueried ? (
              <TableRow>
                <TableCell colSpan={dictionaries.length > 0 ? 7 : 6} className="text-center py-16 text-muted-foreground">
                  사전을 선택하고 조회 버튼을 눌러주세요.
                </TableCell>
              </TableRow>
            ) : pagedEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={dictionaries.length > 0 ? 7 : 6} className="text-center py-10 text-muted-foreground">검색 결과가 없습니다.</TableCell>
              </TableRow>
            ) : (
              pagedEntries.map(entry => (
                <TableRow key={entry.id} data-state={selectedIds.has(entry.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(entry.id)} onCheckedChange={() => toggleSelect(entry.id)} />
                  </TableCell>
                  <TableCell className="font-bold text-base">{entry.term}</TableCell>
                  <TableCell>{entry.reading}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-md font-mono">
                      {entry.part_of_speech || 'None'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="line-clamp-2 text-sm max-w-xl" dangerouslySetInnerHTML={{ __html: entry.meaning }}></div>
                  </TableCell>
                  {dictionaries.length > 0 && (
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.dictionary?.name || '-'}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">
            {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, sortedEntries.length).toLocaleString()} / {sortedEntries.length.toLocaleString()}개
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="px-2" onClick={() => setPage(1)} disabled={page === 1}>
              <ChevronLeft className="h-3 w-3" /><ChevronLeft className="h-3 w-3 -ml-2" />
            </Button>
            <Button variant="outline" size="sm" className="px-2" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {(() => {
              const WINDOW = 5
              const half = Math.floor(WINDOW / 2)
              let start = Math.max(1, page - half)
              const end = Math.min(totalPages, start + WINDOW - 1)
              if (end - start + 1 < WINDOW) start = Math.max(1, end - WINDOW + 1)
              return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  className="w-9"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              ))
            })()}
            <Button variant="outline" size="sm" className="px-2" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="px-2" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
              <ChevronRight className="h-3 w-3" /><ChevronRight className="h-3 w-3 -ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>단어 수정</DialogTitle>
            <DialogDescription>사전 항목의 내용을 수정합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>표제어 <span className="text-red-500">*</span></Label>
                <Input value={editForm.term} onChange={e => setEditForm({ ...editForm, term: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>요미가나 <span className="text-red-500">*</span></Label>
                <Input value={editForm.reading} onChange={e => setEditForm({ ...editForm, reading: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>품사 (Yomitan rules) <span className="text-muted-foreground text-xs font-normal">— 없으면 활용 없음</span></Label>
              <PosToggleGroup
                value={editForm.part_of_speech}
                onChange={v => setEditForm({ ...editForm, part_of_speech: v })}
              />
            </div>
            <div className="space-y-1">
              <Label>뜻 <span className="text-red-500">*</span></Label>
              <RichTextEditor value={editForm.meaning} onChange={html => setEditForm({ ...editForm, meaning: html })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>피치 악센트</Label>
                <Input value={editForm.pitch_accent} onChange={e => setEditForm({ ...editForm, pitch_accent: e.target.value })} placeholder="예: 0, 1, 2..." />
              </div>
              <div className="space-y-1">
                <Label>태그</Label>
                <Input value={editForm.tags} onChange={e => setEditForm({ ...editForm, tags: e.target.value })} placeholder="예: common, jlpt-n3" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>취소</Button>
            <Button onClick={handleEditSave} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{exportType === 'yomitan' ? 'Yomitan' : 'Kindle'} 내보내기</DialogTitle>
            <DialogDescription>내보낼 사전을 선택하세요.</DialogDescription>
          </DialogHeader>
          {dictionaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              등록된 사전이 없습니다.{' '}
              <a href="/dictionaries" className="underline hover:text-foreground">사전 관리</a>에서 먼저 사전을 생성하세요.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>사전 선택</Label>
              <Select value={exportDictId} onValueChange={v => setExportDictId(v ?? exportDictId)}>
                <SelectTrigger>
                  <span className="flex flex-1 text-left truncate">
                    {exportDictId
                      ? (() => { const d = dictionaries.find(x => String(x.id) === exportDictId); return d ? `${d.name} (${d._count.entries.toLocaleString()}개)` : exportDictId })()
                      : '사전 선택'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {dictionaries.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name} ({d._count.entries.toLocaleString()}개)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>취소</Button>
            <Button onClick={handleExport} disabled={!exportDictId || dictionaries.length === 0}>
              내보내기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
