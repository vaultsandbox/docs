---
title: VaultSandboxClient API
description: Complete API reference for the VaultSandboxClient class
---

The `VaultSandboxClient` is the main entry point for interacting with VaultSandbox. It handles inbox creation, email retrieval, cryptographic operations, and resource management.

## Class Overview

```java
public final class VaultSandboxClient implements Closeable
```

The client is thread-safe and can be shared across multiple threads. It uses `ConcurrentHashMap` for inbox registry and thread-safe HTTP clients.

## Factory Methods

### create(ClientConfig config)

Creates a client with custom configuration.

```java
public static VaultSandboxClient create(ClientConfig config)
```

**Parameters:**

- `config` - `ClientConfig` with all settings

**Returns:** Configured `VaultSandboxClient` instance

**Throws:**

- `NullPointerException` - if config or config.apiKey is null

**Example:**

```java
ClientConfig config = ClientConfig.builder()
    .apiKey("your-api-key")
    .strategy(StrategyType.SSE)
    .waitTimeout(Duration.ofSeconds(60))
    .build();

VaultSandboxClient client = VaultSandboxClient.create(config);
```

## ClientConfig Builder

Full configuration options using the builder pattern:

```java
ClientConfig config = ClientConfig.builder()
    .apiKey("your-api-key")           // Required
    .baseUrl("https://...")           // Required
    .strategy(StrategyType.SSE)       // Optional (SSE is default)
    .httpTimeout(Duration.ofSeconds(30))
    .waitTimeout(Duration.ofSeconds(30))
    .maxRetries(3)
    .retryDelay(Duration.ofSeconds(1))
    .retryOn(Set.of(408, 429, 500, 502, 503, 504))
    .sseReconnectInterval(Duration.ofSeconds(2))
    .sseMaxReconnectAttempts(10)
    .pollInterval(Duration.ofSeconds(2))
    .maxBackoff(Duration.ofSeconds(30))
    .backoffMultiplier(1.5)
    .jitterFactor(0.3)
    .build();
```

### Configuration Properties

| Property                  | Type           | Default           | Description                      |
| ------------------------- | -------------- | ----------------- | -------------------------------- |
| `apiKey`                  | `String`       | required          | API authentication key           |
| `baseUrl`                 | `String`       | required          | API base URL                     |
| `strategy`                | `StrategyType` | `SSE`             | Delivery strategy (SSE, POLLING) |
| `httpTimeout`             | `Duration`     | 30s               | HTTP request timeout             |
| `waitTimeout`             | `Duration`     | 30s               | Default wait timeout for emails  |
| `maxRetries`              | `int`          | 3                 | Max retry attempts               |
| `retryDelay`              | `Duration`     | 1s                | Initial retry delay              |
| `retryOn`                 | `Set<Integer>` | 408, 429, 500-504 | HTTP status codes to retry       |
| `sseReconnectInterval`    | `Duration`     | 2s                | SSE reconnect interval           |
| `sseMaxReconnectAttempts` | `int`          | 10                | Max SSE reconnection attempts    |
| `pollInterval`            | `Duration`     | 2s                | Polling interval                 |
| `maxBackoff`              | `Duration`     | 30s               | Max backoff duration             |
| `backoffMultiplier`       | `double`       | 1.5               | Backoff multiplier               |
| `jitterFactor`            | `double`       | 0.3               | Jitter factor (0-1)              |

## Inbox Methods

### createInbox()

Creates a new inbox with a unique email address.

```java
public Inbox createInbox()
public Inbox createInbox(CreateInboxOptions options)
```

**Parameters:**

- `options` - Optional creation options (email address, TTL)

**Returns:** New `Inbox` instance ready to receive emails

**Throws:**

- `ApiException` - on API errors
- `NetworkException` - on network connectivity issues

**Examples:**

```java
// Default options
Inbox inbox = client.createInbox();

// With custom options
CreateInboxOptions options = CreateInboxOptions.builder()
    .emailAddress("test@yourdomain.com")
    .ttl(Duration.ofHours(1))
    .build();

Inbox inbox = client.createInbox(options);
```

### CreateInboxOptions

| Option         | Type       | Default        | Description                    |
| -------------- | ---------- | -------------- | ------------------------------ |
| `emailAddress` | `String`   | auto-generated | Custom email address or domain |
| `ttl`          | `Duration` | server default | Inbox time-to-live             |

### getInbox(String emailAddress)

Returns a previously created inbox by email address.

