'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getStagingWords(searchQuery: string = '', page: number = 1) {
  const pageSize = 100
  const where = {
    is_processed: false,
    ...(searchQuery ? { term: { contains: searchQuery } } : {})
  }

  const [words, totalCount] = await Promise.all([
    prisma.staging_words.findMany({
      where,
      orderBy: { frequency: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.staging_words.count({ where })
  ])

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
  return await prisma.staging_words.findMany({
    where: { is_processed: false },
    orderBy: { frequency: 'desc' },
    select: {
      term: true,
      reading: true,
      meaning: true,
      frequency: true,
      part_of_speech: true,
      source: true,
    }
  })
}
