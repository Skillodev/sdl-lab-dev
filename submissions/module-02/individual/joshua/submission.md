# Module 02: Lab Submission Report

**Mentee Name:** Joshua  
**GitHub Handle:** @joshuabface  
**Project Type:** Individual  
**Branch Name:** `feat/m02-ind-joshua`  
**Assigned Topic:** Civic Utility & Municipal Issue Reporter  
**Group Partner (if Group PR):** N/A  

---

## 1. Prototype & Pull Request Links

- **Google Stitch Prototype URL:** https://stitch.google.com/projects/3165976553559818779
- **Pull Request URL (created via `gh pr create`):** https://github.com/joshuabface/sdl-lab-dev/pull/1
- **Skillodev Upstream Comparison URL:** https://github.com/Skillodev/sdl-lab-dev/compare/main...joshuabface:sdl-lab-dev:feat/m02-ind-joshua?expand=1

---

## 2. UI/UX Engineering Audit

### 8pt Spatial Grid
- **Base Grid:** `8px` (micro-grid: `4px` for compact internal alignment & badge padding)
- **Layout Columns / Gutter / Margin:**
  - Desktop (`1440px`): 12 columns, 24px gutter, 64px outer margin, 64px header height
  - Tablet (`768px`): 8 columns, 16px gutter, 32px outer margin
  - Mobile (`390px`): 4 columns, 16px gutter, 16px outer margin

### 60-30-10 Color Tokens & WCAG AA Contrast Audit

| Role | Share | Hex Token | Paired Foreground/Background | Contrast Ratio | WCAG AA Pass (`>= 4.5:1`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dominant / Neutral (Canvas)** | 60% | `#F8FAFC` / `#F1F5F9` | `#334155` text on `#F8FAFC` | `9.89:1` | Yes (AAA) |
| **Secondary Surface (Cards)** | 30% | `#FFFFFF` | `#0F172A` text on `#FFFFFF` | `17.74:1` | Yes (AAA) |
| **Secondary Metadata** | 30% | `#475569` | `#475569` text on `#FFFFFF` | `7.58:1` | Yes (AAA) |
| **Accent / Primary CTA** | 10% | `#1D4ED8` | `#FFFFFF` text on `#1D4ED8` | `6.70:1` | Yes (AA) |
| **Semantic Success** | 10% | `#065F46` / `#D1FAE5` | `#065F46` on `#D1FAE5` | `7.12:1` | Yes (AAA) |
| **Semantic Warning** | 10% | `#92400E` / `#FEF3C7` | `#92400E` on `#FEF3C7` | `6.48:1` | Yes (AA) |
| **Semantic Error** | 10% | `#991B1B` / `#FEE2E2` | `#991B1B` on `#FEE2E2` | `6.81:1` | Yes (AA) |
| **Component Boundary / Focus** | 10% | `#475569` / `#1D4ED8` | `#1D4ED8` on `#FFFFFF` | `6.70:1` | Yes (`>= 3.0:1`) |

### 5 Interactive Component States Checklist
- [x] **Default**
- [x] **Hover**
- [x] **Focus** (visible keyboard focus ring meeting >= 3:1)
- [x] **Active / Pressed**
- [x] **Disabled**

---

## 3. Four-Page Application Overview

1. **Page 1: Live Issue Map & Community Feed (`live_issue_map_community_feed/code.html`):** Interactive GIS map canvas, issue filters, real-time civic stream.
2. **Page 2: Guided Issue Reporting Wizard (`guided_issue_reporting_wizard/code.html`):** Multi-step incident intake form with geo-location pin, photo upload, category tagging.
3. **Page 3: Issue Detail & Resolution Timeline (`issue_detail_resolution_timeline/code.html`):** Dispatch crew assignment, SLA countdown, photo evidence, and audit timeline.
4. **Page 4: Resident Dashboard & Municipal Transparency (`resident_dashboard_transparency/code.html`):** Transparency metrics, ticket resolution rate, and ward MTTR analytics.

---

## 4. Git Hygiene & Commit History (`git log --oneline --graph`)

```text
* eeedd09 feat(m02): add CivicPulse UI/UX design spec and submission for Joshua
* 7fad824 docs(m02): document 5 interactive component states and submission report
* af9a710 feat(m02): add 4-page application overview and exported Stitch assets
* 394bbdd style(m02): define 60-30-10 color tokens and WCAG AA contrast audit table
* f26be27 docs(m02): initialize CivicPulse project architecture and 8pt grid system for Joshua
* 84d52a5 docs(module-02): define Partner A vs Partner B component split for group projects
* 15f5e3a feat(module-02): deploy UI/UX & Git module, cohort pairing engine, and templates
* cdbbf03 feat(module-01): implement compulsory Learning How to Learn benchmark and 5 simplified elective tracks
* 2222f86 feat(cohort): scaffold Dev Lab (SDL) curriculum, Module 01 hyperparameters, and submission issue templates
```
