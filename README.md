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

Pi 0.85.1 and Node.js 22.19 or later are required. Integration was tested on Windows with Node.js 24.12.0. Linux and macOS are deployment targets, but this release does not claim host verification on them.

Install dependencies, then select an explicit isolated directory. The installer uses Pi's public Package API and verifies the bundled Skills before changing settings.

```powershell
npm ci
npm run install-kit -- --agent-dir C:/tmp/lora-test --profile test
npm run run-profile -- --agent-dir C:/tmp/lora-test -- --help
```

`run-profile` starts Pi with the selected resources and disables ambient Extension, Skill, prompt, theme and context discovery. It preserves Pi's model and credential configuration in that agentDir. Configure credentials there through Pi; never put them in the package. A direct `pi` command without this launcher retains Pi's normal ambient discovery behavior.

The `test` profile loads the locked `unslop` Skill and the local deterministic stdio MCP fixture. Other MCP definitions are optional and disabled unless both the profile and registry select them. Installing a package alone starts no MCP server. Glassbox-hosted MCP calls require a host authorization callback; local profile settings never replace Glassbox permissions.

For SDK hosts, `loadInstalledProfile(agentDir)` returns public Pi resource-loader options. Pass them to `DefaultResourceLoader`, then create the Pi session and call `session.bindExtensions({})`. On shutdown, emit `session_shutdown` with `reason: "quit"` before disposing the session so MCP subprocesses close. Glassbox uses its own authorized Tool registration and product state.

To activate a reviewed local Kit revision, provide its explicit path. The updater validates it before changing the installed package selection. It does not pull a floating branch or update Pi itself.

```powershell
npm run update-kit -- --agent-dir C:/tmp/lora-test --profile test --root C:/repos/reviewed-lora-pi-kit
```

Synchronize bundled Skills from the canonical Git repository and a full reviewed commit. The command copies Git blobs, ignores uncommitted source edits and replaces the bundled snapshot with the selected locked Skills.

```powershell
npm run sync-skills -- --source C:/repos/skills --commit 54bf1404a040395a6744549f3d4723d62022fb5b
npm test
npm run build
```

```bash
npm run doctor
```

## License

MIT
