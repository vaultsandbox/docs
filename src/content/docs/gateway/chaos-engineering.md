---
title: Chaos Engineering
description: Simulate email delivery failures to test application resilience
---

Chaos Engineering allows you to simulate various email delivery failures to test how your application handles edge cases and failure scenarios. This feature is designed for testing environments to verify retry logic, error handling, and resilience.

## Enabling Chaos Engineering

Chaos engineering is disabled by default. To enable it, set the environment variable:

```bash
VSB_CHAOS_ENABLED=true
```

When disabled, all chaos-related API endpoints return `403 Forbidden`.

## Chaos Types

VaultSandbox supports five types of chaos injection, evaluated in priority order:

| Priority | Type | Description |
| :------- | :--- | :---------- |
| 1 | **Connection Drop** | Drops the SMTP connection before sending a response |
| 2 | **Greylist** | Simulates greylisting by rejecting initial delivery attempts |
| 3 | **Random Error** | Returns random SMTP error codes (4xx temporary or 5xx permanent) |
| 4 | **Blackhole** | Accepts the email but silently discards it |
| 5 | **Latency** | Injects delays before SMTP responses |

When multiple chaos types are enabled, only the first matching action (in priority order) is applied per email.

---

## Configuration Options

### Latency Injection

Adds artificial delays to SMTP responses to test timeout handling and slow server scenarios.

| Field | Type | Default | Description |
| :---- | :--- | :------ | :---------- |
| `enabled` | boolean | — | Enable latency injection |
| `minDelayMs` | number | `500` | Minimum delay in milliseconds |
| `maxDelayMs` | number | `10000` | Maximum delay in milliseconds (max: 60000) |
| `jitter` | boolean | `true` | Randomize delay within min/max range |
| `probability` | number | `1.0` | Probability of applying delay (0.0-1.0) |

**Example:**

```json
{
  "enabled": true,
  "latency": {
    "enabled": true,
    "minDelayMs": 1000,
    "maxDelayMs": 5000,
    "jitter": true,
    "probability": 0.5
  }
}
```

### Connection Drop

Simulates network failures by dropping the TCP connection after receiving the email but before sending the response.

| Field | Type | Default | Description |
| :---- | :--- | :------ | :---------- |
| `enabled` | boolean | — | Enable connection dropping |
| `probability` | number | `1.0` | Probability of dropping (0.0-1.0) |
| `graceful` | boolean | `true` | `true` = TCP FIN (graceful), `false` = TCP RST (abrupt) |

**Example:**

```json
{
  "enabled": true,
  "connectionDrop": {
    "enabled": true,
    "probability": 0.3,
    "graceful": false
  }
}
```

### Random Error

Returns random SMTP error codes to test error handling and retry logic.

| Field | Type | Default | Description |
| :---- | :--- | :------ | :---------- |
| `enabled` | boolean | — | Enable random errors |
| `errorRate` | number | `0.1` | Error rate (0.0-1.0, e.g., 0.1 = 10% failure) |
| `errorTypes` | array | `["temporary"]` | Error types: `temporary` (4xx) and/or `permanent` (5xx) |

**Temporary Errors (4xx)** — Client should retry:
- `421` - Service temporarily unavailable
- `450` - Mailbox busy, try again later
- `451` - Temporary processing error
- `452` - Insufficient storage

**Permanent Errors (5xx)** — Client should not retry:
- `550` - Mailbox not found
- `551` - User not local
- `552` - Message size exceeds limit
- `553` - Mailbox name invalid
- `554` - Transaction failed

**Example:**

```json
{
  "enabled": true,
  "randomError": {
    "enabled": true,
    "errorRate": 0.2,
    "errorTypes": ["temporary", "permanent"]
  }
}
```

### Greylisting

Simulates greylisting behavior where initial delivery attempts are rejected, but subsequent retries succeed.

| Field | Type | Default | Description |
| :---- | :--- | :------ | :---------- |
| `enabled` | boolean | — | Enable greylisting simulation |
| `retryWindowMs` | number | `300000` | Time window for tracking retries (ms, default: 5 min) |
| `maxAttempts` | number | `2` | Accept after N delivery attempts |
| `trackBy` | string | `ip_sender` | How to identify retries: `ip`, `sender`, or `ip_sender` |

**Example:**

