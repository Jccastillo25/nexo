'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type UploadPhotoState = { error: string } | { success: true; url: string } | null

export async function uploadEmployeePhoto(
  employeeId: string,
  _prevState: UploadPhotoState,
  formData: FormData,
): Promise<UploadPhotoState> {
  const supabase = await createClient()

  const file = formData.get('photo') as File | null
  if (!file || file.size === 0) {
    return { error: 'Selecciona una imagen para subir.' }
  }

  const maxSize = 3 * 1024 * 1024 // 3 MB
  if (file.size > maxSize) {
    return { error: 'La imagen no puede superar los 3 MB.' }
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    return { error: 'Solo se permiten imágenes JPG, PNG o WebP.' }
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const filePath = `${employeeId}/avatar.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('employee-photos')
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: true, // sobreescribe si ya existe
    })

  if (uploadError) {
    return { error: `Error al subir: ${uploadError.message}` }
  }

  const { data: publicData } = supabase.storage
    .from('employee-photos')
    .getPublicUrl(filePath)

  const photoUrl = publicData.publicUrl

  const { error: updateError } = await supabase
    .from('employees')
    .update({ photo_url: photoUrl })
    .eq('id', employeeId)

  if (updateError) {
    return { error: `Error al guardar URL: ${updateError.message}` }
  }

  revalidatePath(`/employees/${employeeId}`)
  revalidatePath(`/employees/${employeeId}/edit`)
  revalidatePath('/employees')

  return { success: true, url: photoUrl }
}