```java
public Inbox getInbox(String emailAddress)
```

**Parameters:**

- `emailAddress` - Email address of the inbox

**Returns:** The `Inbox`, or `null` if not found in client's registry

**Note:** Only returns inboxes created or imported by this client instance.

### deleteInbox(String emailAddress)

Deletes an inbox and all its emails.

```java
public void deleteInbox(String emailAddress)
```

**Parameters:**

- `emailAddress` - Email address of inbox to delete

**Throws:**

- `InboxNotFoundException` - if inbox doesn't exist
- `ApiException` - on API errors
- `NetworkException` - on network connectivity issues

**Example:**

```java
client.deleteInbox("test-abc123@vaultsandbox.com");
```

### deleteAllInboxes()

Deletes all inboxes associated with the API key.

```java
public int deleteAllInboxes()
```

**Returns:** Number of inboxes deleted

**Throws:**

- `ApiException` - on API errors
- `NetworkException` - on network connectivity issues

**Example:**

```java
int count = client.deleteAllInboxes();
System.out.println("Deleted " + count + " inbox(es)");
```

## Export/Import Methods

### exportInbox(Inbox inbox)

Exports inbox credentials for later import.

```java
public ExportedInbox exportInbox(Inbox inbox)
public ExportedInbox exportInbox(String emailAddress)
```

**Parameters:**

- `inbox` - Inbox to export, or
- `emailAddress` - Email address of inbox to export

**Returns:** `ExportedInbox` containing credentials

**Throws:**

- `InboxNotFoundException` - if inbox not found (email address variant)

**Security Warning:** The exported data contains private cryptographic keys. Store securely!

**Example:**

```java
ExportedInbox exported = client.exportInbox(inbox);
// Store exported data securely
```

### exportInboxToFile(Inbox inbox, Path path)

Exports inbox credentials to a JSON file.

```java
public void exportInboxToFile(Inbox inbox, Path path) throws IOException
```

**Parameters:**

- `inbox` - Inbox to export
- `path` - File path to write

**Throws:**

- `IOException` - on file write errors

**Example:**

```java
client.exportInboxToFile(inbox, Path.of("inbox-backup.json"));
```

### importInbox(ExportedInbox data)

Imports a previously exported inbox.

```java
public Inbox importInbox(ExportedInbox data) throws InvalidImportDataException
```

**Parameters:**

- `data` - Exported inbox data

**Returns:** Restored `Inbox` instance

**Throws:**

- `InvalidImportDataException` - if data is invalid or inbox no longer exists
- `InboxAlreadyExistsException` - if inbox already registered with this client

**Example:**

```java
ExportedInbox data = // load from storage
Inbox inbox = client.importInbox(data);
```

### importInboxFromFile(Path path)

Imports inbox from a JSON file.

```java
public Inbox importInboxFromFile(Path path) throws IOException, InvalidImportDataException
```

**Parameters:**

- `path` - Path to exported JSON file

**Returns:** Restored `Inbox` instance

**Throws:**

- `IOException` - on file read errors
- `InvalidImportDataException` - if data is invalid or inbox no longer exists
- `InboxAlreadyExistsException` - if inbox already registered with this client

**Example:**

```java
Inbox inbox = client.importInboxFromFile(Path.of("inbox-backup.json"));
```

## Monitoring Methods

### monitorInboxes(Inbox... inboxes)

Creates a monitor for multiple inboxes.

```java
public InboxMonitor monitorInboxes(Inbox... inboxes)
public InboxMonitor monitorInboxes(List<Inbox> inboxes)
```

**Parameters:**

- `inboxes` - Inboxes to monitor (varargs or List)

**Returns:** `InboxMonitor` for registering callbacks

**Example:**

```java
Inbox inbox1 = client.createInbox();
Inbox inbox2 = client.createInbox();

try (InboxMonitor monitor = client.monitorInboxes(inbox1, inbox2)) {
    monitor.onEmail(email -> {
        System.out.println("Email to: " + email.getTo());
        System.out.println("Subject: " + email.getSubject());
    });

    // Trigger emails to be sent...
    // Callbacks invoked as emails arrive
}
```

### InboxMonitor Methods

| Method                            | Description                           |
| --------------------------------- | ------------------------------------- |
| `onEmail(Consumer<Email>)`        | Register callback for incoming emails |
| `removeCallback(Consumer<Email>)` | Remove a registered callback          |
| `getInboxes()`                    | Get list of monitored inboxes         |
| `close()`                         | Close monitor and release resources   |

