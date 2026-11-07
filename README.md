# RVNP Attendance Portal

Official static attendance portal for Rift Valley National Polytechnic (RVNP), deployed to Vercel with user accounts, Postgres database, and Row-Level Security (RLS) policies in Supabase.

Live URL: [https://rvnp-attendance.vercel.app](https://rvnp-attendance.vercel.app)

---

## Key Roles & Workflow

1. **Trainee Role (Read-Only Attendance)**:
   - Trainees **cannot mark attendance** for themselves or others.
   - Trainees can view their attendance history, calculate attendance percentage (present vs total), and generate an official scannable QR Pass with their admission number for unit trainers to scan during roll call.
2. **Trainer Role (Attendance Marking)**:
   - When a trainer registers, their account is flagged as **Pending Approval**.
   - Once approved by an Administrator, the trainer can access their assigned course roster, select enrolled trainees, enter the unit name, and mark session attendance (`Present`, `Absent`, `Late`).
3. **Administrator Role (Trainer Approvals & Notifications)**:
   - Administrators review all incoming trainer registrations.
   - 1-click **Accept & Approve Trainer** grants the trainer portal permissions.
   - **One-tap Email & Mobile Contact**: The admin can instantly send a pre-filled approval email to the trainer's Gmail via mobile/desktop mail client (`mailto:`), open Web Gmail, or call/SMS the trainer directly from their phone.

---

## Set up Supabase

1. In your Supabase Project **SQL Editor**, run [`supabase/schema.sql`](./supabase/schema.sql).
2. In **Authentication → URL Configuration**, add:
   - `http://localhost:8000/**`
   - `https://rvnp-attendance.vercel.app/**`
3. In **Project Settings → API**, copy the project URL and the publishable key into [`supabase-config.js`](./supabase-config.js).

### Creating an Initial Administrator
To promote any registered account to Administrator:
```sql
update public.profiles
set role = 'admin', is_approved = true
where email = 'your_admin_email@example.com';
```

---

## Email Delivery & Notifications

### 1. Direct Admin Approval Notification (Mobile & Web)
When an administrator clicks **Send Email to Trainer's Gmail** or **Open Web Gmail** in the admin dashboard:
- It launches the native mail app or Gmail with the recipient, subject (`RVNP Attendance Portal - Your Trainer Account has been Approved`), and portal access link ready to dispatch in one tap.

### 2. Automated Auth Emails via Google Apps Script (Optional)
The project includes an optional Google Apps Script bridge in [`google-apps-script/Code.gs`](./google-apps-script/Code.gs) and Edge Function in [`supabase/functions/send-email`](./supabase/functions/send-email) for routing Supabase auth tokens (signup, password reset) through Gmail.

---

## Deploy to Vercel

The portal is hosted on Vercel at `rvnp-attendance.vercel.app`.
Deployments are automated via GitHub CI/CD:
- Any commit pushed to the `main` branch of `https://github.com/maina605/rvnp-.git` is built and deployed by Vercel automatically.
