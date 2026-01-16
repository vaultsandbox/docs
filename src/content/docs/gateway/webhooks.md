---
title: Webhooks
description: Real-time HTTP notifications for email events in VaultSandbox Gateway
---

VaultSandbox provides a webhooks system that enables real-time HTTP notifications for email events. Configure webhooks to trigger CI/CD pipelines, send notifications to Slack/Discord, or integrate with any HTTP endpoint.

## Overview

Webhooks support two scopes:

- **Global Webhooks**: Receive events from all inboxes
- **Inbox Webhooks**: Receive events from a specific inbox only

All webhook deliveries are cryptographically signed (HMAC-SHA256) and include automatic retry logic with exponential backoff.

## Supported Events

| Event Type | Trigger | Use Case |
| :--------- | :------ | :------- |
| `email.received` | Email arrives at inbox | Real-time notifications, CI/CD triggers |
| `email.stored` | Email persisted to storage | Audit logging, metrics collection |
| `email.deleted` | Email removed (manual, TTL, or eviction) | Compliance tracking, cleanup verification |

## API Endpoints

All endpoints require authentication via the `X-API-Key` header.

### Global Webhooks

| Method | Endpoint | Description |
| :----- | :------- | :---------- |
| `POST` | `/api/webhooks` | Create webhook |
| `GET` | `/api/webhooks` | List webhooks |
| `GET` | `/api/webhooks/:id` | Get webhook details |
| `PATCH` | `/api/webhooks/:id` | Update webhook |
| `DELETE` | `/api/webhooks/:id` | Delete webhook |
| `POST` | `/api/webhooks/:id/test` | Send test event |
| `POST` | `/api/webhooks/:id/rotate-secret` | Rotate signing secret |
| `GET` | `/api/webhooks/templates` | Get available templates |
| `GET` | `/api/webhooks/metrics` | Get aggregated metrics |

### Inbox Webhooks

| Method | Endpoint | Description |
| :----- | :------- | :---------- |
| `POST` | `/api/inboxes/:email/webhooks` | Create webhook |
| `GET` | `/api/inboxes/:email/webhooks` | List webhooks |
| `GET` | `/api/inboxes/:email/webhooks/:id` | Get webhook details |
| `PATCH` | `/api/inboxes/:email/webhooks/:id` | Update webhook |
| `DELETE` | `/api/inboxes/:email/webhooks/:id` | Delete webhook |
| `POST` | `/api/inboxes/:email/webhooks/:id/test` | Send test event |
| `POST` | `/api/inboxes/:email/webhooks/:id/rotate-secret` | Rotate signing secret |

## Creating a Webhook

```bash
curl -X POST https://your-gateway/api/webhooks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-endpoint.com/webhook",
    "events": ["email.received"],
    "description": "Notify on new emails"
  }'
```

**Response:**

```json
{
  "id": "whk_a1b2c3d4e5f6...",
  "url": "https://your-endpoint.com/webhook",
  "events": ["email.received"],
  "description": "Notify on new emails",
  "enabled": true,
  "secret": "whsec_abc123def456...",
  "createdAt": "2024-05-11T10:00:00.000Z"
}
```

:::caution[Store the Secret]
The `secret` is only returned once during creation. Store it securely for signature verification.
:::

## Payload Structure

All webhook events follow a standard envelope:

```json
{
  "id": "evt_abc123def456",
  "object": "event",
  "createdAt": 1715421234,
  "type": "email.received",
  "data": { ... }
}
```

### email.received

Triggered when an email successfully arrives at an inbox.

