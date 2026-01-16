---
title: Webhooks
description: Set up webhooks to receive real-time notifications when emails arrive
---

Webhooks provide a way to receive HTTP callbacks when events occur in your inbox. Instead of polling or maintaining SSE connections, your application receives push notifications automatically.

## Creating a Webhook

Create a webhook for an inbox to receive notifications when emails arrive:

```javascript
const inbox = await client.createInbox();

const webhook = await inbox.createWebhook({
	url: 'https://your-app.com/webhook/emails',
	events: ['email.received'],
});

console.log(`Webhook ID: ${webhook.id}`);
console.log(`Secret: ${webhook.secret}`); // Save this for signature verification
```

### Webhook Options

```typescript
interface CreateWebhookOptions {
	url: string;
	events: WebhookEventType[];
	template?: 'slack' | 'discord' | 'teams' | 'simple' | 'notification' | 'zapier' | 'default' | CustomTemplate;
	filter?: FilterConfig;
	description?: string;
}
```

| Property      | Type                 | Required | Description                                    |
| ------------- | -------------------- | -------- | ---------------------------------------------- |
| `url`         | `string`             | Yes      | The URL to send webhook requests to            |
| `events`      | `WebhookEventType[]` | Yes      | Events that trigger the webhook                |
| `template`    | `string \| object`   | No       | Payload format template                        |
| `filter`      | `FilterConfig`       | No       | Filter which emails trigger the webhook        |
| `description` | `string`             | No       | Human-readable description                     |

### Event Types

| Event            | Description                           |
| ---------------- | ------------------------------------- |
| `email.received` | Email received by the inbox           |
| `email.stored`   | Email successfully stored             |
| `email.deleted`  | Email deleted from the inbox          |

## Managing Webhooks

### List Webhooks

```javascript
const response = await inbox.listWebhooks();

console.log(`Total webhooks: ${response.total}`);
response.webhooks.forEach((webhook) => {
	console.log(`- ${webhook.id}: ${webhook.url} (${webhook.enabled ? 'enabled' : 'disabled'})`);
});
```

### Get Webhook Details

```javascript
const webhook = await inbox.getWebhook('webhook-id');

console.log(`URL: ${webhook.url}`);
console.log(`Events: ${webhook.events.join(', ')}`);
console.log(`Created: ${webhook.createdAt}`);
console.log(`Last delivery: ${webhook.lastDeliveryAt || 'Never'}`);

if (webhook.stats) {
	console.log(`Deliveries: ${webhook.stats.successfulDeliveries}/${webhook.stats.totalDeliveries}`);
}
```

### Update Webhook

```javascript
const updated = await inbox.updateWebhook('webhook-id', {
	url: 'https://your-app.com/webhook/v2/emails',
	enabled: true,
	description: 'Updated webhook endpoint',
});
```

### Delete Webhook

```javascript
await inbox.deleteWebhook('webhook-id');
console.log('Webhook deleted');
```

## Filtering Webhooks

Use filters to control which emails trigger webhooks:

```javascript
const webhook = await inbox.createWebhook({
	url: 'https://your-app.com/webhook/emails',
	events: ['email.received'],
	filter: {
		rules: [
			{ field: 'from', operator: 'domain', value: 'example.com' },
			{ field: 'subject', operator: 'contains', value: 'Invoice' },
		],
		mode: 'all', // 'all' = AND, 'any' = OR
	},
});
```

### Filter Operators

