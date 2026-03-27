'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createDictionary, updateDictionary, deleteDictionary } from '@/app/actions/dictionary'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'

type DictionaryWithCount = {
  id: number
  name: string
  title: string | null
  revision: string | null
  sequenced: boolean | null
  format: number | null
  author: string | null
  url: string | null
  description: string | null
  created_at: Date
  updated_at: Date
  _count: { entries: number }
}

const EMPTY_FORM = {
  name: '',
  title: '',
  revision: '',
  sequenced: true,
  format: 3,
  author: '',
  url: '',
  description: '',
}

export default function DictionariesClientView({ initialDictionaries }: { initialDictionaries: DictionaryWithCount[] }) {
  const [dictionaries, setDictionaries] = useState(initialDictionaries)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [targetId, setTargetId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setCreateOpen(true)
  }

  const openEdit = (dict: DictionaryWithCount) => {
    setTargetId(dict.id)
    setForm({
      name: dict.name,
      title: dict.title || '',
      revision: dict.revision || '',
      sequenced: dict.sequenced ?? true,
      format: dict.format ?? 3,
      author: dict.author || '',
      url: dict.url || '',
      description: dict.description || '',
    })
    setEditOpen(true)
  }

  const openDelete = (id: number) => {
    setTargetId(id)
    setDeleteOpen(true)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('사전 이름을 입력하세요.'); return }
    setSaving(true)
    try {
      await createDictionary({
        name: form.name,
        title: form.title || undefined,
        revision: form.revision || undefined,
        sequenced: form.sequenced,
        format: form.format,
        author: form.author || undefined,
        url: form.url || undefined,
        description: form.description || undefined,
      })
      toast.success('사전이 추가되었습니다.')
      setCreateOpen(false)
      window.location.reload()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      toast.error(msg.includes('Unique') ? '이미 존재하는 사전 이름입니다.' : '추가에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (targetId === null) return
    if (!form.name.trim()) { toast.error('사전 이름을 입력하세요.'); return }
    setSaving(true)
    try {
      await updateDictionary(targetId, {
        name: form.name,
        title: form.title || undefined,
        revision: form.revision || undefined,
        sequenced: form.sequenced,
        format: form.format,
        author: form.author || undefined,
        url: form.url || undefined,
        description: form.description || undefined,
      })
      toast.success('사전이 수정되었습니다.')
      setEditOpen(false)
      window.location.reload()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      toast.error(msg.includes('Unique') ? '이미 존재하는 사전 이름입니다.' : '수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (targetId === null) return
    try {
      await deleteDictionary(targetId)
      setDictionaries(dictionaries.filter(d => d.id !== targetId))
      setDeleteOpen(false)
      toast.success('사전이 삭제되었습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const deletingDict = dictionaries.find(d => d.id === targetId)

  const formFields = (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>사전 이름 <span className="text-red-500">*</span></Label>
        <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="내 사전" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Title</Label>
          <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="사전 제목" />
        </div>
        <div className="space-y-1">
          <Label>Revision</Label>
          <Input value={form.revision} onChange={e => setForm({ ...form, revision: e.target.value })} placeholder="예: rev1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Author</Label>
          <Input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} placeholder="제작자" />
        </div>
        <div className="space-y-1">
          <Label>URL</Label>
          <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Format (Yomitan)</Label>
          <Input type="number" value={form.format} onChange={e => setForm({ ...form, format: parseInt(e.target.value) || 3 })} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            id="sequenced"
            checked={form.sequenced}
            onCheckedChange={v => setForm({ ...form, sequenced: v === true })}
          />
          <Label htmlFor="sequenced" className="cursor-pointer">Sequenced (Yomitan)</Label>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="사전 설명" />
      </div>
    </div>
  )

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">사전 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">내보내기에 사용할 사전을 관리합니다. 모든 사전은 Yomitan과 Kindle 형식으로 내보낼 수 있습니다.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          새 사전 추가
        </Button>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>사전 이름</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Revision</TableHead>
              <TableHead>Author</TableHead>
              <TableHead className="text-right">단어 수</TableHead>
              <TableHead className="w-[80px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dictionaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  등록된 사전이 없습니다. 새 사전을 추가해주세요.
                </TableCell>
              </TableRow>
            ) : (
              dictionaries.map(dict => (
                <TableRow key={dict.id}>
                  <TableCell className="font-medium">{dict.name}</TableCell>
                  <TableCell className="text-muted-foreground">{dict.title || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{dict.revision || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{dict.author || '-'}</TableCell>
                  <TableCell className="text-right">{dict._count.entries.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(dict)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => openDelete(dict.id)}>
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>새 사전 추가</DialogTitle>
            <DialogDescription>사전 이름과 메타데이터를 입력합니다.</DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>취소</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>사전 수정</DialogTitle>
            <DialogDescription>사전 이름과 메타데이터를 수정합니다.</DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>취소</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사전 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingDict?.name}</strong> 사전을 삭제하시겠습니까?
              {deletingDict && deletingDict._count.entries > 0 && (
                <> 이 사전에 속한 <strong>{deletingDict._count.entries}개</strong> 단어의 사전 연결이 해제됩니다.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
