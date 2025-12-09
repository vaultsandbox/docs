---
title: Architecture Overview
description: Understanding VaultSandbox's system components and zero-knowledge security model
---

VaultSandbox is built on a zero-knowledge architecture that ensures email privacy while maintaining production-like testing fidelity. This page explains how the system works and why it's designed this way.

## System Components

VaultSandbox consists of three main components:

### 1. Backend (Gateway)

A NestJS-based service that provides:

- **Dynamic SMTP Server**: Accepts inbound email on port 25 with full TLS support
- **REST API**: Manages inboxes, emails, and API keys
- **Real-time Notifications**: Server-Sent Events (SSE) for instant email delivery
- **Email Authentication**: SPF, DKIM, DMARC, and reverse DNS validation
- **Cryptographic Operations**: Message signing with ML-DSA-65 (Dilithium3)

**Key Characteristic**: The backend encrypts emails immediately upon receipt and never stores plaintext.

### 2. Frontend (Web UI)

An Angular-based single-page application that provides:

- **Inbox Management**: Create, view, and delete inboxes
- **Email Viewer**: Rich HTML preview and header inspection
- **Authentication Results**: Visual display of SPF/DKIM/DMARC status
- **Link Extraction**: Automatic detection and testing of email links
- **Client-side Decryption**: All email decryption happens in the browser

**Key Characteristic**: The frontend generates encryption keypairs locally and decrypts emails in the browser.

### 3. Node.js Client SDK

A developer-focused SDK for automated testing:

- **Automatic Encryption**: Transparent ML-KEM-768 keypair generation
- **Smart Email Delivery**: SSE-based real-time delivery or efficient polling
- **Email Assertions**: Helper methods for testing email content and authentication
- **CI/CD Optimized**: Designed for test automation and pipelines

**Key Characteristic**: Developers never interact with keys or encryption—everything is automatic.

## Zero-Knowledge Security Model

VaultSandbox implements a zero-knowledge architecture where the server cannot read your emails.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Email Receipt Flow                           │
└─────────────────────────────────────────────────────────────────┘

1. Inbox Creation
   ┌─────────┐                                    ┌─────────┐
   │ Client  │  Generate ML-KEM-768 keypair       │ Server  │
   │         │  (private key stays local)         │         │
   │         │ ────────────────────────────────>  │         │
   │         │  Send public key only              │         │
   └─────────┘                                    └─────────┘

2. Email Arrival
   ┌─────────┐                                    ┌─────────┐
   │  SMTP   │  Raw email arrives via SMTP        │ Server  │
   │ Sender  │ ────────────────────────────────>  │         │
   │         │  (plaintext over TLS)              │         │
   └─────────┘                                    └─────────┘

3. Immediate Encryption
                                                  ┌─────────┐
                                                  │ Server  │
                                                  │         │
   • Parse email (headers, body, attachments)     │ ✓ Parse |
   • Validate SPF, DKIM, DMARC                    │ ✓ Auth  |
   • Encrypt with client's public key             │ ✓ Enc.  |
   • Sign with ML-DSA-65 server key               │ ✓ Sign  |
   • DISCARD PLAINTEXT                            │ ✗ Plain |
                                                  └─────────┘

4. Storage (Encrypted Only)
                                                 ┌─────────┐
                                                 │ Memory  │
                                                 │         │
   Stored in RAM as Uint8Array:                  │[bytes]  │
   • Encrypted payloads (binary)                 │[bytes]  │
   • Cryptographic signature (binary)            │[bytes]  │
                                                 └─────────┘

5. Client Retrieval
   ┌───────────┐                                    ┌─────────┐
   │ Client    │  Request encrypted email           │ Server  │
   │           │ <────────────────────────────────  │         │
   │           │  Receive encrypted blob + sig      └─────────┘
   │ ✓ Verify  |
   │ ✓ Decrypt |
   └───────────┘
