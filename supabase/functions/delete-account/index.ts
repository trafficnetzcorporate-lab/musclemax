import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Permanently delete the caller's account and personal data.
 *
 * Semantics (per product definition):
 *  - Personal account data is removed: profile, workout sessions, exercise
 *    progress, leg logs, and the user's own challenge attempts.
 *  - Challenges they created are ANONYMIZED and deactivated
 *    (creator_display_name → 'Former Athlete', status → 'deleted') so
 *    public links stop resolving, but other participants' attempts and
 *    history are preserved.
 *  - Finally the auth user itself is deleted.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uid = user.id;

    // 1. Anonymize + deactivate challenges created by this user.
    const { error: anonError } = await admin
      .from('challenges')
      .update({
        creator_display_name: 'Former Athlete',
        status: 'deleted',
        creator_user_id: null,
      })
      .eq('creator_user_id', uid);
    if (anonError) throw anonError;

    // 2. Delete the user's own personal data.
    for (const [table, column] of [
      ['challenge_attempts', 'participant_user_id'],
      ['workout_sessions', 'user_id'],
      ['exercise_progress', 'user_id'],
      ['leg_workout_logs', 'user_id'],
      ['profiles', 'user_id'],
    ] as const) {
      const { error } = await admin.from(table).delete().eq(column, uid);
      if (error) throw error;
    }

    // 3. Delete the auth account.
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ deleted: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
