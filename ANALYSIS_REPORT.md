# Complete Analysis Report: Final Groups and Project Registration.xlsx

**File:** `data/Final Groups and Project Registration.xlsx`  
**Last Updated:** 2026-07-12 09:29:09 (auto-refresh every 30 min)  
**Total Sheets:** 21  
**Approx. Total Rows:** ~95,000+  
**Domain:** Student group formation, skill assessment, and project registration — academic Project-Based Learning (PBL) program at a university (BITSathy, based on `@bitsathy.ac.in` email domain)

---

## TABLE OF CONTENTS

1. [Workbook Overview](#1-workbook-overview)
2. [All 21 Sheets — Structure & Columns](#2-all-21-sheets--structure--columns)
3. [Summary Sheet — Detailed Content](#3-summary-sheet--detailed-content)
4. [Exploratory Data Analysis](#4-exploratory-data-analysis)
   - 4.1 Departments & Clusters
   - 4.2 Student Demographics
   - 4.3 I/II Year Students
   - 4.4 Group Structure & Roles
   - 4.5 Skills Analysis
   - 4.6 Project Registrations
   - 4.7 Group Ranking
   - 4.8 Peer-to-Peer Review Schedule
   - 4.9 SSG (Student Skill Group)
   - 4.10 Users Directory
   - 4.11 Industry Mentors
5. [Key Insights & Observations](#5-key-insights--observations)
6. [Data Quality Issues & Gaps](#6-data-quality-issues--gaps)
7. [Cross-Sheet Relationships](#7-cross-sheet-relationships)
8. [Conclusions](#8-conclusions)

---

## 1. WORKBOOK OVERVIEW

The workbook is a **master tracking dashboard** for a university-wide Project-Based Learning (PBL) initiative. It tracks students (I, II, III, IV years), their department/cluster, chosen skills, group formations, project proposals, peer review scheduling, and skill rankings.

**Highlights at a glance:**

| Metric | Value |
|---|---|
| Total students in pipeline | ~5,497 (UAL & PBL sheet) |
| Active I/II year students | 3,221 |
| Total groups formed | 263 |
| Unique projects registered | 443 |
| Unique skills tracked | 53 |
| SSG (Specialization) enrolments | 394 |
| Departments | 12 |
| Clusters | 2 (CS, Non-CS) |

---

## 2. ALL 21 SHEETS — STRUCTURE & COLUMNS

| # | Sheet Name | Rows | Cols | Purpose | Column Names |
|---|---|---|---|---|---|
| 1 | **Summary** | 611 | 47 | Auto-updated multi-section dashboard | (see Section 3) |
| 2 | **Group Ranking** | 1000 | 5 | Group leaderboard by total points | `Rank`, `Group Name`, `Roll Number`, `Name`, `Total Points` |
| 3 | **Sheet42** | 1000 | 47 | Student record dump (likely I/II year student list) | Name, Roll, Roll, Name, Email, Year, Dept, Code, Cluster, Gender, Resident, Learning Mode, ?, SSG-Yes, ?, ?, Points, Points, Group A, Group B, ... |
| 4 | **Skill Set Summary** | 54 | 8 | Skill categorization & student counts | `Skill Name`, `Primary`, `Secondary`, `Specialization`, `No. of Students`, `(blank)`, `Skill Not Chosen`, `No. of Students` |
| 5 | **Group Summary** | 264 | 13 | Per-group summary with capacity & project status | `Group Name`, `Group Level`, `Captain Roll Number`, `Captain Name`, `Captain Email`, `Captain Year`, `I Year Count`, `II Year Count`, `Total Count`, `Max Members Limits`, `Available Positions`, `Project Registered`, `Project Counts` |
| 6 | **Industry mentors** | 264 | 11 | Group details + industry mentor mapping | `Group Name`, `Group Level`, `Captain Roll Number`, `Captain Name`, `Captain Email`, `Captain Year`, `I Year Count`, `II Year Count`, `Total Count`, `Industry mentor Name`, `Industry Name` |
| 7 | **Group Registration** | 3358 | 7 | Detailed member-to-group registration | `Roll Number`, `Name`, `Email`, `Year`, `Group Name`, `Group Category`, `Role` |
| 8 | **Department Summary** | 1264 | 22 | Department-wise & cluster-wise member counts | `Departments / Groups`, `Cluster wise Count` (Non CS, CS, TOTAL), `Department wise Count` (AG, AIDS, AIML, BT, CSE, EEE, ECE, EIE, IT, ME, MTRS, CSBS), `Overall` (Department, I Year, II Year, Total) |
| 9 | **I Year, II Year Students wise D** | 3626 | 31 | Master student roster with skills & group info | `Roll Number`, `Name`, `Email Id`, `Year`, `Department`, `Dept. Code`, `Cluster`, `Gender`, `Resident`, `Learning Mode`, `SSG`, `Group Registered`, `Skills Registered`, `SSG Domain`, `AP in PS Technical`, `Rank in PS Technical`, `Group Name`, `Group Category`, `Role`, `Primary Skill 1`, `Primary Skill 1 - Rank`, `Primary Skill 2`, `Primary Skill 2 - Rank`, `Secondary Skill 1`, `Secondary Skill 1 - Rank`, `Secondary Skill 2`, `Secondary Skill 2 - Rank`, `Specialization Skill 1`, `Specialization Skill 1 - Rank`, `Specialization Skill 2`, `Specialization Skill 2 - Rank` |
| 10 | **GROUP (sample)** | 1001 | 20 | Wide-format group roster (one column per role) | `Group ID`, `Captain Roll Number`, `Captain Name`, `Captain Email`, `team-vice-captain`, `team-manager`, `team-strategist`, `team-member-1` ... `team-member-13` |
| 11 | **Departments** | 13 | 3 | Department reference table | `Departments`, `Code`, `Cluster` |
| 12 | **Copy of Group Registration** | 3358 | 6 | Duplicate of Group Registration (slim version) | `Roll Number`, `Name`, `Email`, `Year`, `Group Name`, `Role` |
| 13 | **Project Registrations** | 444 | 33 | Project proposals with 25 skill columns | `Project ID`, `Final Project ID`, `Group Name`, `Project Title`, `Project Description`, `Captain Roll Number`, `Captain Name`, `Captain Email`, `Skill Set 1` ... `Skill Set 25` |
| 14 | **User Skill wise rank** | 19355 | 8 | Per-student, per-skill ranking | `Skill ID`, `Skill Name`, `Roll Number`, `Name`, `Email ID`, `Total Point`, `Skill Rank`, `Total Ranks` |
| 15 | **SSG Group Registration Pending** | 778 | 19 | Two side-by-side lists (Hardware SSG + Software SSG) of unregistered students | Cols 1-9 (Hardware SSG): `Roll Number`, `Name`, `Email Id`, `Year`, `Department`, `Code`, `Cluster`, `Gender`, `Resident` <br> Cols 11-19 (Software SSG): same structure |
| 16 | **Peer to Peer Review Schedule** | 229 | 7 | P2P review timetables | `Roll Number`, `Name`, `Email`, `Year`, `Group Number`, `Time Slot`, `Venue` |
| 17 | **User Skill Mapping** | 19389 | 8 | Master user-skill mapping with type classification | `user_id`, `email`, `total_points`, `rank_position`, `email` (dup), `skill_name`, `type` (primary/secondary/specialization), `(blank)` |
| 18 | **Project Skills Set Mapping** | 4083 | 2 | Project-to-skills long table | `project_id`, `skill_name` |
| 19 | **users** | 8715 | 2 | User directory (id, email) | `id`, `email` |
| 20 | **SSG** | 395 | 2 | SSG enrollment with mode (Hardware/Software) | `Email Id`, `Mode` |
| 21 | **UAL & PBL** | 5497 | 21 | All students (II/III/IV year) with learning mode | `Roll Number`, `Name`, `Email Id`, `Year`, `Department`, `Gender`, `Resident`, `Learning Mode`, `Changes On`, `Remarks`, ...(mostly empty) |

---

## 3. SUMMARY SHEET — DETAILED CONTENT

The **Summary** sheet (611 rows × 47 cols) is a **multi-section auto-refreshing dashboard**. It contains 11 sub-sections spread across the column space.

### 3.1 Section Map

| Section | Columns | Rows | Description |
|---|---|---|---|
| A. Groups Registered Students | A–B | 4–6 | Count by year |
| B. Groups Not Registered Students | A–B | 10–12 | Count by year |
| C. SSG by Domain | D–G | 4–6 | Software vs Hardware enrollment |
| D. Learning Mode wise Group Registration | D–G | 10–12 | PBL vs UAL |
| E. Project Registration Summary | D–G | 15–18 | Group project registration status |
| F. Skills Set Summary | D–G | 22–24 | Skills registration rate |
| G. Group Counts | A–B | 14–22 | Available positions, total groups |
| H. Groups Less than 9 members | I–Q | 4–end | Filter table 1 |
| I. Groups with 10 members | S–AA | 4–end | Filter table 2 |
| J. Groups with 11 to 15 members | AC–AK | 4–end | Filter table 3 |
| K. Groups with 9, 11, or 16 members | AM–AU | 4–end | Filter table 4 |

All four group filter tables (H, I, J, K) share **9 identical columns**:
`Group Name | Group Level | Captain Roll Number | Captain Name | Captain Email | Captain Year | I Year Count | II Year Count | Total Count`

### 3.2 Section A: Groups Registered Students

| Year | Count |
|---|---|
| I | 1,657 |
| II | 1,564 |
| **Total** | **3,221** |

### 3.3 Section B: Groups Not Registered Students

| Year | Count |
|---|---|
| I | 58 |
| II | 33 |
| **Total** | **91** |

### 3.4 Section C: SSG by Domain

| Domain | Total Students | Registered | Not Registered |
|---|---|---|---|
| Software | 118 | 112 | 6 |
| Hardware | 276 | 270 | 6 |
| **Total** | **394** | **382** | **12** |

### 3.5 Section D: Learning Mode wise Group Registration

| Mode | I Year | II Year |
|---|---|---|
| Project-Based Learning Mode | 1,570 | 1,562 |
| University Academic Learning Mode | 87 | 2 |
| **Total** | **1,657** | **1,564** |

### 3.6 Section E: Project Registration Summary

| Year | Total Groups | Registered | Not Registered |
|---|---|---|---|
| I Year Groups | 0 | 0 | 0 |
| II Year Groups | 94 | 0 | 94 |
| **Total** | **94** | **0** | **94** |

> ⚠️ Anomaly: 94 II-year groups are reported as "Not Registered" for projects — could indicate a sync delay or filtering issue.

### 3.7 Section F: Skills Set Summary

| Year | Total Students | Registered | Not Registered |
|---|---|---|---|
| I Year Students | 1,628 | 1,573 | 55 |
| II Year Students | 1,595 | 1,567 | 28 |
| **Total** | **3,223** | **3,140** | **83** |

### 3.8 Section G: Group Counts

- Groups Available Positions: **336**
- Total Groups: **258**
- Skills Not Chosen Students (I=55, II=28): **83**

### 3.9 Sections H–K: Group Filter Tables (Sample Rows)

**Groups Less than 9 members (size 2–8):** A#100103 (7), A#100142 (8), A#100241 (7), A#100102 (8), A#100144 (4), A#100165 (2), A#100106 (4), A#100136 (3), etc.

**Groups with 10 members:** A#100083, A#100008, A#100051, A#100084, A#100104, A#100111, A#100117, A#100088, A#100125, A#100149, A#100148, A#100159, A#100160, A#100163, A#100164, A#100170, A#100171, A#100179, A#100194, A#100195, A#100201, A#100197, A#100204, A#100206, A#100207, A#100208, A#100235, A#100239, A#100242, A#100250, etc.

**Groups with 11 to 15 members (sample):** A#100006 (12), A#100013 (13), A#100018 (13), A#100026 (15), A#100038 (14), A#100065 (15), A#100066 (15), A#100085 (12), A#100086 (14), A#100110 (13), A#100135 (13), A#100154 (12), A#100156 (15), A#100162 (15), A#100167 (13), A#100234 (13), A#100238 (12), A#100246 (12), A#100251 (13), A#100253 (15), A#100254 (12), A#100256 (15), A#100257 (12), A#100262 (14), etc.

**Groups with 9, 11, or 16 members:** A#100009 (11), A#100019 (9), A#100024 (9), A#100133 (9), A#100140 (11), A#100169 (9), A#100236 (16), A#100247 (9), A#100252 (11), A#100255 (9), A#100258 (9), A#100263 (11), A#100001 (16), A#100004 (16), A#100007 (16), A#100010 (16), A#100012 (11), A#100016 (16), A#100017 (16), A#100021 (16), A#100023 (16), A#100029 (16), A#100030 (9), A#100032 (16), A#100035 (16), A#100039 (16), A#100040 (16), A#100041 (16), A#100044 (16), A#100045 (9), A#100048 (9), A#100053 (16), A#100054 (9), A#100055 (16), A#100061 (9), A#100062 (11), A#100073 (16), A#100076 (16), A#100078 (16), A#100079 (16), A#100081 (9), A#100082 (9), A#100091 (16), A#100094 (16), A#100099 (11), A#100105 (11), A#100109 (16), A#100112 (16), A#100115 (16), A#100119 (16), A#100120 (16), etc.

---

## 4. EXPLORATORY DATA ANALYSIS

### 4.1 Departments & Clusters

**Reference table (Departments sheet):**

| Code | Department | Cluster |
|---|---|---|
| AG | Agricultural Engineering | Non CS |
| AIDS | Artificial Intelligence and Data Science | CS |
| AIML | Artificial Intelligence and Machine Learning | CS |
| BT | Biotechnology | Non CS |
| CSE | Computer Science and Engineering | CS |
| EEE | Electrical and Electronics Engineering | Non CS |
| ECE | Electronics and Communication Engineering | Non CS |
| EIE | Electronics and Instrumentation Engineering | Non CS |
| IT | Information Technology | CS |
| ME | Mechanical Engineering | Non CS |
| MTRS | Mechatronics | Non CS |
| CSBS | Computer Science and Business Systems | CS |

**Total students by department (Department Summary, Overall):**

| Department | I Year | II Year | Total |
|---|---|---|---|
| AG | 23 | 22 | 45 |
| AIDS | 259 | 233 | 492 |
| AIML | 137 | 110 | 247 |
| BT | 114 | 106 | 220 |
| CSE | 348 | 359 | 707 |
| EEE | 93 | 100 | 193 |
| ECE | 244 | 213 | 457 |
| EIE | 55 | 50 | 105 |
| IT | 275 | 223 | 498 |
| ME | 56 | 44 | 100 |
| MTRS | 53 | 54 | 107 |
| CSBS | 0 | 50 | 50 |

**Cluster totals:**

| Cluster | I Year | II Year | Total |
|---|---|---|---|
| **CS** | 1,019 | 975 | 1,994 (62%) |
| **Non-CS** | 638 | 589 | 1,227 (38%) |
| **Grand Total** | **1,657** | **1,564** | **3,221** |

**Insights:**
- **CSE is the largest dept** (707 students, 22% of total)
- **CS cluster dominates** with 62% of all students
- **CSBS has only II-year students** (no I-year intake)
- Top 4 depts (CSE, IT, AIDS, ECE) account for ~67% of students

---

### 4.2 Student Demographics (UAL & PBL sheet — 5,497 records)

| Dimension | Breakdown |
|---|---|
| **Year** | IV=1,870 (34%), III=1,844 (33.5%), II=1,782 (32.4%) |
| **Gender** | Male=3,352 (61%), Female=2,144 (39%) |
| **Resident** | Hosteller (H)=4,019 (73%), Day-scholar (D)=1,477 (27%) |
| **Learning Mode** | PBL=4,825 (88%), UAL=671 (12%) |
| **Top 5 Depts** | CSE(1,039), ECE(774), IT(747), AIDS(738), AIML(399) |

---

### 4.3 I/II Year Students Sheet (3,626 records)

| Field | Distribution |
|---|---|
| **Year** | I=1,781 (49.1%), II=1,844 (50.9%) |
| **Cluster** | CS=2,198 (60.6%), Non-CS=1,427 (39.4%) |
| **Gender** | M=2,215 (61%), F=1,409 (39%) |
| **Resident** | H=2,745 (75.7%), D=880 (24.3%) |
| **Learning Mode** | PBL=3,223 (88.9%), UAL=402 (11.1%) |
| **SSG Enrolled** | Yes=394 (10.9%), No=3,231 (89.1%) |
| **Group Registered** | Yes=3,221 (88.8%), No=404 (11.2%) |
| **Skills Registered** | Yes=3,311 (91.3%), No=314 (8.7%) |
| **SSG Domain** | Hardware=276, Software=118 |

**Sample top departments:** CSE=771, IT=553, AIDS=542, ECE=518, AIML=272

---

### 4.4 Group Structure & Roles (Group Registration — 3,358 records)

**260 unique groups across multiple years:**

| Year | Records |
|---|---|
| II | 1,658 |
| III | 1,564 |
| NA | 3 |
| PO | 1 |

**Role distribution (descending):**

| Role | Count |
|---|---|
| team-captain | 263 |
| team-vice-captain | 255 |
| team-strategist | 254 |
| team-manager | 252 |
| team-member-1 | 236 |
| team-member-4 | 235 |
| team-member-5 | 230 |
| team-member-3 | 229 |
| team-member-2 | 229 |
| team-member-6 | 219 |
| team-member-7 | 200 |
| team-member-8 | 162 |
| team-member-9 | 162 |
| team-member-11 | 154 |
| team-member-10 | 144 |
| team-member-12 | 121 |
| team-member-13 | 1 |

**Top 5 largest groups:**
- A#100063 — 17 members
- A#100236 — 16 members
- A#100001 — 16 members
- A#100004 — 16 members
- A#100007 — 16 members

**Group Summary stats (Group Summary sheet, 263 groups):**

| Field | Distribution |
|---|---|
| **Group Levels** | Level 1=42, Level 2=133, Level 3=83 |
| **Total Count range** | min=2, max=17, avg=12.5 |
| **I Year Count** | 0 (all groups are dominated by II/III year) |
| **II Year Count** | sum=1,658, max=16 |
| **Max Members Limit** | 11 (Level 1, 130 groups) or 16 (Level 2, 133 groups) |
| **Project Registered** | No=263 (none registered yet) |
| **Groups with ≥9 members** | 240 (91%) |

> ⚠️ Anomaly: 263/263 groups show "No" for Project Registered in Group Summary — but Project Registrations has 443 entries. Likely different sync timing.

**GROUP (sample) — wide-format team roster (1,000 rows):**

| Team Size | # Groups |
|---|---|
| 0 (empty) | 739 |
| 1 | 1 |
| 2–4 | 6 |
| 5–7 | 13 |
| 8–9 | 46 |
| 10–11 | 49 |
| 12–13 | 74 |
| 14–15 | 71 |
| 16 | 1 |
| **Max** | **16** |

**Copy of Group Registration (3,358 records):**
- Year: I=1,636, II=1,615
- Role distribution: similar to Group Registration (captain=262, member-13=2)

---

### 4.5 Skills Analysis (53 unique skills)

**Skill Set Summary classification:**

#### Pure Specialization Skills (Primary=0, Secondary=0)

| Skill | Count |
|---|---|
| Generative AI (Gen AI) | 1,646 |
| Prompt Engineering | 1,200 |
| User Experience (UI/UX) Design | 1,133 |
| Research methodology | 344 |
| Intellectual Property Rights (IPR) | 286 |
| Report writing | 275 |
| Business Process Intelligence (BPI) | 246 |
| Augmented Reality (AR) & Virtual Reality (VR) Development | 215 |
| Quality Tools (Six Sigma/TQM) | 127 |
| Product thinking | 121 |
| Continuous Improvement (Lean/Kaizen) | 119 |
| Creativity | 107 |

#### Pure Technical Skills (Primary + Secondary split)

| Skill | Primary | Secondary | Total |
|---|---|---|---|
| Full-Stack Software Development | 1,096 | 538 | 1,634 |
| Cloud Computing | 635 | 786 | 1,421 |
| Big Data Analytics and machine learning | 701 | 382 | 1,083 |
| IoT and Sensor Integration | 363 | 410 | 773 |
| Cyber Security and Cryptography | 284 | 485 | 769 |
| DevOps and IT Infra | 284 | 478 | 762 |
| Agentic AI & LLM Optimization | 406 | 315 | 721 |
| Embedded Systems & Firmware | 365 | 214 | 579 |
| Natural Language Processing | 185 | 296 | 481 |
| Computer Vision and Image Processing | 185 | 256 | 441 |
| VLSI & Circuit Design | 236 | 122 | 358 |
| Edge AI | 123 | 221 | 344 |
| PCB Design and Development | 132 | 169 | 301 |
| Blockchain Technology | 91 | 168 | 259 |
| Control System | 77 | 115 | 192 |
| Data Acquisition System | 76 | 100 | 176 |
| Power Electronics & Grid Integration | 82 | 83 | 165 |
| Bioinformatics and Data Analytics | 83 | 76 | 159 |
| Manufacturing and Fabrication | 76 | 66 | 142 |
| Mechanical Modelling | 87 | 44 | 131 |
| Bio-Process Engineering | 65 | 66 | 131 |
| Autonomous Mobile Robotics (AMR) | 72 | 56 | 128 |
| Robot Systems Integration | 42 | 78 | 120 |
| PLC and Industrial Control | 46 | 74 | 120 |
| Mechanical Engineering CAD and FEA | 52 | 63 | 115 |
| EIE | 55 | 50 | 105 |
| Microbial and Plant Bioprospecting | 50 | 51 | 101 |
| Battery Management Systems (BMS) | 43 | 59 | 102 |
| Molecular Biology and Genetic Engineering | 42 | 60 | 102 |
| Precision Agriculture (Agri-Tech) | 59 | 43 | 102 |
| Digital Signal Processing | 39 | 59 | 98 |
| Additive Manufacturing (3D Printing) | 29 | 61 | 90 |
| Design for Manufacturing and Assembly | 30 | 40 | 70 |
| FPGA Prototyping | 38 | 24 | 62 |
| Power System | 26 | 32 | 58 |
| Game Development | 16 | 40 | 56 |
| Servo-Drives & Motion Control | 14 | 39 | 53 |
| Mechanisms Design | 12 | 34 | 46 |
| Unmanned Aerial Systems | 18 | 22 | 40 |
| 3D game modeling | 13 | 23 | 36 |
| Pneumatics & Electro-Pneumatics | 5 | 15 | 20 |
| Computational Fluid Dynamics (CFD) | 2 | 17 | 19 |

**User Skill wise rank (19,354 records):**

| Metric | Value |
|---|---|
| Total skill-student records | 19,354 |
| Unique skills | 53 |
| Points min | 100 |
| Points max | 16,250 |
| Points average | 3,412 |

**Top 10 most frequently ranked skills:**

| Skill | Students Ranked |
|---|---|
| Generative AI (Gen AI) | 1,714 |
| Full-Stack Software Development | 1,701 |
| Cloud Computing | 1,492 |
| Prompt Engineering | 1,256 |
| User Experience (UI/UX) Design | 1,183 |
| Big Data Analytics and machine learning | 1,110 |
| IoT and Sensor Integration | 816 |
| Cyber Security and Cryptography | 814 |
| DevOps and IT Infra | 793 |
| Agentic AI & LLM Optimization | 742 |

**User Skill Mapping (19,388 records):**

| Field | Value |
|---|---|
| Type distribution | primary=6,628, secondary=6,628, specialization=6,132 |
| Total points | min=100, max=12,500, avg=2,653 |

---

### 4.6 Project Registrations (Project Registrations — 443 projects)

**Overview:**

| Metric | Value |
|---|---|
| Total project entries | 443 |
| Unique groups with projects | 136 |
| Avg skills per project | 9.2 |
| Max skills per project | 25 |
| Min skills per project | 1 |

**Skill count distribution:**

| Skills/Project | # Projects |
|---|---|
| 6 | 60 |
| 7 | 52 |
| 8 | 45 |
| 9 | 39 |
| 10 | 38 |
| 11 | 28 |
| 5 | 27 |
| 13 | 26 |
| 15 | 20 |
| 4 | 19 |
| 14 | 18 |
| 3 | 17 |
| 12 | 13 |
| 16 | 9 |
| 19 | 5 |
| 22, 20, 18, 17, 21, 24, 25 | 4, 4, 4, 3, 2, 2, 1 each |

**Top 5 most active groups (by project count):**

| Group | # Projects |
|---|---|
| A#100062 | 5 |
| A#100093 | 5 |
| A#100133 | 5 |
| A#100105 | 5 |
| A#100082 | 5 |

**Sample project titles (from group A#100062):**
- LearnFlow - Adaptive Learning
- CuraNet - Healthcare Integration
- SafeSense - Industrial Safety & Predictive Hazard
- (5 total from this group)

**Top 10 skills in projects (Project Registrations):**

| Skill | # Projects Using |
|---|---|
| Full-Stack Software Development | 311 |
| Cloud Computing | 304 |
| Big Data Analytics and machine learning | 300 |
| IoT and Sensor Integration | 257 |
| Embedded Systems & Firmware | 198 |
| User Experience (UI/UX) Design | 187 |
| Intellectual Property Rights (IPR) | 183 |
| Cyber Security and Cryptography | 173 |
| Generative AI (Gen AI) | 170 |
| Edge AI | 161 |

**Project Skills Set Mapping (4,082 project-skill links, 439 unique projects):**

Same top 10 skills with identical rankings.

---

### 4.7 Group Ranking (260 ranked groups out of 1,000 rows)

| Stat | Value |
|---|---|
| Points min | 6,170 |
| Points max | 215,495 |
| Points average | 71,243 |

**Top 3 groups:**

| Rank | Group | Total Points |
|---|---|---|
| 1 | A#100067 | 215,495 |
| 2 | A#100059 | 214,790 |
| 3 | A#100063 | 201,105 |

---

### 4.8 Peer-to-Peer Review Schedule (229 students)

| Field | Value |
|---|---|
| Year | II=141, I=87 |
| Unique groups | 228 |
| Time: 10:45 – 12:20 | 108 students |
| Time: 13:30 – 15:10 | 120 students |
| Venue: WW113 | 72 |
| Venue: WW114 | 72 |
| Venue: WW115 | 72 |
| Venue: WW117 | 12 |

---

### 4.9 SSG (Student Skill Group — Specialization Streams)

**SSG (395 enrolments):**

| Mode | Count |
|---|---|
| Hardware | 276 (69.9%) |
| Software | 118 (30.1%) |

**SSG Group Registration Pending (6 students pending registration):**

| Field | Value |
|---|---|
| Year | I=6 |
| Gender | F=5, M=1 |
| Top Departments | AG=2, ECE=2, BT=1, MTRS=1 |

> Essentially resolved: only 6 students still need SSG registration out of 394 expected.

---

### 4.10 Users Directory (8,714 records)

| Field | Value |
|---|---|
| Total users | 8,714 |
| Unique emails | 8,694 |
| ID types | Numeric IDs (e.g., 1045), Roll-based IDs (e.g., 201ME153, 2023UAD5001) |

---

### 4.11 Industry Mentors (264 rows)

| Field | Value |
|---|---|
| Total group rows | 264 |
| Groups with mentor assigned | **0** |
| Groups without mentor | 263 |

> ⚠️ **Critical gap:** No industry mentors have been assigned to any group yet.

---

## 5. KEY INSIGHTS & OBSERVATIONS

### 5.1 Scale & Engagement
1. **Massive PBL initiative** — 3,221 active students, 263 groups, 443 projects, 53 skills
2. **88% PBL adoption** — Project-Based Learning is the dominant mode (4,825 of 5,497)
3. **89% group registration** — Most students formed or joined groups; 91% chose skills
4. **Only 11% in SSG** — Specialization streams are exclusive/selective

### 5.2 Departmental Trends
5. **CS cluster dominates** with 62% (1,994) of all I/II-year students
6. **CSE is #1 dept** at 707 students (22% of total)
7. **AG is smallest dept** at 45 students
8. **CSBS is new** — Only II-year students (50), no I-year intake yet
9. **Cross-cluster mixing** — Some groups (e.g., A#100002) have 12 Non-CS + 3 CS members

### 5.3 Skill Trends
10. **AI/Cloud dominate** — Gen AI (1,714), Full-Stack (1,701), Cloud (1,492) lead
11. **Soft skills as specialization** — UI/UX, Prompt Engineering, Research methodology are specialization-only
12. **Hardcore tech skills** — Full-Stack, Cloud, Big Data, IoT, Cyber Security, DevOps are Primary+Secondary
13. **Niche skills** — Pneumatics, CFD, Mechanisms have <50 students
14. **Skill diversity** — 53 distinct skills tracked, showing breadth of program

### 5.4 Group Dynamics
15. **Most groups well-formed** — 91% have ≥9 members
16. **Group levels** — 50% are Level 2 (cap 16), 32% are Level 3, 16% are Level 1 (cap 11)
17. **Role hierarchy is clear** — 263 captains, ~250 each for VC/manager/strategist
18. **Some groups over-subscribed** — A#100063 has 17 members despite 16 max
19. **Top 5 groups** (A#100062, A#100093, A#100133, A#100105, A#100082) submitted 5 projects each

### 5.5 Demographic Patterns
20. **Gender ratio** — 61% Male, 39% Female (typical engineering skew)
21. **Residency** — 73% hostellers, 27% day-scholars
22. **Year distribution (UAL & PBL)** — Roughly even: IV=34%, III=33.5%, II=32.4%

### 5.6 Program Health
23. **Group formation: ✅ Excellent** — 89% registered
24. **Skill selection: ✅ Excellent** — 91% registered
25. **SSG enrollment: ⚠️ Low** — Only 11% opted for specialization
26. **Project proposals: ✅ Strong** — 443 projects, 136 groups (52% of all groups) active
27. **Industry mentors: ❌ Missing** — 0/263 groups have mentors assigned
28. **Peer review: 🟡 Partial** — Only 229 students (6.5% of 3,221) have P2P slots
29. **Group ranking: 🟡 Active** — 260 groups ranked, top group has 215K points

---

## 6. DATA QUALITY ISSUES & GAPS

| # | Issue | Location | Severity |
|---|---|---|---|
| 1 | **Industry mentors all empty** | Industry mentors sheet | 🔴 Critical — blocks mentor program |
| 2 | **Project Registration: II Year Groups = 0/94 registered** | Summary Section E | 🟠 Inconsistency with 443 projects in Project Registrations |
| 3 | **Group Summary: 263/263 "Project Registered = No"** | Group Summary col 12 | 🟠 Conflicts with 443 actual projects |
| 4 | **Group Ranking sheet has 1,000 rows but only 260 populated** | Group Ranking | 🟡 Many empty rows |
| 5 | **GROUP (sample): 739 of 1,000 groups empty** | GROUP (sample) | 🟡 Sample is sparse — only 261 actual groups |
| 6 | **Duplicate sheets** | Group Registration vs Copy of Group Registration (slim) | 🟡 Redundancy |
| 7 | **Sheet42 vs I Year, II Year** | Both contain similar student data | 🟡 Possible duplicate |
| 8 | **A#100063 has 17 members** (max 16) | Group Registration | 🟢 Minor over-subscription |
| 9 | **SSG Pending = 6** (down from 12) | Summary vs Pending sheet | 🟢 Mostly resolved |
| 10 | **"Artifical" spelling** (should be "Artificial") | Departments, Group Registration, etc. | 🟢 Cosmetic |
| 11 | **UAL & PBL has 21 cols but only 10 are populated** | UAL & PBL | 🟢 Sparse schema |
| 12 | **Some groups have I-Year Count = 0** despite summary showing I-year members | Group Summary | 🟡 Possible roll-up issue |
| 13 | **No I-year group projects** (II-year only) | Summary Section E | 🟡 Expected behavior? |
| 14 | **Learning Mode UAL has only 2 II-year students** (vs 87 I-year) | Summary Section D | 🟡 Curious imbalance |

---

## 7. CROSS-SHEET RELATIONSHIPS

The workbook follows a **star schema** pattern:

```
                    ┌─────────────────────┐
                    │   users (master)    │
                    │   8,714 records     │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Group        │    │ User Skill       │    │ UAL & PBL        │
│ Registration │    │ Mapping          │    │ (all students)   │
│ 3,358 rows   │    │ 19,389 rows      │    │ 5,497 rows       │
└──────┬───────┘    └──────┬───────────┘    └──────────────────┘
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────────┐
│ Group        │    │ User Skill wise  │
│ Summary      │    │ rank             │
│ 264 rows     │    │ 19,355 rows      │
└──────┬───────┘    └──────────────────┘
       │
       ├──► Group Ranking
       ├──► Industry mentors (empty)
       ├──► Department Summary
       ├──► Project Registrations (443)
       └──► Peer to Peer Review Schedule

Specialization streams:
SSG (395) ──► SSG Group Registration Pending (6 remaining)
Skill Set Summary (53) ──► Project Skills Set Mapping
```

**Key foreign keys:**
- `Roll Number` (or `user_id`) links students across all sheets
- `Group Name` (A#XXXXXX) links groups across Group Summary, Registration, Industry mentors, Project Registrations
- `project_id` links Project Registrations ↔ Project Skills Set Mapping
- `Skill Name` links User Skill wise rank ↔ User Skill Mapping ↔ Skill Set Summary

---

## 8. CONCLUSIONS

### Program Snapshot
The "Final Groups and Project Registration" workbook is a **comprehensive tracking system for a large-scale Project-Based Learning initiative at BITSathy**, covering ~3,200 I/II-year students across 12 departments and 263 groups. The program has strong adoption in group formation (89%) and skill selection (91%), with 443 project proposals submitted.

### What's Working
- ✅ **Group formation & role assignment** is near-complete and well-structured
- ✅ **Skill diversification** with 53 skills across CS and Non-CS clusters
- ✅ **Project submissions** are flowing (443 entries, 136 active groups)
- ✅ **Group ranking system** is operational with 260 groups scored
- ✅ **P2P review scheduling** has begun (229 students, 4 venues)
- ✅ **SSG enrollment** is nearly complete (only 6 pending)

### Critical Gaps to Address
- ❌ **Industry mentor assignment is at 0%** — this is the most pressing gap
- ❌ **Project registration status flag** in Group Summary shows 0% — likely a sync issue
- ⚠️ **II-year groups marked "Not Registered" for projects** — even though 443 exist
- ⚠️ **Data redundancy** between Group Registration and Copy of Group Registration
- ⚠️ **Sheet42 appears to duplicate** the I/II Year Students sheet

### Recommended Next Steps
1. **Assign industry mentors** — Start with top 50 groups (A#100001–A#100050)
2. **Fix Project Registered flag** in Group Summary — sync with Project Registrations
3. **Clean up duplicate sheets** (Copy of Group Registration, Sheet42)
4. **Validate SSG pending list** — confirm 6 remaining students complete registration
5. **Expand P2P review** — only 229 of 3,221 students have slots
6. **Investigate Learning Mode imbalance** — why only 2 II-year UAL students
7. **Document data refresh cadence** — Summary is auto-updated every 30 min; verify other sheets follow same pattern

### Strategic Insights
- **AI/Cloud skills are the future** — top 3 skills are all related (Gen AI, Full-Stack, Cloud)
- **CS cluster will dominate PBL** — already 62% of students
- **Project diversity is good** — 443 projects with avg 9.2 skills each show broad thinking
- **Soft skills included** — UI/UX, Research, IPR, Report writing are formal skill categories
- **Some groups are over-achievers** — top 5 groups submitted 5 projects each, indicating high engagement
- **Group size cap of 16** is being respected except for 1 outlier (A#100063 with 17)

---

**Report generated:** 2026-07-14  
**Source file:** `data/Final Groups and Project Registration.xlsx` (4.0 MB)  
**Analysis method:** Python + openpyxl, programmatic EDA across all 21 sheets
