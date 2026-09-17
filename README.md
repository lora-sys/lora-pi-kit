# @lora-sys/pi-kit

Lora's reproducible Pi distribution.

## Purpose

Lora PI Kit provides the owned environment for Lora's coding Agent, Glassbox Personal Agent execution, and Herdr delegated workers without manual reconfiguration.

```text
Pi
  Agent engine

Lora PI Kit
  Lora's Pi distribution

Glassbox
  Personal Agent system and product control plane
```

## Structure

```text
lora-pi-kit/
├── package.json         # Pi Package Manifest (keywords: ["pi-package"])
├── extensions/          # Pi Extensions
│   ├── core/            # runtime, context hooks, tool policy, notifications
│   ├── glassbox/        # policy bridge, trace hooks, taste context, feedback bridge
│   └── mcp/             # stdio JSON-RPC client, registry, tool adapter
├── skills/              # Pinned snapshot from lora-sys/skills
├── prompts/             # base, coding, review, worker prompt templates
├── profiles/            # main-agent, local-coding, owner-direct, qq-group, herdr-worker, test
├── mcp/                 # registry.json
├── config/              # settings.template.json, models.template.json
├── locks/               # pi.lock.json, skills.lock.json, compatibility.json
└── scripts/             # doctor, install, update, sync-skills
```

## Profiles

- `main-agent`: Glassbox Personal Agent runtime profile
- `local-coding`: Interactive local coding environment
- `owner-direct`: Private owner communication profile
- `qq-group`: Remote group profile with narrow safe tool surface
- `herdr-worker`: Delegated Pi worker execution under Herdr
- `test`: Deterministic test profile with isolated agentDir

## Verification & Doctor

```bash
npx tsx scripts/doctor.ts
```

## License

MIT
