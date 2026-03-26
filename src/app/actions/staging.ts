'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getStagingWords(searchQuery: string = '') {
  return await prisma.staging_words.findMany({
    where: { 
      is_processed: false,
      ...(searchQuery ? { term: { contains: searchQuery } } : {})
    },
    orderBy: { frequency: 'desc' },
    take: 100, // Limit to 100 for safety against huge staging db
  })
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
