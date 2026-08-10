import os from 'node:os';

const FRONTEND_PORTS = [7333, 5173, 3000, 4173];

/**
 * Returns every non-loopback, non-link-local IPv4 address currently assigned
 * to any network interface on this machine.
 *
 * Uses Node's built-in `os.networkInterfaces()` — no native addons, no shell
 * commands, works on Windows / macOS / Linux equally.
 */
export function getLocalNetworkIPs(): string[] {
  const ips: string[] = [];

  for (const ifaces of Object.values(os.networkInterfaces())) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&           // skip loopback (127.x.x.x)
        !iface.address.startsWith('169.254') // skip link-local (APIPA)
      ) {
        ips.push(iface.address);
      }
    }
  }

  return ips;
}

/**
 * Builds the complete list of origins that should be allowed in CORS /
 * Socket.IO.  Includes:
 *   • http://localhost:<port> and http://127.0.0.1:<port>
 *   • http://<every-LAN-ip>:<port>  for each frontend port
 *   • Any extra origins passed in (e.g. CLIENT_ORIGIN from .env)
 */
export function buildAllowedOrigins(extraOrigins: string[] = []): string[] {
  const localIps = getLocalNetworkIPs();

  const origins = new Set<string>(extraOrigins.filter(Boolean));

  for (const port of FRONTEND_PORTS) {
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);

    for (const ip of localIps) {
      origins.add(`http://${ip}:${port}`);
    }
  }

  return Array.from(origins);
}

/**
 * Convenience: returns true if the given `origin` matches any
 * auto-detected LAN IP (any frontend port) or the static extra origins.
 */
export function isOriginAllowed(origin: string, extraOrigins: string[] = []): boolean {
  // Re-built each call so it always reflects the current IP state.
  // The list is tiny (<20 entries), so there is no performance concern.
  return buildAllowedOrigins(extraOrigins).includes(origin);
}