## Server Methods

### getServerInfo()

Gets server capabilities and configuration.

```java
public ServerInfo getServerInfo()
```

**Returns:** `ServerInfo` with algorithms, limits, allowed domains

**Throws:**

- `ApiException` - on API errors
- `NetworkException` - on network connectivity issues

**Note:** Server info is cached after first call.

**Example:**

```java
ServerInfo info = client.getServerInfo();
System.out.println("Max TTL: " + info.getMaxTtl());
System.out.println("Allowed domains: " + info.getAllowedDomains());
```

### ServerInfo Properties

| Property         | Type           | Description                                               |
| ---------------- | -------------- | --------------------------------------------------------- |
| `serverSigPk`    | `String`       | Server's public signing key                               |
| `context`        | `String`       | Server context identifier                                 |
| `maxTtl`         | `int`          | Maximum inbox TTL in seconds                              |
| `defaultTtl`     | `int`          | Default inbox TTL in seconds                              |
| `sseConsole`     | `boolean`      | Whether SSE console is enabled (getter: `isSseConsole()`) |
| `allowedDomains` | `List<String>` | Allowed email domains                                     |
| `algorithms`     | `Algorithms`   | Supported cryptographic algorithms                        |
| `version`        | `String`       | Server version                                            |
| `domain`         | `String`       | Server domain                                             |
| `limits`         | `Limits`       | Rate limits and constraints                               |

### Algorithms Properties

The `Algorithms` object contains the cryptographic algorithms used by the server:

| Property | Type     | Description                 | Example          |
| -------- | -------- | --------------------------- | ---------------- |
| `kem`    | `String` | Key encapsulation mechanism | `"ML-KEM-768"`   |
| `sig`    | `String` | Digital signature algorithm | `"ML-DSA-65"`    |
| `aead`   | `String` | Authenticated encryption    | `"AES-256-GCM"`  |
| `kdf`    | `String` | Key derivation function     | `"HKDF-SHA-512"` |

**Example:**

```java
ServerInfo info = client.getServerInfo();
Algorithms algs = info.getAlgorithms();
if (algs != null) {
    System.out.println("KEM: " + algs.getKem());     // ML-KEM-768
    System.out.println("Sig: " + algs.getSig());     // ML-DSA-65
    System.out.println("AEAD: " + algs.getAead());   // AES-256-GCM
    System.out.println("KDF: " + algs.getKdf());     // HKDF-SHA-512
}
```

### Limits Properties

The `Limits` object contains rate limit information:

| Property            | Type  | Description                           |
| ------------------- | ----- | ------------------------------------- |
| `maxInboxes`        | `int` | Maximum number of inboxes per API key |
| `maxEmailsPerInbox` | `int` | Maximum emails per inbox              |
| `inboxTtlSeconds`   | `int` | Default inbox TTL in seconds          |

**Example:**

```java
ServerInfo info = client.getServerInfo();
ServerInfo.Limits limits = info.getLimits();
if (limits != null) {
    System.out.println("Max inboxes: " + limits.getMaxInboxes());
    System.out.println("Max emails per inbox: " + limits.getMaxEmailsPerInbox());
}
```

### checkKey()

Validates the API key with the server.

```java
public boolean checkKey()
```

**Returns:** `true` if key is valid, `false` if unauthorized

**Throws:**

- `ApiException` - on unexpected API errors (other than 401)
- `NetworkException` - on network connectivity issues

**Example:**

```java
if (client.checkKey()) {
    System.out.println("API key is valid");
} else {
    System.out.println("API key is invalid");
}
```

## Resource Management

### getConfig()

Returns the client's configuration.

```java
public ClientConfig getConfig()
```

**Returns:** The `ClientConfig` used by this client

### close()

Closes the client and releases resources.

```java
public void close()
```

Closes SSE connections, stops polling threads, and clears the inbox registry. Inboxes on the server are **not** deleted.

**Usage with try-with-resources (preferred):**

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .build();
try (VaultSandboxClient client = VaultSandboxClient.create(config)) {
    Inbox inbox = client.createInbox();
    Email email = inbox.waitForEmail();
    // Process email
}
// Client automatically closed
```

**Manual close:**

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .build();
VaultSandboxClient client = VaultSandboxClient.create(config);
try {
    Inbox inbox = client.createInbox();
    Email email = inbox.waitForEmail();
    // Process email
} finally {
    client.close();
}
```

## Exception Types

All exceptions extend `VaultSandboxException` (a `RuntimeException`):

