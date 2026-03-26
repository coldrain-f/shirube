import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import JSZip from 'jszip'

export async function GET() {
  try {
    const entries = await prisma.dictionary_entries.findMany()

    const termBank = entries.map((entry) => [
      entry.term,
      entry.reading,
      entry.part_of_speech || '',
      '',
      0,
      [entry.meaning],
      entry.id,
      entry.tags || ''
    ])

    const indexJson = {
      title: "Shirube Custom Dictionary",
      format: 3,
      revision: new Date().toISOString().split('T')[0],
      sequenced: true,
      author: "Shirube User",
      description: "Generates from Shirube Custom Japanese Dictionary Management System."
    }

    const zip = new JSZip()
    zip.file('index.json', JSON.stringify(indexJson))
    // Term bank files in Yomitan must be named term_bank_1.json, term_bank_2.json, etc.
    zip.file('term_bank_1.json', JSON.stringify(termBank))
    
    const zipBuffer = await zip.generateAsync({ type: 'blob' })

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="shirube_yomitan_export.zip"'
      }
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
