# VaultSandbox Cryptographic Protocol Specification

**Version**: 1.0
**Status**: Draft
**Date**: 2026-01-03

## Table of Contents

1. [Overview](#1-overview)
2. [Notation and Conventions](#2-notation-and-conventions)
3. [Cryptographic Algorithms](#3-cryptographic-algorithms)
4. [Key Management](#4-key-management)
5. [Encrypted Payload Format](#5-encrypted-payload-format)
6. [Key Derivation](#6-key-derivation)
7. [Encryption Process](#7-encryption-process)
8. [Decryption Process](#8-decryption-process)
9. [Inbox Export Format](#9-inbox-export-format)
10. [Inbox Import Process](#10-inbox-import-process)
11. [Security Considerations](#11-security-considerations)
12. [Test Vectors](#12-test-vectors)

---

## 1. Overview

VaultSandbox implements a hybrid post-quantum encryption protocol for secure email handling. The protocol uses NIST-standardized post-quantum algorithms combined with authenticated encryption to provide confidentiality, integrity, and authenticity of messages.

### 1.1 Design Goals

- **Post-quantum security**: Resistant to attacks by quantum computers
- **Forward secrecy**: Each message uses fresh key encapsulation
- **Authenticity**: Server signatures prevent tampering
- **Interoperability**: Consistent behavior across implementations

### 1.2 Protocol Flow

```
┌────────┐                      ┌────────┐
│ Client │                      │ Server │
└───┬────┘                      └───┬────┘
    │                               │
    │  1. Generate ML-KEM keypair   │
    │  2. Send public key ──────────│
    │                               │
    │                               │  3. Receive email
    │                               │  4. Encapsulate with client's pk
    │                               │  5. Derive AES key (HKDF)
    │                               │  6. Encrypt email (AES-GCM)
    │                               │  7. Sign payload (ML-DSA)
    │                               │
    │  ◄──────── Encrypted email ───│
    │                               │
    │  8. Verify signature          │
    │  9. Decapsulate shared secret │
    │ 10. Derive AES key (HKDF)     │
    │ 11. Decrypt email (AES-GCM)   │
    │                               │
```

---

## 2. Notation and Conventions

### 2.1 Terminology

| Term      | Definition                                       |
| --------- | ------------------------------------------------ |
| `\|\|`    | Byte concatenation                               |
| `len(x)`  | Length of x in bytes                             |
| `BE32(n)` | 4-byte big-endian encoding of unsigned integer n |
| `UTF8(s)` | UTF-8 encoding of string s                       |

### 2.2 Binary Encoding

All binary data in JSON fields MUST be encoded as **Base64URL without padding** (RFC 4648 Section 5).

#### Base64URL Alphabet

```
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

#### Encoding Rules

1. Use `-` instead of `+`
2. Use `_` instead of `/`
3. Do NOT include `=` padding characters
4. Implementations MUST reject input containing `+`, `/`, or `=`

#### Examples

| Raw bytes (hex) | Standard Base64 | Base64URL (correct) |
| --------------- | --------------- | ------------------- |
| `0xfb`          | `+w==`          | `-w`                |
| `0x3e`          | `Pg==`          | `Pg`                |
| `0xabcdef`      | `q83v`          | `q83v`              |

### 2.3 Timestamps

All timestamps MUST be formatted as ISO 8601 strings in UTC with the `Z` suffix:

```
YYYY-MM-DDTHH:mm:ss.sssZ
```

Milliseconds are optional. Examples:

- `2024-01-15T10:30:00Z`
- `2024-01-15T10:30:00.000Z`

---

## 3. Cryptographic Algorithms

### 3.1 Algorithm Suite

The protocol uses the following algorithm suite, identified by the string:

```
ML-KEM-768:ML-DSA-65:AES-256-GCM:HKDF-SHA-512
```

All implementations MUST support this suite. Implementations MUST reject payloads specifying different algorithms.

### 3.2 ML-KEM-768 (Key Encapsulation)

| Parameter          | Value                           |
| ------------------ | ------------------------------- |
| Standard           | NIST FIPS 203                   |
| Security level     | 192-bit (classical and quantum) |
| Public key size    | 1184 bytes                      |
| Secret key size    | 2400 bytes                      |
| Ciphertext size    | 1088 bytes                      |
| Shared secret size | 32 bytes                        |

#### Key Structure

The ML-KEM-768 secret key embeds the public key:

```
Secret Key (2400 bytes):
┌───────────────────────────────────────────────────────────────────────────────┐
│ Private material (1152 bytes) │ Public key (1184 bytes) │ h (32) │ z (32)    │
│ [0:1152]                      │ [1152:2336]             │        │           │
└───────────────────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
                         Public Key Offset: 1152
                         Public Key Length: 1184 bytes
```

Implementations MUST derive the public key from the secret key at offset 1152 (bytes 1152-2335, 1184 bytes) rather than storing it separately.

### 3.3 ML-DSA-65 (Digital Signatures)

| Parameter       | Value         |
| --------------- | ------------- |
| Standard        | NIST FIPS 204 |
| Security level  | 192-bit       |
| Public key size | 1952 bytes    |
| Signature size  | 3309 bytes    |

### 3.4 AES-256-GCM (Authenticated Encryption)

| Parameter  | Value               |
| ---------- | ------------------- |
| Key size   | 256 bits (32 bytes) |
| Nonce size | 96 bits (12 bytes)  |
| Tag size   | 128 bits (16 bytes) |

The authentication tag is appended to the ciphertext.

### 3.5 HKDF-SHA-512 (Key Derivation)

| Parameter         | Value               |
| ----------------- | ------------------- |
| Hash function     | SHA-512             |
| Output key length | 256 bits (32 bytes) |

---

## 4. Key Management

### 4.1 Keypair Generation

Clients MUST generate a fresh ML-KEM-768 keypair for each inbox. The keypair consists of:

- **Secret key**: 2400 bytes, kept confidential by the client
- **Public key**: 1184 bytes, sent to the server during inbox creation

### 4.2 Public Key Derivation

Given a secret key `sk` of 2400 bytes, the public key is extracted as:

```
pk = sk[1152:2336]
```

Where `sk[a:b]` denotes bytes from index `a` (inclusive) to index `b` (exclusive). This extracts exactly 1184 bytes.

### 4.3 Server Signature Key

The server's ML-DSA-65 public key is provided during inbox creation and MUST be stored alongside the inbox. This key is used to verify all encrypted payloads.

Implementations MUST verify that the `server_sig_pk` in each payload matches the pinned server key from inbox creation.

---

## 5. Encrypted Payload Format

### 5.1 JSON Structure

```json
{
	"v": 1,
	"algs": {
		"kem": "ML-KEM-768",
		"sig": "ML-DSA-65",
		"aead": "AES-256-GCM",
		"kdf": "HKDF-SHA-512"
	},
	"ct_kem": "<base64url>",
	"nonce": "<base64url>",
	"aad": "<base64url>",
	"ciphertext": "<base64url>",
	"sig": "<base64url>",
	"server_sig_pk": "<base64url>"
}
```

### 5.2 Field Descriptions

| Field           | Type    | Description                                            |
| --------------- | ------- | ------------------------------------------------------ |
| `v`             | integer | Protocol version. MUST be `1`.                         |
| `algs`          | object  | Algorithm identifiers.                                 |
| `algs.kem`      | string  | KEM algorithm. MUST be `"ML-KEM-768"`.                 |
| `algs.sig`      | string  | Signature algorithm. MUST be `"ML-DSA-65"`.            |
| `algs.aead`     | string  | AEAD algorithm. MUST be `"AES-256-GCM"`.               |
| `algs.kdf`      | string  | KDF algorithm. MUST be `"HKDF-SHA-512"`.               |
| `ct_kem`        | string  | ML-KEM ciphertext (1088 bytes decoded).                |
| `nonce`         | string  | AES-GCM nonce (12 bytes decoded).                      |
| `aad`           | string  | Additional authenticated data.                         |
| `ciphertext`    | string  | AES-GCM ciphertext with appended tag.                  |
| `sig`           | string  | ML-DSA signature over transcript (3309 bytes decoded). |
| `server_sig_pk` | string  | Server's ML-DSA public key (1952 bytes decoded).       |

### 5.3 Size Constraints

Implementations MUST validate decoded sizes:

| Field           | Expected size |
| --------------- | ------------- |
| `ct_kem`        | 1088 bytes    |
| `nonce`         | 12 bytes      |
| `sig`           | 3309 bytes    |
| `server_sig_pk` | 1952 bytes    |

---

## 6. Key Derivation

### 6.1 HKDF Parameters

The AES-256 key is derived using HKDF-SHA-512 with the following parameters:

| Parameter                | Value                           |
| ------------------------ | ------------------------------- |
| IKM (Input Key Material) | ML-KEM shared secret (32 bytes) |
| Salt                     | SHA-256(ct_kem)                 |
| Info                     | See Section 6.2                 |
| Output length            | 32 bytes                        |

### 6.2 Info Parameter Construction

The HKDF info parameter provides domain separation and binds the key to the AAD:

```
info = context || BE32(len(aad)) || aad
```

Where:

- `context` = UTF8("vaultsandbox:email:v1") (22 bytes)
- `BE32(len(aad))` = 4-byte big-endian length of AAD
- `aad` = raw AAD bytes

### 6.3 Context String

The context string MUST be exactly:

```
vaultsandbox:email:v1
```

This string provides domain separation to prevent key reuse across different applications or protocol versions.

### 6.4 Pseudocode

```
function deriveKey(sharedSecret, aad, ctKem):
    salt = SHA256(ctKem)

    context = UTF8("vaultsandbox:email:v1")
    aadLength = BE32(len(aad))
    info = context || aadLength || aad

    return HKDF-SHA512(
        ikm = sharedSecret,
        salt = salt,
        info = info,
        length = 32
    )
```

---

## 7. Encryption Process

This section describes the server-side encryption process for reference.

### 7.1 Steps

1. **Generate nonce**: Generate 12 cryptographically random bytes for the AES-GCM nonce.

2. **Encapsulate**: Using the client's ML-KEM public key:

   ```
   (ctKem, sharedSecret) = ML-KEM-768.Encapsulate(clientPublicKey)
   ```

3. **Derive AES key**:

   ```
   aesKey = deriveKey(sharedSecret, aad, ctKem)
   ```

4. **Encrypt**:

   ```
   ciphertext = AES-256-GCM.Encrypt(aesKey, nonce, plaintext, aad)
   ```

   The ciphertext includes the 16-byte authentication tag appended.

5. **Build transcript**: See Section 7.2.

6. **Sign**:

   ```
   signature = ML-DSA-65.Sign(serverSecretKey, transcript)
   ```

7. **Assemble payload**: Construct the JSON payload per Section 5.

### 7.2 Signature Transcript

The signature is computed over a transcript that binds all payload components:

```
transcript = version || algs || context || ctKem || nonce || aad || ciphertext || serverSigPk
```

Where:

- `version` = single byte with value `0x01`
- `algs` = UTF8("ML-KEM-768:ML-DSA-65:AES-256-GCM:HKDF-SHA-512")
- `context` = UTF8("vaultsandbox:email:v1")
- `ctKem` = raw KEM ciphertext (1088 bytes)
- `nonce` = raw nonce (12 bytes)
- `aad` = raw AAD bytes
- `ciphertext` = raw ciphertext with tag
- `serverSigPk` = raw server public key (1952 bytes)

---

## 8. Decryption Process

### 8.1 Steps

Implementations MUST perform these steps in order:

1. **Parse payload**: Decode JSON and validate structure per Section 5.

2. **Validate version**: Verify `v == 1`. Reject otherwise.

3. **Validate algorithms**: Verify all algorithm fields match expected values. Reject otherwise.

4. **Validate sizes**: Verify decoded binary fields have correct sizes per Section 5.3.

5. **Verify server key**: Compare `server_sig_pk` against the pinned server key from inbox creation.

   ```
   if server_sig_pk != pinnedServerKey:
       return ERROR_SERVER_KEY_MISMATCH
   ```

6. **Verify signature** (BEFORE decryption):

   ```
   transcript = buildTranscript(payload)
   if not ML-DSA-65.Verify(server_sig_pk, transcript, sig):
       return ERROR_SIGNATURE_INVALID
   ```

7. **Decapsulate**:

   ```
   sharedSecret = ML-KEM-768.Decapsulate(clientSecretKey, ctKem)
   ```

8. **Derive AES key**:

   ```
   aesKey = deriveKey(sharedSecret, aad, ctKem)
   ```

9. **Decrypt**:
   ```
   plaintext = AES-256-GCM.Decrypt(aesKey, nonce, ciphertext, aad)
   if decryption fails:
       return ERROR_DECRYPTION_FAILED
   ```

### 8.2 Security Requirements

- **Signature verification MUST occur before decryption** to prevent chosen-ciphertext attacks.
- Implementations MUST NOT return different errors for signature failure vs. decryption failure to prevent oracle attacks. Use a generic "decryption failed" error.
- Implementations MUST use constant-time comparison for server key verification.

---

## 9. Inbox Export Format

### 9.1 Purpose

The export format allows users to back up inbox credentials and restore them in any compatible client implementation.

### 9.2 JSON Structure

```json
{
	"version": 1,
	"emailAddress": "example@vaultsandbox.com",
	"expiresAt": "2024-01-20T15:30:00Z",
	"inboxHash": "abc123...",
	"serverSigPk": "<base64url>",
	"secretKey": "<base64url>",
	"exportedAt": "2024-01-13T10:00:00Z"
}
```

### 9.3 Field Descriptions

| Field          | Type    | Required | Description                                            |
| -------------- | ------- | -------- | ------------------------------------------------------ |
| `version`      | integer | Yes      | Export format version. MUST be `1`.                    |
| `emailAddress` | string  | Yes      | The inbox email address. MUST contain `@`.             |
| `expiresAt`    | string  | Yes      | Inbox expiration timestamp (ISO 8601).                 |
| `inboxHash`    | string  | Yes      | Unique inbox identifier. Non-empty.                    |
| `serverSigPk`  | string  | Yes      | Server's ML-DSA-65 public key (base64url).             |
| `secretKey`    | string  | Yes      | ML-KEM-768 secret key (base64url, 2400 bytes decoded). |
| `exportedAt`   | string  | Yes      | Export timestamp (ISO 8601).                           |

### 9.4 Field Specifications

#### version

Integer value indicating the export format version. This specification defines version `1`.

Implementations MUST reject exports with unknown versions.

#### emailAddress

The email address assigned to the inbox. MUST contain exactly one `@` character.

#### expiresAt

ISO 8601 timestamp indicating when the inbox expires and will no longer receive emails.

#### inboxHash

A unique identifier for the inbox, typically derived from the public key. Used for API operations.

#### serverSigPk

The server's ML-DSA-65 public key, encoded as base64url without padding.

Decoded size MUST be exactly 1952 bytes.

#### secretKey

The client's ML-KEM-768 secret key, encoded as base64url without padding.

Decoded size MUST be exactly 2400 bytes.

The public key is NOT included in the export as it can be derived from the secret key (see Section 4.2).

#### exportedAt

ISO 8601 timestamp indicating when the export was created. Informational only.

### 9.5 Example

```json
{
	"version": 1,
	"emailAddress": "temp_abc123@vaultsandbox.com",
	"expiresAt": "2024-01-20T15:30:00.000Z",
	"inboxHash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
	"serverSigPk": "MIIFIjANBgkqhk...<truncated>",
	"secretKey": "MIIEvgIBADANBg...<truncated>",
	"exportedAt": "2024-01-13T10:00:00.000Z"
}
```

### 9.6 File Naming Convention

Exported files SHOULD use the following naming pattern:

```
inbox-{sanitized_email}.json
```

Where `sanitized_email` is the email address with:

- `@` replaced with `_at_`
- Any character not in `[a-zA-Z0-9._-]` replaced with `_`

Example: `inbox-temp_abc123_at_vaultsandbox_com.json`

### 9.7 Security Considerations for Export

- Exported files contain private key material and MUST be handled securely.
- Implementations SHOULD set restrictive file permissions (e.g., `0600` on Unix systems).
- Implementations SHOULD warn users that the export contains sensitive data.
- Implementations MAY offer password-protected exports in future versions.

---

## 10. Inbox Import Process

### 10.1 Validation Steps

Implementations MUST validate imported data in the following order:

1. **Parse JSON**: Verify the input is valid JSON.

2. **Validate version**:

   ```
   if version != 1:
       return ERROR_UNSUPPORTED_VERSION
   ```

3. **Validate required fields**: All fields from Section 9.3 MUST be present and non-null.

4. **Validate emailAddress**:
   - MUST be a non-empty string
   - MUST contain exactly one `@` character

   ```
   if emailAddress == "" or count(emailAddress, "@") != 1:
       return ERROR_INVALID_EMAIL
   ```

5. **Validate inboxHash**:
   - MUST be a non-empty string

   ```
   if inboxHash == "":
       return ERROR_INVALID_INBOX_HASH
   ```

6. **Validate and decode secretKey**:

   ```
   secretKeyBytes = base64url_decode(secretKey)
   if decoding fails:
       return ERROR_INVALID_SECRET_KEY
   if len(secretKeyBytes) != 2400:
       return ERROR_INVALID_SECRET_KEY_SIZE
   ```

7. **Validate and decode serverSigPk**:

   ```
   serverSigPkBytes = base64url_decode(serverSigPk)
   if decoding fails:
       return ERROR_INVALID_SERVER_KEY
   if len(serverSigPkBytes) != 1952:
       return ERROR_INVALID_SERVER_KEY_SIZE
   ```

8. **Validate timestamps**:
   - `expiresAt` MUST be a valid ISO 8601 timestamp
   - `exportedAt` MUST be a valid ISO 8601 timestamp

### 10.2 Keypair Reconstruction

After validation, reconstruct the full keypair:

```
secretKey = base64url_decode(export.secretKey)
publicKey = secretKey[1152:2400]
keypair = { secretKey, publicKey }
```

### 10.3 Inbox Restoration

Create a new inbox instance with:

- Email address from export
- Expiration time from export
- Inbox hash from export
- Server signature public key from export
- Reconstructed keypair

### 10.4 Duplicate Handling

Implementations SHOULD check for existing inboxes with the same email address or inbox hash before import and either:

- Reject the import with an error, or
- Prompt the user to confirm replacement

---

## 11. Security Considerations

### 11.1 Random Number Generation

All random values (keypairs, nonces) MUST be generated using a cryptographically secure random number generator (CSPRNG).

### 11.2 Memory Handling

Implementations SHOULD:

- Zero secret key material after use when possible
- Avoid logging or serializing secret keys except for export
- Use secure memory allocations where available

### 11.3 Timing Attacks

Implementations MUST use constant-time operations for:

- Server key comparison
- Signature verification
- Any comparison involving secret data

### 11.4 Error Messages

Implementations MUST NOT reveal whether a failure occurred during:

- Signature verification vs. decryption
- MAC verification vs. decryption

Use generic error messages to prevent oracle attacks.

### 11.5 Key Storage

- Secret keys MUST be stored securely (encrypted storage, secure enclave, etc.)
- Exported files SHOULD have restrictive permissions
- Applications SHOULD implement secure deletion of exports after import

---

## 12. Test Vectors

### 12.1 Base64URL Encoding

| Input (hex)                        | Output (base64url)       |
| ---------------------------------- | ------------------------ |
| (empty)                            | (empty)                  |
| `00`                               | `AA`                     |
| `fb`                               | `-w`                     |
| `fbff`                             | `-_8`                    |
| `000102030405060708090a0b0c0d0e0f` | `AAECAwQFBgcICQoLDA0ODw` |

### 12.2 HKDF Info Construction

Given:

- Context: `"vaultsandbox:email:v1"` (22 bytes)
- AAD: `0x010203` (3 bytes)

Info parameter (hex):

```
7661756c7473616e64626f783a656d61696c3a7631  (context: "vaultsandbox:email:v1")
00000003                                      (BE32 length: 3)
010203                                        (AAD bytes)
```

Full info (29 bytes, hex):

```
7661756c7473616e64626f783a656d61696c3a763100000003010203
```

### 12.3 Signature Transcript Construction

Given:

- version: `1`
- algs: `"ML-KEM-768:ML-DSA-65:AES-256-GCM:HKDF-SHA-512"`
- context: `"vaultsandbox:email:v1"`
- ctKem: (1088 bytes, represented as `<ct_kem>`)
- nonce: (12 bytes, represented as `<nonce>`)
- aad: (variable, represented as `<aad>`)
- ciphertext: (variable, represented as `<ciphertext>`)
- serverSigPk: (1952 bytes, represented as `<server_pk>`)

Transcript:

```
01                                              (version byte)
4d4c2d4b454d2d3736383a4d4c2d4453412d36353a    (algs string start)
4145532d3235362d47434d3a484b44462d5348412d353132  (algs string end)
7661756c7473616e64626f783a656d61696c3a7631  (context)
<ct_kem>                                        (1088 bytes)
<nonce>                                         (12 bytes)
<aad>                                           (variable)
<ciphertext>                                    (variable)
<server_pk>                                     (1952 bytes)
```

---

## Appendix A: Algorithm Identifiers

| Identifier     | Algorithm                                           | Standard        |
| -------------- | --------------------------------------------------- | --------------- |
| `ML-KEM-768`   | Module-Lattice Key Encapsulation Mechanism          | NIST FIPS 203   |
| `ML-DSA-65`    | Module-Lattice Digital Signature Algorithm          | NIST FIPS 204   |
| `AES-256-GCM`  | Advanced Encryption Standard in Galois/Counter Mode | NIST SP 800-38D |
| `HKDF-SHA-512` | HMAC-based Key Derivation Function with SHA-512     | RFC 5869        |

## Appendix B: Size Constants

| Constant                   | Value | Description                              |
| -------------------------- | ----- | ---------------------------------------- |
| `MLKEM_PUBLIC_KEY_SIZE`    | 1184  | ML-KEM-768 public key size in bytes      |
| `MLKEM_SECRET_KEY_SIZE`    | 2400  | ML-KEM-768 secret key size in bytes      |
| `MLKEM_CIPHERTEXT_SIZE`    | 1088  | ML-KEM-768 ciphertext size in bytes      |
| `MLKEM_SHARED_SECRET_SIZE` | 32    | ML-KEM-768 shared secret size in bytes   |
| `MLKEM_PUBLIC_KEY_OFFSET`  | 1152  | Offset of public key within secret key   |
| `MLDSA_PUBLIC_KEY_SIZE`    | 1952  | ML-DSA-65 public key size in bytes       |
| `MLDSA_SIGNATURE_SIZE`     | 3309  | ML-DSA-65 signature size in bytes        |
| `AES_KEY_SIZE`             | 32    | AES-256 key size in bytes                |
| `AES_NONCE_SIZE`           | 12    | AES-GCM nonce size in bytes              |
| `AES_TAG_SIZE`             | 16    | AES-GCM authentication tag size in bytes |

## Appendix C: Error Codes

Implementations SHOULD use consistent error identification:

| Error                 | Description                                |
| --------------------- | ------------------------------------------ |
| `UNSUPPORTED_VERSION` | Protocol or export version not supported   |
| `INVALID_PAYLOAD`     | Malformed JSON or missing required fields  |
| `INVALID_ALGORITHM`   | Unrecognized or unsupported algorithm      |
| `INVALID_SIZE`        | Decoded field has incorrect size           |
| `SERVER_KEY_MISMATCH` | Server public key doesn't match pinned key |
| `SIGNATURE_INVALID`   | Signature verification failed              |
| `DECRYPTION_FAILED`   | AEAD decryption or authentication failed   |
| `INVALID_IMPORT_DATA` | Export file validation failed              |

---

## Revision History

| Version | Date       | Changes               |
| ------- | ---------- | --------------------- |
| 1.0     | 2024-01-03 | Initial specification |
