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
    // Validar que el solicitante está autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, password, full_name, position, company_id, linked_employee_id, companies, permissions } = await req.json()

    if (!email || !password || !company_id || !companies?.length) {
      return new Response(JSON.stringify({ error: 'Faltan campos obligatorios: email, password, company_id, companies' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cliente con privilegios de solicitante (para verificar su rol)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verificar que el solicitante tiene rol owner/admin en la empresa
    const { data: { user: caller } } = await supabaseUser.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerMembership } = await supabaseUser
      .from('company_memberships')
      .select('role')
      .eq('user_id', caller.id)
      .eq('company_id', company_id)
      .single()

    if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
      return new Response(JSON.stringify({ error: 'Sin permisos para crear usuarios en esta empresa' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Cliente administrativo para crear el usuario en Auth
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Crear usuario en auth.users
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError || !newUser.user) {
      return new Response(JSON.stringify({ error: createError?.message || 'Error al crear usuario en Auth' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = newUser.user.id

    // 2. Crear perfil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        full_name: full_name || '',
        position: position || '',
        company_id,
        linked_employee_id: linked_employee_id || null,
        is_active: true,
      })

    if (profileError) {
      // Rollback: eliminar usuario de Auth si falla el perfil
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: 'Error al crear perfil: ' + profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Crear membresías de empresa
    const memberships = companies.map((c: { company_id: string; role: string }) => ({
      user_id: userId,
      company_id: c.company_id,
      role: c.role || 'viewer',
    }))

    const { error: membershipError } = await supabaseAdmin
      .from('company_memberships')
      .insert(memberships)

    if (membershipError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: 'Error al asignar empresas: ' + membershipError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Crear permisos para cada empresa
    if (permissions && Object.keys(permissions).length > 0) {
      const permRows = companies.map((c: { company_id: string }) => ({
        profile_id: userId,
        company_id: c.company_id,
        ...permissions,
      }))

      const { error: permsError } = await supabaseAdmin
        .from('user_permissions')
        .insert(permRows)

      if (permsError) {
        // No hacer rollback por permisos — el usuario ya existe, los permisos se pueden ajustar
        console.error('Error al insertar permisos:', permsError.message)
      }
    }

    // 5. Registrar en audit_logs
    await supabaseAdmin.from('audit_logs').insert({
      company_id,
      table_name: 'profiles',
      action: 'INSERT',
      record_id: userId,
      user_id: caller.id,
      performed_by_profile_id: caller.id,
      source: 'ADMIN',
      details: {
        new_data: { email, full_name, position, companies },
        action_description: 'Usuario creado desde panel de Administración de Accesos',
      },
    })

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
