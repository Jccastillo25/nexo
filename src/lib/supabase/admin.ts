import { createClient } from '@supabase/supabase-js'

/**
 * Privileged Supabase client using the SERVICE_ROLE_KEY.
 * Use ONLY in Server Actions or API routes for operations 
 * that must bypass RLS (like initial Kiosk PIN validation).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not defined. Admin client will fallback to public key (respecting RLS).')
    return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
