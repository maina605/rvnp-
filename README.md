# RVNP Attendance Portal

Static frontend for Vercel with user accounts, Postgres data, and row-level access policies in Supabase. The original PHP/MySQL scripts have been replaced; Vercel does not execute PHP.

## Set up Supabase

1. Create a Supabase project.
2. In **SQL Editor**, run [`supabase/schema.sql`](./supabase/schema.sql).
3. In **Authentication → URL Configuration**, set the Site URL to your Vercel URL. Add `http://localhost:8000/**` and `https://YOUR_VERCEL_DOMAIN/**` to the redirect allow list so email confirmation and password recovery links can return to the portal.
4. In **Authentication → Providers → Email**, configure email confirmation and password recovery to match your needs.
5. Copy the project URL and the **publishable** key (or legacy `anon` key) from **Project Settings → API** into [`supabase-config.js`](./supabase-config.js).

The browser key is intentionally public. Do not put a Supabase `service_role` or secret key in this file. Database access is restricted by the SQL schema's row-level security policies.

Trainer accounts are created as pending. After the trainer confirms their email, an RVNP administrator must approve the account in the Supabase SQL Editor:

```sql
update public.profiles
set is_approved = true
where role = 'trainer' and trainer_id = 'TRAINER_ID_HERE';
```

Only approved trainers can view trainees in their course or record attendance for them. Trainees can access only their own profile and attendance records.

## Run locally

From this directory, start any static file server. For example, with Python:

```powershell
py -m http.server 8000
```

Open `http://localhost:8000`. Configure that URL in Supabase's redirect allow list before testing sign-up or password recovery.

## Deploy the frontend to Vercel

1. Push this repository to GitHub, or import it directly in Vercel.
2. In Vercel, import the repository and set the project root to this `rvnp-` directory if it is inside a larger repository.
3. Choose **Other** as the framework preset. No build command or output directory is required; this is a static site.
4. Deploy. The site uses the Supabase URL and publishable key from `supabase-config.js`.
5. Add the final Vercel domain to the Supabase Auth redirect allow list.

## Notes

- `attendance.recorded_at` is set by the database and cannot be supplied by the browser.
- Self-registration is enabled for both account roles to match the original portal. Trainer registration does not grant data access until an administrator approves the account.
- The trainee QR code contains the admission number and course. Treat downloaded QR codes as personal information.
