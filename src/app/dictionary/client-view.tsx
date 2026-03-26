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
import { deleteDictionaryEntry } from '@/app/actions/dictionary'
import { toast } from 'sonner'
import { Trash2, Edit } from 'lucide-react'

export default function DictionaryClientView({ initialEntries }: { initialEntries: dictionary_entries[] }) {
  const [entries, setEntries] = useState(initialEntries)
  const [search, setSearch] = useState('')

  const filteredEntries = entries.filter(e => 
    e.term.includes(search) || 
    e.reading.includes(search) || 
    e.meaning.includes(search)
  )

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

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <Input 
          placeholder="단어, 요미가나, 뜻 검색..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            총 {filteredEntries.length}개
          </div>
          <div className="flex gap-2 border-l pl-4">
            <Button variant="outline" onClick={() => window.open('/api/export/yomitan', '_blank')}>
              Yomitan 내보내기 (.zip)
            </Button>
            <Button variant="outline" onClick={() => window.open('/api/export/kindle', '_blank')}>
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
              <TableHead className="w-[100px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">검색 결과가 없습니다.</TableCell>
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
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => toast.info('수정 기능은 패치 예정입니다.')}>
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
    </div>
  )
}
