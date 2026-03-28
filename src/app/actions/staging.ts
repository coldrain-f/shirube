'use server'

import { Prisma, staging_words } from '@prisma/client'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import fs from 'fs/promises'
import path from 'path'

const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/

async function fetchBaseIdTermRows(searchPattern: string | null, dictFilterId?: number) {
  return searchPattern && dictFilterId !== undefined
    ? prisma.$queryRaw<{id: number; term: string}[]>`SELECT id, term FROM staging_words WHERE is_processed = 0 AND term LIKE ${searchPattern} AND term IN (SELECT term FROM dictionary_entries WHERE dictionary_id = ${dictFilterId}) ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC`
    : searchPattern
    ? prisma.$queryRaw<{id: number; term: string}[]>`SELECT id, term FROM staging_words WHERE is_processed = 0 AND term LIKE ${searchPattern} ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC`
    : dictFilterId !== undefined
    ? prisma.$queryRaw<{id: number; term: string}[]>`SELECT id, term FROM staging_words WHERE is_processed = 0 AND term IN (SELECT term FROM dictionary_entries WHERE dictionary_id = ${dictFilterId}) ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC`
    : prisma.$queryRaw<{id: number; term: string}[]>`SELECT id, term FROM staging_words WHERE is_processed = 0 ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC`
}

export async function getStagingWords(
  searchQuery: string = '',
  page: number = 1,
  dictFilterId?: number,
  noKanji: boolean = false,
  stagingDup: boolean = false,
) {
  const pageSize = 100
  const searchPattern = searchQuery ? `%${searchQuery}%` : null
  const offset = (page - 1) * pageSize

  if (noKanji || stagingDup) {
    const [allRows, dupTermsResult] = await Promise.all([
      fetchBaseIdTermRows(searchPattern, dictFilterId),
      stagingDup
        ? prisma.$queryRaw<{term: string}[]>`SELECT term FROM staging_words WHERE is_processed = 0 GROUP BY term HAVING COUNT(*) > 1`
        : Promise.resolve([] as {term: string}[]),
    ])
    const dupTerms = new Set(dupTermsResult.map(r => r.term))
    let filtered = allRows
    if (noKanji) filtered = filtered.filter(r => !KANJI_RE.test(r.term))
    if (stagingDup) filtered = filtered.filter(r => dupTerms.has(r.term))
    const totalCount = filtered.length
    const pageIds = filtered.slice(offset, offset + pageSize).map(r => Number(r.id))
    const words = pageIds.length > 0
      ? await prisma.staging_words.findMany({ where: { id: { in: pageIds } } }).then(rows => {
          const order = new Map(pageIds.map((id, i) => [id, i]))
          return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        })
      : []
    return { words, totalCount, page, pageSize }
  }

  const [words, countResult] = await Promise.all([
    searchPattern && dictFilterId !== undefined
      ? prisma.$queryRaw<staging_words[]>`
          SELECT * FROM staging_words
          WHERE is_processed = 0 AND term LIKE ${searchPattern}
            AND term IN (SELECT term FROM dictionary_entries WHERE dictionary_id = ${dictFilterId})
          ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `
      : searchPattern
      ? prisma.$queryRaw<staging_words[]>`
          SELECT * FROM staging_words
          WHERE is_processed = 0 AND term LIKE ${searchPattern}
          ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `
      : dictFilterId !== undefined
      ? prisma.$queryRaw<staging_words[]>`
          SELECT * FROM staging_words
          WHERE is_processed = 0
            AND term IN (SELECT term FROM dictionary_entries WHERE dictionary_id = ${dictFilterId})
          ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `
      : prisma.$queryRaw<staging_words[]>`
          SELECT * FROM staging_words
          WHERE is_processed = 0
          ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `,
    searchPattern && dictFilterId !== undefined
      ? prisma.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) as count FROM staging_words WHERE is_processed = 0 AND term LIKE ${searchPattern} AND term IN (SELECT term FROM dictionary_entries WHERE dictionary_id = ${dictFilterId})`
      : searchPattern
      ? prisma.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) as count FROM staging_words WHERE is_processed = 0 AND term LIKE ${searchPattern}`
      : dictFilterId !== undefined
      ? prisma.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) as count FROM staging_words WHERE is_processed = 0 AND term IN (SELECT term FROM dictionary_entries WHERE dictionary_id = ${dictFilterId})`
      : prisma.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) as count FROM staging_words WHERE is_processed = 0`
  ])

  const totalCount = Number(countResult[0]?.count || 0)
  return { words, totalCount, page, pageSize }
}

