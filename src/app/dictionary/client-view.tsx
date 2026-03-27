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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { deleteDictionaryEntry, updateDictionaryEntry } from '@/app/actions/dictionary'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { toast } from 'sonner'
import { Trash2, Edit } from 'lucide-react'

type DictionaryEntry = dictionary_entries & {
  dictionary?: { id: number; name: string } | null
}

type DictionaryOption = {
  id: number
  name: string
  _count: { entries: number }
}

const POS_OPTIONS = [
  { value: 'n', label: '명사 (n)' },
  { value: 'v1', label: '상하1단 동사 (v1)' },
  { value: 'v5k', label: '5단 동사 -ku (v5k)' },
  { value: 'v5s', label: '5단 동사 -su (v5s)' },
  { value: 'v5t', label: '5단 동사 -tsu (v5t)' },
  { value: 'v5n', label: '5단 동사 -nu (v5n)' },
  { value: 'v5m', label: '5단 동사 -mu (v5m)' },
  { value: 'v5r', label: '5단 동사 -ru (v5r)' },
  { value: 'v5w', label: '5단 동사 -u (v5w)' },
  { value: 'v5g', label: '5단 동사 -gu (v5g)' },
  { value: 'v5b', label: '5단 동사 -bu (v5b)' },
  { value: 'vk', label: 'くる 동사 (vk)' },
  { value: 'vs', label: 'する 동사 (vs)' },
  { value: 'adj-i', label: 'い 형용사 (adj-i)' },
  { value: 'adj-na', label: 'な 형용사 (adj-na)' },
  { value: 'adv', label: '부사 (adv)' },
  { value: 'exp', label: '표현/숙어 (exp)' },
  { value: 'int', label: '감동사 (int)' },
  { value: 'prt', label: '조사 (prt)' },
]

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

  const filteredEntries = entries.filter(e => {
    const matchSearch = !search || e.term.includes(search) || e.reading.includes(search) || e.meaning.includes(search)
    const matchDict = filterDictId === 'all'
      || (filterDictId === 'none' && !e.dictionary_id)
      || (e.dictionary_id !== null && String(e.dictionary_id) === filterDictId)
    return matchSearch && matchDict
  })

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

  const exportUrl = (type: 'yomitan' | 'kindle') => {
    const dictId = filterDictId !== 'all' && filterDictId !== 'none' ? filterDictId : null
    const base = `/api/export/${type}`
    return dictId ? `${base}?dictionaryId=${dictId}` : base
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Input
            placeholder="단어, 요미가나, 뜻 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          {dictionaries.length > 0 && (
            <Select value={filterDictId} onValueChange={v => setFilterDictId(v ?? 'all')}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="사전 필터" />
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
            총 {filteredEntries.length}개
          </div>
          <div className="flex gap-2 border-l pl-4">
            <Button variant="outline" onClick={() => window.open(exportUrl('yomitan'), '_blank')}>
              Yomitan 내보내기 (.zip)
            </Button>
            <Button variant="outline" onClick={() => window.open(exportUrl('kindle'), '_blank')}>
              Kindle 내보내기 (.opf)
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
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={dictionaries.length > 0 ? 6 : 5} className="text-center py-10 text-muted-foreground">검색 결과가 없습니다.</TableCell>
              </TableRow>
            ) : (
              filteredEntries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="font-bold text-base">{entry.term}</TableCell>
                  <TableCell>{entry.reading}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-md">
                      {entry.part_of_speech}
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
              <Label>품사 <span className="text-red-500">*</span></Label>
              <Select value={editForm.part_of_speech} onValueChange={v => setEditForm({ ...editForm, part_of_speech: v ?? editForm.part_of_speech })}>
                <SelectTrigger><SelectValue placeholder="품사 선택" /></SelectTrigger>
                <SelectContent>
                  {POS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
    </div>
  )
}
