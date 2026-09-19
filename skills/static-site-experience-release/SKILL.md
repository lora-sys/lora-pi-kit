---
name: static-site-experience-release
description: Audit, refine, validate, and release an existing static personal, portfolio, or blog site with a branch-first workflow. Use when users request experience or interaction improvements, content-fact alignment, performance/accessibility review, analytics or GitHub Discussions integration, GitHub Pages deployment, or production acceptance for an Astro/static GitHub repository.
---

# Static Site Experience & Release

Use this skill to improve an **existing** static site without turning it into a feature pile. Prefer clarity, factual consistency, stable interaction, accessibility, and validated release discipline over additional cards, CTAs, animation, or backend services.

Do not use this skill to build a new site from scratch, add a database-backed anonymous comment service, or deploy a persistent server.

## Operating Principles

- Preserve the user's confirmed visual baseline. Treat current project-card geometry, Hero hierarchy, key illustrations, and primary contact path as protected until explicitly changed.
- Start with a visitor-path audit, not implementation. Test first-time understanding, project exploration, reading flow, trust/credentials, contact, mobile controls, and third-party loading states.
- Fix factual conflicts before visual enhancements. Treat a user-provided PDF, verified source file, or explicit statement as authoritative; never invent dates, achievements, locations, statistics, or comments.
- Apply **subtraction before addition**. Reduce competing choices, default-open indexes, redundant CTAs, and unexplained loading states before adding interaction.
- Use progressive disclosure for dense content. Preserve deep content, tags, archives, and full tables of contents behind meaningful native `<details>` / `<summary>` controls or equally accessible disclosure.
- Keep deployment static. Do not introduce a database, always-on process, or secret-bearing client implementation merely for interaction polish.
- Respect `prefers-reduced-motion`, keyboard operation, visible focus, native dialog behavior, and touch target size.

## Establish Inputs

Before editing, establish the repository path, production URL, package manager, quality-check command, production-build command, preview command, deployment workflow, branch policy, and static hosting base path. For Astro deployed under a GitHub Pages project subpath, keep internal links and public assets `BASE_URL` safe.

Record user non-negotiables. Typical examples include a protected project-card layout, Chinese-first language, official-resume PDF authority, a specific slogan, no fabricated analytics, and no audit artifacts in the repository.

## Workflow

### 1. Audit Before Building

1. Create or use an isolated feature branch. Record `git status --short`, current branch, and deployed commit.
2. Open production and local production preview. Review homepage, projects, writing index, one long article, About, resume, contact, guestbook, and any carousel/archive sections.
3. Inspect responsive CSS and effective touch targets. Verify keyboard reachability and reduced-motion fallbacks.
4. Save findings, screenshots, Lighthouse reports, and browser notes **outside the repository**.
5. Classify findings:

| Priority | Fix type | Examples |
|---|---|---|
| P0 | Facts and broken trust | Resume/About date conflict, missing official section, inaccessible primary action, broken public route |
| P1 | Reading and exploration friction | Dense first screen, full article TOC with dozens of items, redundant CTA competition, unstable external embed |
| P2 | Fine interaction polish | Touch heat areas, focus return, mild row feedback, restrained scroll feedback |
| Do not do | Feature accumulation | Extra project-card buttons, auto pop-ups, fabricated counters, needless carousels, database comments |

Present a short prioritized plan before broad visual changes. If the user rejects a layout, revert the intrusion first and treat that feedback as a protected constraint.

### 2. Implement Facts and Information Hierarchy

1. Align duplicated profile fields with an official source. If a PDF resume is authoritative, update structured resume and profile data to match it; do not alter the PDF unless the user supplies a replacement.
2. Keep the resume simple: structured web summary for scanning, PDF preview/download for authority, native dialog with Escape, backdrop close, focus restoration, and direct download.
3. Convert dense writing indexes into an intentional sequence: filter → selected reading → optional routes → expandable full archive and tags.
4. Convert very long article TOCs into a concise overview of major sections plus an expandable full TOC. Preserve heading anchors and SEO structure.
5. Compress verbose About introductions into fewer accurate paragraphs. Keep at most three primary actions; demote secondary links rather than adding buttons.
6. Avoid changing a protected project-card composition. Reuse existing Story, Website, Source, or card click behavior rather than injecting a CTA into every card.

