---
title: Webhook SDK Specification
description: Language-agnostic specification for implementing VaultSandbox webhook management in client libraries.
---

# VaultSandbox Webhook SDK Specification

A language-agnostic specification for implementing webhook management in VaultSandbox client libraries. This document provides all necessary information to build webhook functionality in any programming language.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Reference](#api-reference)
4. [Data Structures](#data-structures)
5. [Event Types](#event-types)
6. [Filtering](#filtering)
7. [Payload Templates](#payload-templates)
8. [Signature Verification](#signature-verification)
9. [Error Handling](#error-handling)
10. [Limits & Quotas](#limits--quotas)
11. [Utility Endpoints](#utility-endpoints)
12. [Implementation Checklist](#implementation-checklist)

---

## Overview

The VaultSandbox webhook system enables real-time notifications when email events occur. Webhooks support two scopes:

- **Global webhooks**: Receive events for all inboxes
- **Inbox webhooks**: Receive events for a specific inbox only

### Key Features

- **Multiple event types**: Subscribe to email received, stored, or deleted events
- **Flexible filtering**: Filter events by sender, subject, headers, and more
- **Payload templates**: Built-in templates for Slack, Discord, Teams, or custom formats
- **Signature verification**: HMAC-SHA256 signatures for secure delivery
- **Automatic retries**: Exponential backoff for failed deliveries

### ID Prefixes

| Type     | Prefix   | Example                 |
| -------- | -------- | ----------------------- |
| Webhook  | `whk_`   | `whk_a1b2c3d4e5f6...`   |
| Secret   | `whsec_` | `whsec_abc123def456...` |
| Event    | `evt_`   | `evt_xyz789abc...`      |
| Delivery | `dlv_`   | `dlv_123abc456...`      |
| Message  | `msg_`   | `msg_def789ghi...`      |

---

## Authentication

All webhook endpoints require API key authentication via the `X-API-Key` header.

```http
GET /api/webhooks HTTP/1.1
Host: api.example.com
X-API-Key: your-api-key
```

---

## API Reference

### Global Webhooks

Global webhooks receive events for all inboxes associated with the API key.

#### POST /api/webhooks

Creates a new global webhook.

**Request Body:** [`CreateWebhookDto`](#createwebhookdto)

**Response:** `201 Created` - [`WebhookResponse`](#webhookresponse) (includes `secret`)

**Errors:**

| Status | Description           |
| ------ | --------------------- |
| 400    | Invalid request body  |
| 409    | Webhook limit reached |

---

#### GET /api/webhooks

Lists all global webhooks.

**Response:** `200 OK` - [`WebhookListResponse`](#webhooklistresponse)

**Note:** The `secret` field is excluded from list responses.

---

#### GET /api/webhooks/{id}

Retrieves a specific global webhook.

**Response:** `200 OK` - [`WebhookResponse`](#webhookresponse) (includes `secret` and `stats`)

**Errors:**

| Status | Description       |
| ------ | ----------------- |
| 404    | Webhook not found |

---

#### PATCH /api/webhooks/{id}

Updates a global webhook.

**Request Body:** [`UpdateWebhookDto`](#updatewebhookdto)

**Response:** `200 OK` - [`WebhookResponse`](#webhookresponse)

**Errors:**

| Status | Description          |
| ------ | -------------------- |
| 400    | Invalid request body |
| 404    | Webhook not found    |

---

#### DELETE /api/webhooks/{id}

Deletes a global webhook.

**Response:** `204 No Content`

---

#### POST /api/webhooks/{id}/test

Sends a test event to verify webhook connectivity.

**Response:** `200 OK` - [`TestWebhookResponse`](#testwebhookresponse)

**Errors:**

| Status | Description       |
| ------ | ----------------- |
| 404    | Webhook not found |

---

#### POST /api/webhooks/{id}/rotate-secret

Generates a new signing secret. The old secret remains valid for 1 hour.

**Response:** `200 OK` - [`RotateSecretResponse`](#rotatesecretresponse)

**Errors:**

| Status | Description       |
| ------ | ----------------- |
| 404    | Webhook not found |

---

### Inbox Webhooks

Inbox webhooks are scoped to a specific inbox and follow the same patterns as global webhooks.

#### POST /api/inboxes/{email}/webhooks

Creates a new inbox webhook.

**Request Body:** [`CreateWebhookDto`](#createwebhookdto)

**Response:** `201 Created` - [`WebhookResponse`](#webhookresponse)

**Errors:**

| Status | Description           |
| ------ | --------------------- |
| 400    | Invalid request body  |
| 404    | Inbox not found       |
| 409    | Webhook limit reached |

---

#### GET /api/inboxes/{email}/webhooks

Lists all webhooks for the specified inbox.

**Response:** `200 OK` - [`WebhookListResponse`](#webhooklistresponse)

---

#### GET /api/inboxes/{email}/webhooks/{id}

Retrieves a specific inbox webhook.

**Response:** `200 OK` - [`WebhookResponse`](#webhookresponse)

---

#### PATCH /api/inboxes/{email}/webhooks/{id}

Updates an inbox webhook.

**Request Body:** [`UpdateWebhookDto`](#updatewebhookdto)

**Response:** `200 OK` - [`WebhookResponse`](#webhookresponse)

---

#### DELETE /api/inboxes/{email}/webhooks/{id}

Deletes an inbox webhook.

**Response:** `204 No Content`

---

#### POST /api/inboxes/{email}/webhooks/{id}/test

Sends a test event to the inbox webhook endpoint.

**Response:** `200 OK` - [`TestWebhookResponse`](#testwebhookresponse)

---

#### POST /api/inboxes/{email}/webhooks/{id}/rotate-secret

Generates a new signing secret for the inbox webhook.

**Response:** `200 OK` - [`RotateSecretResponse`](#rotatesecretresponse)

---

## Data Structures

### Request DTOs

#### CreateWebhookDto

```typescript
interface CreateWebhookDto {
	/** Target URL (HTTPS required in production) */
	url: string;

	/** Event types to subscribe to (max 10) */
	events: WebhookEventType[];

	/** Optional payload template */
	template?: 'slack' | 'discord' | 'teams' | 'simple' | 'notification' | 'zapier' | 'default' | CustomTemplateDto;

	/** Optional event filter configuration */
	filter?: FilterConfigDto;

	/** Optional description (max 500 chars) */
	description?: string;
}
```

| Field         | Type                        | Required | Description                         |
| ------------- | --------------------------- | -------- | ----------------------------------- |
| `url`         | string                      | Yes      | Target URL (HTTPS required in prod) |
| `events`      | WebhookEventType[]          | Yes      | Event types to subscribe to         |
| `template`    | string \| CustomTemplateDto | No       | Payload template configuration      |
| `filter`      | FilterConfigDto             | No       | Event filter rules                  |
| `description` | string                      | No       | Human-readable description          |

**Example:**

```json
{
	"url": "https://example.com/webhook",
	"events": ["email.received"],
	"description": "Notify when new emails arrive"
}
```

---

#### UpdateWebhookDto

All fields are optional. Set `template` or `filter` to `null` to remove them.

```typescript
interface UpdateWebhookDto {
	url?: string;
	events?: WebhookEventType[];
	template?: string | CustomTemplateDto | null;
	filter?: FilterConfigDto | null;
	description?: string;
	enabled?: boolean;
}
```

**Example - Disable webhook:**

```json
{
	"enabled": false
}
```

**Example - Remove filter:**

```json
{
	"filter": null
}
```

---

#### CustomTemplateDto

```typescript
interface CustomTemplateDto {
	/** Must be 'custom' */
	type: 'custom';

	/** JSON template with {{variable}} placeholders (max 10000 chars) */
	body: string;

	/** Optional Content-Type header override */
	contentType?: string;
}
```

**Example:**

```json
{
	"template": {
		"type": "custom",
		"body": "{\"email_from\": \"{{data.from.address}}\", \"subject\": \"{{data.subject}}\"}"
	}
}
```

---

#### FilterConfigDto

```typescript
interface FilterConfigDto {
	/** Filter rules (max 10) */
	rules: FilterRuleDto[];

	/** 'all' = AND logic, 'any' = OR logic */
	mode: 'all' | 'any';

	/** Require email to pass SPF/DKIM/DMARC checks */
	requireAuth?: boolean;
}

interface FilterRuleDto {
	/** Field to filter on */
	field: FilterableField;

	/** Comparison operator */
	operator: FilterOperator;

	/** Value to match (max 1000 chars) */
	value: string;

	/** Case-sensitive matching (default: false) */
	caseSensitive?: boolean;
}
```

**Example:**

```json
{
	"filter": {
		"mode": "all",
		"requireAuth": true,
		"rules": [
			{
				"field": "from.address",
				"operator": "domain",
				"value": "example.com"
			},
			{
				"field": "subject",
				"operator": "contains",
				"value": "urgent"
			}
		]
	}
}
```

---

### Response DTOs

#### WebhookResponse

```typescript
interface WebhookResponse {
	/** Webhook ID (whk_ prefix) */
	id: string;

	/** Target URL */
	url: string;

	/** Subscribed event types */
	events: WebhookEventType[];

	/** 'global' or 'inbox' */
	scope: 'global' | 'inbox';

	/** Inbox email (inbox webhooks only) */
	inboxEmail?: string;

	/** Inbox hash (inbox webhooks only) */
	inboxHash?: string;

	/** Whether webhook is active */
	enabled: boolean;

	/** Signing secret (whsec_ prefix) - only on create/get, not list */
	secret?: string;

	/** Template configuration */
	template?: WebhookTemplate;

	/** Filter configuration */
	filter?: FilterConfigDto;

	/** Human-readable description */
	description?: string;

	/** ISO timestamp */
	createdAt: string;

	/** ISO timestamp of last update */
	updatedAt?: string;

	/** ISO timestamp of last delivery attempt */
	lastDeliveryAt?: string;

	/** Status of last delivery */
	lastDeliveryStatus?: 'success' | 'failed';

	/** Delivery statistics (only on get, not list) */
	stats?: WebhookStatsResponse;
}
```

---

#### WebhookListResponse

```typescript
interface WebhookListResponse {
	webhooks: WebhookResponse[];
	total: number;
}
```

---

#### TestWebhookResponse

```typescript
interface TestWebhookResponse {
	/** Whether test succeeded */
	success: boolean;

	/** HTTP status code from endpoint */
	statusCode?: number;

	/** Response time in milliseconds */
	responseTime?: number;

	/** Response body (truncated to 1KB) */
	responseBody?: string;

	/** Error message if failed */
	error?: string;

	/** The test payload that was sent */
	payloadSent?: unknown;
}
```

---

#### RotateSecretResponse

```typescript
interface RotateSecretResponse {
	/** Webhook ID */
	id: string;

	/** New signing secret */
	secret: string;

	/** ISO timestamp - old secret valid until this time (1 hour grace period) */
	previousSecretValidUntil: string;
}
```

---

#### WebhookStatsResponse

```typescript
interface WebhookStatsResponse {
	totalDeliveries: number;
	successfulDeliveries: number;
	failedDeliveries: number;
}
```

---

## Event Types

```typescript
type WebhookEventType =
	| 'email.received' // Email arrived at inbox
	| 'email.stored' // Email persisted to storage
	| 'email.deleted'; // Email deleted
```

### Event Envelope

All events are wrapped in a standard envelope:

```typescript
interface WebhookEventEnvelope<T> {
	/** Event ID (evt_ prefix) */
	id: string;

	/** Always 'event' */
	object: 'event';

	/** Unix timestamp */
	createdAt: number;

	/** Event type */
	type: WebhookEventType;

	/** Event-specific data */
	data: T;
}
```

---

### email.received

Fired when an email arrives at an inbox.

```typescript
interface EmailReceivedData {
	/** Email ID (msg_ prefix) */
	id: string;

	/** Inbox hash */
	inboxId: string;

	/** Inbox email address */
	inboxEmail: string;

	/** Sender */
	from: EmailAddress;

	/** Recipients */
	to: EmailAddress[];

	/** CC recipients */
	cc?: EmailAddress[];

	/** Email subject */
	subject: string;

	/** First 200 chars of text body */
	snippet: string;

	/** Full text body (optional) */
	textBody?: string;

	/** Full HTML body (optional) */
	htmlBody?: string;

	/** Selected headers (lowercase keys) */
	headers: Record<string, string>;

	/** Attachment metadata (no content) */
	attachments: AttachmentMeta[];

	/** SPF/DKIM/DMARC results */
	auth?: EmailAuthResults;

	/** ISO timestamp */
	receivedAt: string;
}

interface EmailAddress {
	address: string;
	name?: string;
}

interface AttachmentMeta {
	filename: string;
	contentType: string;
	size: number;
}
```

**Example payload:**

```json
{
	"id": "evt_abc123",
	"object": "event",
	"createdAt": 1705420800,
	"type": "email.received",
	"data": {
		"id": "msg_xyz789",
		"inboxId": "a1b2c3d4",
		"inboxEmail": "test@inbox.example.com",
		"from": {
			"address": "sender@example.com",
			"name": "John Doe"
		},
		"to": [
			{
				"address": "test@inbox.example.com"
			}
		],
		"subject": "Hello World",
		"snippet": "This is the beginning of the email...",
		"headers": {
			"message-id": "<abc@example.com>",
			"date": "Wed, 16 Jan 2026 12:00:00 +0000"
		},
		"attachments": [],
		"receivedAt": "2026-01-16T12:00:00.000Z"
	}
}
```

---

### email.stored

Fired when an email is persisted to storage.

```typescript
interface EmailStoredData {
	id: string;
	inboxId: string;
	inboxEmail: string;
	storedAt: string;
}
```

---

### email.deleted

Fired when an email is deleted.

```typescript
interface EmailDeletedData {
	id: string;
	inboxId: string;
	inboxEmail: string;
	reason: 'manual' | 'ttl' | 'eviction';
	deletedAt: string;
}
```

---

## Filtering

Filter webhooks to only receive events matching specific criteria.

### Filterable Fields

| Field             | Description                         |
| ----------------- | ----------------------------------- |
| `subject`         | Email subject line                  |
| `from.address`    | Sender email address                |
| `from.name`       | Sender display name                 |
| `to.address`      | First recipient email address       |
| `to.name`         | First recipient display name        |
| `body.text`       | Plain text body (first 5KB)         |
| `body.html`       | HTML body (first 5KB)               |
| `header.X-Custom` | Any email header (case-insensitive) |

### Filter Operators

| Operator      | Description                              | Example                                  |
| ------------- | ---------------------------------------- | ---------------------------------------- |
| `equals`      | Exact match                              | `from.address equals "user@example.com"` |
| `contains`    | Substring match                          | `subject contains "urgent"`              |
| `starts_with` | Prefix match                             | `subject starts_with "Re:"`              |
| `ends_with`   | Suffix match                             | `from.address ends_with "@example.com"`  |
| `domain`      | Email domain match (supports subdomains) | `from.address domain "example.com"`      |
| `regex`       | Regular expression                       | `subject regex "^(RE\|FW):"`             |
| `exists`      | Field presence check                     | `header.X-Priority exists`               |

### Filter Mode

- `all`: ALL rules must match (AND logic)
- `any`: AT LEAST ONE rule must match (OR logic)

### Authentication Requirement

Set `requireAuth: true` to only trigger for emails that pass SPF/DKIM/DMARC checks.

---

## Payload Templates

Transform webhook payloads using built-in or custom templates.

### Built-in Templates

| Template       | Description                                   |
| -------------- | --------------------------------------------- |
| `default`      | Raw event envelope JSON                       |
| `slack`        | Slack Block Kit format                        |
| `discord`      | Discord embed format                          |
| `teams`        | Microsoft Teams MessageCard format            |
| `simple`       | Minimal fields (from, to, subject, preview)   |
| `notification` | Single text message format                    |
| `zapier`       | Comprehensive fields for automation platforms |

**Example - Using Slack template:**

```json
{
	"url": "https://hooks.slack.com/services/xxx",
	"events": ["email.received"],
	"template": "slack"
}
```

### Custom Templates

Create custom payloads using `{{variable}}` placeholders with dot notation.

**Available Variables:**

- `{{id}}` - Event ID
- `{{type}}` - Event type
- `{{createdAt}}` - Unix timestamp
- `{{timestamp}}` - ISO 8601 timestamp
- `{{data.from.address}}` - Sender email
- `{{data.from.name}}` - Sender name
- `{{data.subject}}` - Email subject
- `{{data.snippet}}` - Email preview
- `{{data.inboxEmail}}` - Inbox address
- Any other nested field in the event data

**Example:**

```json
{
	"template": {
		"type": "custom",
		"body": "{\"text\": \"New email from {{data.from.address}}: {{data.subject}}\"}",
		"contentType": "application/json"
	}
}
```

---

## Signature Verification

All webhook deliveries are signed using HMAC-SHA256. **Always verify signatures** to ensure requests are authentic.

### Delivery Headers

| Header              | Description                |
| ------------------- | -------------------------- |
| `X-Vault-Signature` | `sha256=<hex_signature>`   |
| `X-Vault-Event`     | Event type                 |
| `X-Vault-Delivery`  | Delivery ID (dlv\_ prefix) |
| `X-Vault-Timestamp` | Unix timestamp             |

### Verification Algorithm

```
signed_payload = ${timestamp}.${raw_body}
expected_signature = HMAC-SHA256(signed_payload, webhook_secret)
```

### Implementation Examples

#### Node.js

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(rawBody: string, signature: string, timestamp: string, secret: string): boolean {
	const signedPayload = `${timestamp}.${rawBody}`;
	const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

	const actualSignature = signature.replace('sha256=', '');

	return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(actualSignature));
}

// Express middleware example
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
	const signature = req.headers['x-vault-signature'] as string;
	const timestamp = req.headers['x-vault-timestamp'] as string;
	const rawBody = req.body.toString();

	if (!verifyWebhookSignature(rawBody, signature, timestamp, WEBHOOK_SECRET)) {
		return res.status(401).send('Invalid signature');
	}

	const event = JSON.parse(rawBody);
	// Process event...

	res.status(200).send('OK');
});
```

#### Python

```python
import hmac
import hashlib

def verify_webhook_signature(raw_body: str, signature: str, timestamp: str, secret: str) -> bool:
    signed_payload = f"{timestamp}.{raw_body}"
    expected_signature = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()

    actual_signature = signature.replace("sha256=", "")

    return hmac.compare_digest(expected_signature, actual_signature)

# Flask example
@app.route('/webhook', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Vault-Signature')
    timestamp = request.headers.get('X-Vault-Timestamp')
    raw_body = request.get_data(as_text=True)

    if not verify_webhook_signature(raw_body, signature, timestamp, WEBHOOK_SECRET):
        return 'Invalid signature', 401

    event = request.get_json()
    # Process event...

    return 'OK', 200
```

#### Go

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
)

func verifyWebhookSignature(rawBody, signature, timestamp, secret string) bool {
    signedPayload := fmt.Sprintf("%s.%s", timestamp, rawBody)

    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(signedPayload))
    expectedSignature := hex.EncodeToString(mac.Sum(nil))

    actualSignature := signature[7:] // Remove "sha256=" prefix

    return hmac.Equal([]byte(expectedSignature), []byte(actualSignature))
}
```

### Timestamp Validation

To prevent replay attacks, validate that the timestamp is recent (e.g., within 5 minutes):

```typescript
function isTimestampValid(timestamp: string, toleranceSeconds = 300): boolean {
	const webhookTime = parseInt(timestamp, 10);
	const currentTime = Math.floor(Date.now() / 1000);
	return Math.abs(currentTime - webhookTime) <= toleranceSeconds;
}
```

### Secret Rotation

When rotating secrets via `/rotate-secret`:

1. A new secret is generated immediately
2. The old secret remains valid for **1 hour** (grace period)
3. Update your verification code before the grace period expires
4. During the grace period, verify against both secrets

---

## Error Handling

### HTTP Status Codes

| Status | Description                  |
| ------ | ---------------------------- |
| 200    | Success (GET, PATCH, POST)   |
| 201    | Webhook created successfully |
| 204    | Webhook deleted successfully |
| 400    | Invalid request body         |
| 401    | Missing or invalid API key   |
| 404    | Webhook or inbox not found   |
| 409    | Webhook limit reached        |

### Error Response Format

```typescript
interface ErrorResponse {
	statusCode: number;
	message: string | string[];
	error: string;
}
```

**Example:**

```json
{
	"statusCode": 400,
	"message": ["url must be a valid HTTPS URL"],
	"error": "Bad Request"
}
```

### Retry Behavior

The server retries failed deliveries with exponential backoff:

| Attempt | Delay      |
| ------- | ---------- |
| 1       | Immediate  |
| 2       | 30 seconds |
| 3       | 5 minutes  |
| 4       | 30 minutes |
| 5       | 4 hours    |

A delivery is considered successful if your endpoint returns a `2xx` status code.

---

## Limits & Quotas

| Limit                    | Default Value |
| ------------------------ | ------------- |
| Global webhooks          | 100           |
| Webhooks per inbox       | 50            |
| Events per webhook       | 10            |
| Filter rules per webhook | 10            |
| Max retry attempts       | 5             |
| Delivery timeout         | 10 seconds    |
| Custom template size     | 10,000 chars  |
| Description length       | 500 chars     |
| Filter value length      | 1,000 chars   |

---

## Utility Endpoints

### GET /api/server-info

The server info endpoint includes webhook-related configuration fields.

**Webhook-related fields:**

```typescript
interface ServerInfoResponse {
	// ... other fields ...

	/** Whether the webhook system is enabled on this server */
	webhookEnabled: boolean;

	/** Default value for webhook requireAuth filter when not specified */
	webhookRequireAuthDefault: boolean;
}
```

**Usage:**

- Check `webhookEnabled` before showing webhook UI
- Use `webhookRequireAuthDefault` as the default value for the `requireAuth` filter toggle

---

### GET /api/webhooks/templates

Retrieves available payload templates for dropdown/select UI components.

**Response:** `200 OK`

```typescript
interface WebhookTemplateOption {
	/** Display label */
	label: string;

	/** Template identifier to use in CreateWebhookDto */
	value: string;
}

interface WebhookTemplatesResponse {
	templates: WebhookTemplateOption[];
}
```

**Example Response:**

```json
{
	"templates": [
		{ "label": "Default (Raw JSON)", "value": "default" },
		{ "label": "Slack", "value": "slack" },
		{ "label": "Discord", "value": "discord" },
		{ "label": "Microsoft Teams", "value": "teams" },
		{ "label": "Simple", "value": "simple" },
		{ "label": "Notification", "value": "notification" },
		{ "label": "Zapier/Automation", "value": "zapier" }
	]
}
```

---

### GET /api/webhooks/metrics

Retrieves aggregated webhook statistics across all webhooks.

**Response:** `200 OK`

```typescript
interface WebhookMetricsResponse {
	webhooks: {
		/** Number of global webhooks */
		global: number;

		/** Number of inbox-scoped webhooks */
		inbox: number;

		/** Number of currently enabled webhooks */
		enabled: number;

		/** Total webhooks (global + inbox) */
		total: number;
	};

	deliveries: {
		/** Total delivery attempts across all webhooks */
		total: number;

		/** Successful deliveries */
		successful: number;

		/** Failed deliveries */
		failed: number;
	};
}
```

**Example Response:**

```json
{
	"webhooks": {
		"global": 3,
		"inbox": 12,
		"enabled": 14,
		"total": 15
	},
	"deliveries": {
		"total": 1250,
		"successful": 1180,
		"failed": 70
	}
}
```

**Usage:**

- Display in a dashboard or summary view
- Calculate success rate: `(deliveries.successful / deliveries.total) * 100`

**Note:** This endpoint aggregates stats by iterating all webhooks. Use sparingly (e.g., on dashboard load, not in real-time polling).

---

## Implementation Checklist

### Core Requirements

- [ ] Create global webhook
- [ ] List global webhooks
- [ ] Get global webhook by ID
- [ ] Update global webhook
- [ ] Delete global webhook
- [ ] Test global webhook
- [ ] Rotate global webhook secret
- [ ] Create inbox webhook
- [ ] List inbox webhooks
- [ ] Get inbox webhook by ID
- [ ] Update inbox webhook
- [ ] Delete inbox webhook
- [ ] Test inbox webhook
- [ ] Rotate inbox webhook secret

### Signature Verification

- [ ] HMAC-SHA256 signature generation
- [ ] Constant-time signature comparison
- [ ] Timestamp validation (replay attack prevention)
- [ ] Dual-secret verification during rotation grace period

### Filtering

- [ ] All filter operators (equals, contains, starts_with, ends_with, domain, regex, exists)
- [ ] Filter mode (all/any)
- [ ] Authentication requirement filter

### Templates

- [ ] Built-in template selection
- [ ] Custom template with variable substitution
- [ ] Template retrieval from utility endpoint

### Error Handling

- [ ] All HTTP error codes
- [ ] Error response parsing
- [ ] Retry behavior documentation for consumers

### Testing

- [ ] Unit tests for signature verification
- [ ] Integration tests for CRUD operations
- [ ] Filter rule evaluation tests
- [ ] Template rendering tests

---

## Version History

| Version | Date       | Changes                           |
| ------- | ---------- | --------------------------------- |
| 0.8.0   | 2026-01-18 | Initial webhook SDK specification |
