---
title: Client SDK Specification
description: Language-agnostic specification for implementing VaultSandbox client libraries with ML-KEM-768 encryption.
---

# VaultSandbox Client SDK Specification

A language-agnostic specification for implementing VaultSandbox client libraries. This document provides all necessary information to build a fully-functional SDK in any programming language.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Naming Conventions](#naming-conventions)
4. [Authentication](#authentication)
5. [Cryptographic Requirements](#cryptographic-requirements)
6. [API Reference](#api-reference)
7. [Data Structures](#data-structures)
8. [Delivery Strategies](#delivery-strategies)
9. [Error Handling](#error-handling)
10. [Behavioral Specifications](#behavioral-specifications)
11. [Implementation Checklist](#implementation-checklist)

---

## Overview

VaultSandbox is a secure, receive-only SMTP server designed for QA/testing environments. The client SDK enables:

- Creating temporary email inboxes with quantum-safe encryption
- Receiving and decrypting emails in real-time or via polling
- Validating email authentication (SPF/DKIM/DMARC)
- Zero cryptographic knowledge required from end users

### Key Features

- **Quantum-safe encryption**: ML-KEM-768 (Kyber768) + AES-256-GCM
- **Signature verification**: ML-DSA-65 (Dilithium3) before decryption
- **Real-time delivery**: Server-Sent Events (SSE) with polling fallback
- **Automatic retry**: Exponential backoff for transient failures

---

## Architecture

### Layer Overview

```
┌────────────────────────────────────────────────────────────┐
│                     User-Facing API                        │
│         (VaultSandboxClient, Inbox, Email classes)         │
├────────────────────────────────────────────────────────────┤
│                   Delivery Strategy Layer                  │
│              (SSE Strategy / Polling Strategy)             │
├────────────────────────────────────────────────────────────┤
│                       HTTP Layer                           │
│           (API Client with retry logic)                    │
├────────────────────────────────────────────────────────────┤
│                      Crypto Layer                          │
│    (ML-KEM-768, ML-DSA-65, AES-256-GCM, HKDF-SHA-512)      │
└────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component              | Responsibility                                             |
| ---------------------- | ---------------------------------------------------------- |
| **VaultSandboxClient** | Main entry point; manages inboxes, strategies, lifecycle   |
| **Inbox**              | Represents a single inbox; email operations, subscriptions |
| **Email**              | Represents a decrypted email with content and metadata     |
| **ApiClient**          | HTTP communication with retry logic                        |
| **DeliveryStrategy**   | Abstract interface for SSE/polling implementations         |
| **Crypto Module**      | Keypair generation, decryption, signature verification     |

### Client Configuration Options

SDKs should support these configuration options when creating a client:

| Option                    | Type       | Default                   | Description                                    |
| ------------------------- | ---------- | ------------------------- | ---------------------------------------------- |
| `apiKey`                  | string     | (required)                | API key for authentication                     |
| `baseUrl`                 | string     | Platform-specific         | VaultSandbox API base URL                      |
| `strategy`                | enum       | `auto`                    | Delivery strategy: `auto`, `sse`, `polling`    |
| `timeout`                 | number     | 30000                     | HTTP request timeout (ms)                      |
| `maxRetries`              | number     | 3                         | Maximum retry attempts for failed requests     |
| `retryDelay`              | number     | 1000                      | Base delay between retries (ms)                |
| `retryOn`                 | number[]   | [408,429,500,502,503,504] | HTTP status codes that trigger retry           |
| `pollingInterval`         | number     | 2000                      | Initial polling interval (ms)                  |
| `pollingMaxBackoff`       | number     | 30000                     | Maximum polling interval (ms)                  |
| `pollingBackoffMultiplier`| number     | 1.5                       | Polling backoff multiplier                     |
| `pollingJitterFactor`     | number     | 0.3                       | Random jitter factor (0-1)                     |
| `sseReconnectInterval`    | number     | 5000                      | SSE reconnection interval (ms)                 |
| `sseMaxReconnectAttempts` | number     | 10                        | Max SSE reconnection attempts                  |
| `sseConnectionTimeout`    | number     | 5000                      | SSE connection timeout for auto fallback (ms)  |
| `httpClient`              | object     | Platform default          | Custom HTTP client (optional)                  |
| `onSyncError`             | function   | null                      | Callback for background sync errors (optional) |

### Inbox Creation Options

| Option          | Type   | Default  | Description                               |
| --------------- | ------ | -------- | ----------------------------------------- |
| `ttl`           | number | 3600     | Time-to-live in seconds (60-604800)       |
| `emailAddress`  | string | null     | Desired email address or domain (optional)|

---

## Naming Conventions

This specification uses **camelCase** for all identifiers in the wire format (JSON payloads, API responses). SDK implementations should adapt to their language's idiomatic conventions:

| Language   | Public API Style | Example Method       | Example Field       |
|------------|------------------|----------------------|---------------------|
| JavaScript | camelCase        | `createInbox()`      | `email.authResults` |
| Go         | PascalCase       | `CreateInbox()`      | `Email.AuthResults` |
| Python     | snake_case       | `create_inbox()`     | `email.auth_results`|
| Rust       | snake_case       | `create_inbox()`     | `email.auth_results`|
| Java       | camelCase        | `createInbox()`      | `email.authResults` |

**Wire format remains camelCase regardless of SDK language.** For example, the JSON field `emailAddress` becomes:
- Go: `EmailAddress` (struct field)
- Python: `email_address` (attribute)
- JavaScript: `emailAddress` (property)

SDKs should handle this translation transparently during serialization/deserialization.

---

## Authentication

All API requests require the `X-API-Key` header.

```http
X-API-Key: your-api-key
Content-Type: application/json
```

### Validating API Key

Before any operations, validate the API key:

```http
GET /api/check-key
X-API-Key: your-api-key
```

**Response:**

```json
{
	"ok": true
}
```

---

## Cryptographic Requirements

### Algorithm Suite

| Purpose              | Algorithm              | Standard        |
| -------------------- | ---------------------- | --------------- |
| Key Encapsulation    | ML-KEM-768 (Kyber768)  | NIST FIPS 203   |
| Signature            | ML-DSA-65 (Dilithium3) | NIST FIPS 204   |
| Symmetric Encryption | AES-256-GCM            | NIST SP 800-38D |
| Key Derivation       | HKDF-SHA-512           | RFC 5869        |

### Key Sizes

| Key Type                  | Size (bytes) |
| ------------------------- | ------------ |
| ML-KEM-768 Public Key     | 1184         |
| ML-KEM-768 Secret Key     | 2400         |
| ML-KEM-768 Ciphertext     | 1088         |
| ML-KEM-768 Shared Secret  | 32           |
| ML-DSA-65 Public Key      | 1952         |
| ML-DSA-65 Signature       | 3309         |
| AES-256 Key               | 32           |
| AES-GCM Nonce             | 12           |
| AES-GCM Tag               | 16           |

### Constants

```
HKDF_CONTEXT = "vaultsandbox:email:v1"
ALGS_CIPHERSUITE = "ML-KEM-768:ML-DSA-65:AES-256-GCM:HKDF-SHA-512"
PUBLIC_KEY_START_OFFSET = 1152  # Byte offset where public key starts within ML-KEM-768 secret key
```

### Keypair Generation

Generate an ML-KEM-768 keypair for each inbox:

```python
# Pseudocode
keypair = ml_kem768.keygen()
# Returns:
#   - publicKey: Uint8Array (1184 bytes)
#   - secretKey: Uint8Array (2400 bytes)
#   - publicKeyB64: base64url(publicKey)
```

### Encrypted Payload Structure

All encrypted data from the server follows this structure:

```json
{
	"v": 1,
	"algs": {
		"kem": "ML-KEM-768",
		"sig": "ML-DSA-65",
		"aead": "AES-256-GCM",
		"kdf": "HKDF-SHA-512"
	},
	"ct_kem": "<base64url: KEM ciphertext>",
	"nonce": "<base64url: 12-byte nonce>",
	"aad": "<base64url: additional authenticated data>",
	"ciphertext": "<base64url: AES-GCM ciphertext + tag>",
	"sig": "<base64url: ML-DSA-65 signature>",
	"server_sig_pk": "<base64url: server's signing public key>"
}
```

### Decryption Flow

**CRITICAL: Always verify signature BEFORE decryption to detect tampering.**

```
1. VERIFY SIGNATURE (security-critical)
   ├── Build transcript from encrypted payload
   ├── Verify ML-DSA-65 signature
   └── ABORT if verification fails

2. KEM DECAPSULATION
   ├── Decode ct_kem from base64url
   └── sharedSecret = ml_kem768.decapsulate(ct_kem, secretKey)

3. KEY DERIVATION (HKDF-SHA-512)
   ├── salt = SHA-256(ct_kem)
   ├── info = context || aad_length(4 bytes, big-endian) || aad
   └── aesKey = HKDF-Expand(sharedSecret, salt, info, 32 bytes)

4. AES-256-GCM DECRYPTION
   ├── Decode nonce, aad, ciphertext from base64url
   └── plaintext = AES-GCM-Decrypt(aesKey, nonce, aad, ciphertext)
```

### Signature Verification

Build the transcript exactly as the server does:

```
transcript = version (1 byte)
           || algs_ciphersuite (string: "ML-KEM-768:ML-DSA-65:AES-256-GCM:HKDF-SHA-512")
           || context (string: "vaultsandbox:email:v1")
           || ct_kem (bytes)
           || nonce (bytes)
           || aad (bytes)
           || ciphertext (bytes)
           || server_sig_pk (bytes)

valid = ml_dsa65.verify(signature, transcript, server_sig_pk)
```

### Server Key Pinning (Security Critical)

**CRITICAL:** When verifying signatures, the client MUST compare the payload's `server_sig_pk` against the pinned server public key captured at inbox creation time. This prevents man-in-the-middle attacks where an attacker could inject payloads signed with their own key.

```python
# Pseudocode
def verify_with_pinning(encrypted_payload, pinned_server_pk):
    payload_server_pk = from_base64url(encrypted_payload.server_sig_pk)

    # Security check: reject if server keys don't match
    if payload_server_pk != pinned_server_pk:
        raise ServerKeyMismatchError("Server key in payload does not match pinned key - possible MITM attack")

    # Proceed with signature verification using the pinned key
    return verify_signature(encrypted_payload, pinned_server_pk)
```

### Deriving Public Key from Secret Key

In ML-KEM-768, the secret key structure is:
```
secretKey = cpaPrivateKey || cpaPublicKey || h || z
```
Where:
- `cpaPrivateKey`: 1152 bytes (12 × k × n / 8, k=3, n=256)
- `cpaPublicKey`: 1184 bytes (the public key)
- `h`: 32 bytes (hash of public key)
- `z`: 32 bytes (random seed)

The public key starts at byte offset 1152:

```python
public_key = secret_key[1152:2336]  # Bytes 1152-2335 (1184 bytes)
```

**Library-Specific Note:** The offset approach (1152) follows NIST FIPS 203 and works with libraries like `cloudflare/circl`. Some libraries may use different internal representations. Always verify with your chosen library's documentation and test against the server.

---

## API Reference

### Base URL

Configurable per deployment. Example: `https://smtp.vaultsandbox.com`

### Server Information

#### GET /api/server-info

Returns server cryptographic configuration.

**Response:**

```json
{
	"serverSigPk": "<base64url: server ML-DSA-65 public key>",
	"algs": {
		"kem": "ML-KEM-768",
		"sig": "ML-DSA-65",
		"aead": "AES-256-GCM",
		"kdf": "HKDF-SHA-512"
	},
	"context": "vaultsandbox:email:v1",
	"maxTtl": 604800,
	"defaultTtl": 3600,
	"sseConsole": false,
	"allowedDomains": ["vaultsandbox.test", "example.com"]
}
```

| Field            | Type     | Description                                               |
| ---------------- | -------- | --------------------------------------------------------- |
| `serverSigPk`    | string   | Base64URL-encoded server signing public key for ML-DSA-65 |
| `algs`           | object   | Cryptographic algorithms supported by the server          |
| `context`        | string   | Context string for the encryption scheme                  |
| `maxTtl`         | number   | Maximum time-to-live for inboxes in seconds               |
| `defaultTtl`     | number   | Default time-to-live for inboxes in seconds               |
| `sseConsole`     | boolean  | Whether server SSE console logging is enabled             |
| `allowedDomains` | string[] | List of domains allowed for inbox creation                |

### Inbox Management

#### POST /api/inboxes

Creates a new inbox.

**Request:**

```json
{
	"clientKemPk": "<base64url: client ML-KEM-768 public key>",
	"ttl": 3600,
	"emailAddress": "user@example.com"
}
```

| Field          | Type   | Required | Description                                     |
| -------------- | ------ | -------- | ----------------------------------------------- |
| `clientKemPk`  | string | Yes      | Base64url-encoded ML-KEM-768 public key         |
| `ttl`          | number | No       | Time-to-live in seconds (min: 60, max: 604800)  |
| `emailAddress` | string | No       | Desired email address or domain (max 254 chars) |

**Response:**

```json
{
	"emailAddress": "abc123@mail.example.com",
	"expiresAt": "2024-01-15T12:00:00.000Z",
	"inboxHash": "<base64url: SHA-256 hash of client KEM public key>",
	"serverSigPk": "<base64url: server signing public key>"
}
```

| Field          | Type   | Description                                                  |
| -------------- | ------ | ------------------------------------------------------------ |
| `emailAddress` | string | The email address assigned to the inbox                      |
| `expiresAt`    | string | ISO 8601 timestamp when the inbox will expire                |
| `inboxHash`    | string | Base64URL-encoded SHA-256 hash of the client KEM public key  |
| `serverSigPk`  | string | Base64URL-encoded server signing public key for verification |

#### DELETE /api/inboxes/{emailAddress}

Deletes a specific inbox. Idempotent.

**Response:** `204 No Content`

#### DELETE /api/inboxes

Deletes all inboxes for the API key.

**Response:**

```json
{
	"deleted": 5
}
```

#### GET /api/inboxes/{emailAddress}/sync

Returns inbox sync status for efficient polling.

**Response:**

```json
{
	"emailCount": 3,
	"emailsHash": "hash-of-email-ids"
}
```

| Field        | Type   | Description                                           |
| ------------ | ------ | ----------------------------------------------------- |
| `emailCount` | number | Number of emails currently in the inbox               |
| `emailsHash` | string | Hash of email IDs; changes indicate new/deleted emails|

**Usage:** Compare `emailsHash` to detect changes without fetching all emails. This enables efficient polling by skipping unchanged inboxes.

### Email Operations

#### GET /api/inboxes/{emailAddress}/emails

Lists all emails in an inbox (metadata only).

**Note:** The server returns only metadata (sender, subject, date) for this endpoint. To retrieve the full email content (body, attachments), the client library **must** fetch each email individually using `GET /api/inboxes/{emailAddress}/emails/{emailId}`.

**Response:**

```json
[
	{
		"id": "email-uuid",
		"inboxId": "inbox-hash",
		"receivedAt": "2024-01-15T12:00:00.000Z",
		"isRead": false,
		"encryptedMetadata": {
			/* EncryptedPayload */
		}
	}
]
```

#### GET /api/inboxes/{emailAddress}/emails/{emailId}

Retrieves a specific email with full content.

**Response:**

```json
{
	"id": "email-uuid",
	"inboxId": "inbox-hash",
	"receivedAt": "2024-01-15T12:00:00.000Z",
	"isRead": false,
	"encryptedMetadata": {
		/* EncryptedPayload - email headers */
	},
	"encryptedParsed": {
		/* EncryptedPayload - full email body, attachments, auth results */
	}
}
```

**Note:** Unlike the list endpoint, this returns `encryptedParsed` which contains the complete email body, HTML content, attachments, links, and authentication results.

#### GET /api/inboxes/{emailAddress}/emails/{emailId}/raw

Retrieves the raw email source (encrypted).

**Response:**

```json
{
	"id": "email-uuid",
	"encryptedRaw": {
		/* EncryptedPayload */
	}
}
```

#### PATCH /api/inboxes/{emailAddress}/emails/{emailId}/read

Marks an email as read.

**Response:** `204 No Content`

#### DELETE /api/inboxes/{emailAddress}/emails/{emailId}

Deletes a specific email.

**Response:** `204 No Content`

### Real-time Events

#### GET /api/events?inboxes={inboxHashes}

Server-Sent Events endpoint for real-time email notifications.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `inboxes` | string | Comma-separated inbox hashes |

**Headers:**

```http
X-API-Key: your-api-key
Accept: text/event-stream
```

**Event Format:**

```
data: {"inboxId":"inbox-hash","emailId":"email-uuid","encryptedMetadata":{...}}
```

| Field               | Type            | Description                                 |
| ------------------- | --------------- | ------------------------------------------- |
| `inboxId`           | string          | The inbox hash that received the email      |
| `emailId`           | string          | Unique identifier for the new email         |
| `encryptedMetadata` | EncryptedPayload| Encrypted email metadata (from, to, subject)|

**Note:** SSE events only include metadata. To get full email content (body, attachments), fetch the email by ID after receiving the notification.

**Connection Management:**

1. Subscribe to inboxes by adding their hashes to the query parameter
2. On connection open, reset reconnection counter
3. On connection error, disconnect and attempt reconnection with exponential backoff
4. When adding/removing inbox subscriptions, reconnect with updated hash list
5. On reconnection success, sync all inboxes to catch emails received during downtime

---

## Data Structures

### Decrypted Email Metadata

After decrypting `encryptedMetadata`:

```json
{
	"from": "sender@example.com",
	"to": ["recipient@mail.example.com"],
	"subject": "Welcome Email",
	"receivedAt": "2024-01-15T12:00:00.000Z"
}
```

### Email Object Structure

The fully decrypted Email object exposed to users:

```json
{
	"id": "email-uuid",
	"from": "sender@example.com",
	"to": ["recipient@mail.example.com"],
	"subject": "Welcome Email",
	"text": "Plain text content",
	"html": "<html>HTML content</html>",
	"receivedAt": "2024-01-15T12:00:00.000Z",
	"isRead": false,
	"headers": {
		"message-id": "<abc123@example.com>",
		"date": "Mon, 15 Jan 2024 12:00:00 +0000"
	},
	"attachments": [/* AttachmentData[] */],
	"links": ["https://example.com/verify?token=abc123"],
	"authResults": {/* AuthResults */},
	"metadata": {}
}
```

| Field         | Type              | Description                                      |
| ------------- | ----------------- | ------------------------------------------------ |
| `id`          | string            | Unique email identifier                          |
| `from`        | string            | Sender email address                             |
| `to`          | string[]          | Recipient email addresses                        |
| `subject`     | string            | Email subject line                               |
| `text`        | string \| null    | Plain text body (null if not available)          |
| `html`        | string \| null    | HTML body (null if not available)                |
| `receivedAt`  | Date/string       | When email was received                          |
| `isRead`      | boolean           | Read status                                      |
| `headers`     | object            | Email headers as key-value pairs                 |
| `attachments` | AttachmentData[]  | Email attachments                                |
| `links`       | string[]          | URLs extracted from email body                   |
| `authResults` | AuthResults       | SPF/DKIM/DMARC/ReverseDNS results                |
| `metadata`    | object            | Additional metadata (reserved for extensions)    |

### Decrypted Email Content

After decrypting `encryptedParsed`:

```json
{
	"text": "Plain text content",
	"html": "<html>HTML content</html>",
	"headers": {
		"message-id": "<abc123@example.com>",
		"date": "Mon, 15 Jan 2024 12:00:00 +0000"
	},
	"attachments": [
		{
			"filename": "document.pdf",
			"contentType": "application/pdf",
			"size": 15234,
			"contentId": "part123@example.com",
			"contentDisposition": "attachment",
			"content": "<base64: file content>",
			"checksum": "<optional: SHA-256 hash>"
		}
	],
	"metadata": {
		/* Additional metadata associated with the email */
	},
	"links": ["https://example.com/verify?token=abc123"],
	"authResults": {
		"spf": {
			/* SPFResult */
		},
		"dkim": [
			/* DKIMResult[] */
		],
		"dmarc": {
			/* DMARCResult */
		},
		"reverseDns": {
			/* ReverseDNSResult */
		}
	}
}
```

### Authentication Results

#### Validation Logic

Client libraries should provide a validation helper that verifies:

1. **SPF**: `result` must be `"pass"`
2. **DKIM**: At least one entry in the array must have `result: "pass"`
3. **DMARC**: `result` must be `"pass"`
4. **Reverse DNS**: `verified` must be `true`

**Note:** The overall `passed` status only considers SPF, DKIM, and DMARC. Reverse DNS is checked separately and does not affect the overall pass/fail status.

#### Validation Result

The `validate()` method returns a validation summary:

```json
{
	"passed": false,
	"spfPassed": true,
	"dkimPassed": true,
	"dmarcPassed": false,
	"reverseDnsPassed": true,
	"failures": ["DMARC policy: fail (policy: reject)"]
}
```

| Field              | Type       | Description                                              |
| ------------------ | ---------- | -------------------------------------------------------- |
| `passed`           | `boolean`  | True if SPF, DKIM, and DMARC all passed                  |
| `spfPassed`        | `boolean`  | True if SPF result is `"pass"`                           |
| `dkimPassed`       | `boolean`  | True if at least one DKIM signature passed               |
| `dmarcPassed`      | `boolean`  | True if DMARC result is `"pass"`                         |
| `reverseDnsPassed` | `boolean`  | True if reverse DNS `verified` is `true`                 |
| `failures`         | `string[]` | Human-readable descriptions of failed checks             |

SDKs may also provide a convenience method like `isPassing()` that returns the `passed` value directly.

#### SPF Result

```json
{
	"result": "pass",
	"domain": "example.com",
	"ip": "192.0.2.1",
	"details": "SPF record validated"
}
```

| Field     | Type     | Description                      |
| --------- | -------- | -------------------------------- |
| `result`  | `string` | SPF check result (see values)    |
| `domain`  | `string` | Domain checked (optional)        |
| `ip`      | `string` | Sender IP address (optional)     |
| `details` | `string` | Human-readable details (optional)|

| Result      | Meaning                 |
| ----------- | ----------------------- |
| `pass`      | Authorized sender       |
| `fail`      | Not authorized          |
| `softfail`  | Probably not authorized |
| `neutral`   | No assertion            |
| `none`      | No SPF record           |
| `temperror` | Temporary error         |
| `permerror` | Permanent error         |

#### DKIM Result

```json
{
	"result": "pass",
	"domain": "example.com",
	"selector": "selector1",
	"signature": "base64-encoded-sig"
}
```

| Field      | Type     | Description                       |
| ---------- | -------- | --------------------------------- |
| `result`   | `string` | DKIM check result (see values)    |
| `domain`   | `string` | Signing domain (optional)         |
| `selector` | `string` | DKIM selector (optional)          |
| `signature`| `string` | DKIM signature info (optional)    |

| Result | Meaning           |
| ------ | ----------------- |
| `pass` | Valid signature   |
| `fail` | Invalid signature |
| `none` | No signature      |

#### DMARC Result

```json
{
	"result": "pass",
	"policy": "reject",
	"aligned": true,
	"domain": "example.com"
}
```

| Field     | Type      | Description                        |
| --------- | --------- | ---------------------------------- |
| `result`  | `string`  | DMARC check result (see values)    |
| `policy`  | `string`  | Domain's DMARC policy (optional)   |
| `aligned` | `boolean` | Whether SPF/DKIM aligned (optional)|
| `domain`  | `string`  | Domain checked (optional)          |

| Result | Meaning         |
| ------ | --------------- |
| `pass` | DMARC passed    |
| `fail` | DMARC failed    |
| `none` | No DMARC policy |

| Policy       | Meaning         |
| ------------ | --------------- |
| `none`       | Monitoring only |
| `quarantine` | Treat as spam   |
| `reject`     | Reject email    |

#### Reverse DNS Result

```json
{
	"verified": true,
	"ip": "192.0.2.1",
	"hostname": "mail.example.com"
}
```

| Field      | Type      | Description                        |
| ---------- | --------- | ---------------------------------- |
| `verified` | `boolean` | Whether reverse DNS verified       |
| `ip`       | `string`  | Server IP address (optional)       |
| `hostname` | `string`  | Resolved hostname (optional)       |

**Note:** Unlike other auth results, ReverseDNS uses a `verified` boolean instead of a `result` string. SDKs may provide a convenience method like `isPassing()` that returns `verified`.

### Exported Inbox Data

For persistence/sharing:

```json
{
	"emailAddress": "abc123@mail.example.com",
	"expiresAt": "2024-01-15T12:00:00.000Z",
	"inboxHash": "sha256-hash",
	"serverSigPk": "<base64url: server signing key>",
	"publicKeyB64": "<base64url: client public key>",
	"secretKeyB64": "<base64url: client secret key>",
	"exportedAt": "2024-01-14T12:00:00.000Z"
}
```

**Security Warning:** Exported data contains private keys. Handle securely.

---

## Delivery Strategies

### Strategy Selection

The `/api/events` SSE endpoint is always available on the server.

| Strategy  | Use Case                                                          |
| --------- | ----------------------------------------------------------------- |
| `sse`     | Real-time updates, low latency                                    |
| `polling` | Firewall restrictions, simpler implementation                     |
| `auto`    | Recommended default; tries SSE first, falls back to polling if unavailable |

### SSE Strategy

#### Connection

```
GET /api/events?inboxes=hash1,hash2,hash3
X-API-Key: your-api-key
Accept: text/event-stream
```

#### Event Handling

```python
# Pseudocode
for event in sse_stream:
    data = json.parse(event.data)
    inbox = find_inbox_by_hash(data.inboxId)
    email = decrypt_email(data.encryptedMetadata, inbox.keypair)
    notify_callbacks(inbox, email)
```

#### Reconnection

- Initial interval: 5000ms
- Max attempts: 10
- Backoff multiplier: 2x
- Reset attempts on successful connection

### Polling Strategy

#### Algorithm

```python
# Pseudocode
last_hash = None
current_backoff = initial_interval  # 2000ms

while not timeout:
    sync_status = GET /api/inboxes/{email}/sync

    if last_hash != sync_status.emailsHash:
        last_hash = sync_status.emailsHash
        emails = GET /api/inboxes/{email}/emails
        current_backoff = initial_interval  # Reset on change

        for email in decrypt_emails(emails):
            if matches_filters(email):
                return email
    else:
        # Exponential backoff when no changes
        current_backoff = min(current_backoff * 1.5, max_backoff)

    jitter = random() * 0.3 * current_backoff
    sleep(current_backoff + jitter)
```

#### Configuration

| Parameter           | Default | Description            |
| ------------------- | ------- | ---------------------- |
| `initialInterval`   | 2000ms  | Starting poll interval |
| `maxBackoff`        | 30000ms | Maximum backoff delay  |
| `backoffMultiplier` | 1.5     | Backoff growth factor  |
| `jitterFactor`      | 0.3     | Random jitter (0-30%)  |

---

## Error Handling

### Error Hierarchy

```
VaultSandboxError (base)
├── ApiError (HTTP errors)
│   └── Contains: statusCode, message, requestId (optional)
├── NetworkError (connection failures)
├── TimeoutError (operation timeouts)
├── InboxNotFoundError (404 for inbox)
├── EmailNotFoundError (404 for email)
├── InboxAlreadyExistsError (import conflict)
├── InvalidImportDataError (validation failure)
├── DecryptionError (crypto failure)
├── SignatureVerificationError (tampering detected)
│   └── ServerKeyMismatchError (server key doesn't match pinned key - possible MITM)
├── SSEError (SSE connection issues)
├── StrategyError (strategy configuration)
├── RateLimitedError (429 - too many requests)
├── UnauthorizedError (401 - invalid API key)
└── ClientClosedError (operation on closed client)
```

### HTTP Retry Logic

#### Retryable Status Codes

```
408 - Request Timeout
429 - Too Many Requests
500 - Internal Server Error
502 - Bad Gateway
503 - Service Unavailable
504 - Gateway Timeout
```

#### Retry Algorithm

```python
# Pseudocode
retry_delay = 1000  # ms
max_retries = 3

for attempt in range(max_retries + 1):
    try:
        return http_request()
    except RetryableError:
        if attempt < max_retries:
            sleep(retry_delay * (2 ** attempt))  # Exponential backoff
        else:
            raise
```

### Critical Errors

**SignatureVerificationError** and **DecryptionError** should:

1. Be logged immediately with full context
2. Never be silently ignored
3. Halt the operation
4. Potentially trigger security alerts

---

## Behavioral Specifications

### Default Values

| Configuration              | Default  | Description                                        |
| -------------------------- | -------- | -------------------------------------------------- |
| HTTP timeout               | 30000ms  | Maximum time for HTTP request completion           |
| Wait timeout               | 30000ms  | Maximum time to wait for email arrival             |
| Poll interval (initial)    | 2000ms   | Starting interval for polling strategy             |
| Poll max backoff           | 30000ms  | Maximum polling interval after backoff             |
| Poll backoff multiplier    | 1.5      | Multiplier for exponential backoff                 |
| Poll jitter factor         | 0.3      | Random jitter (0-30%) to prevent thundering herd   |
| Max retries                | 3        | Maximum HTTP retry attempts                        |
| Retry delay                | 1000ms   | Base delay between retries (doubles each attempt)  |
| SSE reconnect interval     | 5000ms   | Initial SSE reconnection delay                     |
| SSE max reconnect attempts | 10       | Maximum SSE reconnection attempts before fallback  |
| SSE backoff multiplier     | 2        | SSE reconnection backoff multiplier                |
| SSE connection timeout     | 5000ms   | Time to wait for SSE before falling back (auto)    |
| Default inbox TTL          | 3600s    | Default inbox time-to-live (1 hour)                |
| Min inbox TTL              | 60s      | Minimum allowed inbox TTL                          |
| Max inbox TTL              | 604800s  | Maximum allowed inbox TTL (7 days)                 |

### Email Filtering

`waitForEmail` supports these filter options:

| Filter         | Type            | Description            |
| -------------- | --------------- | ---------------------- |
| `subject`      | string \| regex | Match email subject    |
| `from`         | string \| regex | Match sender address   |
| `predicate`    | function        | Custom filter function |
| `timeout`      | number          | Max wait time (ms), default 30000     |
| `pollInterval` | number          | Polling interval (ms)  |

### Inbox Lifecycle

1. **Create**: Generate keypair, register with server
2. **Use**: Receive emails, decrypt, process
3. **Export** (optional): Save keypair + metadata
4. **Delete**: Clean up server resources

### Inbox Methods

| Method               | Description                                          | Returns              |
| -------------------- | ---------------------------------------------------- | -------------------- |
| `getEmails()`        | Fetch and decrypt all emails                         | `Email[]`            |
| `getEmail(id)`       | Fetch and decrypt specific email                     | `Email`              |
| `getRawEmail(id)`    | Get decrypted raw RFC 5322 source                    | `string`             |
| `waitForEmail(opts)` | Wait for email matching filters                      | `Email`              |
| `waitForEmailCount(n, opts)` | Wait for at least N matching emails          | `Email[]`            |
| `watch()`            | Subscribe to new emails (returns channel/observable) | `Channel<Email>`     |
| `onNewEmail(cb)`     | Subscribe with callback                              | `Subscription`       |
| `getSyncStatus()`    | Get email count and hash for change detection        | `SyncStatus`         |
| `markEmailAsRead(id)`| Mark email as read                                   | `void`               |
| `deleteEmail(id)`    | Delete specific email                                | `void`               |
| `delete()`           | Delete inbox and all emails                          | `void`               |
| `export()`           | Export inbox data including keys                     | `ExportedInboxData`  |
| `isExpired()`        | Check if inbox TTL has passed                        | `boolean`            |

### Email Methods

Email objects may include convenience methods for common operations:

| Method         | Description                       | Returns     |
| -------------- | --------------------------------- | ----------- |
| `markAsRead()` | Mark this email as read           | `void`      |
| `delete()`     | Delete this email                 | `void`      |
| `getRaw()`     | Fetch raw RFC 5322 source         | `RawEmail`  |

### Client Methods

| Method                    | Description                                  | Returns              |
| ------------------------- | -------------------------------------------- | -------------------- |
| `createInbox(opts)`       | Create new inbox with auto-generated keypair | `Inbox`              |
| `importInbox(data)`       | Import inbox from exported data              | `Inbox`              |
| `importInboxFromFile(path)` | Import inbox from JSON file                | `Inbox`              |
| `exportInboxToFile(inbox, path)` | Export inbox to JSON file             | `void`               |
| `deleteInbox(email)`      | Delete specific inbox                        | `void`               |
| `deleteAllInboxes()`      | Delete all inboxes for API key               | `number` (count)     |
| `getInbox(email)`         | Get tracked inbox by email address           | `Inbox?`             |
| `getInboxes()`            | Get all tracked inboxes                      | `Inbox[]`            |
| `watchInboxes(inboxes)`   | Monitor multiple inboxes simultaneously      | `InboxMonitor`       |
| `getServerInfo()`         | Get server configuration                     | `ServerInfo`         |
| `checkKey()`              | Validate API key                             | `boolean`            |
| `close()`                 | Close client and release resources           | `void`               |

### Subscription Pattern

For real-time email notifications, implement a subscription interface:

```python
# Pseudocode
class Subscription:
    def unsubscribe(self):
        """Stop receiving notifications and clean up resources"""
        pass

# Usage
subscription = inbox.on_new_email(lambda email: print(email.subject))
# ... later ...
subscription.unsubscribe()
```

### InboxMonitor (Multiple Inbox Watching)

For monitoring multiple inboxes simultaneously:

```python
# Pseudocode
monitor = client.watch_inboxes([inbox1, inbox2, inbox3])
monitor.on('email', lambda inbox, email:
    print(f"New email in {inbox.email_address}: {email.subject}")
)
# ... later ...
monitor.unsubscribe()  # Stop all subscriptions
```

### Email Processing Flow

```
1. Receive encrypted email data
2. Verify ML-DSA-65 signature (MUST be first)
3. Decapsulate KEM ciphertext
4. Derive AES key via HKDF
5. Decrypt metadata (from, to, subject)
6. Decrypt parsed content (text, html, attachments)
7. Decode attachment content from base64
8. Build Email object with all fields
```

---

## Implementation Checklist

### Core Requirements

- [ ] ML-KEM-768 keypair generation
- [ ] ML-KEM-768 decapsulation
- [ ] ML-DSA-65 signature verification
- [ ] Server key pinning (compare payload key vs pinned key)
- [ ] AES-256-GCM decryption
- [ ] HKDF-SHA-512 key derivation with correct salt/info construction
- [ ] Base64url encoding/decoding
- [ ] HTTP client with retry logic
- [ ] API key authentication
- [ ] Derive public key from secret key (offset 1152)

### Client Features

- [ ] Create inbox with auto-generated keypair
- [ ] Delete inbox / delete all inboxes
- [ ] Get inbox by email address
- [ ] List all tracked inboxes
- [ ] List emails in inbox (metadata only)
- [ ] Get specific email by ID (with full content)
- [ ] Get raw email source
- [ ] Mark email as read
- [ ] Delete email
- [ ] Wait for email with filters (subject, from, predicate)
- [ ] Wait for email count
- [ ] Watch/subscribe to single inbox
- [ ] Get sync status for change detection
- [ ] Check inbox expiration

### Delivery Strategies

- [ ] SSE strategy with reconnection and backoff
- [ ] Polling strategy with exponential backoff and jitter
- [ ] Auto strategy (SSE with polling fallback)
- [ ] Strategy-agnostic subscription interface
- [ ] Sync after SSE reconnection (catch missed emails)

### Advanced Features

- [ ] Export inbox (keypair + metadata to JSON)
- [ ] Import inbox from exported data
- [ ] Import/export to file
- [ ] Monitor multiple inboxes simultaneously (InboxMonitor)
- [ ] Authentication results validation helper
- [ ] Custom HTTP client support

### Error Handling

- [ ] All error types from hierarchy
- [ ] HTTP retry with exponential backoff
- [ ] Timeout handling for all operations
- [ ] SSE reconnection with backoff
- [ ] Server key mismatch detection (MITM protection)
- [ ] Graceful client close/cleanup

### Email Object

- [ ] All fields populated (id, from, to, subject, text, html, etc.)
- [ ] Convenience methods (markAsRead, delete, getRaw)
- [ ] Auth results with validation method
- [ ] Attachment content base64 decoding

### Testing

- [ ] Unit tests for crypto operations
- [ ] Unit tests for transcript construction
- [ ] Unit tests for HKDF key derivation
- [ ] Integration tests against live server
- [ ] Error scenario coverage
- [ ] Concurrent inbox handling
- [ ] Import/export round-trip tests

---

## Appendix: Base64url Encoding

VaultSandbox uses URL-safe Base64 (RFC 4648 Section 5):

```
Standard Base64: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
URL-safe Base64: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

- Replace `+` with `-`
- Replace `/` with `_`
- No padding (`=`) required

### Encoding

```python
def to_base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')
```

### Decoding

```python
def from_base64url(s: str) -> bytes:
    # Add padding if needed
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += '=' * padding
    return base64.urlsafe_b64decode(s)
```

---

## Appendix: Transcript Construction

For signature verification, the transcript must be constructed byte-for-byte identical to the server:

```python
def build_transcript(encrypted_data):
    version_bytes = bytes([encrypted_data.v])  # 1 byte

    algs = encrypted_data.algs
    algs_ciphersuite = f"{algs.kem}:{algs.sig}:{algs.aead}:{algs.kdf}"
    algs_bytes = algs_ciphersuite.encode('utf-8')

    context_bytes = HKDF_CONTEXT.encode('utf-8')  # "vaultsandbox:email:v1"

    ct_kem = from_base64url(encrypted_data.ct_kem)
    nonce = from_base64url(encrypted_data.nonce)
    aad = from_base64url(encrypted_data.aad)
    ciphertext = from_base64url(encrypted_data.ciphertext)
    server_sig_pk = from_base64url(encrypted_data.server_sig_pk)

    return (
        version_bytes +
        algs_bytes +
        context_bytes +
        ct_kem +
        nonce +
        aad +
        ciphertext +
        server_sig_pk
    )
```

---

## Appendix: HKDF Key Derivation

```python
def derive_key(shared_secret, context, aad, ct_kem):
    # Salt is SHA-256 hash of KEM ciphertext
    salt = sha256(ct_kem)

    # Info construction
    context_bytes = context.encode('utf-8')  # "vaultsandbox:email:v1"
    aad_length = len(aad).to_bytes(4, 'big')  # 4 bytes, big-endian
    info = context_bytes + aad_length + aad

    # HKDF with SHA-512
    return hkdf_sha512(
        ikm=shared_secret,
        salt=salt,
        info=info,
        length=32  # 256 bits for AES-256
    )
```

---

## Version History

| Version | Date       | Changes                                                        |
| ------- | ---------- | -------------------------------------------------------------- |
| 0.7.0   | 2025-12-30 | Simplified auth results: SDKs use wire format field names      |
|         |            | (`result`, `details`, `signature`, `verified`) directly.       |
|         |            | Removed JSON→SDK field mapping requirement.                    |
| 0.6.0   | 2025-12-30 | Added: key sizes, client config options, inbox/email methods,  |
|         |            | server key pinning, auth results JSON mapping, error types,    |
|         |            | subscription patterns, expanded checklist                      |
| 0.5.0   | 2025-12    | Initial specification                                          |
