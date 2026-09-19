# Quality Gates

## Narrative

- [ ] The opening creates a meaningful question.
- [ ] The problem is defined before the solution.
- [ ] Each page has one teaching job.
- [ ] The final reveal is earned.
- [ ] The deck forms one coherent argument.
- [ ] No page exists only because a template expected it.

## Content

- [ ] Claims come from supplied content or verified sources.
- [ ] Conceptual models are labeled when necessary.
- [ ] No fake metrics, quotes, or benchmark values.
- [ ] Acronyms are introduced before use.
- [ ] The practical example is realistic.
- [ ] Facts, recommendations, and assumptions are distinguishable.

## Visuals

- [ ] Every primary visual explains a relationship.
- [ ] SVG text is readable at 1280×720.
- [ ] Connectors have a clear direction.
- [ ] Line crossings are minimized.
- [ ] One primary visual per page.
- [ ] Accent colors are restrained.
- [ ] Cards are not used as a substitute for information design.

## Motion

- [ ] Motion serves teaching.
- [ ] No essential content depends on motion.
- [ ] Reduced-motion mode is supported.
- [ ] Ambient effects do not interfere with reading.
- [ ] Page transitions are smooth but not slow.
- [ ] Continuous animation is limited.

## Technical

- [ ] One standalone HTML file.
- [ ] No broken external dependencies.
- [ ] Keyboard navigation works.
- [ ] Fullscreen works where supported.
- [ ] Overview works when included.
- [ ] Presenter notes toggle works.
- [ ] HTML has title and viewport metadata.
- [ ] SVGs have `role="img"` and `aria-label`.
- [ ] Layout works at 1440×900 and 1280×720.
- [ ] No obvious overflow or clipped controls.

## Final review questions

1. Can a viewer understand the topic without hearing the speaker?
2. Does the speaker still add useful interpretation?
3. Is the most visually impressive element also conceptually important?
4. Would removing the animation reduce understanding?
5. Does the CTA logically follow from the story?

## Neighbors (handoff boundary)

- **html-stable-publish** is the default handoff target. After the deck passes `python3 scripts/validate_deck.py <deck>.html`, automatically hand it to `html-stable-publish` for anonymous-drop hosting; the receiving skill runs its own preflight and picks the platform. The public link is part of the deliverable.
- **postplan** is the fallback publisher. Use it only when the user explicitly asks for postplan hosting instead of (or in addition to) the anonymous drop: `npx postplan upload ./<deck>.html`. postplan assigns the URL; do not hard-code it in the deck or in this skill.
- **Local-only output** is also valid: when the user explicitly says "不要部署" / "本地就行" / "给我文件就行", skip both handoffs and deliver the file path only.
- This skill produces the deck. Hosting defaults to html-stable-publish; opt-outs must be explicit.
