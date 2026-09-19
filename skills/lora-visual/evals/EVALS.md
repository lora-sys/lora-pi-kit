# lora-visual v1.1.1 acceptance tests

## Mode A — explanatory image

Prompt:

```text
Use $lora-visual in Mode A.

Create one finished explanatory image.

Title:
Agent Harness 的工作流程

Exact labels:
目标
计划
工具调用
反馈
结果

Show one left-to-right workflow.
Use lora + Mochi together once as a narrative anchor. Mochi is required.
No other readable text.
```

Pass only when:

- output is one final image, not a board/contact sheet
- title is exact
- all five labels are exact and appear once
- no extra readable text appears
- lora + Mochi appear once
- the workflow remains obvious without reading the labels
- palette remains black / cream / amber
- no purple-blue AI SaaS styling
- no more than two targeted text-repair attempts are made
- text still wrong after the second repair triggers Mode B plus deterministic SVG typography instead of another bitmap retry

Golden reference:

`assets/golden/mode-a/agent-harness-workflow.png`

## Mode B — transparent illustration

Prompt:

```text
Use $lora-visual in Mode B.

Create one reusable lora + Mochi thinking asset. Both characters are required.
No text.
```

Pass only when:

- one reusable asset is produced
- source is on a uniform chroma-key background
- a background-only failure gets exactly one background replacement edit without redrawing the subject
- `scripts/validate_mode_b.py source.png --expected-key '#00FF00'` passes before removal
- `scripts/cutout.py` is actually run
- `scripts/validate_mode_b.py source.png transparent.png --expected-key '#00FF00'` passes after removal
- final output is RGBA PNG
- four corners have alpha 0
- subject is complete and not cropped
- lora identity matches the canonical reference
- Mochi appears with lora as a recognizable, complete warm-cream fluffy dog
- the amber hair clip is blank and contains no letters or symbols
- no checkerboard or presentation board is treated as transparency

Golden references live in:

`assets/golden/mode-b/`

## Automated validator tests

Run:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

The suite must cover a clean pass plus failures for background variation, opaque corners, key-color fringe, and a subject touching the border.
