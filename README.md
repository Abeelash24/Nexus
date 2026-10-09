# PlacementConnect — Connect. Prepare. Get Placed.

**PlacementConnect** is a college placement-management and career-development platform connecting **Students**, **Alumni Mentors**, and **Placement Officers / Administrators**.

---

## 🚀 Key Highlights & Architectural Overview

### 1. Multi-Role Portals
- **Student Portal**:
  - **Analytics Dashboard**: Greeting banner, 4 core metric cards (Applications, Shortlisted, Interviews, Selected), dynamic profile completion tracker, live application timeline, recommended job opportunities, and study kits.
  - **Career Profile**: High-impact portfolio with verified CGPA, 10th/12th percentages, skill proficiency badges, GitHub/LinkedIn links, projects showcase, certifications, and resume upload/download.
  - **Placement Job Board**: Multi-factor filtering (domain, salary, location, CGPA eligibility), duplicate application prevention, and detailed job requirement breakdowns.
  - **Multi-Stage Application Pipeline**: Visual timeline stepper (`Applied` → `Shortlisted` → `Aptitude` → `Technical Interview` → `HR Interview` → `Selected` / `Rejected`) with interview links and recruiter remarks.
  - **Alumni Mentors Directory**: Search mentors by company (Google, Microsoft, Amazon, NVIDIA), department, graduation year, and mentorship availability.
  - **Resource Drive**: Google Drive-inspired study material vault with 13 categorized folders (DSA, Aptitude, DBMS, OS, Computer Networks, System Design, Java, Python & ML, Web Dev, Cloud & DevOps, HR Prep, Company Kits, Resume Prep), breadcrumb navigation, grid/list toggle, upload, and download triggers.
  - **Real-Time Chat & Messaging**: One-to-one messaging with conversation stream, online indicators, file attachments, and simulated mentor replies.
  - **Voice & Video Calling (WebRTC)**: Interactive calling modal with video streams, mic/camera controls, and session duration timer.
  - **Notification Center**: Filterable alerts for applications, new drives, mentor messages, and campus announcements.

- **Alumni Portal**:
  - **Mentorship Command Center**: Live mentoring availability toggle, mentee statistics, junior student talent directory with CGPA filters, and direct 1-on-1 mock call triggers.

- **Admin / Placement Officer Portal**:
  - **Placement Analytics Hub**: Real-time KPI cards (Placement Rate, Average CTC, Total Students, Partner Companies) and interactive pipeline funnels & department distribution charts.
  - **Candidate Pipeline Tracker**: Master candidate queue with instant round advancement (`Shortlist`, `Technical Interview`, `Selected`, `Rejected`) and interview link broadcaster.
  - **Job Drives Manager**: Post new drives, configure CGPA cutoffs, and close application windows.
  - **Recruiter Directory**: Manage 20+ corporate hiring partners and salary tiers.
  - **100+ Student Directory**: Filterable master student database with CSV Roster Export.

---

## 🛠️ Technology Stack

- **Frontend**: Angular 21 (Standalone Components, Signals, Reactive Forms, Router, RxJS)
- **Styling**: Tailwind CSS v4 + Glassmorphism UI tokens
- **Icons**: Custom universal SVG icon system
- **Backend & Database**: Supabase PostgreSQL with Row Level Security (RLS) policies
- **Deployment**: Configured for Vercel with SPA rewrite headers (`vercel.json`)

---

## ⚡ Quick Start & Local Execution

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm start
```
Navigate to `http://localhost:4200/`.

### 3. Production Build
```bash
npm run build
```

---

## 🗄️ Database & Supabase Deployment

The complete PostgreSQL database definitions and seed scripts are provided in the `/supabase` directory:
- `supabase/schema.sql`: Full DDL, relational tables, constraints, indexes, and Row Level Security (RLS) policies.
- `supabase/seed.sql`: Realistic dataset containing 100+ students, 25 alumni mentors, 20 companies, 30 active job openings, and 100+ study resources.

To deploy into Supabase:
1. Open your Supabase project dashboard.
2. Navigate to the **SQL Editor**.
3. Copy and run `supabase/schema.sql`, then run `supabase/seed.sql`.
4. Update your Supabase URL and Anon Key in `src/environments/environment.ts`.

---

## 🎯 Instant Demo Access

Use the **Demo Switcher Toolbar** located at the top-right header or on the login page to instantly evaluate the application:
- 🎓 **Student**: Rahul Sharma (`rahul.sharma@placementconnect.edu`)
- 💼 **Alumni**: Priya Nair, Senior SDE @ Google (`priya.nair@google.com`)
- ⚡ **Admin**: Dr. Anand Verma, Placement Officer (`placement.officer@placementconnect.edu`)
