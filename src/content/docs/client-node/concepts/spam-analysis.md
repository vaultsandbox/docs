---
title: Spam Analysis
description: Working with spam analysis results in the Node.js SDK
---

VaultSandbox can analyze incoming emails for spam using [Rspamd](https://rspamd.com/). When enabled, emails include spam scores, classifications, and detailed rule information.

For server configuration and setup, see the [Gateway Spam Analysis documentation](/gateway/spam-analysis/).

## Enabling Spam Analysis

### Check Server Availability

First, verify spam analysis is enabled on the server:

```javascript
const info = await client.getServerInfo();

if (info.spamAnalysisEnabled) {
	console.log('Spam analysis is available');
} else {
	console.log('Spam analysis is not enabled on this server');
}
```

### Create Inbox with Spam Analysis

Enable spam analysis when creating an inbox:

```javascript
const inbox = await client.createInbox({ spamAnalysis: true });
console.log(`Spam analysis: ${inbox.spamAnalysis}`); // true
```

If not specified, inboxes use the server's default setting (`VSB_SPAM_ANALYSIS_INBOX_DEFAULT`).

## Accessing Spam Results

### SpamAnalysisResult Structure

Every email may include a `spamAnalysis` property:

```typescript
interface SpamAnalysisResult {
	status: 'analyzed' | 'skipped' | 'error';
	score?: number;
	requiredScore?: number;
	action?: SpamAction;
	isSpam?: boolean;
	symbols?: SpamSymbol[];
	processingTimeMs?: number;
	info?: string;
}

type SpamAction = 'no action' | 'greylist' | 'add header' | 'rewrite subject' | 'soft reject' | 'reject';

interface SpamSymbol {
	name: string;
	score: number;
	description?: string;
	options?: string[];
}
```

### Basic Usage

```javascript
const email = await inbox.waitForEmail({ timeout: 10000 });

if (email.spamAnalysis) {
	console.log(`Status: ${email.spamAnalysis.status}`);

	if (email.spamAnalysis.status === 'analyzed') {
		console.log(`Score: ${email.spamAnalysis.score}`);
		console.log(`Required: ${email.spamAnalysis.requiredScore}`);
		console.log(`Is spam: ${email.spamAnalysis.isSpam}`);
		console.log(`Action: ${email.spamAnalysis.action}`);
	}
}
```

### Helper Methods

The `Email` class provides convenient methods:

```javascript
// Check if email is spam
const isSpam = email.isSpam();
// Returns: true (spam), false (not spam), or null (not analyzed)

// Get the spam score
const score = email.getSpamScore();
// Returns: number (score) or null (not analyzed)
```

## Status Values

| Status | Description |
| :----- | :---------- |
| `analyzed` | Email was successfully analyzed by Rspamd |
| `skipped` | Analysis was skipped (disabled globally or per-inbox) |
| `error` | Analysis failed (timeout, Rspamd unavailable, etc.) |

## Action Values

Rspamd returns an action recommendation based on the spam score:

| Action | Description |
| :----- | :---------- |
| `no action` | Email is likely legitimate |
| `greylist` | Temporary rejection recommended |
| `add header` | Add spam header but deliver |
| `rewrite subject` | Modify subject line to indicate spam |
| `soft reject` | Temporary rejection |
| `reject` | Email should be rejected |

## Working with Symbols

Symbols represent individual spam detection rules that triggered:

```javascript
if (email.spamAnalysis?.symbols) {
	console.log('Triggered rules:');

	email.spamAnalysis.symbols.forEach((symbol) => {
		const sign = symbol.score >= 0 ? '+' : '';
		console.log(`  ${symbol.name}: ${sign}${symbol.score}`);

		if (symbol.description) {
			console.log(`    ${symbol.description}`);
		}

		if (symbol.options?.length) {
			console.log(`    Options: ${symbol.options.join(', ')}`);
		}
	});
}
```

Common symbol patterns:

- **Positive scores**: Spam indicators (e.g., `BAYES_SPAM`, `FORGED_SENDER`)
- **Negative scores**: Legitimate indicators (e.g., `DKIM_SIGNED`, `SPF_ALLOW`)

## Testing Patterns

### Verify Emails Are Not Spam

```javascript
test('transactional emails should not be flagged as spam', async () => {
	await sendPasswordResetEmail(inbox.emailAddress);

	const email = await inbox.waitForEmail({ timeout: 10000 });

	// Check spam status
	expect(email.isSpam()).toBe(false);

	// Optionally check score is low
	const score = email.getSpamScore();
	if (score !== null) {
		expect(score).toBeLessThan(5);
	}
});
```

### Check Spam Analysis Availability

```javascript
test('spam analysis should be performed', async () => {
	const inbox = await client.createInbox({ spamAnalysis: true });

	await sendEmail(inbox.emailAddress);
	const email = await inbox.waitForEmail({ timeout: 10000 });

	expect(email.spamAnalysis).toBeDefined();
	expect(email.spamAnalysis.status).toBe('analyzed');

	await inbox.delete();
});
```

### Analyze Triggered Rules

```javascript
test('should have valid DKIM signature', async () => {
	const email = await inbox.waitForEmail({ timeout: 10000 });

	if (email.spamAnalysis?.status === 'analyzed') {
		const symbols = email.spamAnalysis.symbols || [];
		const dkimSigned = symbols.find((s) => s.name === 'DKIM_SIGNED' || s.name === 'R_DKIM_ALLOW');

		// DKIM_SIGNED has negative score (indicates legitimate email)
		if (dkimSigned) {
			expect(dkimSigned.score).toBeLessThan(0);
		}
	}
});
```

### Handle Missing Analysis

```javascript
const email = await inbox.waitForEmail({ timeout: 10000 });

const spamStatus = email.isSpam();
const spamScore = email.getSpamScore();

if (spamStatus === null) {
	console.log('Spam analysis not available');
	console.log('Reason:', email.spamAnalysis?.info || 'Unknown');
} else {
	console.log(`Is spam: ${spamStatus}`);
	console.log(`Score: ${spamScore}`);
}
```

## Complete Example

```javascript
import { VaultSandboxClient } from '@vaultsandbox/client';

async function analyzeEmailSpam() {
	const client = new VaultSandboxClient({
		url: process.env.VAULTSANDBOX_URL,
		apiKey: process.env.VAULTSANDBOX_API_KEY,
	});

	try {
		// Check if spam analysis is available
		const info = await client.getServerInfo();
		if (!info.spamAnalysisEnabled) {
			console.log('Spam analysis not available on this server');
			return;
		}

		// Create inbox with spam analysis enabled
		const inbox = await client.createInbox({ spamAnalysis: true });
		console.log(`Inbox: ${inbox.emailAddress}`);

		// Wait for email
		const email = await inbox.waitForEmail({ timeout: 30000 });

		console.log('\n=== Email Details ===');
		console.log(`From: ${email.from}`);
		console.log(`Subject: ${email.subject}`);

		console.log('\n=== Spam Analysis ===');

		if (!email.spamAnalysis) {
			console.log('No spam analysis data');
		} else if (email.spamAnalysis.status !== 'analyzed') {
			console.log(`Status: ${email.spamAnalysis.status}`);
			console.log(`Info: ${email.spamAnalysis.info || 'N/A'}`);
		} else {
			console.log(`Score: ${email.spamAnalysis.score} / ${email.spamAnalysis.requiredScore}`);
			console.log(`Is Spam: ${email.isSpam()}`);
			console.log(`Action: ${email.spamAnalysis.action}`);
			console.log(`Processing Time: ${email.spamAnalysis.processingTimeMs}ms`);

			if (email.spamAnalysis.symbols?.length) {
				console.log('\nTriggered Rules:');
				email.spamAnalysis.symbols
					.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
					.slice(0, 10)
					.forEach((s) => {
						const sign = s.score >= 0 ? '+' : '';
						console.log(`  ${s.name}: ${sign}${s.score}`);
					});
			}
		}

		await inbox.delete();
	} finally {
		await client.close();
	}
}

analyzeEmailSpam().catch(console.error);
```

## Next Steps

- **[Gateway Spam Analysis](/gateway/spam-analysis/)** - Server configuration and Rspamd setup
- **[Email API Reference](/client-node/api/email/)** - Complete email API documentation
- **[Authentication Results](/client-node/concepts/auth-results/)** - Email authentication (SPF/DKIM/DMARC)
- **[Managing Inboxes](/client-node/guides/managing-inboxes/)** - Inbox creation options