### 3. Improve Interaction Without Visual Noise

1. Add only interactions with a visitor benefit: reading progress, current nav state, tactile press response, row-entry feedback, hover pause, or controlled carousel playback.
2. Make autoplay optional and controllable. Pause a carousel after manual input, provide previous/next controls and keyboard arrows, and keep state announcements quiet until user interaction.
3. Expand the **effective** touch target at narrow breakpoints with transparent pseudo-elements or minimum heights. Preserve desktop visual dimensions where possible.
4. Maintain focus handling for dialogs and mobile menus. Escape must close temporary UI and focus must return to the initiating control.
5. Disable non-essential motion under `prefers-reduced-motion: reduce`.

### 4. Handle Analytics and Community Embeds Honestly

#### GoatCounter

- Keep the official count script and user-supplied endpoint intact.
- Treat public totals as cacheable and potentially cross-origin. An embed or script load does **not** prove a fresh pageview has appeared in the public total.
- Give the counter parent a stable intrinsic footprint to prevent Hero layout shift.
- Provide a small, accessible direct link to the official public counter page when the iframe is unreadable or blank in automation.
- Never synthesize, increment, or claim visitor counts. Report the current public total with its caching limitation.

#### Giscus

- Use only repository, category, IDs, and authorization confirmed by the user.
- Explain that participation requires GitHub login and creates public GitHub Discussions content.
- Provide a stable loading skeleton and a direct Discussions fallback link before the iframe mounts.
- Verify iframe parameters and production origin. Never post a test comment, reaction, or discussion without explicit user instruction.

### 5. Validate Locally

Run the repository's check and production build commands after substantive changes. Use a local production preview, not only a development server, to inspect static paths and embeds.

| Area | Required verification |
|---|---|
| Content | Official facts match source; bilingual routes remain consistent; PDF routes work |
| Interaction | Keyboard navigation, Escape, focus return, reduced-motion behavior, carousel manual pause |
| Visuals | Protected card and Hero composition remain unchanged; no unexpected wrapping or collapse |
| Static paths | Production subpath / `BASE_URL` links, assets, canonical URLs, JSON-LD, and downloads work |
| Third-party UI | Analytics parent footprint and fallback link work; Giscus has clear loading/fallback behavior |
| Quality | Static/type check, production build, release audit, and `git diff --check` pass |
| Performance | Run Lighthouse on homepage and affected routes; report score, LCP, CLS, and TBT as measurements, not guarantees |

Send production-like screenshots of each materially changed route. Do **not** push or merge until the user explicitly approves the reviewed branch.

### 6. Release and Production Acceptance

After explicit approval:

1. Stage only intended source files. Confirm logs, screenshots, Lighthouse JSON, downloaded files, and temporary assets remain outside the repository.
2. Commit on the feature branch with a scoped message.
3. Fast-forward merge or otherwise merge into `main` according to the user's branch policy.
4. Push `main`, obtain the workflow run URL, and wait for the GitHub Pages workflow to finish successfully.
5. Re-open production pages and verify changed routes, key links, fallback behavior, canonical subpaths, and intended layout.
6. Confirm local `HEAD` equals `origin/main`, worktree is clean, and stop only the recorded preview PID. Do not use broad process-kill commands.

## Reporting

Use a concise release report containing commit URL, deployment workflow URL, live routes, exact scope, check/build result, Lighthouse measurements, and honest third-party caveats. State clearly when a public analytics counter is cached or remains zero. State that review artifacts were kept out of the repository.

## Decision Rules

- If a user says a new layout is ugly, remove the visual intrusion before proposing another enhancement.
- If an external iframe fails in automation but the official direct page works, preserve a stable parent and provide a direct fallback; do not fabricate a replacement number.
- If content is long but valuable, hide depth behind an explicit disclosure instead of deleting it.
- If a change mainly benefits desktop hover behavior, verify it does not degrade touch or keyboard use.
- If a deploy workflow emits non-blocking platform deprecation notices but completes successfully, report deployment success unless the notice affects the build.
