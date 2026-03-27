import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Dictionary, DictionaryIndex, TermEntry } from 'yomichan-dict-builder'
import { parseDocument } from 'htmlparser2'
import { ChildNode, Element, Text, DataNode } from 'domhandler'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'

// Convert htmlparser2 DOM nodes to Yomitan StructuredContent nodes
function domToStructuredContent(nodes: ChildNode[]): unknown[] {
  const result: unknown[] = []

  for (const node of nodes) {
    if (node.type === 'text') {
      const text = (node as Text).data
      if (text) result.push(text)
    } else if (node.type === 'tag') {
      const el = node as Element
      const children = domToStructuredContent(el.children as ChildNode[])
      const content = children.length === 1 ? children[0] : children.length > 1 ? children : undefined

      switch (el.tagName) {
        case 'strong':
        case 'b':
          result.push({ tag: 'span', style: { fontWeight: 'bold' }, content })
          break
        case 'em':
        case 'i':
          result.push({ tag: 'span', style: { fontStyle: 'italic' }, content })
          break
        case 'u':
          result.push({ tag: 'span', style: { textDecorationLine: 'underline' }, content })
          break
        case 'br':
          result.push({ tag: 'br' })
          break
        case 'p':
          result.push({ tag: 'div', content })
          break
        case 'div':
          result.push({ tag: 'div', content })
          break
        case 'span':
          result.push({ tag: 'span', content })
          break
        default:
          // Flatten unknown tags
          if (content) {
            if (Array.isArray(content)) result.push(...content)
            else result.push(content)
          }
      }
    }
  }

  return result
}

function htmlToDefinition(html: string): unknown {
  if (!html || !html.trim()) return html

  // Strip outer whitespace and check if there's any HTML
  if (!html.includes('<')) return html

  const dom = parseDocument(html)
  const nodes = domToStructuredContent(dom.children as ChildNode[])

  if (nodes.length === 0) return html
  if (nodes.length === 1 && typeof nodes[0] === 'string') return nodes[0]

  return {
    type: 'structured-content',
    content: nodes.length === 1 ? nodes[0] : nodes,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dictionaryId = searchParams.get('dictionaryId')
    ? parseInt(searchParams.get('dictionaryId')!, 10)
    : undefined

  if (dictionaryId === undefined) {
    return NextResponse.json(
      { error: '내보낼 사전을 선택해주세요. dictionaryId 파라미터가 필요합니다.' },
      { status: 400 }
    )
  }

  try {
    const [entries, dictMeta] = await Promise.all([
      prisma.dictionary_entries.findMany({
        where: { dictionary_id: dictionaryId },
      }),
      prisma.dictionaries.findUnique({ where: { id: dictionaryId } }),
    ])

    if (!dictMeta) {
      return NextResponse.json({ error: '사전을 찾을 수 없습니다.' }, { status: 404 })
    }

    const safeName = dictMeta.name.replace(/\s+/g, '_')
    const fileName = `${safeName}_yomitan.zip` as `${string}.zip`

    const dictionary = new Dictionary({ fileName })

    const index = new DictionaryIndex()
      .setTitle(dictMeta.title || dictMeta.name)
      .setRevision(dictMeta.revision || new Date().toISOString().split('T')[0])
      .setFormat(3)
      .setSequenced(dictMeta.sequenced ?? true)

    if (dictMeta.author) index.setAuthor(dictMeta.author)
    if (dictMeta.url) index.setUrl(dictMeta.url)
    if (dictMeta.description) index.setDescription(dictMeta.description)

    await dictionary.setIndex(index.build())

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const definition = htmlToDefinition(entry.meaning)

      const term = new TermEntry(entry.term)
        .setReading(entry.reading)
        .setDefinitionTags(entry.part_of_speech || '')
        .setDeinflectors(entry.part_of_speech || '')
        .setSequenceNumber(i + 1)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      term.addDetailedDefinition(definition as any)

      if (entry.tags) term.setTermTags(entry.tags)

      await dictionary.addTerm(term.build())
    }

    // Export to temp directory and read back as buffer
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shirube-yomitan-'))
    try {
      await dictionary.export(tmpDir)
      const zipBuffer = await fs.readFile(path.join(tmpDir, fileName))

      return new NextResponse(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      })
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Yomitan 내보내기 실패' }, { status: 500 })
  }
}
