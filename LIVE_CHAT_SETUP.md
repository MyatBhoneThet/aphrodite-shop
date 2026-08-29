# Live Customer Support Chat

## What this adds

- Only logged-in customers can send support messages.
- Every customer has one private conversation linked to their profile ID.
- The administrator sees the customer's name, email, short account ID, latest
  message, conversation status, and whether the customer needs a reply.
- The customer and admin message views refresh automatically every 2.5–3
  seconds.
- Admin replies are sent only to the selected customer conversation.
- The admin can mark a conversation resolved or reopen it.
- A new customer message automatically reopens a resolved conversation.
- Chat tables are inaccessible to browser roles. Authenticated server routes
  enforce customer ownership and administrator access.

## Required database setup

Saving the migration in the project is not enough. It must be executed in the
Supabase project used by `.env.local`.

1. Open `supabase/migrations/2026-07-28-live-support-chat.sql`.
2. Copy the complete file.
3. Open the Supabase dashboard.
4. Select **SQL Editor → New query**.
5. Paste the complete migration and select **Run**.
6. Confirm Supabase displays `Success. No rows returned`.

Verify the tables:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('support_conversations', 'support_messages')
order by table_name;
```

Both table names must appear.

## Customer instructions

1. Register or log in as a normal customer.
2. Open the store.
3. Select **Live chat** in the bottom-left corner.
4. Enter a message and select **Send**.
5. Keep the chat open to see admin replies automatically.

Anonymous visitors see a login button instead of a message form. Administrators
who open the store chat receive a link to the admin inbox.

## Administrator instructions

1. Log in as an administrator.
2. Open `/admin`.
3. Select **Live Chat** in the left navigation.
4. Select a customer by name or email.
5. Review the customer account ID and message history.
6. Enter an individual reply and select **Send reply**.
7. Select **Mark resolved** after the issue is finished.

The **Needs reply** badge remains until an administrator sends a reply. If the
customer sends another message after resolution, the conversation automatically
returns to open.

## Main files

- `app/components/ChatbotButton.tsx` — authenticated customer chat.
- `app/admin/SupportPanel.tsx` — per-account administrator inbox.
- `app/admin/page.tsx` — Live Chat dashboard navigation.
- `app/api/chat/route.ts` — protected customer message API.
- `app/api/admin/support/route.ts` — protected admin inbox API.
- `app/api/admin/support/[id]/route.ts` — admin messages and status.
- `app/lib/backend.ts` — ownership and administrator authorization.
- `app/lib/supabase.ts` — server-only database operations.
- `app/lib/validation.ts` — message and status validation.
- `supabase/migrations/2026-07-28-live-support-chat.sql` — database upgrade.

## Troubleshooting

If the page says the live chat database setup is incomplete, run the complete
live-support migration in the Supabase SQL Editor. Copying it into the local
folder does not update the remote database.

If the customer message does not appear immediately, check that both browser
windows use the same Supabase project URL in `.env.local`, then select
**Refresh** in the admin Live Chat panel.

After replacing project files, restart the development server:

```bash
npm run dev
```

Then refresh the customer and administrator pages.
