import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado', step: 'auth_header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { email, password, full_name, position, company_id, linked_employee_id, companies, permissions } = body

    if (!email || !password || !company_id || !companies?.length) {
      return new Response(JSON.stringify({ error: 'Faltan campos', step: 'validation', received: { email: !!email, password: !!password, company_id: !!company_id, companies: companies?.length } }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: callerError } = await supabaseUser.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Token inválido', step: 'get_user', detail: callerError?.message }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerMembership, error: membershipCheckError } = await supabaseUser
      .from('company_memberships')
      .select('role')
      .eq('user_id', caller.id)
      .eq('company_id', company_id)
      .single()

    if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
      return new Response(JSON.stringify({ error: 'Sin permisos', step: 'permission_check', role: callerMembership?.role, membershipCheckError: membershipCheckError?.message }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
    })

    if (createError || !newUser.user) {
      return new Response(JSON.stringify({ error: createError?.message || 'Error Auth', step: 'create_auth_user' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = newUser.user.id

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userId, email, full_name: full_name || '', position: position || '', company_id, linked_employee_id: linked_employee_id || null, is_active: true })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: profileError.message, step: 'insert_profile' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const memberships = companies.map((c: { company_id: string; role: string }) => ({
      user_id: userId, company_id: c.company_id, role: c.role || 'viewer',
    }))

    const { error: membershipError } = await supabaseAdmin.from('company_memberships').insert(memberships)

    if (membershipError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: membershipError.message, step: 'insert_memberships' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (permissions && Object.keys(permissions).length > 0) {
      const permRows = companies.map((c: { company_id: string }) => ({
        profile_id: userId, company_id: c.company_id, ...permissions,
      }))
      const { error: permsError } = await supabaseAdmin.from('user_permissions').insert(permRows)
      if (permsError) console.error('Permisos error:', permsError.message)
    }

    // audit_logs: solo columnas que existen en la tabla
    await supabaseAdmin.from('audit_logs').insert({
      company_id,
      source: 'ADMIN',
      details: { new_data: { email, full_name, companies }, action_description: 'Usuario creado' },
    })

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, step: 'catch' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
