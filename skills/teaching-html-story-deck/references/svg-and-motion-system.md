# SVG and Motion System

## Inline SVG structure

```html
<svg viewBox="0 0 1200 500" role="img" aria-label="Description">
  <defs>
    <marker id="arrow" ...>...</marker>
  </defs>
  <g class="node">...</g>
  <path class="flow-line" marker-end="url(#arrow)" d="..."/>
</svg>
```

## Node design

- 16–24px corner radius;
- dark fill;
- low-contrast border;
- small monospace category label;
- larger primary title;
- one supporting line;
- three text lines maximum.

## Flow paths

Use one reading direction:

- left to right;
- top to bottom;
- central source to outer nodes.

Use curved paths only to avoid collisions or express convergence.

Recommended semantic animation:

```css
.flow-line {
  stroke-dasharray: 8 9;
  animation: dash 12s linear infinite;
}
@keyframes dash {
  to { stroke-dashoffset: -280; }
}
```

Do not animate every connector. Highlight the main path.

## Architecture graph

Show only components needed for the teaching point:

- system boundary;
- source of truth;
- actors;
- data stores;
- external systems;
- direction of calls;
- human decision points.

## Radial mind map

Use a central circle for the method or system. Place 4–7 responsibilities around it. Each node should own one distinct verb: interpret, shape, constrain, review, compose, validate.

## 2×2 matrix

Label both axes and every quadrant. Highlight only the relevant quadrant. Avoid invented numerical scales.

Useful axes:

- judgment cost × execution complexity;
- frequency × severity;
- uncertainty × investment.

## Hill Chart

Use as a conceptual model for uncertainty becoming known execution.

Label:

- left: uncertainty;
- top: know how to finish;
- right: execution.

Do not imply measured progress unless real data exists.

## Permission graph

Use a shared source-of-truth node at the top. Place roles below. Add a Human Owner separately when only a human may expand scope or accept risk.

Role cards should include:

- role name;
- responsibility;
- forbidden authority.

## Motion layers

### Ambient

Optional: slow grid drift, faint grain, pointer glow, subtle radial light.

### Page transition

Use opacity, 16–30px translation, and a slight scale from about `.985` to `1`.

### Staged reveal

Reveal in this order:

1. eyebrow;
2. title;
3. thesis;
4. primary visual;
5. supporting detail.

Use 70–120ms delay increments.

### Semantic motion

Good uses:

- dashed path movement for data direction;
- pulse around a critical node;
- progress fill;
- Before → After state highlight;
- moving point representing uncertainty;
- gate opening after evidence passes.

### Interaction

Recommended: hover lift, overview mode, presenter-note toggle, fullscreen, keyboard navigation, pointer glow.

## Timing

- micro interaction: 160–280ms;
- page transition: 420–720ms;
- staged reveal: 500–900ms;
- ambient loop: 12–30s;
- semantic path loop: 8–14s.

## Reduced motion

Always include:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

## Anti-patterns

- animating every card;
- background motion faster than reading;
- particle systems unrelated to content;
- neon bloom behind paragraphs;
- multiple competing easings;
- essential information hidden behind animation;
- scroll hijacking without a fallback.
