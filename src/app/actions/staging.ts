'use server'

import { Prisma, staging_words } from '@prisma/client'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import fs from 'fs/promises'
import path from 'path'

export async function getStagingWords(searchQuery: string = '', page: number = 1) {
  const pageSize = 100
  const searchPattern = searchQuery ? `%${searchQuery}%` : null

  const [words, countResult] = await Promise.all([
    searchPattern
      ? prisma.$queryRaw<staging_words[]>`
          SELECT * FROM staging_words 
          WHERE is_processed = 0 AND term LIKE ${searchPattern}
          ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC 
          LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
        `
      : prisma.$queryRaw<staging_words[]>`
          SELECT * FROM staging_words 
          WHERE is_processed = 0
          ORDER BY CASE WHEN frequency = -1 THEN 1 ELSE 0 END ASC, frequency ASC 
          LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
        `,
    searchPattern
      ? prisma.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) as count FROM staging_words WHERE is_processed = 0 AND term LIKE ${searchPattern}`
      : prisma.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) as count FROM staging_words WHERE is_processed = 0`
  ])

  const totalCount = Number(countResult[0]?.count || 0)

  return { words, totalCount, page, pageSize }
}

export async function markWordProcessed(id: number) {
  await prisma.staging_words.update({
    where: { id },
    data: { is_processed: true },
  })
  revalidatePath('/staging')
}

export async function addWordToDictionary(data: {
  term: string
  reading: string
  meaning: string
  part_of_speech: string
  source: string
  staging_id?: number
}) {
  const { staging_id, ...dictData } = data
  
  // Upsert dictionary entry based on term and reading
  await prisma.dictionary_entries.upsert({
    where: {
      term_reading: {
        term: dictData.term,
        reading: dictData.reading,
      }
    },
    update: {
      meaning: dictData.meaning,
      part_of_speech: dictData.part_of_speech,
    },
    create: {
      ...dictData
    }
  })

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
