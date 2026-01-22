---
title: Chaos Engineering
description: Test email resilience by simulating SMTP failures and network issues
---

Chaos engineering allows you to simulate various SMTP failure scenarios and network issues during email testing. This helps verify your application handles email delivery failures gracefully.

## Prerequisites

Chaos features must be enabled on the gateway server. Check availability:

```javascript
const serverInfo = await client.getServerInfo();

if (serverInfo.chaosEnabled) {
	console.log('Chaos features available');
} else {
	console.log('Chaos features disabled on this server');
}
```

## Enabling Chaos

### During Inbox Creation

```javascript
const inbox = await client.createInbox({
	chaos: {
		enabled: true,
		latency: { enabled: true, minDelayMs: 1000, maxDelayMs: 5000 },
	},
});
```

### After Inbox Creation

```javascript
await inbox.setChaosConfig({
	enabled: true,
	latency: { enabled: true, minDelayMs: 1000, maxDelayMs: 5000 },
});
```

### Getting Current Configuration

```javascript
const config = await inbox.getChaosConfig();

console.log(`Chaos enabled: ${config.enabled}`);
console.log(`Latency enabled: ${config.latency?.enabled}`);
```

### Disabling Chaos

```javascript
await inbox.disableChaos();
```

## Chaos Configuration

```typescript
interface ChaosConfigRequest {
	enabled: boolean;
	expiresAt?: string; // ISO 8601 timestamp for auto-disable
	latency?: LatencyConfig;
	connectionDrop?: ConnectionDropConfig;
	randomError?: RandomErrorConfig;
	greylist?: GreylistConfig;
	blackhole?: BlackholeConfig;
}
```

| Property         | Type                   | Required | Description                            |
| ---------------- | ---------------------- | -------- | -------------------------------------- |
| `enabled`        | `boolean`              | Yes      | Master switch for all chaos features   |
| `expiresAt`      | `string`               | No       | Auto-disable chaos after this time     |
| `latency`        | `LatencyConfig`        | No       | Inject artificial delays               |
| `connectionDrop` | `ConnectionDropConfig` | No       | Simulate connection failures           |
| `randomError`    | `RandomErrorConfig`    | No       | Return random SMTP error codes         |
| `greylist`       | `GreylistConfig`       | No       | Simulate greylisting behavior          |
| `blackhole`      | `BlackholeConfig`      | No       | Accept but silently discard emails     |

## Latency Injection

Inject artificial delays into email processing to test timeout handling and slow connections.

```javascript
await inbox.setChaosConfig({
	enabled: true,
	latency: {
		enabled: true,
		minDelayMs: 500, // Minimum delay (default: 500)
		maxDelayMs: 5000, // Maximum delay (default: 10000, max: 60000)
		jitter: true, // Randomize within range (default: true)
		probability: 0.5, // 50% of emails affected (default: 1.0)
	},
});
```

### Configuration Options

```typescript
interface LatencyConfig {
	enabled: boolean;
	minDelayMs?: number; // Default: 500
	maxDelayMs?: number; // Default: 10000, Max: 60000
	jitter?: boolean; // Default: true
	probability?: number; // 0.0-1.0, Default: 1.0
}
```

| Property      | Type      | Default | Description                                           |
| ------------- | --------- | ------- | ----------------------------------------------------- |
| `enabled`     | `boolean` | -       | Enable/disable latency injection                      |
| `minDelayMs`  | `number`  | `500`   | Minimum delay in milliseconds                         |
| `maxDelayMs`  | `number`  | `10000` | Maximum delay in milliseconds (max: 60000)            |
| `jitter`      | `boolean` | `true`  | Randomize delay within range. If false, uses maxDelay |
| `probability` | `number`  | `1.0`   | Probability of applying delay (0.0-1.0)               |

### Use Cases

- Test application timeout handling
- Verify UI responsiveness during slow email delivery
- Test retry logic with variable delays

## Connection Drop

Simulate connection failures by dropping SMTP connections.

```javascript
await inbox.setChaosConfig({
	enabled: true,
	connectionDrop: {
		enabled: true,
		probability: 0.3, // 30% of connections dropped
		graceful: false, // Abrupt RST instead of graceful FIN
	},
});
```

### Configuration Options

```typescript
interface ConnectionDropConfig {
	enabled: boolean;
	probability?: number; // 0.0-1.0, Default: 1.0
	graceful?: boolean; // Default: true
}
```

