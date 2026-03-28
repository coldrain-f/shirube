'use client'

import { useState } from 'react'
import { dictionary_entries } from '@prisma/client'
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
import { deleteDictionaryEntry, updateDictionaryEntry } from '@/app/actions/dictionary'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { toast } from 'sonner'
import { Trash2, Edit, Download, ChevronLeft, ChevronRight } from 'lucide-react'

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
  initialEntries,
  dictionaries = [],
}: {
  initialEntries: DictionaryEntry[]
  dictionaries?: DictionaryOption[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [search, setSearch] = useState('')
  const [filterDictId, setFilterDictId] = useState<string>('all')
  const [editOpen, setEditOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<DictionaryEntry | null>(null)
  const [editForm, setEditForm] = useState({ term: '', reading: '', meaning: '', part_of_speech: '', pitch_accent: '', tags: '' })
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [isEditingPage, setIsEditingPage] = useState(false)
  const [pageInput, setPageInput] = useState('1')

  const filteredEntries = entries.filter(e => {
    const matchSearch = !search || e.term.includes(search) || e.reading.includes(search) || e.meaning.includes(search)
    const matchDict = filterDictId === 'all'
      || (filterDictId === 'none' && !e.dictionary_id)
      || (e.dictionary_id !== null && String(e.dictionary_id) === filterDictId)
    return matchSearch && matchDict
  })

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const pagedEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
          <Input
            placeholder="단어, 요미가나, 뜻 검색..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="max-w-xs"
          />
          {dictionaries.length > 0 && (
            <Select value={filterDictId} onValueChange={v => { setFilterDictId(v ?? 'all'); setPage(1) }}>
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
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            총 {filteredEntries.length.toLocaleString()}개
          </div>
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

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>단어 (Term)</TableHead>
              <TableHead>요미가나 (Reading)</TableHead>
              <TableHead>품사 (POS)</TableHead>
              <TableHead>뜻풀이 (Meaning)</TableHead>
              {dictionaries.length > 0 && <TableHead>사전</TableHead>}
              <TableHead className="w-[100px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={dictionaries.length > 0 ? 6 : 5} className="text-center py-10 text-muted-foreground">검색 결과가 없습니다.</TableCell>
              </TableRow>
            ) : (
              pagedEntries.map(entry => (
                <TableRow key={entry.id}>
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
            {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, filteredEntries.length).toLocaleString()} / {filteredEntries.length.toLocaleString()}개
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setPage(p => { setPageInput(String(p - 1)); return p - 1 }) }} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {isEditingPage ? (
              <input
                type="number"
                className="w-14 text-center text-sm border rounded-md px-1 py-0.5 tabular-nums bg-background"
                value={pageInput}
                min={1}
                max={totalPages}
                autoFocus
                onChange={e => setPageInput(e.target.value)}
                onBlur={() => {
                  const n = parseInt(pageInput)
                  if (!isNaN(n)) setPage(Math.min(Math.max(1, n), totalPages))
                  setIsEditingPage(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') { setIsEditingPage(false); setPageInput(String(page)) }
                }}
              />
            ) : (
              <span
                className="text-sm tabular-nums cursor-pointer hover:underline"
                onClick={() => { setPageInput(String(page)); setIsEditingPage(true) }}
                title="클릭하여 페이지 이동"
              >
                {page} / {totalPages}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => { setPage(p => { setPageInput(String(p + 1)); return p + 1 }) }} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
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
