# Story and Visual Framework

## Default narrative spine

### 1. Hook

Open with contradiction, tension, or a surprising consequence.

Examples:

- “AI writes code faster. Why do projects still fail?”
- “Every Agent completed its task. Why can the user not finish one workflow?”
- “The problem is not execution. It is starting the wrong project.”

### 2. Problem definition

Name the actual failure mode:

- current behavior;
- why it appears reasonable;
- hidden cost;
- one-sentence problem statement.

### 3. Use cases and trigger boundary

Show when the method applies and when it does not.

Preferred visual: 2×2 matrix, spectrum, or inclusion/exclusion map.

### 4. Principle

Introduce the central mental move, such as:

- fix time, flex scope;
- one source of truth;
- evidence before completion;
- humans own boundary decisions.

### 5. Core method

Break the principle into a memorable sequence. Keep one page to 5–7 steps maximum.

### 6. Data flow

Show how information or decisions move. This answers “how does it work?”

### 7. Architecture or mind map

Show components, roles, permissions, and relationships. This answers “what is inside it?”

### 8. Practical demonstration

Use Before / After. The Before state should be realistic and flawed; the After state should visibly reduce ambiguity, scope, or risk.

### 9. Operating decision

Show how the loop closes, for example:

- Ship / Reshape / Kill;
- approve / reject / research;
- pass / fail Evidence Gate.

### 10. Final reveal

Only now introduce the final product, Skill, framework, repository, or CTA.

## Alternative structures

### Technical architecture lesson

```text
Failure symptom
→ constraints
→ system boundary
→ components
→ data flow
→ sequence
→ trade-offs
→ failure modes
→ demo
```

### Research explanation

```text
Question
→ previous approach
→ method
→ experiment
→ findings
→ limits
→ implications
```

### Tutorial

```text
Outcome
→ prerequisites
→ mental model
→ steps
→ state changes
→ common errors
→ final artifact
```

## Content-to-visual mapping

| Relationship | Best visual | Question answered |
|---|---|---|
| A becomes B through steps | Flow / pipeline | How does it move? |
| Components communicate | Architecture graph | What talks to what? |
| One core with related modules | Radial mind map | What belongs around the center? |
| Two variables define use | 2×2 matrix | When should it be used? |
| Ordered stages | Timeline | What happens first? |
| Uncertainty becomes execution | Hill Chart | What do we know now? |
| Input differs from output | Before / after | What changed? |
| Roles have different authority | Permission graph | Who may decide what? |
| A decision filters work | Gate | What must be true to pass? |
| Repeating improvement | Feedback loop | How does it improve? |
| Included and excluded scope | Boundary map | What is inside the cycle? |
| Multiple options lead to outcomes | Decision tree | What happens under each condition? |
| User and system exchange messages | Sequence diagram | Who calls whom and when? |

## Selection rules

- Choose the fewest elements that still explain the relationship.
- Avoid architecture diagrams when a simple flow is enough.
- Avoid charts when no quantitative data exists.
- Label conceptual charts as models, not evidence.
- One primary visual per page.
- Do not use a mind map for a strictly ordered process.
- Do not use a timeline for components that exist simultaneously.

## Page writing rule

Each page needs:

- one teaching job;
- one main sentence;
- one primary visual;
- one transition into the next page.