```json
{
  "id": "evt_abc123",
  "object": "event",
  "createdAt": 1715421234,
  "type": "email.received",
  "data": {
    "id": "msg_xyz789",
    "inboxId": "abc123def456",
    "inboxEmail": "test@sandbox.example.com",
    "from": {
      "address": "sender@example.com",
      "name": "John Sender"
    },
    "to": [
      { "address": "test@sandbox.example.com", "name": "Test Inbox" }
    ],
    "cc": [],
    "subject": "Welcome to Our Service!",
    "snippet": "Thank you for signing up...",
    "textBody": "Full text body content",
    "htmlBody": "<html>...</html>",
    "headers": {
      "message-id": "<abc123@example.com>",
      "date": "Sat, 11 May 2024 10:30:00 +0000"
    },
    "attachments": [
      {
        "filename": "welcome.pdf",
        "contentType": "application/pdf",
        "size": 15234
      }
    ],
    "auth": {
      "spf": "pass",
      "dkim": "pass",
      "dmarc": "pass"
    },
    "receivedAt": "2024-05-11T10:30:34.567Z"
  }
}
```

:::note[Attachments]
Attachment content is never included in webhook payloads—only metadata (filename, content type, size). Retrieve attachments via the REST API.
:::

### email.stored

Triggered when an email is persisted to storage.

```json
{
  "id": "evt_abc123",
  "object": "event",
  "createdAt": 1715421235,
  "type": "email.stored",
  "data": {
    "id": "msg_xyz789",
    "inboxId": "abc123def456",
    "inboxEmail": "test@sandbox.example.com",
    "storedAt": "2024-05-11T10:30:35.123Z"
  }
}
```

### email.deleted

Triggered when an email is removed from an inbox.

```json
{
  "id": "evt_abc123",
  "object": "event",
  "createdAt": 1715425000,
  "type": "email.deleted",
  "data": {
    "id": "msg_xyz789",
    "inboxId": "abc123def456",
    "inboxEmail": "test@sandbox.example.com",
    "reason": "manual",
    "deletedAt": "2024-05-11T11:30:00.000Z"
  }
}
```

**Deletion reasons:**
- `manual`: Deleted via API
- `ttl`: Expired due to inbox TTL
- `eviction`: Removed due to storage limits

## Payload Templates

Transform webhook payloads using built-in or custom templates.

### Built-in Templates

| Template | Description |
| :------- | :---------- |
| `default` | Raw event JSON |
| `slack` | Slack Block Kit format |
| `discord` | Discord embed format |
| `teams` | Microsoft Teams MessageCard |
| `simple` | Minimal fields (from, to, subject, preview) |
| `notification` | Simple text message |
| `zapier` | Comprehensive fields for Zapier |

**Example with Slack template:**

```bash
curl -X POST https://your-gateway/api/webhooks \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hooks.slack.com/services/...",
    "events": ["email.received"],
    "template": { "type": "slack" }
  }'
```

### Custom Templates

Create custom payloads using `{{variable}}` placeholders:

```json
{
  "url": "https://your-endpoint.com/webhook",
  "events": ["email.received"],
  "template": {
    "type": "custom",
    "body": "{\"email_from\": \"{{data.from.address}}\", \"subject\": \"{{data.subject}}\", \"event\": \"{{type}}\"}"
  }
}
```

**Available variables:**

| Variable | Description |
| :------- | :---------- |
| `{{id}}` | Event ID |
| `{{type}}` | Event type |
| `{{createdAt}}` | Unix timestamp |
| `{{timestamp}}` | ISO 8601 timestamp |
| `{{data.from.address}}` | Sender email |
| `{{data.from.name}}` | Sender name |
| `{{data.subject}}` | Email subject |
| `{{data.snippet}}` | Email preview (first 200 chars) |
| `{{data.inboxEmail}}` | Inbox address |
| `{{data.textBody}}` | Full text body |
| `{{data.htmlBody}}` | Full HTML body |
| `{{data.auth.spf}}` | SPF result |
| `{{data.auth.dkim}}` | DKIM result |
| `{{data.auth.dmarc}}` | DMARC result |

## Event Filtering

Reduce noise by filtering which events trigger webhook deliveries.

### Filter Configuration

