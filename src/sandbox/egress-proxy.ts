import { lookup } from "node:dns/promises";
import { createServer, request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Socket, connect } from "node:net";
import { Transform } from "node:stream";
import { checkServerIdentity } from "node:tls";

export const EGRESS_PROXY_HOST = "lora-egress-proxy";
export const EGRESS_PROXY_PORT = 3128;
export const EGRESS_MAX_CONNECTIONS = 32;
export const EGRESS_MAX_REQUESTS = 512;
export const EGRESS_MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const EGRESS_MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
export const EGRESS_MAX_TUNNEL_BYTES = 64 * 1024 * 1024;
export const EGRESS_TIMEOUT_MS = 60_000;
export type EgressDnsMode = "system" | "cloudflare_doh";
const DOH_RESOLVERS = ["1.1.1.1", "1.0.0.1"] as const;
const DOH_HOST = "cloudflare-dns.com";
const DOH_MAX_RESPONSE_BYTES = 16 * 1024;
const DOH_MAX_ANSWERS = 32;

const deniedV4 = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const;
const deniedV6 = [
  ["64:ff9b::", 96], ["64:ff9b:1::", 48],
  ["2001::", 23], ["2001:2::", 48], ["2001:10::", 28], ["2001:20::", 28],
  ["2001:30::", 28], ["2001:4:112::", 48], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const;

function ipv4Number(value: string): number | undefined {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return undefined;
  return parts.reduce((result, part) => ((result << 8) | part) >>> 0, 0);
}

function cidr4(value: string, base: string, prefix: number): boolean {
  const address = ipv4Number(value);
  const network = ipv4Number(base);
  if (address === undefined || network === undefined) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (network & mask);
}

function ipv6Number(value: string): bigint | undefined {
  if (value.includes("%")) return undefined;
  let input = value.toLowerCase();
  if (input.includes(".")) {
    const split = input.lastIndexOf(":");
    const v4 = ipv4Number(input.slice(split + 1));
    if (split < 0 || v4 === undefined) return undefined;
    input = `${input.slice(0, split)}:${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = input.split("::");
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const zeros = halves.length === 2 ? 8 - left.length - right.length : 0;
  if (zeros < 0 || (halves.length === 1 && left.length !== 8)) return undefined;
  const groups = [...left, ...Array(zeros).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/u.test(group))) return undefined;
  return groups.reduce((result, group) => (result << 16n) | BigInt(`0x${group}`), 0n);
}

function cidr6(value: bigint, base: string, prefix: number): boolean {
  const network = ipv6Number(base);
  if (network === undefined) return false;
  const shift = BigInt(128 - prefix);
  return (value >> shift) === (network >> shift);
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !deniedV4.some(([base, prefix]) => cidr4(address, base, prefix));
  if (family !== 6) return false;
  const value = ipv6Number(address);
  if (value === undefined) return false;
  const mappedPrefix = ipv6Number("::ffff:0:0");
  if (mappedPrefix !== undefined && (value >> 32n) === (mappedPrefix >> 32n)) {
    const mappedV4 = [24, 16, 0, 0].map((_, index) => Number((value >> BigInt(24 - index * 8)) & 255n)).join(".");
    return isPublicAddress(mappedV4);
  }
  if (!cidr6(value, "2000::", 3)) return false;
  return !deniedV6.some(([base, prefix]) => cidr6(value, base, prefix));
}

export interface PublicTarget {
  hostname: string;
  port: number;
  address: string;
  family: 4 | 6;
}

export function parseCloudflareDnsJson(body: string, type: "A" | "AAAA"): Array<{ address: string; family: 4 | 6 }> {
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== "object" || !("Status" in parsed) || parsed.Status !== 0) throw new Error("DoH answer status denied");
  const answers = "Answer" in parsed && Array.isArray(parsed.Answer) ? parsed.Answer : [];
  if (answers.length > DOH_MAX_ANSWERS) throw new Error("DoH answer count exceeded");
  const addresses: Array<{ address: string; family: 4 | 6 }> = [];
  for (const answer of answers) {
    if (!answer || typeof answer !== "object" || !("type" in answer) || !("data" in answer)) throw new Error("Malformed DoH answer");
    if (answer.type !== 1 && answer.type !== 28) continue;
    const family = answer.type === 1 ? 4 : 6;
    if (typeof answer.data !== "string" || isIP(answer.data) !== family) throw new Error("Malformed DoH address");
    if (!isPublicAddress(answer.data)) throw new Error("DoH returned a non-public address");
    addresses.push({ address: answer.data, family });
  }
  return addresses;
}

async function cloudflareDohAnswers(host: string, type: "A" | "AAAA"): Promise<Array<{ address: string; family: 4 | 6 }>> {
  let lastError: unknown;
  for (const resolver of DOH_RESOLVERS) {
    try {
      const body = await new Promise<Buffer>((resolve, reject) => {
        const request = httpsRequest({
          host: resolver, port: 443, method: "GET",
          path: `/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
          servername: DOH_HOST, rejectUnauthorized: true,
          checkServerIdentity: (_hostname, certificate) => checkServerIdentity(DOH_HOST, certificate),
          headers: { host: DOH_HOST, accept: "application/dns-json", connection: "close" },
          agent: false, timeout: 4_000,
        }, (response) => {
          if (response.statusCode !== 200) { response.resume(); reject(new Error("DoH status denied")); return; }
          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > DOH_MAX_RESPONSE_BYTES) {
              response.destroy(new Error("DoH response limit exceeded"));
              return;
            }
            chunks.push(chunk);
          });
          response.once("error", reject);
          response.once("end", () => resolve(Buffer.concat(chunks)));
        });
        request.once("timeout", () => request.destroy(new Error("DoH timeout")));
        request.once("error", reject);
        request.end();
      });
      return parseCloudflareDnsJson(body.toString("utf8"), type);
    } catch (error) {
      lastError = error;
      // Unsafe or malformed DNS answers must not be retried through a different source.
      if (String(error).includes("non-public") || String(error).includes("Malformed") || String(error).includes("answer status") || String(error).includes("answer count")) throw error;
    }
  }
  throw lastError ?? new Error("DoH resolution failed");
}

