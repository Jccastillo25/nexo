'use server'

import { revalidatePath } from 'next/cache'

export async function forceRevalidate(path: string) {
  revalidatePath(path)
  return { success: true }
}
