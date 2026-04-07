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
    let { email, password, full_name, position, company_id, linked_employee_id, companies, permissions } = body

    // Sanitización de UUIDs: "" -> null
    const sanitizeUUID = (id: any) => (typeof id === 'string' && id.trim() === '') ? null : id
    
    company_id = sanitizeUUID(company_id)
    linked_employee_id = sanitizeUUID(linked_employee_id)

    if (!email || !password || !company_id || !companies?.length) {
      console.error('Validación fallida:', { email: !!email, password: !!password, company_id, companies_len: companies?.length })
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios o IDs inválidos', step: 'validation' }), {
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
      return new Response(JSON.stringify({ error: 'Sin permisos', step: 'permission_check', role: callerMembership?.role, detail: membershipCheckError?.message }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Crear usuario en Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
    })

    if (createError || !newUser.user) {
      console.error('Error Auth Admin:', createError)
      return new Response(JSON.stringify({ error: createError?.message || 'Error Auth', step: 'create_auth_user' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = newUser.user.id

    // 2. Insertar Perfil
    const profilePayload = { 
      id: userId, 
      email, 
      full_name: full_name || '', 
      position: position || '', 
      company_id, 
      linked_employee_id: linked_employee_id || null, 
      is_active: true 
    }
    
    console.log('Insertando perfil:', profilePayload)
    const { error: profileError } = await supabaseAdmin.from('profiles').insert(profilePayload)

    if (profileError) {
      console.error('Error insert profile:', profileError)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: profileError.message, step: 'insert_profile' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Membresías de Empresa
    const memberships = companies.map((c: { company_id: string; role: string }) => ({
      user_id: userId,
      company_id: sanitizeUUID(c.company_id),
      role: c.role || 'viewer',
    }))

    console.log('Insertando membresías:', memberships)
    const { error: membershipError } = await supabaseAdmin.from('company_memberships').insert(memberships)

    if (membershipError) {
      console.error('Error insert memberships:', membershipError)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: membershipError.message, step: 'insert_memberships' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Permisos Globales (Sin company_id)
    if (permissions && Object.keys(permissions).length > 0) {
      const permsPayload = { profile_id: userId, ...permissions }
      console.log('Insertando permisos:', permsPayload)
      const { error: permsError } = await supabaseAdmin.from('user_permissions').insert(permsPayload)
      if (permsError) console.error('Error insert user_permissions:', permsError)
    }

    // 5. Audit logs
    const auditPayload = {
      company_id,
      source: 'ADMIN',
      action: 'USUARIO_CREADO',
      details: { 
        email, 
        full_name, 
        companies: memberships.length,
        description: 'Alta exitosa de nuevo usuario administrativo' 
      },
    }
    console.log('Insertando audit log:', auditPayload)
    await supabaseAdmin.from('audit_logs').insert(auditPayload)

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('Error fatal catch:', err)
    return new Response(JSON.stringify({ error: err.message, step: 'catch' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
