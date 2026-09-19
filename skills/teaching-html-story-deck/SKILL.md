---
name: teaching-html-story-deck
description: "Create or upgrade standalone interactive teaching HTML story decks with problem-first narrative, content-specific inline SVG diagrams, presenter notes, keyboard navigation, responsive layout, and accessibility checks. Use for teaching HTML, 讲解页, 教学网页, 教学演示, story deck, explainer webpage, course page, 架构可视化, 产品/系统设计 walkthrough, 升级既有 HTML 演示页, 出一份 HTML 报告, B 站/抖音讲解页. Do not use for: copying a single short article to HTML, marketing landing pages without a teaching arc, dashboards, or any task whose output is not a self-contained HTML file. Default delivery contract: after producing the deck, automatically hand it to html-stable-publish for anonymous-drop hosting and return the public link as part of the deliverable; only fall back to local-file-only / postplan when the user explicitly asks for it."
license: MIT
---

# Teaching HTML Story Deck

Create a polished, self-contained teaching webpage that explains a topic through a coherent story. Do not produce a generic dashboard or a collection of unrelated cards.

The default deliverable is one `.html` file containing HTML, CSS, JavaScript, inline SVG, presenter notes, keyboard controls, responsive behavior, and reduced-motion support.

## Core promise

Transform raw content into:

```text
Problem
→ Why it matters
→ Use cases and boundaries
→ Mental model
→ Core method
→ Data flow
→ Architecture / mind map
→ Practical example
→ Decision / result
→ Final reveal / CTA
```

The final product, Skill, repository, framework, or CTA should usually appear only after the audience understands the problem and method.

## Non-negotiable principles

1. **Narrative before decoration.** Decide what the audience must understand, and in what order, before choosing visuals.
2. **Show relationships.** Turn sequence, dependency, authority, scope, uncertainty, and transformation into visuals rather than repeated bullet lists.
3. **Generate visuals from the content.** Do not reuse the same diagram blindly.
4. **Motion explains state.** Animation should reveal hierarchy, direction, progress, uncertainty, or state change.
5. **One file, no build step.** Inline CSS, JavaScript, and SVG. Avoid CDNs, external fonts, frameworks, and remote images unless requested.
6. **High finish, restrained design.** Prefer near-black surfaces, large typography, fine borders, sparse luminous accents, subtle grids, and quiet depth.
7. **No invented evidence.** Never fabricate metrics, benchmarks, quotes, user counts, or research results.
8. **Label conceptual models.** A proposed mental model is not measured data.
9. **The deck must work without animation.** Respect `prefers-reduced-motion`.
10. **Do not imitate brands exactly.** Borrow broad qualities such as precision and restraint; never copy logos, proprietary illustrations, or exact branded layouts.

## Default user preferences

Read `references/user-preferences.md` before designing unless the user explicitly asks for a different style.

## Workflow

### 1. Understand the teaching job

Extract:

- topic and source material;
- target audience and starting knowledge;
- final understanding or action;
- facts that must remain exact;
- concepts that may be shown as models;
- delivery context: desktop, Bilibili, Douyin, blog, course, or product demo;
- desired final reveal;
- existing HTML that should be preserved or upgraded.

Do not ask a question when the context is already sufficient. Make a best-effort assumption and note it in presenter notes when necessary.

### 2. Build the narrative spine

Create a page blueprint before coding.

Default sequence when appropriate:

1. Hook or contradiction;
2. Problem definition;
3. Use cases and trigger boundary;
4. Principle or mental model;
5. Core method;
6. Content-specific data flow;
7. Architecture or mind map;
8. Practical before/after example;
9. Progress, evidence, or operating decision;
10. Final reveal and CTA.

Shorten or reorder the sequence to fit the subject. Never force ten pages.

Read `references/story-and-visual-framework.md`.

### 3. Map concepts to visuals

For every major idea, determine the relationship type:

- ordered transformation → flow or pipeline;
- simultaneous components → architecture graph;
- one core with related capabilities → radial mind map;
- trigger conditions → 2×2 matrix;
- sequence over time → timeline;
- uncertainty becoming execution → Hill Chart or confidence curve;
- input/output change → before/after;
- responsibility and authority → role-permission graph;
- approval criteria → evidence gate;
- repeating improvement → feedback loop;
- inclusion/exclusion → scope boundary map;
- message exchange → sequence diagram.

