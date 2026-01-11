---
title: Gateway Configuration
description: Complete reference for configuring the VaultSandbox Gateway
---

This page documents all configuration options for the VaultSandbox Gateway backend. The gateway is configured exclusively via environment variables.

## Quick Reference

All environment variables at a glance. See sections below for details.

| Variable                             | Default           | Description                        |
| :----------------------------------- | :---------------- | :--------------------------------- |
| **VSX DNS**                          |                   |                                    |
| `VSB_VSX_DNS_ENABLED`                | `false`           | Enable automatic DNS via vsx.email |
| **Custom Domain**                    |                   |                                    |
| `VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS` | —                 | Domains to accept emails for       |
| **SMTP**                             |                   |                                    |
| `VSB_SMTP_HOST`                      | `0.0.0.0`         | SMTP bind address                  |
| `VSB_SMTP_PORT`                      | `25`              | SMTP port                          |
| `VSB_SMTP_SECURE`                    | `false`           | Immediate TLS (SMTPS)              |
| `VSB_SMTP_MAX_MESSAGE_SIZE`          | `10485760`        | Max email size (bytes)             |
| `VSB_SMTP_MAX_HEADER_SIZE`           | `65536`           | Max header size (bytes)            |
| `VSB_SMTP_SESSION_TIMEOUT`           | `300000`          | Session timeout (ms)               |
| `VSB_SMTP_MAX_CONNECTIONS`           | `25`              | Max concurrent connections         |
| `VSB_SMTP_BANNER`                    | `VaultSandbox...` | SMTP greeting                      |
| **TLS/Certificates**                 |                   |                                    |
| `VSB_CERT_ENABLED`                   | `false`           | Enable Let's Encrypt               |
| `VSB_CERT_EMAIL`                     | —                 | Let's Encrypt email (optional)     |
| `VSB_CERT_DOMAIN`                    | (auto)            | Primary certificate domain         |
| `VSB_CERT_STAGING`                   | `false`           | Use staging environment            |
| `VSB_SMTP_TLS_CERT_PATH`             | —                 | Manual cert path                   |
| `VSB_SMTP_TLS_KEY_PATH`              | —                 | Manual key path                    |
| `VSB_SMTP_TLS_MIN_VERSION`           | `TLSv1.2`         | Minimum TLS version                |
| **HTTP Server**                      |                   |                                    |
| `VSB_SERVER_PORT`                    | `80`              | HTTP port                          |
| `VSB_SERVER_HTTPS_ENABLED`           | (auto)            | Enable HTTPS server                |
| `VSB_SERVER_HTTPS_PORT`              | `443`             | HTTPS port                         |
| `VSB_SERVER_ORIGIN`                  | (auto)            | CORS origin                        |
| **Local Mode**                       |                   |                                    |
| `VSB_GATEWAY_MODE`                   | `local`           | Operation mode (see note below)    |
| `VSB_LOCAL_API_KEY`                  | (auto)            | API key (min 32 chars)             |
| `VSB_LOCAL_API_KEY_STRICT`           | `false`           | Require explicit API key           |
| `VSB_DATA_PATH`                      | `/app/data`       | Data directory                     |
| `VSB_LOCAL_INBOX_DEFAULT_TTL`        | `3600`            | Default inbox TTL (seconds)        |
| `VSB_LOCAL_INBOX_MAX_TTL`            | `604800`          | Max inbox TTL (seconds)            |
| `VSB_LOCAL_CLEANUP_INTERVAL`         | `300`             | Cleanup interval (seconds)         |
| `VSB_LOCAL_ALLOW_CLEAR_ALL_INBOXES`  | `true`            | Allow DELETE /api/inboxes          |
| **Rate Limiting**                    |                   |                                    |
| `VSB_THROTTLE_TTL`                   | `60000`           | API rate limit window (ms)         |
| `VSB_THROTTLE_LIMIT`                 | `500`             | API requests per window            |
| `VSB_SMTP_RATE_LIMIT_ENABLED`        | `true`            | Enable SMTP rate limiting          |
| `VSB_SMTP_RATE_LIMIT_MAX_EMAILS`     | `500`             | Max emails per duration            |
| `VSB_SMTP_RATE_LIMIT_DURATION`       | `900`             | SMTP rate window (seconds)         |
| **Clustering**                       |                   |                                    |
| `VSB_ORCHESTRATION_ENABLED`          | `false`           | Enable distributed mode            |
| `VSB_CLUSTER_NAME`                   | `default`         | Cluster name                       |
| `VSB_NODE_ID`                        | (auto)            | Node identifier                    |
| `VSB_CLUSTER_PEERS`                  | —                 | Peer URLs                          |
| **Other**                            |                   |                                    |
| `NODE_ENV`                           | `production`      | Environment                        |
| `VSB_SSE_CONSOLE_ENABLED`            | `true`            | Enable SSE console                 |
| `VSB_DEVELOPMENT`                    | `false`           | Enable dev mode (test endpoints)   |