```json
{
  "enabled": true,
  "greylist": {
    "enabled": true,
    "retryWindowMs": 60000,
    "maxAttempts": 3,
    "trackBy": "ip_sender"
  }
}
```

### Blackhole

Accepts emails normally but discards them instead of storing. Useful for testing scenarios where emails "disappear" without errors.

| Field | Type | Default | Description |
| :---- | :--- | :------ | :---------- |
| `enabled` | boolean | — | Enable blackhole mode |
| `triggerWebhooks` | boolean | `false` | Whether to still trigger webhooks for blackholed emails |

**Example:**

```json
{
  "enabled": true,
  "blackhole": {
    "enabled": true,
    "triggerWebhooks": false
  }
}
```

---

## Auto-Expiration

Chaos configurations can be set to auto-expire to prevent accidentally leaving chaos enabled:

```json
{
  "enabled": true,
  "expiresAt": "2025-01-15T12:00:00Z",
  "latency": {
    "enabled": true,
    "minDelayMs": 2000,
    "maxDelayMs": 5000
  }
}
```

After the `expiresAt` timestamp, chaos rules are ignored and emails are processed normally.

---

## API Endpoints

All chaos endpoints require `VSB_CHAOS_ENABLED=true` and authentication via the `X-API-Key` header.

### Configure Chaos at Inbox Creation

Set chaos configuration when creating an inbox:

```bash
curl -X POST https://your-gateway/api/inboxes \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "chaos": {
      "enabled": true,
      "latency": {
        "enabled": true,
        "minDelayMs": 1000,
        "maxDelayMs": 3000
      }
    }
  }'
```

### Get Chaos Configuration

```bash
GET /api/inboxes/:emailAddress/chaos
```

**Response:**

```json
{
  "enabled": true,
  "latency": {
    "enabled": true,
    "minDelayMs": 1000,
    "maxDelayMs": 3000,
    "jitter": true,
    "probability": 1.0
  }
}
```

### Update Chaos Configuration

```bash
POST /api/inboxes/:emailAddress/chaos
```

**Request Body:**

```json
{
  "enabled": true,
  "randomError": {
    "enabled": true,
    "errorRate": 0.5,
    "errorTypes": ["temporary"]
  }
}
```

### Disable Chaos

```bash
DELETE /api/inboxes/:emailAddress/chaos
```

Returns `204 No Content` on success.

---

## Metrics

Chaos events are tracked in the metrics endpoint (`GET /api/metrics`):

| Metric | Description |
| :----- | :---------- |
| `chaos.events_total` | Total chaos events triggered |
| `chaos.latency_injected_ms` | Total milliseconds of latency injected |
| `chaos.errors_returned_total` | Total random errors returned |
| `chaos.connections_dropped_total` | Total connections dropped |
| `chaos.greylist_rejections_total` | Total greylist rejections |
| `chaos.blackhole_total` | Total emails blackholed |

---

## Use Cases

### Testing Retry Logic

Configure random temporary errors to verify your application retries failed deliveries:

```json
{
  "enabled": true,
  "randomError": {
    "enabled": true,
    "errorRate": 0.5,
    "errorTypes": ["temporary"]
  }
}
```

### Testing Timeout Handling

Inject latency to test timeout and slow-server handling:

```json
{
  "enabled": true,
  "latency": {
    "enabled": true,
    "minDelayMs": 10000,
    "maxDelayMs": 30000
  }
}
```

### Simulating Greylisting

Test that your email system correctly retries after greylist rejections:

```json
{
  "enabled": true,
  "greylist": {
    "enabled": true,
    "maxAttempts": 2,
    "retryWindowMs": 300000
  }
}
```

### Testing Missing Email Scenarios

Use blackhole mode to test how your application handles "lost" emails:

```json
{
  "enabled": true,
  "blackhole": {
    "enabled": true
  }
}
```

---

## Web Interface

When chaos is enabled for an inbox, the Web UI displays:
- Chaos status indicator in the mailbox sidebar
- Chaos configuration button in the inbox header
- Real-time chaos events in the SSE console

---

## Security Considerations

- Chaos engineering is disabled by default (`VSB_CHAOS_ENABLED=false`)
- All chaos API endpoints require API key authentication
- Consider using `expiresAt` to auto-disable chaos configurations
- Monitor chaos metrics to detect misconfiguration