| Exception                        | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `VaultSandboxException`          | Base exception type                           |
| `ApiException`                   | API returned an error (has `getStatusCode()`) |
| `NetworkException`               | Network connectivity issues                   |
| `TimeoutException`               | Operation timed out                           |
| `InboxNotFoundException`         | Inbox doesn't exist                           |
| `InboxAlreadyExistsException`    | Inbox already exists (import)                 |
| `InvalidImportDataException`     | Invalid export data                           |
| `EmailNotFoundException`         | Email doesn't exist                           |
| `SseException`                   | SSE connection failed                         |
| `DecryptionException`            | Email decryption failed                       |
| `SignatureVerificationException` | Signature verification failed                 |

### Exception Handling Example

```java
try {
    Inbox inbox = client.createInbox();
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
} catch (TimeoutException e) {
    System.err.println("Email not received within timeout");
} catch (ApiException e) {
    System.err.println("API error: " + e.getMessage() + " (status: " + e.getStatusCode() + ")");
} catch (NetworkException e) {
    System.err.println("Network error: " + e.getMessage());
} catch (VaultSandboxException e) {
    System.err.println("VaultSandbox error: " + e.getMessage());
}
```

## Complete Examples

### Basic Usage

```java
ClientConfig config = ClientConfig.builder()
    .apiKey("your-api-key")
    .baseUrl("https://gateway.example.com")
    .build();

VaultSandboxClient client = VaultSandboxClient.create(config);
try {
    Inbox inbox = client.createInbox();
    System.out.println("Inbox: " + inbox.getEmailAddress());

    // Send email to inbox.getEmailAddress() from your application

    Email email = inbox.waitForEmail();
    System.out.println("Subject: " + email.getSubject());
    System.out.println("Body: " + email.getText());
} finally {
    client.close();
}
```

### With Full Configuration

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
    .baseUrl(System.getenv("VAULTSANDBOX_URL"))
    .strategy(StrategyType.SSE)
    .waitTimeout(Duration.ofSeconds(60))
    .maxRetries(5)
    .build();

try (VaultSandboxClient client = VaultSandboxClient.create(config)) {
    Inbox inbox = client.createInbox(
        CreateInboxOptions.builder()
            .ttl(Duration.ofHours(2))
            .build()
    );

    Email email = inbox.waitForEmail();
    // Process email...

    client.deleteInbox(inbox.getEmailAddress());
}
```

### Multi-Inbox Monitoring

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .build();
try (VaultSandboxClient client = VaultSandboxClient.create(config)) {
    Inbox inbox1 = client.createInbox();
    Inbox inbox2 = client.createInbox();
    Inbox inbox3 = client.createInbox();

    try (InboxMonitor monitor = client.monitorInboxes(inbox1, inbox2, inbox3)) {
        List<Email> received = new CopyOnWriteArrayList<>();
        monitor.onEmail(received::add);

        // Trigger your application to send emails...

        // Wait for expected emails
        while (received.size() < 3) {
            Thread.sleep(100);
        }

        // Verify all emails received
        assertEquals(3, received.size());
    }

    client.deleteAllInboxes();
}
```

### Export and Import

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .build();

// Session 1: Create and export
try (VaultSandboxClient client = VaultSandboxClient.create(config)) {
    Inbox inbox = client.createInbox();
    System.out.println("Created: " + inbox.getEmailAddress());

    // Export for later
    client.exportInboxToFile(inbox, Path.of("inbox.json"));
}

// Session 2: Import and use
try (VaultSandboxClient client = VaultSandboxClient.create(config)) {
    Inbox inbox = client.importInboxFromFile(Path.of("inbox.json"));
    System.out.println("Imported: " + inbox.getEmailAddress());

    // Can now receive and read emails
    Email email = inbox.waitForEmail();
}
```

## Thread Safety

`VaultSandboxClient` is fully thread-safe:

- Uses `ConcurrentHashMap` for inbox registry
- HTTP client (OkHttp) is thread-safe
- Multiple threads can share one client instance
- Delivery strategies are thread-safe

**Recommended:** Create one client per test class and share across test methods.

## Related Pages

- [Configuration](/client-java/configuration/) - Configuration options
- [Inbox API](/client-java/api/inbox/) - Inbox class reference
- [Email API](/client-java/api/email/) - Email class reference
- [Error Handling](/client-java/api/errors/) - Exception reference
- [Delivery Strategies](/client-java/advanced/strategies/) - SSE vs Polling