export async function resolvePublicTarget(hostname: string, port: number, dnsMode: EgressDnsMode = "system"): Promise<PublicTarget> {
  const host = hostname.replace(/^\[|\]$/gu, "").replace(/\.$/u, "").toLowerCase();
  if (!host || !Number.isInteger(port) || ![80, 443].includes(port)) throw new Error("Egress target port denied");
  const family = isIP(host);
  if (dnsMode !== "system" && dnsMode !== "cloudflare_doh") throw new Error("Unsupported DNS mode");
  const answers = family
    ? [{ address: host, family }]
    : dnsMode === "cloudflare_doh"
      ? [...await cloudflareDohAnswers(host, "A"), ...await cloudflareDohAnswers(host, "AAAA")]
      : await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (answers.length === 0 || answers.some((answer) => !isPublicAddress(answer.address))) {
    throw new Error("Egress target resolved to a non-public address");
  }
  const selected = answers[0]!;
  return { hostname: host, port, address: selected.address, family: selected.family as 4 | 6 };
}

function responseLimit(maxBytes: number, onLimit: () => void): Transform {
  let bytes = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        onLimit();
        callback(new Error("Egress byte limit exceeded"));
        return;
      }
      callback(null, chunk);
    },
  });
}

function authority(value: string): { host: string; port: number } {
  const parsed = new URL(`http://${value}`);
  const port = parsed.port ? Number(parsed.port) : 443;
  if (!parsed.hostname || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("Invalid CONNECT target");
  }
  return { host: parsed.hostname, port };
}