| Operator      | Description                            | Example                                              |
| ------------- | -------------------------------------- | ---------------------------------------------------- |
| `equals`      | Exact match                            | `{ field: 'from', operator: 'equals', value: 'noreply@example.com' }` |
| `contains`    | Contains substring                     | `{ field: 'subject', operator: 'contains', value: 'Reset' }` |
| `starts_with` | Starts with string                     | `{ field: 'subject', operator: 'starts_with', value: 'RE:' }` |
| `ends_with`   | Ends with string                       | `{ field: 'from', operator: 'ends_with', value: '@company.com' }` |
| `domain`      | Email domain match                     | `{ field: 'from', operator: 'domain', value: 'example.com' }` |
| `regex`       | Regular expression match               | `{ field: 'subject', operator: 'regex', value: 'Order #\\d+' }` |
| `exists`      | Field exists and is non-empty          | `{ field: 'attachments', operator: 'exists', value: 'true' }` |

### Case Sensitivity

```javascript
const webhook = await inbox.createWebhook({
	url: 'https://your-app.com/webhook/emails',
	events: ['email.received'],
	filter: {
		rules: [
			{
				field: 'subject',
				operator: 'contains',
				value: 'urgent',
				caseSensitive: false, // Case-insensitive match
			},
		],
		mode: 'all',
	},
});
```

### Require Authentication

Only trigger webhooks for authenticated emails:

```javascript
const webhook = await inbox.createWebhook({
	url: 'https://your-app.com/webhook/verified-emails',
	events: ['email.received'],
	filter: {
		rules: [],
		mode: 'all',
		requireAuth: true, // Only emails passing SPF/DKIM/DMARC
	},
});
```

## Templates

Templates control the webhook payload format:

### Built-in Templates

```javascript
// Slack-formatted payload
const slackWebhook = await inbox.createWebhook({
	url: 'https://hooks.slack.com/services/...',
	events: ['email.received'],
	template: 'slack',
});

// Discord-formatted payload
const discordWebhook = await inbox.createWebhook({
	url: 'https://discord.com/api/webhooks/...',
	events: ['email.received'],
	template: 'discord',
});

// Microsoft Teams
const teamsWebhook = await inbox.createWebhook({
	url: 'https://outlook.office.com/webhook/...',
	events: ['email.received'],
	template: 'teams',
});
```

### Custom Templates

```javascript
const webhook = await inbox.createWebhook({
	url: 'https://your-app.com/webhook/emails',
	events: ['email.received'],
	template: {
		type: 'custom',
		body: JSON.stringify({
			email_id: '{{email.id}}',
			sender: '{{email.from}}',
			subject_line: '{{email.subject}}',
			received_timestamp: '{{email.receivedAt}}',
		}),
		contentType: 'application/json',
	},
});
```

## Testing Webhooks

### Send Test Request

```javascript
const result = await inbox.testWebhook('webhook-id');

if (result.success) {
	console.log(`Test successful!`);
	console.log(`Status: ${result.statusCode}`);
	console.log(`Response time: ${result.responseTime}ms`);
} else {
	console.error(`Test failed: ${result.error}`);
}
```

### Test Response

```typescript
interface TestWebhookResponse {
	success: boolean;
	statusCode?: number;
	responseTime?: number;
	responseBody?: string;
	error?: string;
	payloadSent?: unknown;
}
```

## Rotating Secrets

Rotate webhook secrets periodically for security:

```javascript
const result = await inbox.rotateWebhookSecret('webhook-id');

console.log(`New secret: ${result.secret}`);
console.log(`Old secret valid until: ${result.previousSecretValidUntil}`);

// Update your application with the new secret
// The old secret remains valid during the grace period
```

## Verifying Webhook Signatures

Always verify webhook signatures in your endpoint. Webhooks include the following headers:

| Header              | Description                |
| ------------------- | -------------------------- |
| `X-Vault-Signature` | HMAC-SHA256 signature      |
| `X-Vault-Timestamp` | Unix timestamp             |
| `X-Vault-Event`     | Event type                 |
| `X-Vault-Delivery`  | Unique delivery ID         |

The signature is computed over `${timestamp}.${raw_request_body}`:

