---
title: Security & Encryption
description: Deep dive into VaultSandbox's zero-knowledge security architecture and quantum-safe cryptography
---

VaultSandbox implements a zero-knowledge security architecture using quantum-safe cryptography. This guide explains how the system protects your email data.

## Zero-Knowledge Architecture

### Core Principle

**The server never stores your plaintext emails.**

The gateway receives emails via SMTP in plaintext, immediately encrypts them with your public key, and discards the plaintext. The gateway:

- ✅ Receives plaintext emails via SMTP
- ✅ Immediately encrypts with client's public key
- ✅ Discards plaintext after encryption
- ✅ Stores only encrypted blobs
- ❌ Never has access to decryption keys
- ❌ Cannot decrypt stored emails

**Only the client with the private key can decrypt the stored emails.**

### Encryption Flow

```
┌──────────────────────────────────────────────────────────────┐
│            Zero-Knowledge Encryption Flow                    │
└──────────────────────────────────────────────────────────────┘

1. Inbox Creation
   Client generates ML-KEM-768 keypair locally
   ┌──────────┐
   │  Client  │  Private Key (stays local)
   │          │  Public Key → Server
   └──────────┘

2. Email Arrival
   ┌──────────┐  SMTP   ┌──────────┐
   │  Sender  │ ──────→ │  Gateway │
   └──────────┘         └──────────┘
                        ↓
                    Parse & Validate
                    SPF, DKIM, DMARC
                        ↓
                    Encrypt with
                    client's public key
                        ↓
                    Sign with ML-DSA-65
                        ↓
                    DISCARD PLAINTEXT
                        ↓
                    Store encrypted blob

3. Email Retrieval
   ┌──────────┐         ┌──────────┐
   │  Client  │ ←────── │  Gateway │
   └──────────┘         └──────────┘
        ↓               (Encrypted blob
    Verify signature     + signature)
        ↓
    Decrypt locally
        ↓
    Plaintext email
```

## Quantum-Safe Cryptography

VaultSandbox uses post-quantum cryptographic algorithms to protect against future quantum computer attacks.

### ML-KEM-768 (Kyber768)

**Module-Lattice-Based Key-Encapsulation Mechanism**

**Purpose**: Quantum-resistant key exchange

**Security Level**: NIST Level 3 (equivalent to AES-192)

**Why it matters**:

- Traditional RSA/ECDH will be broken by quantum computers
- ML-KEM-768 is resistant to quantum attacks
- NIST-standardized post-quantum algorithm

**Key sizes**:

- Public key: 1,184 bytes
- Private key: 2,400 bytes
- Ciphertext: 1,088 bytes

### AES-256-GCM

**Advanced Encryption Standard - Galois/Counter Mode**

**Purpose**: Symmetric encryption of email payloads

**Security Level**: 256-bit (quantum-resistant when key size doubled)

**Features**:

- Authenticated encryption (confidentiality + integrity)
- Fast performance for bulk data
- Industry standard

### ML-DSA-65 (Dilithium3)

**Module-Lattice-Based Digital Signature Algorithm**

**Purpose**: Sign encrypted emails to ensure authenticity

**Security Level**: NIST Level 3

**Why it's used**:

- Quantum-resistant signatures
- Prevents MITM attacks
- Ensures message integrity

**Signature size**: 3,309 bytes

### HKDF-SHA-512

**HMAC-based Key Derivation Function**

**Purpose**: Derive AES keys from shared secrets

**Features**:

- Cryptographically secure key derivation
- **Unique salt per encryption**: The salt is derived from the ML-KEM ciphertext (`SHA-256(ctKem)`), preventing key reuse across different encryption sessions.
- **Structured `info` parameter**: The `info` parameter is structured with a length prefix for the Associated Authenticated Data (AAD) to prevent ambiguity.
- Prevents key reuse
- Info parameter for domain separation

## Encryption Modes

### Hybrid Encryption

VaultSandbox combines asymmetric and symmetric encryption:

```
┌────────────────────────────────────────────────────────────┐
│                  Hybrid Encryption                         │
└────────────────────────────────────────────────────────────┘

1. Generate ephemeral shared secret
   ML-KEM-768 Encapsulate → Shared Secret (32 bytes) + Encapsulated Key

2. Derive salt from ML-KEM ciphertext
   SHA-256(Encapsulated Key) → HKDF Salt

3. Derive encryption key
   HKDF-SHA-512(Shared Secret, Salt) → AES-256 Key

4. Encrypt email payload
   AES-256-GCM(Email Plaintext, AES Key) → Ciphertext

4. Package encrypted data
   {
     encapsulatedKey: ...,  // ML-KEM ciphertext
     nonce: ...,            // AES-GCM nonce
     ciphertext: ...,       // Encrypted email
     authTag: ...           // AES-GCM auth tag
   }

5. Sign package
   ML-DSA-65.Sign(Package) → Signature
```