## Configuration Methods

You can set environment variables in:

1.  **Docker Compose** `.env` file (recommended)
2.  **System environment** variables
3.  **Docker run** command with `-e` flags

## VSX DNS Mode

The simplest way to run VaultSandbox. With VSX DNS enabled, the gateway automatically discovers your public IP, assigns a domain (e.g., `1mzhr2y.vsx.email`), and configures DNS and certificates—no manual setup required.

### VSB_VSX_DNS_ENABLED

**Description**: Enable automatic DNS configuration via [vsx.email](https://vsx.email). When enabled, the gateway auto-discovers your public IP and assigns a subdomain with proper MX records.

**Default**: `false`

**Example**:

```bash
VSB_VSX_DNS_ENABLED=true
```

**Requirements**:

- Ports 25, 80, and 443 must be publicly reachable
- No NAT or firewall blocking inbound connections

**What it configures automatically**:

- Domain assignment based on your IP (e.g., `1mzhr2y.vsx.email`)
- DNS records (A and MX)
- Let's Encrypt TLS certificates
- CORS origin

:::tip[Finding Your Domain]
After starting the gateway, find your assigned domain by entering your IP at [vsx.email](https://vsx.email) or running:

```bash
docker compose exec gateway cat /app/data/certificates/metadata.json; echo
```

:::

---

## Custom Domain Mode

Use your own domain instead of VSX DNS. Requires manual DNS configuration.

### VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS

**Description**: Comma-separated list of domains to accept emails for. The gateway will reject emails addressed to other domains. **Required when not using VSX DNS.**

**Example**:

```bash
VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS=mail.example.com,sandbox.example.com
```

**Used for**:

- SMTP RCPT TO validation
- Default domain for ACME certificates (first domain in list)
- Auto-derived CORS origin (if `VSB_SERVER_ORIGIN` not set)

:::note[Not needed with VSX DNS]
When `VSB_VSX_DNS_ENABLED=true`, the allowed recipient domain is automatically configured based on your assigned vsx.email subdomain.
:::

## SMTP Configuration

Control the behavior of the SMTP server.

### VSB_SMTP_HOST

**Description**: The network address the SMTP server binds to.

**Default**: `0.0.0.0` (All interfaces)

**Example**:

```bash
VSB_SMTP_HOST=127.0.0.1
```

### VSB_SMTP_PORT

**Description**: The port the SMTP server listens on.

**Default**: `25`

**Example**:

```bash
VSB_SMTP_PORT=2525
```

**Notes**:

- Port 25 is required for public internet email delivery.
- Binding to port 25 typically requires root privileges.

### VSB_SMTP_SECURE

**Description**: Whether the SMTP server expects an immediate TLS connection (SMTPS). NOTE: This is rarely used for public mail servers, which typically use STARTTLS on port 25.

**Default**: `false`

**Example**:

```bash
VSB_SMTP_SECURE=false
```

### VSB_SMTP_MAX_MESSAGE_SIZE

**Description**: Maximum allowed email size in bytes.

**Default**: `10485760` (10 MB)

**Example**:

```bash
VSB_SMTP_MAX_MESSAGE_SIZE=20971520 # 20MB
```

### VSB_SMTP_MAX_HEADER_SIZE

**Description**: Maximum allowed email header block size in bytes. Prevents parser DoS attacks.

**Default**: `65536` (64 KB)

**Example**:

```bash
VSB_SMTP_MAX_HEADER_SIZE=131072 # 128KB
```

### VSB_SMTP_SESSION_TIMEOUT

**Description**: Timeout for SMTP sessions in milliseconds.

**Default**: `300000` (5 minutes)

### VSB_SMTP_MAX_CONNECTIONS

**Description**: Maximum number of concurrent SMTP connections.

**Default**: `25`

### VSB_SMTP_BANNER

**Description**: Custom SMTP banner message greeting clients.

**Default**: `VaultSandbox Test SMTP Server (Receive-Only)`

**Example**:

```bash
VSB_SMTP_BANNER="My Custom SMTP Gateway"
```

### Advanced SMTP Security

| Variable                         | Default               | Description                                                     |
| :------------------------------- | :-------------------- | :-------------------------------------------------------------- |
| `VSB_SMTP_CLOSE_TIMEOUT`         | `30000`               | Time in ms to wait before force-closing a connection.           |
| `VSB_SMTP_DISABLED_COMMANDS`     | `VRFY,EXPN,ETRN,TURN` | Comma-separated list of SMTP commands to disable.               |
| `VSB_SMTP_DISABLE_PIPELINING`    | `false`               | Hide PIPELINING capability from clients.                        |
| `VSB_SMTP_EARLY_TALKER_DELAY`    | `300`                 | Delay in ms before sending banner to catch "early talker" bots. |
| `VSB_SMTP_MAX_MEMORY_MB`         | `500`                 | Maximum memory in MB for email storage (memory management).     |
| `VSB_SMTP_MAX_EMAIL_AGE_SECONDS` | `0`                   | Maximum age of stored emails in seconds (0 = no limit).         |

## TLS Configuration

Configure TLS/SSL for secure SMTP connections. TLS can be enabled via automatic certificate management (recommended) or manual certificate paths.

### Manual TLS Certificates

If not using automatic certificate management, provide paths to your certificate files:

| Variable                 | Default | Description                                    |
| :----------------------- | :------ | :--------------------------------------------- |
| `VSB_SMTP_TLS_CERT_PATH` | (empty) | Path to the TLS certificate file (PEM format). |
| `VSB_SMTP_TLS_KEY_PATH`  | (empty) | Path to the TLS private key file (PEM format). |

**Note**: Both paths must be provided together. For automatic certificate management, use `VSB_CERT_ENABLED=true` instead.

### TLS Security Settings

These settings apply to both manual and automatic TLS configurations:

| Variable                          | Default     | Description                                                    |
| :-------------------------------- | :---------- | :------------------------------------------------------------- |
| `VSB_SMTP_TLS_MIN_VERSION`        | `TLSv1.2`   | Minimum TLS version (TLSv1.2 or TLSv1.3). RFC 8996 compliance. |
| `VSB_SMTP_TLS_CIPHERS`            | (see below) | Colon-separated list of allowed cipher suites.                 |
| `VSB_SMTP_TLS_HONOR_CIPHER_ORDER` | `true`      | Prefer server cipher order over client preference.             |
| `VSB_SMTP_TLS_ECDH_CURVE`         | `auto`      | ECDH curve configuration for key exchange.                     |

**Default Cipher Suites** (prioritized for security and performance):

```
ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305
```

## Local Mode & Storage

Configuration for running the gateway in "Local Mode" (standalone), where emails are stored locally and managed via a built-in API.

### VSB_GATEWAY_MODE

**Description**: Operation mode of the gateway.

**Default**: `local`

**Options**:

- `local`: Standalone mode. Stores emails locally.
- `backend`: Proxies requests to a separate backend service.

:::caution[Backend mode not available]
Currently only `local` mode is supported. Setting `VSB_GATEWAY_MODE=backend` will throw an error as this feature is under development.
:::

### VSB_LOCAL_API_KEY

**Description**: API Key for authenticating requests in local mode. If not set, one will be auto-generated and saved to `.api-key` in the data directory.

**Requirements**: Minimum 32 characters.

**Example**:

```bash
VSB_LOCAL_API_KEY=your-secure-random-key-minimum-32-chars
```

### VSB_LOCAL_API_KEY_STRICT

**Description**: If `true`, disables auto-generation of API keys and forces the server to crash if `VSB_LOCAL_API_KEY` is not set. Recommended for production.

**Default**: `false`

### VSB_DATA_PATH

**Description**: Directory for storing persistent data (API keys, certificates).

**Default**: `/app/data`

### Inbox & Cleanup (Local Mode)

| Variable                         | Default  | Description                                                                           |
| :------------------------------- | :------- | :------------------------------------------------------------------------------------ |
| `VSB_LOCAL_INBOX_DEFAULT_TTL`    | `3600`   | Default time-to-live (seconds) for new inboxes (1 hour).                              |
| `VSB_LOCAL_INBOX_MAX_TTL`        | `604800` | Maximum allowed TTL (seconds) for any inbox (7 days).                                 |
| `VSB_LOCAL_CLEANUP_INTERVAL`     | `300`    | Interval (seconds) for the background cleanup task (5 mins).                          |
| `VSB_INBOX_ALIAS_RANDOM_BYTES`   | `4`      | Number of random bytes for inbox alias generation (4-32). Produces 2x hex characters. |
| `VSB_SMTP_HARD_MODE_REJECT_CODE` | `421`    | SMTP code used when rejecting emails in "hard mode".                                  |
| `VSB_LOCAL_ALLOW_CLEAR_ALL_INBOXES` | `true` | Allow DELETE /api/inboxes endpoint.                                                   |

### VSB_LOCAL_ALLOW_CLEAR_ALL_INBOXES

**Description**: Controls access to the `DELETE /api/inboxes` endpoint. When set to `false`, the endpoint returns `403 Forbidden`. Useful for shared testing environments to prevent accidental data loss.

**Default**: `true`

**Example**:

```bash
VSB_LOCAL_ALLOW_CLEAR_ALL_INBOXES=false
```

**Behavior**:

- `true` (default): `DELETE /api/inboxes` works normally, clearing all inboxes
- `false`: `DELETE /api/inboxes` returns 403 Forbidden with message: "Clear all inboxes is disabled (VSB_LOCAL_ALLOW_CLEAR_ALL_INBOXES=false)"

**Server Info Response**: The current setting is exposed in `GET /api/server-info` as `allowClearAllInboxes`:

```json
{
  "serverSigPk": "...",
  "algs": { ... },
  "context": "vaultsandbox:email:v1",
  "maxTtl": 604800,
  "defaultTtl": 3600,
  "sseConsole": false,
  "allowClearAllInboxes": true,
  "allowedDomains": ["example.com"]
}
```

:::tip[Use Case]
Disable this in shared QA environments where multiple users or CI pipelines share the same server instance to prevent accidental deletion of all test inboxes.
:::

## HTTP Server Configuration

### VSB_SERVER_PORT

**Description**: Port for the HTTP API server.

**Default**: `80`

### VSB_SERVER_HTTPS_ENABLED

**Description**: Enable the HTTPS server. Defaults to the value of `VSB_CERT_ENABLED`.

**Default**: `true` (when `VSB_CERT_ENABLED=true`), otherwise `false`

### VSB_SERVER_HTTPS_PORT

**Description**: Port for the HTTPS API server.

**Default**: `443`

### VSB_SERVER_ORIGIN

**Description**: Access-Control-Allow-Origin header value (CORS). If not set, auto-derived from the first domain in `VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS` with appropriate protocol.

**Default**: Auto-derived (e.g., `https://mail.example.com`)

**Example**:

```bash
VSB_SERVER_ORIGIN=https://app.example.com
# Or use wildcard for permissive CORS:
VSB_SERVER_ORIGIN=*
```

## Certificate Management (ACME / Let's Encrypt)

Variables to configure automatic SSL certificate provisioning.

### VSB_CERT_ENABLED

**Description**: Enable automatic certificate management.

**Default**: `false`

### VSB_CERT_EMAIL

**Description**: Email address for Let's Encrypt registration and certificate expiry notifications. Optional - certificates work without it.

### VSB_CERT_DOMAIN

**Description**: Primary domain for the certificate. Defaults to the first domain in `VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS`.

### VSB_CERT_ADDITIONAL_DOMAINS

**Description**: Comma-separated list of additional domains (Subject Alternative Names) to include in the certificate.

**Example**:

```bash
VSB_CERT_ADDITIONAL_DOMAINS=api.example.com,admin.example.com
```

### Advanced Certificate Config

| Variable                        | Default                                          | Description                                                 |
| :------------------------------ | :----------------------------------------------- | :---------------------------------------------------------- |
| `VSB_CERT_STAGING`              | `false`                                          | Use Let's Encrypt Staging environment (for testing).        |
| `VSB_CERT_CHECK_INTERVAL`       | `86400000`                                       | Interval (ms) to check for renewal (24 hours).              |
| `VSB_CERT_RENEW_THRESHOLD_DAYS` | `30`                                             | Renew certificate if expiring within X days.                |
| `VSB_CERT_ACME_DIRECTORY`       | `https://acme-v02.api.letsencrypt.org/directory` | ACME directory URL (override for custom CA).                |
| `VSB_CERT_PEER_SHARED_SECRET`   | (auto)                                           | Shared secret for validating P2P certificate sync requests. |

## Orchestration & Clustering

Configuration for running multiple gateway nodes.

### VSB_ORCHESTRATION_ENABLED

**Description**: Enable distributed coordination (leadership election, lock management).

**Default**: `false`

### VSB_CLUSTER_NAME

**Description**: Logical name of the cluster.

**Default**: `default`

### VSB_NODE_ID

**Description**: Unique identifier for this node. If not set, auto-generated from hostname and random bytes.

**Default**: Auto-generated (e.g., `hostname-a1b2c3d4`)

### VSB_CLUSTER_PEERS

**Description**: Comma-separated list of peer URLs for synchronization.

**Example**:

```bash
VSB_CLUSTER_PEERS=http://node1:80,http://node2:80
```

### Backend Connection

If `VSB_GATEWAY_MODE` is `backend`, or if `VSB_ORCHESTRATION_ENABLED` is `true`, these configure the connection to the upstream service.

| Variable                      | Default | Description                                     |
| :---------------------------- | :------ | :---------------------------------------------- |
| `VSB_BACKEND_URL`             | (empty) | URL of the backend service.                     |
| `VSB_BACKEND_API_KEY`         | (empty) | API Key for the backend service.                |
| `VSB_BACKEND_REQUEST_TIMEOUT` | `10000` | Timeout (ms) for backend requests.              |
| `VSB_LEADERSHIP_TTL`          | `300`   | TTL (seconds) for distributed leadership locks. |

## Rate Limiting

### API Throttling

| Variable             | Default | Description                             |
| :------------------- | :------ | :-------------------------------------- |
| `VSB_THROTTLE_TTL`   | `60000` | Time window in milliseconds (1 minute). |
| `VSB_THROTTLE_LIMIT` | `500`   | Max requests per IP per window.         |

### SMTP Rate Limiting

| Variable                         | Default | Description                              |
| :------------------------------- | :------ | :--------------------------------------- |
| `VSB_SMTP_RATE_LIMIT_ENABLED`    | `true`  | Enable per-IP rate limiting for SMTP.    |
| `VSB_SMTP_RATE_LIMIT_MAX_EMAILS` | `500`   | Max emails allowed per duration.         |
| `VSB_SMTP_RATE_LIMIT_DURATION`   | `900`   | Duration window in seconds (15 minutes). |

## Miscellaneous

| Variable                  | Default      | Description                                                                  |
| :------------------------ | :----------- | :--------------------------------------------------------------------------- |
| `NODE_ENV`                | `production` | Application environment (`development` or `production`).                     |
| `VSB_SSE_CONSOLE_ENABLED` | `true`       | Enable Server-Sent Events console for real-time logs.                        |
| `VSB_DEVELOPMENT`         | `false`      | Enable development mode. Exposes test endpoints for SDK testing (see below). |

### VSB_DEVELOPMENT

**Description**: Enables development-only features, including a test endpoint for creating emails with controlled authentication results. Useful for SDK development and testing email auth flows without SMTP infrastructure.

**Default**: `false`

**Example**:

```bash
VSB_DEVELOPMENT=true
```

:::caution[Not for production]
Never enable this in production environments. The test endpoint bypasses normal email delivery.
:::

**What it enables**:

- `POST /api/test/emails` - Create test emails with controlled SPF/DKIM/DMARC results

See the [SDK Test Specification](/sdk/tests-spec/#9-development-test-endpoint) for endpoint details and usage examples.

## Crypto / Signing

Used for quantum-safe signing of responses (ML-DSA-65 digital signatures).

| Variable                               | Default | Description                                           |
| :------------------------------------- | :------ | :---------------------------------------------------- |
| `VSB_SERVER_SIGNATURE_SECRET_KEY_PATH` | (empty) | Path to the secret key file (raw binary, 4032 bytes). |
| `VSB_SERVER_SIGNATURE_PUBLIC_KEY_PATH` | (empty) | Path to the public key file (raw binary, 1952 bytes). |

**Notes**:

- Both paths must be provided together, or neither (for ephemeral keys).
- If not provided, ephemeral keys are generated on startup (keys change on restart).
- For production, use persistent keys to maintain signature verification across restarts.
