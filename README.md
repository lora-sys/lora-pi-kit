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

## Isolated tool execution

`createDockerSandboxExecutor` is the Kit execution boundary for Pi's eight native
tools and a fixed `agent-browser` CLI. It starts a tool-only process inside a
Docker container. It never starts another model session. The service must supply
a trusted, registered workspace path, an immutable policy version and session ID,
and a Docker image reference with a SHA-256 digest. These values belong in the
Glassbox server's protected deployment configuration and authorization records.
Never accept an image, path, principal, or policy from tool arguments or workspace
files. The image digest can be the local Docker image ID returned after building
`Dockerfile.sandbox`; a floating image tag is refused at runtime.

```bash
npm ci
npm run build
docker build -f Dockerfile.sandbox -t lora-pi-kit-sandbox:reviewed .
docker image inspect lora-pi-kit-sandbox:reviewed --format '{{.Id}}'
npm run sandbox-smoke -- sha256:<the-image-id>
npm run lock-sandbox-image -- sha256:<the-image-id>
```

Pass that exact `sha256:...` image ID to `createDockerSandboxExecutor({ image })`.
Call `doctor()` before advertising tool availability. `openSession` accepts
`{ sessionId, workspacePath, writable, policyVersion, network: "none" }` and
returns `toolDefinitions` with each Pi schema and actual availability. Call
`execute({ id, name, params, signal, onUpdate })` for a native Pi tool. The
result preserves Pi text and image blocks, details, error status, and streamed
updates. `network` may also be `"public_web"` for browser-enabled sessions.
That policy starts a per-session internal Docker network and a trusted proxy
sidecar. The worker has no direct external route. The proxy permits public DNS
answers on ports 80 and 443, rejects private or special-use addresses, pins the
resolved IP, and bounds concurrency, time, and bytes. Shell commands do not get
an unrestricted network path. The default remains `"none"`.

`executeCli` accepts only the fixed `agent-browser` executable and an argument
array. Kit forces the proxy settings and returns separate bounded `stdout`,
`stderr`, and `exitCode` fields in `details`. Screenshot calls may set
`maxArtifactBytes` up to 2 MiB. Kit returns a validated PNG as
`details.artifact={mimeType:"image/png",data:<base64>,sizeBytes:<number>}`.
`cancel(id)` stops that CLI process and closes its browser daemon session. If
Kit cannot confirm the outcome, it closes the whole sandbox session. Always
call `close()`.

Each trusted `sessionId` maps to one Docker name through SHA-256. Kit marks the
container with a session hash, image, and launch token. After a server restart,
create an executor and call `ensureSessionStopped(sessionId)` for each persisted
unresolved session before releasing its workspace write lease. Kit inspects the
container labels, removes that container by its Docker ID, then inspects the ID
again. The call succeeds only when Docker confirms it is absent. A Docker error
or label mismatch leaves the lease unresolved. Recovery does not require the
old image to remain selected; the session hash and Kit ownership label identify
its container. Containers created before this mapping cannot be recovered from
`sessionId` alone and require operator verification.

The version 1 newline JSON protocol rejects oversized messages. Docker enforces
the workspace bind mount, selected network policy, nonroot user, read-only root
filesystem, temporary filesystem, process limit, memory limit, and CPU quota.
Sessions use 512 MiB and one CPU quota. The default `none` policy allows 64
processes; `public_web` allows 512 to run headless Chromium. The image lock records
these limits. Application limits cap session count and lifetime. The server must maintain cross-session
workspace write ownership and reauthorize each call. Kit does not grant product
permissions or detect exfiltration of text already present in a model prompt.
The `none` policy prevents general HTTP, including browser URLs. `public_web`
is limited to the proxy rules above. Doctor checks the agent-browser runtime,
proxy bundle, and Docker internal-network support before reporting CLI
availability.

The Docker factory accepts `dnsMode: "system" | "cloudflare_doh"`; the default
is `system`. Public web requests fail closed if system DNS returns private or
reserved addresses. Select `cloudflare_doh` explicitly when the host network
rewrites DNS answers. It queries Cloudflare over TLS at fixed resolver IPs,
validates the `cloudflare-dns.com` certificate name, checks every A and AAAA
answer, and pins the selected public IP for the connection. It never falls back
to system DNS. The sandbox image lock records the DNS mode contract and fixed
resolver addresses.

The Dockerfile pins Pi through `package-lock.json`, agent-browser to `0.38.1`,
fd to `10.5.0`, and PowerShell to the upstream `7.5.3` package hash. The Node
base image also uses a digest. `locks/sandbox-image.json` records the reviewed
runtime image and hashes of the Kit execution artifacts. Rebuild Kit with
`npm run build` before checking these hashes. A missing Docker daemon, image,
CLI, or PowerShell causes an unavailable or failed result; there is no host
execution fallback.

The `local-coding` and `herdr-worker` profiles require `run-profile` with an
absolute `--workspace` path. The launcher checks the locked image, disables
Pi's original built-in tools, then registers eight same-name tools backed by
the Docker session. It exits if the sandbox extension cannot initialize.
Herdr must obtain the workspace and write lease from its trusted scheduler;
the Kit profile does not grant access or coordinate writes with Glassbox.

```bash
npm run run-profile -- --agent-dir /trusted/pi-state --workspace /authorized/project -- --print "Inspect the project"
```

## Verification & Doctor

Pi 0.85.1 and Node.js 22.19 or later are required. Integration was tested on Windows with Node.js 24.12.0. Linux and macOS are deployment targets, but this release does not claim host verification on them.

Install dependencies, then select an explicit isolated directory. The installer uses Pi's public Package API and verifies the bundled Skills before changing settings.

```powershell
npm ci
npm run install-kit -- --agent-dir C:/tmp/lora-test --profile test
npm run run-profile -- --agent-dir C:/tmp/lora-test -- --help
```

`run-profile` starts Pi with the selected resources and disables ambient Extension, Skill, prompt, theme and context discovery. It preserves Pi's model and credential configuration in that agentDir. Configure credentials there through Pi; never put them in the package. A direct `pi` command without this launcher retains Pi's normal ambient discovery behavior.

The published package contains every Skill that passes Pi-compatible structural validation at the pinned `lora-sys/skills` commit. The `main-agent` profile exposes that reviewed catalog. Remote profiles remain narrow, and Glassbox may narrow them again with a durable per-group whitelist before a Run starts.

The `test` profile loads the locked `unslop` Skill and the local deterministic stdio MCP fixture. Other MCP definitions are optional and disabled unless both the profile and registry select them. Installing a package alone starts no MCP server. Glassbox-hosted MCP calls require a host authorization callback; local profile settings never replace Glassbox permissions.

For SDK hosts, `loadInstalledProfile(agentDir)` returns public Pi resource-loader options. Pass them to `DefaultResourceLoader`, then create the Pi session and call `session.bindExtensions({})`. On shutdown, emit `session_shutdown` with `reason: "quit"` before disposing the session so MCP subprocesses close. Glassbox uses its own authorized Tool registration and product state.

To activate a reviewed local Kit revision, provide its explicit path. The updater validates it before changing the installed package selection. It does not pull a floating branch or update Pi itself.

```powershell
npm run update-kit -- --agent-dir C:/tmp/lora-test --profile test --root C:/repos/reviewed-lora-pi-kit
```

Synchronize bundled Skills from the canonical Git repository and a full reviewed commit. The command discovers every structurally valid `SKILL.md`, validates its name and description, copies immutable Git blobs, ignores uncommitted source edits and replaces the bundled snapshot. Profiles still decide which bundled Skills Pi loads.

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
