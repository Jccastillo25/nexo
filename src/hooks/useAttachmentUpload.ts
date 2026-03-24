'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAttachmentUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const uploadFile = async (
    file: File,
    bucket: string,
    path: string
  ): Promise<string | null> => {
    setIsUploading(true)
    setError(null)

    try {
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path)

      return publicUrl
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setIsUploading(false)
    }
  }

  return { uploadFile, isUploading, error }
}