```

### Cryptographic Details

#### Encryption: Hybrid ML-KEM-768 + AES-256-GCM

1. **Key Encapsulation**: ML-KEM-768 (Kyber768) for quantum-safe key establishment.
2. **Symmetric Encryption**: AES-256-GCM for email payload.
3. **Key Derivation**: HKDF-SHA-512 with a salt derived from the ML-KEM ciphertext to derive a unique AES key from the shared secret.

**Why Hybrid Encryption?**

- ML-KEM-768 is quantum-resistant but not suitable for large payloads
- AES-256-GCM is fast and secure for bulk encryption
- Combined, they provide quantum-safe protection with excellent performance

#### Signatures: ML-DSA-65 (Dilithium3)

Every encrypted email is signed by the gateway to ensure:

- **Authenticity**: The email came from the legitimate gateway.
- **Integrity**: The email hasn't been tampered with.
- **Non-repudiation**: The gateway can prove it sent the email.

The signature covers the protocol version, algorithm suite, and email data, preventing any downgrade attacks.

**Verification happens BEFORE decryption** to prevent processing of tampered messages.

### Security Guarantees

| What the Server Knows | What the Server CANNOT Know |
| --------------------- | --------------------------- |
| Email arrived         | Email content               |
| Sender address        | Attachments                 |
| Recipient address     | HTML/Text body              |
| Email size (approx)   | Extracted links             |
| SPF/DKIM/DMARC result | Decryption keys             |
| Timestamp             | Private inbox keys          |

### Threat Model

VaultSandbox protects against:

- **Data Breaches**: Even if the server is compromised, emails remain encrypted
- **Man-in-the-Middle (MITM)**: Signature verification detects tampering
- **Future Quantum Attacks**: ML-KEM-768 is quantum-resistant

VaultSandbox does NOT protect against:

- **Client-side Compromise**: If the client's private key is stolen, emails can be decrypted
- **DNS Hijacking**: Ensure your domain's DNS is secure
- **Compromised Send-side**: VaultSandbox receives emails via standard SMTP; secure the sending application

## Ephemeral Storage Design

VaultSandbox is optimized for CI/CD pipelines with ephemeral, in-memory storage.

### Why In-Memory?

1. **Speed**: No disk I/O bottlenecks—perfect for fast test suites
2. **Simplicity**: No database to manage or backup
3. **Security**: Data disappears on container restart
4. **CI Optimized**: Each test run starts with a clean slate

### Binary Storage Format

Encrypted payloads are stored as raw binary `Uint8Array` fields in memory:

```typescript
interface EncryptedPayload {
	v: 1;
	algs: { kem: 'ML-KEM-768'; sig: 'ML-DSA-65'; aead: 'AES-256-GCM'; kdf: 'HKDF-SHA-512' };
	ct_kem: Uint8Array; // KEM ciphertext (raw bytes)
	nonce: Uint8Array; // 12-byte nonce
	aad: Uint8Array; // Additional authenticated data
	ciphertext: Uint8Array; // AES-GCM ciphertext with tag
	sig: Uint8Array; // ML-DSA signature
	server_sig_pk: Uint8Array; // Server signing public key
}
```

### Memory Management

VaultSandbox implements sophisticated memory management to prevent out-of-memory conditions:

#### Configurable Memory Limit

- **Default**: 500MB (`VSB_SMTP_MAX_MEMORY_MB`)
- Hard cap: Emails exceeding the total limit are rejected
- Tracks actual payload sizes (metadata + parsed + raw)

#### FIFO Eviction Policy

When memory limit is approached, the oldest emails are evicted first:

```
┌─────────────────────────────────────────────────────────┐
│                   FIFO Eviction Flow                    │
└─────────────────────────────────────────────────────────┘

1. Email arrives (100KB)
   Current: 490MB / 500MB

2. Check: 490MB + 100KB > 500MB?
   Yes → Evict oldest emails

3. Evict oldest until space available
   [Email 1 - 2KB] → Tombstone → Free
   [Email 2 - 5KB] → Tombstone → Free
   ...

4. Store new email
   Current: 495MB / 500MB
```

**Tombstone Pattern for O(1) Deletion:**

- Instead of array shifts, evicted emails are marked as "tombstones"
- Encrypted payloads are removed, freeing ~99.9% of memory
- Metadata kept briefly for tracking consistency
- Hourly compaction removes tombstone entries entirely

#### Time-Based Eviction (Optional)

- Configure via `VSB_SMTP_MAX_EMAIL_AGE_SECONDS`
- Emails older than threshold are automatically evicted
- Supplements inbox TTL for additional cleanup
- Disabled by default (set to 0)

### Data Lifecycle

```
Test Start
    ↓
[Create Inbox] ──> Inbox exists in RAM
    ↓
[Email Arrives] ──> Encrypted (Uint8Array), stored in RAM
    ↓                Memory tracked, FIFO eviction if needed
[Test Reads Email] ──> Serialized to Base64URL, decrypted client-side
    ↓
[Test Completes]
    ↓
[Delete Inbox] ──> Data removed from RAM, memory freed
    ↓
(or)
[Memory Pressure] ──> Oldest emails evicted (FIFO)
    ↓
(or)
[Container Restart] ──> All data wiped