| Property      | Type      | Default | Description                                |
| ------------- | --------- | ------- | ------------------------------------------ |
| `enabled`     | `boolean` | -       | Enable/disable connection dropping         |
| `probability` | `number`  | `1.0`   | Probability of dropping connection (0.0-1.0) |
| `graceful`    | `boolean` | `true`  | Use graceful close (FIN) vs abrupt (RST)   |

### Use Cases

- Test connection reset handling
- Verify TCP error recovery
- Test application behavior when SMTP connections fail mid-delivery

## Random Errors

Return random SMTP error codes to test error handling.

```javascript
await inbox.setChaosConfig({
	enabled: true,
	randomError: {
		enabled: true,
		errorRate: 0.1, // 10% of emails return errors
		errorTypes: ['temporary'], // Only 4xx errors
	},
});
```

### Configuration Options

```typescript
interface RandomErrorConfig {
	enabled: boolean;
	errorRate?: number; // 0.0-1.0, Default: 0.1
	errorTypes?: ChaosErrorType[]; // Default: ['temporary']
}

type ChaosErrorType = 'temporary' | 'permanent';
```

| Property     | Type               | Default         | Description                          |
| ------------ | ------------------ | --------------- | ------------------------------------ |
| `enabled`    | `boolean`          | -               | Enable/disable random errors         |
| `errorRate`  | `number`           | `0.1`           | Probability of returning an error    |
| `errorTypes` | `ChaosErrorType[]` | `['temporary']` | Types of errors to return            |

### Error Types

| Type        | SMTP Codes | Description                              |
| ----------- | ---------- | ---------------------------------------- |
| `temporary` | 4xx        | Temporary failures, should retry         |
| `permanent` | 5xx        | Permanent failures, should not retry     |

### Use Cases

- Test 4xx SMTP error handling and retry logic
- Test 5xx SMTP error handling and failure notifications
- Verify application handles both error types correctly

## Greylisting Simulation

Simulate greylisting behavior where the first delivery attempt is rejected and subsequent retries are accepted.

```javascript
await inbox.setChaosConfig({
	enabled: true,
	greylist: {
		enabled: true,
		retryWindowMs: 300000, // 5 minute window
		maxAttempts: 2, // Accept on second attempt
		trackBy: 'ip_sender', // Track by IP and sender combination
	},
});
```

### Configuration Options

```typescript
interface GreylistConfig {
	enabled: boolean;
	retryWindowMs?: number; // Default: 300000 (5 minutes)
	maxAttempts?: number; // Default: 2
	trackBy?: GreylistTrackBy; // Default: 'ip_sender'
}

type GreylistTrackBy = 'ip' | 'sender' | 'ip_sender';
```

| Property        | Type              | Default       | Description                                |
| --------------- | ----------------- | ------------- | ------------------------------------------ |
| `enabled`       | `boolean`         | -             | Enable/disable greylisting                 |
| `retryWindowMs` | `number`          | `300000`      | Window for tracking retries (5 min)        |
| `maxAttempts`   | `number`          | `2`           | Attempts before accepting                  |
| `trackBy`       | `GreylistTrackBy` | `'ip_sender'` | How to identify unique delivery attempts   |

### Tracking Methods

| Method      | Description                             |
| ----------- | --------------------------------------- |
| `ip`        | Track by sender IP only                 |
| `sender`    | Track by sender email only              |
| `ip_sender` | Track by combination of IP and sender   |

### Use Cases

- Test SMTP retry behavior when mail servers use greylisting
- Verify retry intervals and backoff logic
- Test handling of temporary 4xx rejections

## Blackhole Mode

Accept emails but silently discard them without storing.

```javascript
await inbox.setChaosConfig({
	enabled: true,
	blackhole: {
		enabled: true,
		triggerWebhooks: false, // Don't trigger webhooks for discarded emails
	},
});
```

### Configuration Options

```typescript
interface BlackholeConfig {
	enabled: boolean;
	triggerWebhooks?: boolean; // Default: false
}
```

| Property          | Type      | Default | Description                               |
| ----------------- | --------- | ------- | ----------------------------------------- |
| `enabled`         | `boolean` | -       | Enable/disable blackhole mode             |
| `triggerWebhooks` | `boolean` | `false` | Trigger webhooks for discarded emails     |

### Use Cases

- Test behavior when emails are silently lost
- Test webhook integration even when emails aren't stored
- Simulate email delivery that succeeds at SMTP level but fails at storage