```javascript
import crypto from 'crypto';

function verifyWebhookSignature(rawBody, signature, timestamp, secret) {
	const signedPayload = `${timestamp}.${rawBody}`;
	const expectedSignature =
		'sha256=' +
		crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

	return crypto.timingSafeEqual(
		Buffer.from(signature),
		Buffer.from(expectedSignature)
	);
}

// In your webhook handler (using express.raw() to get the raw body)
app.post('/webhook/emails', express.raw({ type: 'application/json' }), (req, res) => {
	const signature = req.headers['x-vault-signature'];
	const timestamp = req.headers['x-vault-timestamp'];
	const rawBody = req.body.toString();

	if (!verifyWebhookSignature(rawBody, signature, timestamp, WEBHOOK_SECRET)) {
		return res.status(401).send('Invalid signature');
	}

	// Process the webhook
	const event = JSON.parse(rawBody);
	console.log('Email received:', event);
	res.status(200).send('OK');
});
```

## Error Handling

```javascript
import { WebhookNotFoundError, InboxNotFoundError, ApiError } from '@vaultsandbox/client';

try {
	const webhook = await inbox.getWebhook('webhook-id');
} catch (error) {
	if (error instanceof WebhookNotFoundError) {
		console.error('Webhook not found');
	} else if (error instanceof InboxNotFoundError) {
		console.error('Inbox not found');
	} else if (error instanceof ApiError) {
		console.error(`API error (${error.statusCode}): ${error.message}`);
	}
}
```

## Complete Example

```javascript
import { VaultSandboxClient } from '@vaultsandbox/client';

async function setupWebhooks() {
	const client = new VaultSandboxClient({
		url: process.env.VAULTSANDBOX_URL,
		apiKey: process.env.VAULTSANDBOX_API_KEY,
	});

	try {
		// Create inbox
		const inbox = await client.createInbox();
		console.log(`Inbox: ${inbox.emailAddress}`);

		// Create webhook with filter
		const webhook = await inbox.createWebhook({
			url: 'https://your-app.com/webhook/emails',
			events: ['email.received', 'email.stored'],
			description: 'Production email webhook',
			filter: {
				rules: [{ field: 'from', operator: 'domain', value: 'example.com' }],
				mode: 'all',
			},
		});

		console.log(`Webhook created: ${webhook.id}`);
		console.log(`Secret: ${webhook.secret}`);

		// Test the webhook
		const testResult = await inbox.testWebhook(webhook.id);
		if (testResult.success) {
			console.log('Webhook test successful!');
		} else {
			console.error('Webhook test failed:', testResult.error);
		}

		// List all webhooks
		const { webhooks, total } = await inbox.listWebhooks();
		console.log(`Total webhooks: ${total}`);

		// Update webhook
		await inbox.updateWebhook(webhook.id, {
			description: 'Updated description',
		});

		// Rotate secret after some time
		// const newSecret = await inbox.rotateWebhookSecret(webhook.id);

		// Cleanup
		// await inbox.deleteWebhook(webhook.id);
		// await inbox.delete();
	} finally {
		await client.close();
	}
}

setupWebhooks().catch(console.error);
```

## Webhook vs SSE vs Polling

| Feature           | Webhooks                  | SSE                       | Polling                   |
| ----------------- | ------------------------- | ------------------------- | ------------------------- |
| Delivery          | Push to your server       | Push to client            | Pull from client          |
| Connection        | None required             | Persistent                | Repeated requests         |
| Latency           | Near real-time            | Real-time                 | Depends on interval       |
| Server required   | Yes (webhook endpoint)    | No                        | No                        |
| Firewall friendly | Yes                       | Usually                   | Yes                       |
| Best for          | Server-to-server          | Browser/client apps       | Simple integrations       |

## Next Steps

- [Real-time Monitoring](/client-node/guides/real-time/) - SSE-based monitoring
- [Inbox API Reference](/client-node/api/inbox/) - Complete inbox methods
- [Error Handling](/client-node/api/errors/) - Handle webhook errors