export async function getAllStagingWordIds(
  searchQuery: string = '',
  dictFilterId?: number,
  noKanji: boolean = false,
  stagingDup: boolean = false,
) {
  const searchPattern = searchQuery ? `%${searchQuery}%` : null
  const [rows, dupTermsResult] = await Promise.all([
    fetchBaseIdTermRows(searchPattern, dictFilterId),
    stagingDup
      ? prisma.$queryRaw<{term: string}[]>`SELECT term FROM staging_words WHERE is_processed = 0 GROUP BY term HAVING COUNT(*) > 1`
      : Promise.resolve([] as {term: string}[]),
  ])
  const dupTerms = new Set(dupTermsResult.map(r => r.term))
  let filtered = rows
  if (noKanji) filtered = filtered.filter(r => !KANJI_RE.test(r.term))
  if (stagingDup) filtered = filtered.filter(r => dupTerms.has(r.term))
  return filtered.map(r => Number(r.id))
}

export async function bulkDeleteStagingWords(ids: number[]) {
  if (ids.length === 0) return { deleted: 0 }
  const result = await prisma.staging_words.deleteMany({ where: { id: { in: ids } } })
  revalidatePath('/staging')
  return { deleted: result.count }
}

export async function markWordProcessed(id: number) {
  await prisma.staging_words.update({
    where: { id },
    data: { is_processed: true },
  })
  revalidatePath('/staging')
}

export async function deleteStagingWord(id: number) {
  await prisma.staging_words.delete({ where: { id } })
  revalidatePath('/staging')
}

export async function updateStagingWord(id: number, data: {
  term: string
  reading?: string | null
  meaning?: string | null
  part_of_speech?: string | null
}) {
  await prisma.staging_words.update({
    where: { id },
    data,
  })
  revalidatePath('/staging')
}

export async function addWordToDictionary(data: {
  term: string
  reading: string
  meaning: string
  part_of_speech: string
  dictionary_id?: number
  staging_id?: number
}) {
  const { staging_id, dictionary_id, ...dictData } = data

  // term+reading 기준으로 기존 항목 조회 후 update, 없으면 create
  const existing = await prisma.dictionary_entries.findFirst({
    where: { term: dictData.term, reading: dictData.reading },
    select: { id: true },
  })

  if (existing) {
    await prisma.dictionary_entries.update({
      where: { id: existing.id },
      data: {
        meaning: dictData.meaning,
        part_of_speech: dictData.part_of_speech,
        ...(dictionary_id !== undefined ? { dictionary_id } : {}),
      },
    })
  } else {
    await prisma.dictionary_entries.create({
      data: {
        ...dictData,
        ...(dictionary_id !== undefined ? { dictionary_id } : {}),
      },
    })
  }

  // Mark staging as processed if it came from staging
  if (staging_id) {
    await prisma.staging_words.update({
      where: { id: staging_id },
      data: { is_processed: true },
    })
  }

  revalidatePath('/staging')
  revalidatePath('/dictionary')
}

export async function clearAllStagingWords() {
  const result = await prisma.staging_words.deleteMany({
    where: { is_processed: false },
  })
  revalidatePath('/staging')
  return { deleted: result.count }
}

