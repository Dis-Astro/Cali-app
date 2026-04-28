import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface CreateUserRequest {
  email: string
  password: string
  first_name: string
  last_name: string
  role: 'admin' | 'coach' | 'cliente_palestra' | 'cliente_coaching' | 'cliente_corso'
  phone?: string
  date_of_birth?: string
  address?: string
  fiscal_code?: string
  emergency_contact?: string
  bootstrap?: boolean // Flag per creazione primo admin
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client for user creation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Parse request body first to check for bootstrap
    const body: CreateUserRequest = await req.json()
    console.log('Request received:', body.email, 'bootstrap:', body.bootstrap)

    // Check if this is a bootstrap request (creating first admin)
    if (body.bootstrap === true && body.role === 'admin') {
      // Verify no admins exist in the system
      const { count, error: countError } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')

      if (countError) {
        console.error('Count error:', countError)
        return new Response(
          JSON.stringify({ error: 'Errore nel verificare gli admin esistenti' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (count && count > 0) {
        console.error('Admins already exist, bootstrap not allowed')
        return new Response(
          JSON.stringify({ error: 'Bootstrap non permesso: esistono già degli admin nel sistema' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Bootstrap mode: creating first admin')
    } else {
      // Normal flow: require authentication
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization header required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      })

      // Verify caller is authenticated
      const { data: { user: callerUser }, error: authError } = await supabaseClient.auth.getUser()
      if (authError || !callerUser) {
        console.error('Auth error:', authError)
        return new Response(
          JSON.stringify({ error: 'Non autenticato' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if caller is admin
      const { data: callerProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('user_id', callerUser.id)
        .single()

      if (profileError || !callerProfile) {
        console.error('Profile error:', profileError)
        return new Response(
          JSON.stringify({ error: 'Profilo non trovato' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (callerProfile.role !== 'admin') {
        console.error('User is not admin:', callerProfile.role)
        return new Response(
          JSON.stringify({ error: 'Solo gli admin possono creare utenti' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log('Creating user:', body.email, 'with role:', body.role)

    // Validate required fields
    if (!body.email || !body.password || !body.first_name || !body.last_name || !body.role) {
      return new Response(
        JSON.stringify({ error: 'Campi obbligatori mancanti: email, password, first_name, last_name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role
    const validRoles = ['admin', 'coach', 'cliente_palestra', 'cliente_coaching', 'cliente_corso']
    if (!validRoles.includes(body.role)) {
      return new Response(
        JSON.stringify({ error: 'Ruolo non valido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create user with admin API (auto-confirms email)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Auto-confirm since admin creates the user
    })

    if (createError) {
      console.error('Create user error:', createError)
      // Handle specific errors
      if (createError.message.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: 'Email già registrata' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Errore nella creazione utente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User created:', newUser.user.id)

    // Create profile for the new user
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: newUser.user.id,
        first_name: body.first_name,
        last_name: body.last_name,
        role: body.role,
        phone: body.phone || null,
        date_of_birth: body.date_of_birth || null,
        address: body.address || null,
        fiscal_code: body.fiscal_code || null,
        emergency_contact: body.emergency_contact || null,
      })

    if (profileInsertError) {
      console.error('Profile insert error:', profileInsertError)
      // Try to clean up the created user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return new Response(
        JSON.stringify({ error: 'Errore nella creazione del profilo: ' + profileInsertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Profile created successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          first_name: body.first_name,
          last_name: body.last_name,
          role: body.role
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Errore interno del server' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
