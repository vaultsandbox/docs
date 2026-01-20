---
title: Spam Analysis
description: Configure spam detection for incoming emails using Rspamd integration
---

The Gateway integrates with [Rspamd](https://rspamd.com/) to provide spam analysis for incoming emails. When enabled, each email is analyzed and scored, with results included in the email metadata.

## Overview

Spam analysis is an optional feature that:

- Analyzes emails using Rspamd's detection engine
- Returns spam scores and triggered rules (symbols)
- Provides actionable recommendations (reject, add header, etc.)
- Operates at both global and per-inbox levels

## Requirements

- Rspamd service running and accessible
- Gateway configured to connect to Rspamd

## Quick Setup with Docker Compose

The simplest way to enable spam analysis is to run Rspamd alongside the gateway:

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest
    container_name: vaultsandbox-gateway
    restart: unless-stopped

    ports:
      - '25:25'   # SMTP
      - '80:80'   # HTTP (ACME challenges)
      - '443:443' # HTTPS (Web UI + API)

    environment:
      VSB_VSX_DNS_ENABLED: 'true'
      VSB_ENCRYPTION_ENABLED: 'enabled'
      # Spam Analysis - Rspamd integration
      VSB_SPAM_ANALYSIS_ENABLED: 'true'
      VSB_RSPAMD_URL: 'http://rspamd:11333'
      VSB_RSPAMD_TIMEOUT_MS: '5000'
      # VSB_RSPAMD_PASSWORD: 'optional-password'  # Only if Rspamd has auth enabled
      VSB_SPAM_ANALYSIS_INBOX_DEFAULT: 'true'

    volumes:
      - gateway-data:/app/data

    depends_on:
      - rspamd

  rspamd:
    image: rspamd/rspamd:latest
    container_name: rspamd
    restart: unless-stopped
    # Web UI only on localhost (not exposed publicly)
    ports:
      - '127.0.0.1:11334:11334'
    volumes:
      - rspamd-data:/var/lib/rspamd

volumes:
  gateway-data:
  rspamd-data:
```

## Configuration

### Environment Variables

| Variable | Default | Description |
| :------- | :------ | :---------- |
| `VSB_SPAM_ANALYSIS_ENABLED` | `false` | Enable spam analysis globally |
| `VSB_RSPAMD_URL` | `http://localhost:11333` | Rspamd worker API URL |
| `VSB_RSPAMD_TIMEOUT_MS` | `5000` | Request timeout in milliseconds |
| `VSB_RSPAMD_PASSWORD` | — | Password for Rspamd authentication (optional) |
| `VSB_SPAM_ANALYSIS_INBOX_DEFAULT` | `true` | Default spam analysis setting for new inboxes |

### VSB_SPAM_ANALYSIS_ENABLED

**Description**: Master switch to enable spam analysis. When `false`, no emails are analyzed regardless of per-inbox settings.

**Default**: `false`

**Example**:

```bash
VSB_SPAM_ANALYSIS_ENABLED=true
```

### VSB_RSPAMD_URL

**Description**: Base URL for the Rspamd worker API. The gateway sends emails to the `/checkv2` endpoint.

**Default**: `http://localhost:11333`

**Example**:

```bash
VSB_RSPAMD_URL=http://rspamd:11333
```

:::note[Port 11333 vs 11334]
Rspamd exposes two ports:
- **11333**: Worker API (used for email scanning)
- **11334**: Web interface and controller API

The gateway connects to port 11333 for analysis.
:::

### VSB_RSPAMD_TIMEOUT_MS

**Description**: Maximum time to wait for Rspamd response in milliseconds. If exceeded, the analysis returns `status: 'error'` with timeout information.

**Default**: `5000` (5 seconds)

**Example**:

```bash
VSB_RSPAMD_TIMEOUT_MS=10000  # 10 seconds
```

### VSB_RSPAMD_PASSWORD

**Description**: Password for Rspamd controller authentication. Only required if Rspamd is configured with authentication enabled.

**Default**: Not set (no authentication)

**Example**:

```bash
VSB_RSPAMD_PASSWORD=your-rspamd-password
```

### VSB_SPAM_ANALYSIS_INBOX_DEFAULT

**Description**: Default spam analysis setting for newly created inboxes when clients don't specify a preference.

**Default**: `true` (spam analysis enabled for new inboxes)

**Example**:

```bash
VSB_SPAM_ANALYSIS_INBOX_DEFAULT=false  # Disable by default for new inboxes
```

## Per-Inbox Configuration

Spam analysis can be enabled or disabled per inbox, allowing fine-grained control over which inboxes receive spam analysis.

### Creating an Inbox with Spam Analysis

When creating an inbox via the API, specify the `spamAnalysis` parameter:

```bash
curl -X POST https://your-gateway/api/inboxes \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "spamAnalysis": true
  }'
```

If `spamAnalysis` is not specified, it defaults to the value of `VSB_SPAM_ANALYSIS_INBOX_DEFAULT`.

### Behavior Hierarchy

Spam analysis follows a three-level hierarchy:

1. **Global Level** (`VSB_SPAM_ANALYSIS_ENABLED`)
   - If `false`, spam analysis is disabled for ALL emails
   - If `true`, proceeds to inbox-level check

2. **Per-Inbox Level** (`spamAnalysis` field on inbox)
   - If inbox has `spamAnalysis: false`, analysis is skipped for that inbox
   - If inbox has `spamAnalysis: true`, analysis proceeds

3. **Result**: Analysis only runs when both global and inbox settings are enabled

## Response Structure

When spam analysis is performed, the results are included in the email response under the `spamAnalysis` field:

```json
{
  "id": "email-id",
  "from": "sender@example.com",
  "to": ["recipient@your-domain.com"],
  "subject": "Test Email",
  "spamAnalysis": {
    "status": "analyzed",
    "score": 5.2,
    "requiredScore": 15.0,
    "action": "add header",
    "isSpam": false,
    "symbols": [
      {
        "name": "BAYES_SPAM",
        "score": 3.5,
        "description": "Bayes spam probability",
        "options": ["99.98%"]
      },
      {
        "name": "MISSING_MID",
        "score": 0.5,
        "description": "Message-ID header is missing"
      }
    ],
    "processingTimeMs": 45
  }
}
```

### Status Values

| Status | Description |
| :----- | :---------- |
| `analyzed` | Email was successfully analyzed |
| `skipped` | Analysis was skipped (disabled globally or per-inbox) |
| `error` | Analysis failed (timeout, connection error, etc.) |

### Action Values

Rspamd returns an action recommendation based on the spam score:

| Action | Description |
| :----- | :---------- |
| `no action` | Email is likely legitimate |
| `greylist` | Temporary rejection recommended (greylisting) |
| `add header` | Add spam header but deliver |
| `rewrite subject` | Modify subject line to indicate spam |
| `soft reject` | Temporary rejection |
| `reject` | Permanently reject the email |

### Symbols

Symbols represent the individual rules that triggered during analysis. Each symbol includes:

- `name`: Rule identifier (e.g., `BAYES_SPAM`, `DKIM_SIGNED`)
- `score`: Score contribution (positive = spam, negative = ham)
- `description`: Human-readable explanation (optional)
- `options`: Additional context or parameters (optional)

## Metrics

When spam analysis is enabled, the gateway tracks the following metrics under the `spam` object in the `/api/metrics` response:

| Metric | Description |
| :----- | :---------- |
| `spam.analyzed_total` | Total emails analyzed |
| `spam.processing_time_ms` | Total processing time in milliseconds |
| `spam.spam_detected_total` | Emails classified as spam |
| `spam.errors_total` | Analysis errors |
| `spam.skipped_total` | Skipped analyses |

## Rspamd Configuration

### Basic Setup

The default Rspamd image works out of the box. For custom configuration, mount a volume with your Rspamd config files:

```yaml
rspamd:
  image: rspamd/rspamd:latest
  volumes:
    - rspamd-data:/var/lib/rspamd
    - ./rspamd/local.d:/etc/rspamd/local.d:ro
```

### Accessing Rspamd Web UI

The Rspamd web interface runs on port 11334. For security, only expose it locally:

```yaml
rspamd:
  ports:
    - '127.0.0.1:11334:11334'  # Only accessible from localhost
```

Then access it at `http://localhost:11334` in your browser.

### Setting a Password

To enable authentication for Rspamd:

1. Generate a password hash:
   ```bash
   docker run --rm rspamd/rspamd rspamadm pw -p your-password
   ```

2. Add to `local.d/worker-controller.inc`:
   ```
   password = "$2$generated-hash-here";
   ```

3. Set `VSB_RSPAMD_PASSWORD` in the gateway:
   ```bash
   VSB_RSPAMD_PASSWORD=your-password
   ```

## Troubleshooting

### Analysis Returns "error" Status

Check if Rspamd is running and accessible:

```bash
# Test Rspamd connectivity
curl -v http://rspamd:11333/ping

# Check Rspamd logs
docker logs rspamd
```

### Timeouts

If analysis frequently times out:

1. Increase the timeout: `VSB_RSPAMD_TIMEOUT_MS=10000`
2. Check Rspamd resource usage
3. Ensure network connectivity between containers

### All Emails Show "skipped" Status

Verify configuration:

1. `VSB_SPAM_ANALYSIS_ENABLED=true` at global level
2. Inbox has `spamAnalysis: true` (or `VSB_SPAM_ANALYSIS_INBOX_DEFAULT=true`)
3. Gateway is running in `local` mode (spam analysis not available in `backend` mode)
