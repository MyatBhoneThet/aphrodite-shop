# Locked out of the admin? (lost authenticator phone)

The admin sign-in asks for a 6-digit code from an authenticator app. If the only
phone with that app is lost or broken, you can still get back in. This page
shows how, and how to make sure it never happens.

## Prevent it (do this once)

1. Open **Admin → Security → Add another authenticator** and set the account up
   on a **second phone or tablet** too. Both then give valid codes.
2. During setup the screen shows a long **key** (letters and numbers). It is
   shown **only once**. Copy it into a password manager, or write it on paper
   and keep it somewhere safe. With the key you can add any new phone later:
   in the app choose *Enter code manually* and type it.
3. Keep a second administrator if the shop has more than one owner (see
   "Make someone else an administrator" below).

Nobody can read the key back afterwards. Not the developers, not Supabase.

## Got the other phone, or the saved key

* Other phone: sign in with it, open **Admin → Security**, press **Remove** on
  the lost authenticator, then **Add another authenticator** for the new phone.
* Saved key: install an authenticator app on the new phone, add an account by
  *entering the key manually*. It will show the same codes as the old phone.

## Got neither: clear the lost authenticator in Supabase

You need to be able to open the Supabase project (the Supabase account is
separate from the shop admin login).

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Replace the email and run:

   ```sql
   delete from auth.mfa_factors
   where user_id = (select id from auth.users where email = 'owner@example.com');
   ```

   (The same can often be done from **Authentication → Users → the user →
   remove MFA factors**; the SQL always works.)
3. Sign in to `/admin/login` with the **password** only. You will be asked to
   set up a new authenticator. Save the new key this time.

This is logged: every sign-in also emails the account owner.

## Make someone else an administrator

Only do this for someone you fully trust. In the Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'second.owner@example.com';
```

They sign in at `/admin/login` and set up their own authenticator. To take the
access away again, set `role = 'normal'` (or use **Admin → Staff access** for
staff accounts).

## Forgot the password too

Use **Forgot password** on the login page first. If the email address is also
unreachable, the Supabase dashboard (**Authentication → Users**) can send a
password reset or set a new password for the user.
