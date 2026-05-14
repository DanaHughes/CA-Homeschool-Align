# CA Homeschool Align

**Making homeschool doable.**

An AI-powered web app that helps California teachers and homeschool families match learning activities to state standards in seconds.

🔗 **Live app:** https://ca-homeschool-align-480626814684.us-west1.run.app

---

## The Problem

California charter homeschool families spend hours every Learning Period manually matching curriculum and activities to state standards before their charter will approve purchases or count the work toward enrollment. The current process forces families into one of two bad options:

1. **Stick to boxed curriculum** (worksheets, textbooks) that's easy to document but less effective for retention.
2. **Use hands-on, experiential learning** that's better for kids but creates hours of documentation work for parents and teachers.

Research is clear that hands-on learners retain 93.5% of what they learn after a month, compared to just 79% for passive methods like worksheets ([Bridge Learning Analytics](https://www.getbridge.com/blog/learning-analytics/10-stats-about-learning-retention-youll-want-forget/)). A systematic review of 54 studies and nearly 30,000 children also found that learning through movement improves attention and academic performance ([Frontiers in Pediatrics, 2022](https://www.frontiersin.org/journals/pediatrics/articles/10.3389/fped.2022.841582/full)).

CA Homeschool Align closes the documentation gap so families can choose hands-on learning without the paperwork penalty.

---

## What It Does

- **Snap a photo or type an activity.** The app uses the Gemini API to identify the activity and match it to relevant California state standards.
- **Plain-language match explanations.** Translates dry academic standards into "academic hooks" parents can actually use.
- **Multi-grade support.** Select up to three grade levels at once to accommodate family-style homeschooling with siblings.
- **Private student vault.** Save matches per student, organize by Learning Period, and export PDFs for charter approval.
- **Charter compliance built in.** The app guides families to save only grade-appropriate standards to each student's vault.

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Firebase Authentication, Firestore
- **AI:** Google Gemini API for activity-to-standard matching
- **Deployment:** Google Cloud Run (containerized via Docker)
- **PDF Generation:** jsPDF

---

## Coming Next

**Instant work sample generation.** Auto-populated templates pulling from the same AI matching logic, with photo upload areas, grade-appropriate reflection prompts, and built-in multiple-choice questions, so families can document learning in the moment instead of writing it up later.

---

## About the Builder

Built by **Dana Hughes**, a credentialed California TK-12 educator with 15+ years of classroom and curriculum experience spanning traditional, virtual, and homeschool settings. Currently serving as Educational Coordinator at a California virtual charter homeschool school.

I built CA Homeschool Align to solve a problem I see every week in my work supporting charter homeschool families. I have no formal coding background. The app was built using AI-assisted development (primarily Google AI Studio and Claude). I made the architectural decisions, set up Firebase authentication and Firestore data handling, configured the Gemini API integration, and deployed to Google Cloud Run.

When a database write issue emerged that exceeded what AI tools could reliably resolve, I hired a contract engineer to fix that specific bug. Knowing what I can solve myself, and knowing when to bring in targeted expertise, is the same judgment I bring to my classroom work and to any product I touch.

---

## Status

Currently in beta with active users. Ongoing development focused on the work sample generation feature, Stripe payment integration, and expanded state standards coverage.

---

## License

This project is shared publicly as a portfolio piece. Please contact the author for licensing or partnership inquiries.
