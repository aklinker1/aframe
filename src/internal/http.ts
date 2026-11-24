const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
];

export function stripHopByHopHeaders(
  headers: Headers,
  extraStrip: string[] = [],
): Headers {
  const result = new Headers(headers);
  const named = (headers.get("connection") ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  for (const name of [...HOP_BY_HOP_HEADERS, ...named, ...extraStrip]) {
    result.delete(name);
  }
  const proxyHeaders: string[] = [];
  result.forEach((_, name) => {
    if (name.toLowerCase().startsWith("proxy-")) proxyHeaders.push(name);
  });
  for (const name of proxyHeaders) result.delete(name);
  return result;
}

export function cleanRequestHeaders(headers: Headers): Headers {
  const result = stripHopByHopHeaders(headers);
  result.set("accept-encoding", "identity");
  return result;
}

export function cleanResponseHeaders(headers: Headers): Headers {
  return stripHopByHopHeaders(headers, ["content-encoding", "content-length"]);
}

export function parseHostname(host: string): string {
  host = host.trim().toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(0, end + 1);
  }
  const colon = host.indexOf(":");
  return colon === -1 ? host : host.slice(0, colon);
}

export function isHostAllowed(
  host: string,
  allowedHosts: true | string[] | undefined,
): boolean {
  const hostname = parseHostname(host);
  if (!hostname) return false;
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  ) {
    return true;
  }
  if (allowedHosts === true) return true;
  if (!Array.isArray(allowedHosts)) return false;

  return allowedHosts.some((entry) => {
    entry = entry.toLowerCase();
    if (entry.startsWith(".")) {
      return hostname === entry.slice(1) || hostname.endsWith(entry);
    }
    return hostname === parseHostname(entry);
  });
}
