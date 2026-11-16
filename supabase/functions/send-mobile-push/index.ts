import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

serve(async (req) => {
  try {
    const { user_id, title, body, data } = await req.json()

    // Initialize Supabase client using the Auth header from the request
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Fetch the user's push tokens
    const { data: tokens, error } = await supabaseClient
      .from('mobile_push_tokens')
      .select('token')
      .eq('user_id', user_id)

    if (error) throw error
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No tokens found for user" }), { status: 200 })
    }

    // Format payload for Expo Push API
    const messages = tokens.map(t => ({
      to: t.token,
      sound: 'default',
      title: title,
      body: body,
      data: data || {},
    }))

    // Send to Expo
    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    })

    const expoData = await expoRes.json()

    return new Response(JSON.stringify({ success: true, expoData }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    })
  }
})