Use one primary visual per page. Read `references/story-and-visual-framework.md`.

### 4. Generate content-specific SVG

Read `references/svg-and-motion-system.md`.

Requirements:

- inline SVG only by default;
- readable labels and a clear reading direction;
- minimal line crossings;
- semantic groups;
- arrow markers for directional paths;
- animation only on meaningful paths or states;
- `role="img"` and `aria-label`;
- labels large enough at 1280×720;
- nearby text explanation for complex diagrams.

Do not create pseudo-technical complexity. Remove any node that does not affect the explanation.

### 5. Define the motion system

Default layers:

- ambient: subtle grid, grain, pointer glow;
- transition: page enter/exit;
- reveal: staged title, thesis, visual, details;
- semantic: path flow, pulse, progress, state change;
- interaction: hover lift, overview, presenter notes, fullscreen.

Use CSS first. JavaScript should mainly control navigation, pointer position, toggles, and simple state changes.

### 6. Implement the single-file deck

Minimum controls:

- previous / next;
- left and right arrows;
- space for next;
- Home / End;
- `F` fullscreen;
- `O` overview for multi-page decks;
- `N` presenter notes when notes exist.

Use CSS variables for the design system. Default to one primary accent and at most one supporting semantic accent.

### 7. Add presenter support

Each page should contain a hidden note with:

- the purpose of the page;
- the transition from the previous page;
- the main sentence to say;
- what not to over-explain.

Presenter notes are hidden by default and toggled with `N`.

### 8. Validate

Run:

```bash
python scripts/validate_deck.py output.html
```

Check:

- problem appears before solution;
- each page has one teaching job;
- SVG labels are readable;
- keyboard navigation works;
- fullscreen and overview work where included;
- reduced-motion is supported;
- no external dependencies unless requested;
- no fake data;
- final reveal follows naturally;
- the output is genuinely one file.

Read `references/quality-gates.md`.

## Upgrade mode

When improving an existing HTML:

1. preserve useful content and structure;
2. diagnose narrative, hierarchy, diagram, motion, and accessibility problems;
3. improve hierarchy before adding effects;
4. replace generic cards with content-specific visuals where helpful;
5. keep the file standalone;
6. create a new output file unless destructive overwrite is requested.

## Default style

Use **precision dark editorial**:

- near-black background;
- restrained monochrome panels;
- fine borders;
- large editorial typography;
- subtle grid and grain;
- sparse fluorescent yellow-green accent;
- quiet spatial depth;
- advanced but restrained motion.

This is inspired by qualities associated with modern developer products such as clarity, precision, and continuity—not exact brand imitation.

## Output contract

Deliver:

1. the final standalone HTML;
2. a concise explanation of the narrative and controls;
3. assumptions or unverified conceptual models;
4. optionally a story blueprint and visual map when ongoing editing is useful.

## Delivery contract (default handoff)

The default delivery path is **automatic anonymous-drop hosting** — do not ask the user "要不要部署" unless they have already said they want local-only output.

1. After the deck passes `python3 scripts/validate_deck.py <deck>.html`, automatically invoke the `html-stable-publish` skill to upload the file and return the public link as part of the deliverable.
2. If the user explicitly says "不要部署" / "本地就行" / "给我文件就行" — skip the handoff and deliver the file path only.
3. If the user explicitly wants postplan hosting instead of (or in addition to) the anonymous drop — run `npx postplan upload ./<deck>.html`. The postplan platform picks the URL; do not hard-code a publish URL in this skill.
4. Never publish a deck that fails validation. The quality bar in `references/quality-gates.md` is non-negotiable for any handoff.

## Failure modes

Avoid:

- opening with the product name when the problem should be taught first;
- generic SaaS dashboard layouts;
- many accent colors;
- decorative 3D objects unrelated to the subject;
- paragraphs squeezed into tiny cards;
- unreadable SVG labels;
- fake quantitative charts;
- animation used to hide weak hierarchy;
- dense architecture before the problem is established;
- the same bullet-list page repeated throughout;
- external dependencies that break offline use;
- an early product reveal that weakens the story.
