# Google Calendar Setup (Cara Putter auto-events)

When a job/event is scheduled in the Jobs tab, **Cara Putter** creates a real
Google Calendar event via the **same Google service account** already used for
Gmail drafts (`lib/gmail.ts`). No new SDK — `lib/gcal.ts` mints the SA JWT and
calls the Calendar REST API. Until this is set up, scheduling still works and
Eli still drafts the confirmation email; you'll just see a one-time "Calendar
isn't connected yet" notice.

## One-time setup
1. **Enable the Google Calendar API** for the service account's Google Cloud
   project (APIs & Services → Library → Google Calendar API → Enable).
2. **Add the calendar scope to domain-wide delegation.** In the Workspace Admin
   console → Security → API controls → Domain-wide delegation, edit the SA's
   client ID and add:
   `https://www.googleapis.com/auth/calendar.events`
   (alongside the existing Gmail scopes).
3. **Pick the calendar to write to.** By default Cara writes to the *primary*
   calendar of the impersonated mailbox:
   - DC Solar → `DC_DRAFTS_MAILBOX` (default `devon@dcsolarkc.com`)
   - Mobile Mulligans → `MM_DRAFTS_MAILBOX` (default `info@mobilemulligans.net`)
   To use a *different* calendar, share it with that mailbox and set
   `DC_CALENDAR_ID` / `MM_CALENDAR_ID` (the calendar's id) in Vercel.

## Env (per Vercel project)
| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_SA_KEY` | Yes | Already set for Gmail — shared. |
| `DC_CALENDAR_ID` / `MM_CALENDAR_ID` | Optional | Target calendar id; defaults to the mailbox's primary. |

No new key needed if Gmail already works — just enable the API + add the scope,
then redeploy. Test: add a job/event with a scheduled date → it should appear on
the calendar and the live log shows "Cara Putter added … to the Google Calendar."