export function createEgressProxy(dnsMode: EgressDnsMode = "system") {
  if (dnsMode !== "system" && dnsMode !== "cloudflare_doh") throw new Error("Unsupported DNS mode");
  let active = 0;
  let requests = 0;
  const server = createServer((incoming, outgoing) => {
    active++;
    requests++;
    outgoing.once("close", () => { active--; });
    if (active > EGRESS_MAX_CONNECTIONS || requests > EGRESS_MAX_REQUESTS) {
      outgoing.writeHead(429, { connection: "close" }).end();
      return;
    }
    void proxyHttp(incoming, outgoing);
  });

  server.on("connect", (request, client, head) => {
    active++;
    requests++;
    let closed = false;
    let remote: Socket | undefined;
    let clientToServerBytes = 0;
    let serverToClientBytes = 0;
    const finish = () => {
      if (closed) return;
      closed = true;
      active--;
    };
    client.once("close", () => {
      remote?.destroy(); finish();
    });
    if (active > EGRESS_MAX_CONNECTIONS || requests > EGRESS_MAX_REQUESTS) {
      client.end("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
      return;
    }
    const timer = setTimeout(() => { client.destroy(); }, EGRESS_TIMEOUT_MS);
    let targetPromise: Promise<PublicTarget>;
    try {
      const { host, port } = authority(request.url ?? "");
      targetPromise = resolvePublicTarget(host, port, dnsMode);
    } catch {
      clearTimeout(timer);
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      finish();
      return;
    }
    void targetPromise.then((target) => {
      if (closed) return;
      const outgoing = connect({ host: target.address, family: target.family, port: target.port });
      remote = outgoing;
      let tunnelBytes = 0;
      const createTunnelLimit = (direction: "client" | "server") => new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          tunnelBytes += chunk.length;
          if (direction === "client") clientToServerBytes += chunk.length;
          else serverToClientBytes += chunk.length;
          if (tunnelBytes > EGRESS_MAX_TUNNEL_BYTES) {
            client.destroy(); outgoing.destroy();
            callback(new Error("Egress tunnel byte limit exceeded"));
            return;
          }
          callback(null, chunk);
        },
      });
      const clientLimit = createTunnelLimit("client");
      const serverLimit = createTunnelLimit("server");
      const abortTunnel = (error: Error) => {
        console.error(`[egress] CONNECT tunnel failed code=${(error as NodeJS.ErrnoException).code ?? "unknown"} clientBytes=${clientToServerBytes} serverBytes=${serverToClientBytes}`);
        client.destroy();
        outgoing.destroy();
        finish();
      };
      client.once("error", abortTunnel);
      outgoing.once("error", abortTunnel);
      clientLimit.once("error", abortTunnel);
      serverLimit.once("error", abortTunnel);
      outgoing.once("connect", () => {
        client.write("HTTP/1.1 200 Connection Established\r\nConnection: keep-alive\r\n\r\n");
        if (head.length) outgoing.write(head);
        client.pipe(clientLimit).pipe(outgoing);
        outgoing.pipe(serverLimit).pipe(client);
      });
      outgoing.setTimeout(EGRESS_TIMEOUT_MS, () => outgoing.destroy());
      outgoing.once("close", finish);
      (client as Socket).setTimeout(EGRESS_TIMEOUT_MS, () => client.destroy());
    }).catch(() => {
      if (!closed) client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      finish();
    }).finally(() => clearTimeout(timer));
  });

  async function proxyHttp(incoming: IncomingMessage, outgoing: import("node:http").ServerResponse): Promise<void> {
    try {
      if (incoming.method === "CONNECT") throw new Error("Invalid proxy request");
      const targetUrl = new URL(incoming.url ?? "");
      if (targetUrl.protocol !== "http:" || targetUrl.username || targetUrl.password) throw new Error("HTTP proxy target denied");
      const port = targetUrl.port ? Number(targetUrl.port) : 80;
      const target = await resolvePublicTarget(targetUrl.hostname, port, dnsMode);
      const headers = { ...incoming.headers };
      for (const name of ["connection", "proxy-connection", "proxy-authorization", "proxy-authenticate", "keep-alive", "te", "trailer", "transfer-encoding", "upgrade"]) {
        delete headers[name];
      }
      headers.host = targetUrl.host;
      headers.connection = "close";
      const upstream = httpRequest({
        host: target.address,
        family: target.family,
        port: target.port,
        method: incoming.method,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        headers,
        agent: false,
        timeout: EGRESS_TIMEOUT_MS,
      }, (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.statusMessage, response.headers);
        response.pipe(responseLimit(EGRESS_MAX_RESPONSE_BYTES, () => outgoing.destroy()))
          .on("error", () => outgoing.destroy()).pipe(outgoing);
      });
      upstream.setTimeout(EGRESS_TIMEOUT_MS, () => upstream.destroy(new Error("Egress request timeout")));
      upstream.once("error", () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
      incoming.pipe(responseLimit(EGRESS_MAX_REQUEST_BYTES, () => upstream.destroy(new Error("Egress request limit exceeded"))))
        .on("error", () => { if (!outgoing.headersSent) outgoing.writeHead(413); outgoing.end(); }).pipe(upstream);
    } catch {
      outgoing.writeHead(403, { connection: "close" }).end();
    }
  }

  return server;
}

if (process.env.LORA_EGRESS_PROXY === "1") {
  const dnsMode = process.env.LORA_EGRESS_DNS_MODE ?? "system";
  if (dnsMode !== "system" && dnsMode !== "cloudflare_doh") throw new Error("Unsupported DNS mode");
  const server = createEgressProxy(dnsMode);
  server.listen(EGRESS_PROXY_PORT, "0.0.0.0");
  const stop = () => server.close(() => process.exit(0));
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