```json
{
  "url": "https://your-endpoint.com/webhook",
  "events": ["email.received"],
  "filter": {
    "mode": "all",
    "requireAuth": true,
    "rules": [
      {
        "field": "from.address",
        "operator": "domain",
        "value": "github.com"
      },
      {
        "field": "subject",
        "operator": "contains",
        "value": "pull request"
      }
    ]
  }
}
```

This webhook fires only for authenticated emails from `@github.com` with "pull request" in the subject.

### Filterable Fields

| Field | Description |
| :---- | :---------- |
| `subject` | Email subject line |
| `from.address` | Sender email address |
| `from.name` | Sender display name |
| `to.address` | Recipient email |
| `to.name` | Recipient name |
| `body.text` | Plain text body (first 5KB) |
| `body.html` | HTML body (first 5KB) |
| `header.X-Custom` | Any email header |

### Filter Operators

| Operator | Description | Example |
| :------- | :---------- | :------ |
| `equals` | Exact match | `from.address equals "user@example.com"` |
| `contains` | Substring match | `subject contains "urgent"` |
| `starts_with` | Prefix match | `subject starts_with "Re:"` |
| `ends_with` | Suffix match | `from.address ends_with "@example.com"` |
| `domain` | Email domain (with subdomains) | `from.address domain "example.com"` |
| `regex` | Regular expression | `subject regex "^(RE\|FW):"` |
| `exists` | Field presence check | `header.X-Priority exists` |

### Filter Modes

- **`all` (AND)**: All rules must match
- **`any` (OR)**: At least one rule must match

### Email Authentication Filter

Set `requireAuth: true` to only trigger webhooks for emails that pass SPF, DKIM, and/or DMARC authentication. This prevents webhooks from firing for spoofed or unauthenticated senders.

## Security & Signature Verification

All webhooks are cryptographically signed using HMAC-SHA256. **Always verify signatures** to ensure deliveries are authentic.

### Delivery Headers

| Header | Description |
| :----- | :---------- |
| `Content-Type` | `application/json` |
| `User-Agent` | `VaultSandbox-Webhook/1.0` |
| `X-Vault-Signature` | HMAC-SHA256 signature |
| `X-Vault-Event` | Event type |
| `X-Vault-Delivery` | Unique delivery ID |
| `X-Vault-Timestamp` | Unix timestamp |

### Signature Format

```
X-Vault-Signature: sha256=<hex-encoded-hmac>
```

### Verification Algorithm

The signature is computed over a signed payload:

```
signed_payload = ${timestamp}.${raw_request_body}
expected_signature = HMAC-SHA256(signed_payload, webhook_secret)
```