Test End
```

### Retention Policy

- **Default**: Inboxes expire after a configurable TTL (time-to-live)
- **Manual Cleanup**: Delete inboxes explicitly via API/SDK
- **Automatic Cleanup**: Container restart wipes all data
- **Memory-Based Eviction**: Oldest emails evicted when memory limit reached
- **Age-Based Eviction**: Optional time-based cleanup for stale emails

:::caution[Not for Production Email]
VaultSandbox is designed for **testing**, not production email delivery. The ephemeral storage model means:

- Emails are not persisted to disk
- Emails disappear on restart
- No backup or recovery options

For production email, use a traditional email server like Postfix or a transactional email service.
:::

## Production-Like Email Validation

Unlike mocks, VaultSandbox validates emails exactly as a real email gateway would.

### SMTP Protocol Compliance

- **Full TLS Support**: Negotiates TLS with real certificates (ACME/Let's Encrypt)
- **SMTP Commands**: Proper EHLO, MAIL FROM, RCPT TO, DATA handling
- **Error Responses**: Returns appropriate SMTP error codes
- **Size Limits**: Respects message size limits

### Email Authentication

VaultSandbox performs the same checks as Gmail, Outlook, and other major providers:

#### SPF (Sender Policy Framework)

Validates that the sending server is authorized to send from the sender's domain.

```
Received from: mail.sender.com (192.0.2.1)
Envelope From: noreply@sender.com
SPF Record: v=spf1 ip4:192.0.2.1 -all
Result: ✅ PASS
```

#### DKIM (DomainKeys Identified Mail)

Verifies the cryptographic signature in the email headers.

```
DKIM-Signature: v=1; a=rsa-sha256; d=sender.com; s=default; ...
Public Key: Retrieved from default._domainkey.sender.com
Result: ✅ PASS
```

#### DMARC (Domain-based Message Authentication)

Checks alignment between SPF/DKIM and the From address.

```
DMARC Policy: v=DMARC1; p=reject; ...
SPF: ✅ PASS (aligned)
DKIM: ✅ PASS (aligned)
Result: ✅ PASS
```

#### Reverse DNS (rDNS)

Verifies the sending server's hostname matches its IP.

```
Connecting IP: 192.0.2.1
Reverse DNS: mail.sender.com
Forward Lookup: 192.0.2.1
Result: ✅ MATCH
```

### Why This Matters

Testing with real authentication catches issues like:

- Misconfigured SPF records that cause emails to be rejected
- Missing DKIM signatures that reduce deliverability
- DMARC failures that send emails to spam
- Reverse DNS mismatches that trigger spam filters

**These issues only appear when you test against a real email gateway.**

## Email Delivery Strategies

The Node.js SDK supports two strategies for email delivery notification:

### Server-Sent Events (SSE)

**Real-time, push-based delivery** for instant notifications.

```javascript
const inbox = await client.createInbox();

// Emails arrive instantly via SSE
inbox.onNewEmail((email) => {
	console.log('New email:', email.subject);
});
```

**Pros**:

- Instant delivery (no polling delay)
- Efficient (no repeated HTTP requests)
- Deterministic tests (no sleep/wait logic)

**Cons**:

- Requires persistent connection
- May be blocked by some proxies/firewalls

### Polling

**Pull-based delivery** with efficient change detection.

```javascript
const inbox = await client.createInbox();

// Poll for new emails
const email = await inbox.waitForEmail({
	timeout: 30000,
	pollInterval: 2000, // Check every 2 seconds
});
```

**Pros**:

- Works in all network environments
- No persistent connection required
- Sync token-based (only fetches changes)

**Cons**:

- Slight delay based on poll interval
- More HTTP requests

### Auto Strategy (Recommended)

The SDK automatically chooses the best strategy:

```javascript
const client = new VaultSandboxClient({
	url: 'https://mail.example.com',
	apiKey: 'your-api-key',
	strategy: 'auto', // Default
});
```

- Tries SSE first
- Falls back to polling if SSE fails
- Optimal for most use cases

## Scalability Considerations

### Horizontal Scaling

VaultSandbox's in-memory design makes horizontal scaling challenging:

- Each container has its own isolated storage
- Load balancers need sticky sessions for SSE connections
- Inboxes created on one container aren't visible on others

**For high-scale testing**, deploy multiple isolated instances rather than scaling a single deployment.

### Vertical Scaling

VaultSandbox is optimized for vertical scaling:

- Increase RAM for more concurrent inboxes
- Increase CPU for faster encryption/decryption
- Increase network bandwidth for higher email throughput

### Memory Management for Production

Configure memory limits to prevent OOM conditions:

```bash
# Set maximum memory for email storage (default: 500MB)
VSB_SMTP_MAX_MEMORY_MB=1024

# Optional: Auto-evict emails older than N seconds
VSB_SMTP_MAX_EMAIL_AGE_SECONDS=3600
```

**Key behaviors:**

- FIFO eviction automatically frees memory when limit approached
- Tombstone pattern ensures O(1) deletion performance
- Hourly compaction cleans up eviction metadata

## Next Steps

- **[Deployment Setup](/deployment/deployment-setup/)**: Infrastructure, DNS, and TLS setup
- **[Docker Compose Setup](/deployment/docker-compose/)**: Deploy VaultSandbox
- **[Node.js Client](/client-node/installation/)**: Integrate with your tests
- **[Security Details](/gateway/security/)**: Deep dive into encryption and security
