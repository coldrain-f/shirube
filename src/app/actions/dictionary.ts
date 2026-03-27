'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getDictionaries() {
  return await prisma.dictionaries.findMany({
    orderBy: { created_at: 'asc' },
    include: { _count: { select: { entries: true } } }
  })
}

export async function createDictionary(data: {
  name: string
  title?: string
  revision?: string
  sequenced?: boolean
  format?: number
  author?: string
  url?: string
  description?: string
}) {
  await prisma.dictionaries.create({ data })
  revalidatePath('/dictionaries')
}

export async function updateDictionary(id: number, data: {
  name?: string
  title?: string
  revision?: string
  sequenced?: boolean
  format?: number
  author?: string
  url?: string
  description?: string
}) {
  await prisma.dictionaries.update({ where: { id }, data })
  revalidatePath('/dictionaries')
}

export async function deleteDictionary(id: number) {
  await prisma.dictionaries.delete({ where: { id } })
  revalidatePath('/dictionaries')
}

export async function getDictionaryEntries(dictionaryId?: number) {
  return await prisma.dictionary_entries.findMany({
    where: dictionaryId !== undefined ? { dictionary_id: dictionaryId } : undefined,
    orderBy: { updated_at: 'desc' },
    include: { dictionary: { select: { id: true, name: true } } }
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
