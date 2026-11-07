# RVNP Attendance Portal

Official attendance portal for Rift Valley National Polytechnic (RVNP), deployed to Vercel with Postgres database and Row-Level Security (RLS) in Supabase.

Live URL: [https://rvnp-attendance.vercel.app](https://rvnp-attendance.vercel.app)

---

## Complete Role Workflow

### 1. Administrator Account Provisioning
- The Admin provisions institutional trainer accounts directly in the **Admin Portal**:
  - Full Name
  - Institutional Email (e.g. `p.njoroge@rvnp.ac.ke`)
  - Temporary Password
  - Trainer ID (e.g. `TRN/ENG/2024/01`)
  - Assigned Course / Class (e.g. `Electrical Engineering`)
  - Phone Number
- Once created, the Admin can click **Copy Credentials**, **Send via Gmail/Phone**, or **Send via WhatsApp** to dispatch the institutional login details directly to the trainer.
- The Admin also reviews incoming self-registration or pending requests with 1-click approvals.

### 2. Trainer Workflow
1. The Trainer goes to the portal and selects the **Trainer** tab.
2. Logs in using the institutional email and temporary password provided by the Admin.
3. The system verifies the Trainer role and assigned course/class.
4. In the **Trainer Workspace**:
   - The assigned course/class is displayed.
   - The trainee roster lists only the students enrolled in that specific class.
   - The trainer records attendance (`Present`, `Absent`, `Late`), selecting the **Unit Name** and **Academic Term** (`Term 1`, `Term 2`, `Term 3`).
   - The date and timestamp are automatically saved into the PostgreSQL `attendance` table.
5. **Camera QR Attendance Scanner**:
   - The trainer can click **📷 Scan Trainee QR Pass** to open their device camera.
   - Pointing the camera at a trainee's QR pass automatically verifies the student belongs to the trainer's class and records attendance.
   - **Access Control**: If an unauthorized user, foreign visitor, or trainee attempts to scan or record attendance, the system blocks them with:
     `"⛔ Access Denied: Trainees and unauthorized users are NOT permitted to mark attendance."`
6. **Deleting Trainee Records**:
   - In the **Recent Marked Attendance** table, the trainer has a **🗑️ Delete** button for each record.
   - If a trainee was marked by mistake or was not in class, the trainer can delete that record with confirmation.

### 3. Trainee Workflow (Strictly Read-Only)
1. The Trainee signs in under the **Trainee** tab with their admission number and password.
2. Trainees **cannot record attendance** (no submission form exists).
3. Trainees can view their:
   - Attendance percentage breakdown (`Present`, `Absent`, `Late`, Total sessions).
   - **Academic Term Switcher**: Filter live statistics and history by **All Terms**, **Term 1**, **Term 2**, or **Term 3**.
   - **Scannable QR Pass**: Displays an official digital ID with admission number and course for trainers to scan.

---

## Database Setup in Supabase

Run [`supabase/schema.sql`](./supabase/schema.sql) in your [Supabase SQL Editor](https://supabase.com/dashboard):
- Creates `profiles`, `profile_contacts`, and `attendance` tables with `term` column support.
- RLS Policies:
  - Trainees can ONLY view their own attendance.
  - Only approved trainers can mark attendance for trainees in their course.
  - Trainers can delete attendance records for trainees in their course.
  - Administrators have full update and inspection privileges.

To promote your account to Administrator:
```sql
update public.profiles
set role = 'admin', is_approved = true
where email = 'machariadavid957@gmail.com';
```

---

## Deployment

The application is deployed on **Vercel** connected to GitHub repository `maina605/rvnp-` (branch `main`).
Pushing commits to `main` automatically builds and deploys to **[https://rvnp-attendance.vercel.app](https://rvnp-attendance.vercel.app)**.
