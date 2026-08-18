# Production Deployment & Reverse Proxy Guide

This guide explains how to deploy Marekanite in production behind a TLS reverse proxy (e.g. Caddy, Traefik, or Nginx)
over a local network (LAN), VPN, or private overlay network (Tailscale/WireGuard).

> [!WARNING]
> **Network Perimeter Safety**: Do not expose port `8787` directly to the open internet without transport security and
> firewall protections. Always restrict administrative access to internal or VPN networks and configure
`MAREKANITE_ADMIN_TOKEN`.

---

## 🔒 Security & Environment Setup

1. **Configure Environment Variables**: Set `PUBLIC_API_BASE` to your external HTTPS URL so patched clients connect over
   SSL/TLS.
   ```bash
   PUBLIC_API_BASE=https://sync.example.com
   MAREKANITE_ADMIN_TOKEN=your-secure-random-token-here
   HTTP_PORT=8787
   ```

2. **Single Endpoint Architecture**: Hono serves both REST endpoints and WebSocket sync streams over the same port (
   `8787`). In production mode (`NODE_ENV=production`), Hono also serves the compiled Vue admin web interface at the
   root path (`/`).

---

## 🌐 Reverse Proxy Configuration Examples

### Caddy (Recommended)

Caddy automatically provisions SSL certificates and handles WebSocket upgrades out of the box.

```caddyfile
sync.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

### Nginx

Ensure WebSocket connection headers (`Upgrade` and `Connection`) are properly forwarded.

```nginx
server {
    listen 443 ssl http2;
    server_name sync.example.com;

    ssl_certificate     /etc/ssl/certs/sync.example.com.crt;
    ssl_certificate_key /etc/ssl/private/sync.example.com.key;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📱 Client Patching for HTTPS Deployments

1. Patch client packages using your target HTTPS origin (`https://sync.example.com`). The rewriter automatically
   upgrades sync communication to `wss://`.
2. For desktop clients, replace `obsidian.asar` as described in the [Patching Guide](patch-client.md).
3. For Android clients, install the re-signed `.apk` via WebUSB or server-managed Wi-Fi `adb`. Note that stock store
   installations must be uninstalled prior to installing re-signed builds due to key signature differences.

---

## 💡 Mixed Content Handling

If deploying over plain HTTP on LAN hostnames (e.g. `http://homelab.local:8787`), client renderers may flag HTTP
requests as insecure mixed content. To avoid connection blocks:

- Use HTTPS via local CA certificates or split-horizon DNS with Let's Encrypt.
- Or use the desktop patcher's `--profile dev` flag to enable `allowRunningInsecureContent`.
  See [Local Development](local-dev.md).

