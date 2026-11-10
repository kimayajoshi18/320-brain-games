// Emails players whose reminder hour it is and who have not finished today's three games.
// Called once an hour by the schedule in supabase/reminders_schedule.sql.
//
// Secrets (set with `supabase secrets set`):
//   REMINDERS_CRON_SECRET  shared with the schedule, checked on every call
//   RESEND_API_KEY         key for the email service
//   REMINDER_FROM_EMAIL    sender address, e.g. "Puzzlr <reminders@your-domain.com>"
//   APP_URL                link in the email (optional)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2'

interface Target {
  user_id: string
  email: string
  display_name: string
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

Deno.serve(async (req) => {
  const secret = Deno.env.get('REMINDERS_CRON_SECRET')
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('REMINDER_FROM_EMAIL')
  if (!url || !serviceKey || !resendKey || !from) {
    return new Response('Missing settings', { status: 500 })
  }
  const appUrl = Deno.env.get('APP_URL') ?? ''

  const db = createClient(url, serviceKey)
  const { data, error } = await db.rpc('puzzlr_reminder_targets')
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  let failed = 0
  for (const target of (data ?? []) as Target[]) {
    const name = escapeHtml(target.display_name.split(' ')[0] || 'there')
    const link = appUrl ? `<p><a href="${escapeHtml(appUrl)}">Play now</a></p>` : ''
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: target.email,
        subject: 'Your three games are waiting',
        html: `<p>Hi ${name}, you have not played today yet. Finish all three games to keep your streak going.</p>${link}`,
      }),
    })
    if (res.ok) sent++
    else {
      failed++
      console.error(`Could not email a reminder: ${res.status}`)
    }
  }

  return Response.json({ sent, failed })
})
