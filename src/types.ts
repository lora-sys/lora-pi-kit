/**
 * Lora PI Kit core types and contracts
 */

export interface KitProfile {
  name: string;
  description: string;
  promptTemplate: string;
  thinkingLevel: "none" | "low" | "medium" | "high";
  enabledExtensions: string[];
  enabledSkills: string[];
  enabledMcpServers: string[];
  activeTools: string[];
  runtimeIsolation?: {
    defaultAgentDirSubpath?: string;
    isolateSessionState: boolean;
    disposable?: boolean;
  };
  settingsOverrides?: Record<string, unknown>;
}

export interface SkillLockEntry {
  path: string;
  sha256: string;
  bytes: number;
}

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  files: SkillLockEntry[];
}

export interface SkillsLock {
  sourceRepository: string;
  sourceCommit: string;
  syncedAt: string;
  includedSkills: string[];
  skills: Record<string, SkillMetadata>;
}

export interface PiLock {
  upstream: string;
  version: string;
  commit: string;
  packageName: string;
  npmVersion: string;
  lockedAt: string;
}

export interface CompatibilityMetadata {
  kitVersion: string;
  piVersionRange: string;
  pinnedPiVersion: string;
  nodeVersionRange: string;
  testedPiVersions: string[];
  verifiedPlatforms: string[];
  requiredExtensions: string[];
  supportedProfiles: string[];
}

export interface McpServerConfig {
  name: string;
  description?: string;
  transport: "stdio" | "sse" | "websocket";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabledProfiles?: string[];
  requiresAuth?: boolean;
}

export interface McpRegistry {
  version: string;
  servers: Record<string, McpServerConfig>;
}

export interface PolicyCheckRequest {
  toolName: string;
  input: Record<string, unknown>;
  context?: {
    principalId?: string;
    conversationId?: string;
    channel?: string;
    scopeType?: string;
  };
}

export interface PolicyCheckResult {
  allow: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

export type PolicyChecker = (req: PolicyCheckRequest) => Promise<PolicyCheckResult> | PolicyCheckResult;

export interface TraceEvent {
  id: string;
  timestamp: string;
  type: "agent_start" | "agent_end" | "turn_start" | "turn_end" | "tool_call" | "tool_result" | "usage";
  payload: Record<string, unknown>;
}

export type TraceListener = (event: TraceEvent) => void;
