---
name: chinese-ai-resume
description: Create or materially revise a one-page Chinese ATS-friendly resume for AI Agent, LLM application, AI engineering, or AI full-stack internships. Use when a user asks to turn GitHub projects, a portfolio, education, experience, and verified technical evidence into a polished Chinese PDF/DOCX resume, especially when they need project selection, human-sounding project descriptions, public links, a blue technology-style layout, or ATS/link validation.
---

# Chinese AI resume

Create a factual, single-page Chinese resume that helps an interviewer understand what the candidate built, why key choices were made, what failed or remained incomplete, and what can be verified. Default output is an editable DOCX plus a PDF; use the blue technology-style template only when the user wants this visual direction or gives no conflicting design reference.

## Decide the task path

1. **Create a resume from source material.** Follow the full workflow below.
2. **Revise an existing resume.** Extract the current facts, compare them against repositories and supplied evidence, then replace weak or unsupported claims. Keep a user-approved visual reference unless the user requests a redesign.
3. **Create a targeted variant.** Keep the same facts. Change project order, title, summary, skills, and emphasis for the target role. Do not invent a tool, metric, company outcome, or production deployment to force a match.

## Full workflow

### 1. Collect the fact base before drafting

Request or locate: the target job direction, contact details, education, experience, GitHub account, portfolio links, and user-approved project documents. If the candidate authorizes GitHub access, inspect the repositories before choosing flagship projects.

Create a fact sheet for each serious candidate project using [references/project-fact-template.md](references/project-fact-template.md). Record architecture, personal contribution, quality evidence, and known limitations separately. Treat README claims, test reports, source code, commits, demos, and CI output as evidence. Treat unverified descriptions as leads, not resume facts.

Rank projects by all of the following: relevance to the target role, technical depth, readable public evidence, test or demo quality, and ability to explain decisions. Choose at most three flagship projects. Put small experiments, skills, tutorials, or tangential work in “其他作品”.

### 2. Write content the interviewer can check

Read [references/writing-rules.md](references/writing-rules.md) before drafting. Use direct Chinese. State the specific problem, the candidate's action, the reason or constraint, and an explainable result. Avoid generic self-evaluation and stacks of technology names.

Use this section order unless a user-provided reference requires another order:

1. Name and direct target role.
2. Two-line contact block. Put phone, email, city, graduation and availability first. Put portfolio and GitHub second.
3. Education and verified awards.
4. Grouped professional skills.
5. Experience.
6. Project experience.
7. Other public works.
8. Evidence-based personal strengths.

For every flagship project, use this exact content pattern:

```text
[项目名]（一句定位）｜[时间]
GitHub 开源：[可读链接]
项目介绍：[2 至 3 句，交代对象、问题、系统处理方式和真实现状。]
主要工作：
1. [架构或数据流。]
2. [关键决策与理由。]
3. [难点、失败或风险处理。]
4. [测试、演示或可复现质量证据。]
5. [真实边界或后续项。]
```

Use five items only when the facts support five distinct claims. Do not hide a Mock, Replay, single-machine MVP, unfinished live run, or external runtime block. State it plainly.

### 3. Prepare resume JSON

Copy [templates/resume-data-template.json](templates/resume-data-template.json) to the working directory and replace every bracketed placeholder with verified candidate data. Keep every URL public and valid. Each skill must map to a project or experience the candidate can explain.

The supplied template is deliberately compact. Before adding more content, remove weak projects and repeated tool names. One page is a selection constraint, not a reason to reduce every item to jargon.

### 4. Generate the DOCX and PDF

Run the reusable generator from the skill directory. It uses common Chinese/English fonts, native document text, hyperlink relationships, A4 dimensions, blue section bars, and compact spacing.

```bash
python scripts/build_tech_resume.py \
  --input /path/to/resume.json \
  --docx /path/to/output/resume.docx \
  --pdf /path/to/output/resume.pdf
```

If the result overflows one page, first shorten repetition, move low-signal projects to the portfolio, and consolidate similar skills. Adjust type size or margins only after content trimming. Do not solve overflow by turning body text into an image or unreadably small copy.

### 5. Validate the deliverable

Read [references/ats-checklist.md](references/ats-checklist.md) and run the script with every public link and the headings expected in the final resume.

```bash
python scripts/verify_resume.py /path/to/output/resume.pdf \
  --max-pages 1 \
  --require "教育经历" \
  --require "专业技能" \
  --require "项目经历" \
  --require "其他作品" \
  --url "https://github.com/example" \
  --url "https://example.com"
```

Render or open the PDF for a final visual check. Confirm the header hierarchy, two contact lines, section bars, body readability, no clipped text, and link styling. Extracting text successfully is necessary for ATS compatibility, but it does not prove visual quality.

## Non-negotiable factual rules

- Do not invent user counts, revenue, latency, production usage, adoption, awards, tests, framework usage, or team outcomes.
- Do not claim a tool, library, deployment method, or data infrastructure unless source evidence or user confirmation supports it.
- Distinguish individual work from team work.
- Preserve material limitations such as incomplete runtime integrations, mock-only flows, or untested production claims.
- Test each URL before delivery. Replace dead links or remove them.

## Bundled resources

| Resource | Use it when |
|---|---|
| `references/project-fact-template.md` | Selecting projects, checking evidence, or preparing project bullets. |
| `references/writing-rules.md` | Drafting and editing human-sounding Chinese technical content. |
| `references/ats-checklist.md` | Checking one-page layout, text extraction, and public links. |
| `templates/resume-data-template.json` | Preparing input for the document generator. |
| `scripts/build_tech_resume.py` | Generating the editable DOCX and optional PDF. |
| `scripts/verify_resume.py` | Checking PDF pages, ATS text, mandatory headings, and URLs. |