**Why hybrid?**

- ML-KEM is slow for large data
- AES is fast for bulk encryption
- Combined: quantum-safe + performant

### Authenticated Encryption

AES-GCM provides both confidentiality and integrity:

**Confidentiality**: Encrypted data cannot be read

**Integrity**: Any tampering is detected

**Authentication**: Verifies data came from legitimate source

**Result**: If decryption succeeds, you know:

1. Data hasn't been modified
2. Data came from someone with the key
3. No one else has read the data

## Signature Verification

### Why Signatures Matter

Signatures prevent:

- **MITM attacks**: Attacker modifying encrypted data
- **Replay attacks**: Replaying old encrypted emails
- **Data tampering**: Changing encrypted bytes

:::note[Future-Proofing for Retention Systems]
In the current architecture where the gateway both encrypts and stores emails, signature verification provides limited immediate value. However, signatures become critical when encrypted emails are exported for long-term retention or compliance archival.

The signature proves that:

- The email was encrypted by the legitimate VaultSandbox gateway
- The encrypted data hasn't been modified since creation
- Chain of custody is maintained when data moves to external storage

This design prepares VaultSandbox for future retention integrations where encrypted emails may be stored separately from the gateway that created them.
:::

### Verification Flow

```
Server Signs                       Client Verifies
┌──────────┐                      ┌──────────┐
│ Gateway  │                      │  Client  │
│          │                      │          │
│ 1. Encrypt email                │ 1. Receive encrypted email
│    with client's                │    and signature
│    public key                   │          │
│          │                      │ 2. Verify signature with
│ 2. Create transcript:           │    gateway's public key
│    - protocol version           │    (embedded in client)
│    - ciphersuite string         │          │
│    - "vaultsandbox:email:v1"    │ 3. If valid: decrypt
│    - email metadata             │    If invalid: REJECT
│          │                      │          │
│ 3. Sign transcript with         │          │
│    ML-DSA-65 private key        │          │
└──────────┘                      └──────────┘
```

**Transcript context**: `vaultsandbox:email:v1`
This prevents signature reuse across different contexts. The signature now also covers the protocol version and the chosen cryptographic algorithms, preventing downgrade attacks.

### Handling Verification Failures

```javascript
try {
	const email = await inbox.getEmail(emailId);
} catch (error) {
	if (error instanceof SignatureVerificationError) {
		// CRITICAL: Potential MITM attack
		console.error('Signature verification failed!');
		console.error('Email may have been tampered with');
		// Alert security team, log incident
	}
}
```

:::danger[Do Not Ignore Signature Failures]
`SignatureVerificationError` indicates:

- Data tampering
- MITM attack
- System compromise

**Never** skip signature verification in production.
:::

## Key Management

### Client-Side Key Generation

Keys are generated entirely on the client:

**Browser (Web UI)**:

```javascript
// ML-KEM-768 keypair generated in browser
const { publicKey, privateKey } = await generateKeypair();

// Private key never leaves the browser
localStorage.setItem('privateKey', privateKey);

// Only public key sent to server
await createInbox({ publicKey });
```

**Node.js SDK**:

```javascript
const inbox = await client.createInbox();
// Keypair generated automatically
// Private key stays in SDK memory
// Public key sent to gateway
```

### Key Storage

**Private keys are stored**:

- Browser: localStorage (encrypted)
- Node.js SDK: Memory only
- Export: JSON file (user-managed)

**Private keys are NEVER**:

- Sent to the server
- Stored on the server
- Transmitted over network

### Key Lifetime

**Inbox keypairs** exist for the lifetime of the inbox:

```
Inbox Created → Keypair Generated
      ↓
Inbox Active → Private Key in Memory
      ↓
Inbox Deleted → Keypair Destroyed
```

**No long-term key storage** unless explicitly exported.

## Data Sovereignty

### What the Server Knows

| Data                   | Server Can See      |
| ---------------------- | ------------------- |
| Email arrived          | ✅ Yes              |
| Sender address         | ✅ Yes (envelope)   |
| Recipient inbox        | ✅ Yes              |
| Email size (approx)    | ✅ Yes              |
| Timestamp              | ✅ Yes              |
| SPF/DKIM/DMARC results | ✅ Yes              |
| Email subject          | ❌ No (encrypted)   |
| Email body             | ❌ No (encrypted)   |
| Attachments            | ❌ No (encrypted)   |
| Email links            | ❌ No (encrypted)   |
| Private keys           | ❌ No (client-only) |

### Metadata Leakage

**Minimal metadata leakage**:

The server sees:

- Email size (encrypted size, not exact)
- Arrival time
- Sender/recipient addresses (SMTP envelope)

The server does NOT see:

- Subject line
- Content
- Headers (beyond SMTP envelope)
- Attachments

**Why sender/recipient are visible**:

- Required for SMTP protocol
- Needed for SPF/DKIM/DMARC validation
- Stored encrypted with inbox data

## Threat Model

### Threats VaultSandbox Protects Against

✅ **Data Breach**: Even if server is compromised, emails stay encrypted

✅ **MITM Attack**: Signature verification detects tampering

✅ **Quantum Computer Attack**: ML-KEM-768 is quantum-resistant

✅ **Insider Threat**: Server administrators cannot read emails

✅ **Network Eavesdropping**: TLS + client-side encryption

### Threats VaultSandbox Does NOT Protect Against

❌ **Client-Side Compromise**: If attacker gets private key, they can decrypt

❌ **DNS Hijacking**: Attacker controlling DNS can intercept before email reaches VaultSandbox

❌ **Sender-Side Compromise**: VaultSandbox receives emails in plaintext via SMTP (encrypts immediately)

❌ **Weak Passwords** (Web UI): If using web UI with weak password, attacker can access private keys

❌ **Browser/SDK Vulnerabilities**: XSS or memory exploits could expose keys

### Trust Assumptions

VaultSandbox security relies on:

1. **Client integrity**: Browser/SDK is not compromised
2. **TLS security**: HTTPS connection is secure
3. **Cryptographic libraries**: ML-KEM/AES implementations are correct
4. **Server honesty about public key**: Server correctly uses client's public key

**Mitigation**:

- Use trusted, updated browsers
- Keep SDK updated
- Verify TLS certificates
- Audit cryptographic implementations

## Security Best Practices

### For Developers

1. **Never log decrypted emails**: Logs can leak sensitive data
2. **Handle SignatureVerificationError**: Alert on signature failures
3. **Use HTTPS only**: Never use HTTP for API requests
4. **Rotate API keys**: Periodically rotate for reduced risk
5. **Delete inboxes after tests**: Don't leave test data around

### For Infrastructure Teams

1. **Keep VaultSandbox updated**: Security patches are critical
2. **Monitor for anomalies**: Unusual patterns may indicate attacks
3. **Secure the host**: Gateway runs on your infrastructure - secure it
4. **Network isolation**: Isolate VaultSandbox on private network if possible
5. **Enable rate limiting**: Prevent abuse

### For Security Teams

1. **Audit cryptographic implementations**: Verify ML-KEM/AES usage
2. **Monitor signature verification failures**: May indicate MITM attempts
3. **Review access logs**: Track API key usage
4. **Incident response plan**: Know how to respond to security events
5. **Penetration testing**: Regularly test VaultSandbox security

## Compliance and Regulations

### GDPR Compliance

VaultSandbox helps with GDPR:

✅ **Data minimization**: Ephemeral storage, automatic deletion

✅ **Right to erasure**: Delete inbox = delete all data

✅ **Data sovereignty**: Self-hosted in your jurisdiction

✅ **Data protection by design**: Zero-knowledge architecture

**Note**: Test data may still contain PII. Implement proper data handling policies.

### HIPAA Considerations

While VaultSandbox uses strong encryption:

⚠️ **Not HIPAA-certified**: VaultSandbox is a testing tool, not a production email system

⚠️ **Ephemeral storage**: In-memory storage is not suitable for compliance requirements

**For HIPAA**: Use VaultSandbox only for testing, not real patient data.

## Cryptographic Details

### Key Sizes Summary

| Algorithm   | Public Key      | Private Key | Ciphertext/Signature   |
| ----------- | --------------- | ----------- | ---------------------- |
| ML-KEM-768  | 1,184 bytes     | 2,400 bytes | 1,088 bytes            |
| ML-DSA-65   | 1,952 bytes     | 4,032 bytes | 3,309 bytes            |
| AES-256-GCM | N/A (symmetric) | 32 bytes    | Same as plaintext + 16 |

### Performance Impact

**Encryption overhead** (typical email ~10KB):

- ML-KEM key encapsulation: ~1ms
- AES-256-GCM encryption: ~0.5ms
- ML-DSA-65 signing: ~2ms
- **Total**: ~3.5ms per email

**Decryption overhead**:

- ML-KEM decapsulation: ~1ms
- ML-DSA-65 verification: ~2ms
- AES-256-GCM decryption: ~0.5ms
- **Total**: ~3.5ms per email

**Negligible impact** on email testing workflows.

## Security Audits

VaultSandbox undergoes regular security reviews:

- **Cryptographic implementation**: Verified against NIST specifications
- **Dependency scanning**: Automated CVE detection
- **Static analysis**: Code quality and security checks
- **Penetration testing**: Manual security assessments

**Responsible disclosure**: Report security issues to security@vaultsandbox.com

## Next Steps

- **[API Keys & Authentication](/gateway/api-keys/)** - Secure API key management
- **[Configuration](/gateway/configuration/)** - Security-related configuration options
- **[Node.js Client](/client-node/installation/)** - Start using the secure client SDK