export async function getAllStagingWordsForExport() {
  return await prisma.$queryRaw<{term: string, reading: string|null, meaning: string|null, frequency: number, part_of_speech: string|null, source: string}[]>`
    SELECT term, reading, meaning, frequency, part_of_speech, source 
    FROM staging_words 
    WHERE is_processed = 0 
    ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC
  `
}

export async function importStagingWords(
  words: {
    term: string
    reading?: string | null
    meaning?: string | null
    frequency: number
    part_of_speech?: string | null
    source: string
  }[],
  skipDuplicates: boolean = false
) {
  if (!words.length) {
    return { imported: 0 }
  }

  const data = words.map(w => ({
    term: w.term,
    reading: w.reading || null,
    meaning: w.meaning || null,
    frequency: w.frequency || 0,
    part_of_speech: w.part_of_speech || null,
    source: w.source || 'import',
    is_processed: false,
  }))

  if (skipDuplicates) {
    // Filter out words whose term already exists in staging
    const existingTerms = await prisma.staging_words.findMany({
      where: { term: { in: data.map(d => d.term) }, is_processed: false },
      select: { term: true },
    })
    const existingSet = new Set(existingTerms.map(e => e.term))
    const filtered = data.filter(d => !existingSet.has(d.term))
    if (!filtered.length) {
      revalidatePath('/staging')
      return { imported: 0, skipped: data.length }
    }
    const result = await prisma.staging_words.createMany({ data: filtered })
    revalidatePath('/staging')
    return { imported: result.count, skipped: data.length - filtered.length }
  }

  const result = await prisma.staging_words.createMany({ data })
  revalidatePath('/staging')
  return { imported: result.count }
}

export async function getJPDBUpdatesNeeded() {
  try {
    const filePath = path.join(process.cwd(), 'resources', 'JPDB.txt')
    const fileContent = await fs.readFile(filePath, 'utf-8')
    
    // Parse JPDB.txt into a Map (term -> frequency)
    const lines = fileContent.split('\n')
    const frequencyMap = new Map<string, number>()
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 2) {
        const term = parts[0]
        const freq = parseInt(parts[1], 10)
        if (!isNaN(freq)) {
          frequencyMap.set(term, freq)
        }
      }
    }

    // Get all unprocessed staging words
    const stagingWords = await prisma.staging_words.findMany({
      where: { is_processed: false },
      select: { id: true, term: true, frequency: true },
    })

    // Filter words that need updating
    const updates = stagingWords
      .map((word) => ({
        id: word.id,
        currentFreq: word.frequency,
        newFreq: frequencyMap.has(word.term) ? frequencyMap.get(word.term)! : -1
      }))
      .filter((update) => update.newFreq !== update.currentFreq)
      .map((update) => ({
        id: update.id,
        frequency: update.newFreq
      }))

    return updates
  } catch (error) {
    console.error('Failed to get JPDB updates needed:', error)
    throw new Error('JPDB 파일 읽기 또는 업데이트 정보 분석에 실패했습니다.')
  }
}

export async function bulkUpdateFrequencies(updates: { id: number, frequency: number }[]) {
  if (updates.length === 0) return { updated: 0 }

  const result = await prisma.$transaction(
    updates.map((update) =>
      prisma.staging_words.update({
        where: { id: update.id },
        data: { frequency: update.frequency },
      })
    )
  )

  revalidatePath('/staging')
  return { updated: result.length }
}

export async function getAllReadyStagingWords() {
  const words = await prisma.staging_words.findMany({
    where: {
      is_processed: false,
      reading: { not: null },
      meaning: { not: null },
    },
    select: { id: true, term: true, reading: true, meaning: true, part_of_speech: true },
    orderBy: [
      { frequency: 'asc' },
    ],
  })
  return words as { id: number; term: string; reading: string; meaning: string; part_of_speech: string | null }[]
}