### Node.js Verification Example

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(rawBody, signature, timestamp, secret) {
  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express.js middleware example
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-vault-signature'];
  const timestamp = req.headers['x-vault-timestamp'];
  const rawBody = req.body.toString();

  if (!verifyWebhookSignature(rawBody, signature, timestamp, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  // Process the webhook
  const event = JSON.parse(rawBody);
  console.log('Received event:', event.type);

  res.status(200).send('OK');
});
```

### Python Verification Example

```python
import hmac
import hashlib

def verify_signature(raw_body: str, signature: str, timestamp: str, secret: str) -> bool:
    signed_payload = f"{timestamp}.{raw_body}"
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

### Timestamp Validation

Validate timestamps to prevent replay attacks (recommended tolerance: 5 minutes):

```javascript
function isTimestampValid(timestamp, toleranceSeconds = 300) {
  const webhookTime = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  return Math.abs(currentTime - webhookTime) <= toleranceSeconds;
}
```

### Secret Rotation

Rotate secrets with zero-downtime using the `/rotate-secret` endpoint:

```bash
curl -X POST https://your-gateway/api/webhooks/whk_abc123/rotate-secret \
  -H "X-API-Key: your-api-key"
```

**Response:**

```json
{
  "id": "whk_abc123",
  "secret": "whsec_new_secret_here...",
  "previousSecretValidUntil": "2024-05-11T15:00:00.000Z"
}
```

The previous secret remains valid for **1 hour** during the grace period. Update your verification code before the grace period expires.

## Delivery & Retry Logic

### Timeout

Webhook endpoints must respond within **10 seconds**. Return a `2xx` status code to indicate success.

### Retry Strategy

Failed deliveries automatically retry with exponential backoff:

| Attempt | Delay | Cumulative Time |
| :------ | :---- | :-------------- |
| 1 | Immediate | 0 |
| 2 | 30 seconds | 30s |
| 3 | 5 minutes | 5m 30s |
| 4 | 30 minutes | 35m 30s |
| 5 | 4 hours | 4h 35m 30s |

After 5 consecutive failures, the webhook is automatically disabled. Re-enable it manually via the API.

### Rate Limits

| Limit | Value |
| :---- | :---- |
| Concurrent deliveries per webhook | 10 |
| Total concurrent deliveries (global) | 100 |

## Configuration Limits

| Setting | Limit |
| :------ | :---- |
| Global webhooks per account | 100 |
| Webhooks per inbox | 50 |
| Events per webhook | 10 |
| Filter rules per webhook | 10 |
| Custom template size | 10,000 characters |
| Description length | 500 characters |
| Filter rule value | 1,000 characters |
| URL length | 2,048 characters |

## Environment Variables

Server administrators can configure webhook behavior:

| Variable | Default | Description |
| :------- | :------ | :---------- |
| `VSB_WEBHOOK_ENABLED` | `true` | Enable/disable webhook system |
| `VSB_WEBHOOK_MAX_GLOBAL` | `100` | Max global webhooks |
| `VSB_WEBHOOK_MAX_INBOX` | `50` | Max webhooks per inbox |
| `VSB_WEBHOOK_TIMEOUT` | `10000` | Delivery timeout (ms) |
| `VSB_WEBHOOK_MAX_RETRIES` | `5` | Max retry attempts |
| `VSB_WEBHOOK_MAX_RETRIES_PER_WEBHOOK` | `100` | Max retries queued per webhook |
| `VSB_WEBHOOK_ALLOW_HTTP` | `false` | Allow HTTP URLs (dev only) |
| `VSB_WEBHOOK_REQUIRE_AUTH_DEFAULT` | `false` | Default requireAuth value |
| `VSB_WEBHOOK_MAX_HEADERS` | `50` | Max headers included in payload |
| `VSB_WEBHOOK_MAX_HEADER_VALUE_LEN` | `1000` | Max header value length (chars) |

## ID Prefixes

| Type | Prefix | Example |
| :--- | :----- | :------ |
| Webhook | `whk_` | `whk_a1b2c3d4e5f6...` |
| Signing Secret | `whsec_` | `whsec_abc123def456...` |
| Event | `evt_` | `evt_xyz789abc...` |
| Delivery | `dlv_` | `dlv_123abc456...` |

## Best Practices

1. **Always verify signatures** using the `X-Vault-Signature` header
2. **Check timestamp freshness** to prevent replay attacks
3. **Handle duplicates idempotently** using `event.id` for deduplication
4. **Respond quickly** within 10 seconds to avoid retries
5. **Process asynchronously** if heavy work is needed
6. **Use `requireAuth: true`** when filtering on sender identity
7. **Rotate secrets periodically** for security
8. **Monitor for disabled webhooks** and re-enable as needed

## Error Responses

| Status | Description |
| :----- | :---------- |
| `200 OK` | Success |
| `201 Created` | Webhook created |
| `204 No Content` | Webhook deleted |
| `400 Bad Request` | Invalid request or URL |
| `401 Unauthorized` | Missing or invalid API key |
| `404 Not Found` | Webhook or inbox not found |
| `409 Conflict` | Webhook limit reached |
| `422 Unprocessable Entity` | Invalid filter regex or template |

## Next Steps

- [API Reference](/gateway/api-reference/) - Full API documentation
- [Configuration](/gateway/configuration/) - Server configuration options
- [Security](/gateway/security/) - Security architecture overview