## Auto-Expiring Chaos

Set chaos to automatically disable after a specific time:

```javascript
// Enable chaos for 1 hour
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

await inbox.setChaosConfig({
	enabled: true,
	expiresAt,
	latency: { enabled: true, maxDelayMs: 3000 },
});
```

After `expiresAt`, chaos is automatically disabled and normal email delivery resumes.

## Combining Chaos Scenarios

Multiple chaos features can be enabled simultaneously:

```javascript
await inbox.setChaosConfig({
	enabled: true,
	// 30% of emails delayed 1-5 seconds
	latency: {
		enabled: true,
		minDelayMs: 1000,
		maxDelayMs: 5000,
		probability: 0.3,
	},
	// 10% of emails return temporary errors
	randomError: {
		enabled: true,
		errorRate: 0.1,
		errorTypes: ['temporary'],
	},
});
```

## Complete Example

```javascript
import { VaultSandboxClient } from '@vaultsandbox/client';

async function testChaosResilience() {
	const client = new VaultSandboxClient({
		url: process.env.VAULTSANDBOX_URL,
		apiKey: process.env.VAULTSANDBOX_API_KEY,
	});

	// Check if chaos is available
	const serverInfo = await client.getServerInfo();
	if (!serverInfo.chaosEnabled) {
		console.log('Chaos features not available on this server');
		return;
	}

	try {
		// Create inbox with chaos enabled
		const inbox = await client.createInbox({
			chaos: {
				enabled: true,
				latency: {
					enabled: true,
					minDelayMs: 2000,
					maxDelayMs: 5000,
					probability: 0.5,
				},
				randomError: {
					enabled: true,
					errorRate: 0.1,
					errorTypes: ['temporary'],
				},
			},
		});

		console.log(`Testing with chaos: ${inbox.emailAddress}`);

		// Get current chaos configuration
		const config = await inbox.getChaosConfig();
		console.log('Chaos config:', JSON.stringify(config, null, 2));

		// Send test emails and verify handling
		// Your test logic here...

		// Update chaos configuration
		await inbox.setChaosConfig({
			enabled: true,
			greylist: {
				enabled: true,
				maxAttempts: 3,
			},
		});

		// More testing...

		// Disable chaos for normal operation tests
		await inbox.disableChaos();

		// Clean up
		await inbox.delete();
	} finally {
		await client.close();
	}
}

testChaosResilience().catch(console.error);
```

## Testing Patterns

### Test Retry Logic

```javascript
// Enable greylisting to test retry behavior
await inbox.setChaosConfig({
	enabled: true,
	greylist: { enabled: true, maxAttempts: 2 },
});

// Send email - first attempt will fail, retry should succeed
await sendEmail(inbox.emailAddress);

// If your mail sender retries correctly, email should arrive
const email = await inbox.waitForEmail({ timeout: 60000 });
```

### Test Timeout Handling

```javascript
// Enable high latency
await inbox.setChaosConfig({
	enabled: true,
	latency: { enabled: true, minDelayMs: 10000, maxDelayMs: 15000 },
});

// Test that your application handles timeouts correctly
try {
	await inbox.waitForEmail({ timeout: 5000 });
} catch (error) {
	// Expected: TimeoutError
	console.log('Timeout handled correctly');
}
```

### Test Error Recovery

```javascript
// Enable high error rate
await inbox.setChaosConfig({
	enabled: true,
	randomError: { enabled: true, errorRate: 0.8, errorTypes: ['temporary', 'permanent'] },
});

// Test that your application handles errors and retries appropriately
```

## Error Handling

```javascript
import { InboxNotFoundError, ApiError } from '@vaultsandbox/client';

try {
	await inbox.setChaosConfig({ enabled: true, latency: { enabled: true } });
} catch (error) {
	if (error instanceof InboxNotFoundError) {
		console.error('Inbox not found');
	} else if (error instanceof ApiError) {
		if (error.statusCode === 403) {
			console.error('Chaos features are disabled on this server');
		} else {
			console.error(`API error (${error.statusCode}): ${error.message}`);
		}
	}
}
```

## Next Steps

- [Inbox API Reference](/client-node/api/inbox/) - Complete inbox methods including chaos
- [Testing in CI/CD](/client-node/testing/cicd/) - Integrate chaos testing in pipelines
- [Error Handling](/client-node/api/errors/) - Handle chaos-related errors
