import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: shifts, error } = await supabase
    .from('shifts')
    .select('id, name, start_time, end_time, break_minutes, tolerance_in, is_active')
    .eq('is_active', true)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: shifts })
}