export async function bulkRegisterChunkToDictionary(
  words: { id: number; term: string; reading: string; meaning: string; part_of_speech: string | null }[],
  dictionaryId?: number
) {
  const VALID = new Set(['v1', 'v5', 'vk', 'vs', 'adj-i'])

  const normalized = words.map(w => {
    let pos = w.part_of_speech || ''
    const tokens = pos.split(' ').filter(Boolean)
    if (tokens.length > 0 && !tokens.every(t => VALID.has(t))) {
      if (pos.includes('형용사')) pos = 'adj-i'
      else if (pos.includes('동사')) pos = 'v1'
      else pos = ''
    }
    return { ...w, part_of_speech: pos }
  })

  // 기존 항목 일괄 조회
  const existing = await prisma.dictionary_entries.findMany({
    where: { term: { in: normalized.map(w => w.term) } },
    select: { id: true, term: true, reading: true },
  })
  const existingMap = new Map(existing.map(e => [`${e.term}\t${e.reading}`, e.id]))

  const toUpdate = normalized.filter(w => existingMap.has(`${w.term}\t${w.reading}`))
  const toCreate = normalized.filter(w => !existingMap.has(`${w.term}\t${w.reading}`))

  await prisma.$transaction([
    ...toUpdate.map(w => prisma.dictionary_entries.update({
      where: { id: existingMap.get(`${w.term}\t${w.reading}`)! },
      data: { meaning: w.meaning, part_of_speech: w.part_of_speech, ...(dictionaryId !== undefined ? { dictionary_id: dictionaryId } : {}) },
    })),
    ...(toCreate.length > 0 ? [prisma.dictionary_entries.createMany({
      data: toCreate.map(w => ({
        term: w.term,
        reading: w.reading,
        meaning: w.meaning,
        part_of_speech: w.part_of_speech,
        ...(dictionaryId !== undefined ? { dictionary_id: dictionaryId } : {}),
      })),
    })] : []),
    ...normalized.map(w => prisma.staging_words.update({
      where: { id: w.id },
      data: { is_processed: true },
    })),
  ])

  revalidatePath('/staging')
  revalidatePath('/dictionary')
  return { registered: normalized.length }
}

export async function getPosUpdatesFromReference() {
  const stagingWords = await prisma.staging_words.findMany({
    where: { is_processed: false },
    select: { id: true, term: true, reading: true },
  })

  if (stagingWords.length === 0) return { updates: [], notFound: 0 }

  const terms = [...new Set(stagingWords.map(w => w.term))]

  const refs = await prisma.yomitan_pos_reference.findMany({
    where: { term: { in: terms } },
    select: { term: true, reading: true, yomitan_rules: true },
  })

  // Build lookup maps: prefer term+reading match, fall back to term-only
  const byTermReading = new Map<string, string>()
  const byTerm = new Map<string, string>()
  for (const ref of refs) {
    const key = `${ref.term}\t${ref.reading}`
    if (!byTermReading.has(key)) byTermReading.set(key, ref.yomitan_rules ?? '')
    if (!byTerm.has(ref.term)) byTerm.set(ref.term, ref.yomitan_rules ?? '')
  }

  const updates: { id: number; pos: string }[] = []
  let notFound = 0

  for (const w of stagingWords) {
    const key = `${w.term}\t${w.reading ?? ''}`
    let pos: string | undefined
    if (w.reading && byTermReading.has(key)) {
      pos = byTermReading.get(key)
    } else if (byTerm.has(w.term)) {
      pos = byTerm.get(w.term)
    }
    if (pos !== undefined) updates.push({ id: w.id, pos })
    else notFound++
  }

  return { updates, notFound }
}

export async function bulkApplyPosUpdates(updates: { id: number; pos: string }[]) {
  if (updates.length === 0) return { updated: 0 }
  const result = await prisma.$transaction(
    updates.map(u => prisma.staging_words.update({
      where: { id: u.id },
      data: { part_of_speech: u.pos },
    }))
  )
  revalidatePath('/staging')
  return { updated: result.length }
}
