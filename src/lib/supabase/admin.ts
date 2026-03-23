import { createClient } from '@supabase/supabase-js'

/**
 * Privileged Supabase client using the SERVICE_ROLE_KEY.
 * Use ONLY in Server Actions or API routes for operations 
 * that must bypass RLS (like Kiosk PIN validation and clock-in/out).
 * 
 * NEVER expose this client to the browser.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined. Check your .env.local file.')
  }

  if (!supabaseServiceKey) {
    // En desarrollo podemos advertir, pero en producción esto es un error crítico
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not defined. ' +
        'The Kiosk cannot process clock-in/out without this key. ' +
        'Add it to your Vercel environment variables.'
      )
    }
    console.warn(
      '[AdminClient] SUPABASE_SERVICE_ROLE_KEY not found. ' +
      'Falling back to anon key — RLS WILL block kiosk operations. ' +
      'Set SUPABASE_SERVICE_ROLE_KEY in .env.local to fix this.'
    )
    return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
