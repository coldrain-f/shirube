import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import JSZip from 'jszip'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dictionaryId = searchParams.get('dictionaryId')
      ? parseInt(searchParams.get('dictionaryId')!, 10)
      : undefined

    const [entries, dictionary] = await Promise.all([
      prisma.dictionary_entries.findMany({
        where: dictionaryId !== undefined ? { dictionary_id: dictionaryId } : undefined,
      }),
      dictionaryId !== undefined
        ? prisma.dictionaries.findUnique({ where: { id: dictionaryId } })
        : null,
    ])

    const termBank = entries.map((entry) => [
      entry.term,
      entry.reading,
      entry.part_of_speech || '',
      '',
      0,
      [entry.meaning],
      entry.id,
      entry.tags || '',
    ])

    const indexJson = {
      title: dictionary?.title || 'Shirube Custom Dictionary',
      format: dictionary?.format ?? 3,
      revision: dictionary?.revision || new Date().toISOString().split('T')[0],
      sequenced: dictionary?.sequenced ?? true,
      author: dictionary?.author || 'Shirube User',
      url: dictionary?.url || '',
      description: dictionary?.description || 'Generated from Shirube Custom Japanese Dictionary Management System.',
    }

    const zip = new JSZip()
    zip.file('index.json', JSON.stringify(indexJson))
    zip.file('term_bank_1.json', JSON.stringify(termBank))

    const zipBuffer = await zip.generateAsync({ type: 'blob' })
    const filename = dictionary
      ? `shirube_${dictionary.name.replace(/\s+/g, '_')}_yomitan.zip`
      : 'shirube_yomitan_export.zip'

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
