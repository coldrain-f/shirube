'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getDictionaryEntries() {
  return await prisma.dictionary_entries.findMany({
    orderBy: { updated_at: 'desc' }
  })
}

export async function deleteDictionaryEntry(id: number) {
  await prisma.dictionary_entries.delete({
    where: { id }
  })
  revalidatePath('/dictionary')
}

export async function updateDictionaryEntry(id: number, data: {
  term: string
  reading: string
  meaning: string
  part_of_speech: string
  pitch_accent?: string
  tags?: string
}) {
  await prisma.dictionary_entries.update({
    where: { id },
    data
  })
  revalidatePath('/dictionary')
}
