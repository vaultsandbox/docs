---
title: Import & Export
description: Persisting and restoring inbox credentials for debugging and reuse
---

Export and import allows you to persist inbox credentials for later use. This is useful for debugging failed tests, manual testing scenarios, and cross-environment verification.

:::caution[Security Warning]
Exported data contains private keys for email decryption. Handle with care - never commit to version control or expose in logs.
:::

## Overview

Export/Import enables you to:
- Persist inbox credentials to disk
- Resume inbox access in later test runs
- Debug email issues by replaying scenarios
- Share inboxes across environments (securely)

## Export Format

Exported inbox data is stored as JSON:

```json
{
  "emailAddress": "abc123@vaultsandbox.com",
  "expiresAt": "2024-01-15T10:30:00Z",
  "inboxHash": "hash123...",
  "serverSigPk": "base64url...",
  "publicKeyB64": "base64url...",
  "secretKeyB64": "base64url...",
  "exportedAt": "2024-01-14T10:30:00Z"
}
```

## Basic Export

### To Object

```java
Inbox inbox = client.createInbox();

// Export to object
ExportedInbox exported = client.exportInbox(inbox);

// Or export by email address
ExportedInbox exported = client.exportInbox(inbox.getEmailAddress());

// Access properties
String email = exported.getEmailAddress();
String expiresAt = exported.getExpiresAt();
```

### To File

```java
Inbox inbox = client.createInbox();

// Export directly to JSON file
client.exportInboxToFile(inbox, Path.of("inbox.json"));
```

## Basic Import

### From Object

```java
// Restore inbox from exported data
Inbox restored = client.importInbox(exported);

// Use restored inbox normally
Email email = restored.waitForEmail();
```

### From File

```java
// Import from JSON file
Inbox restored = client.importInboxFromFile(Path.of("inbox.json"));

// Use restored inbox
List<Email> emails = restored.listEmails();
```

## ExportedInbox Properties

| Property | Type | Description |
|----------|------|-------------|
| `emailAddress` | `String` | Inbox email address |
| `expiresAt` | `String` | ISO 8601 expiration timestamp |
| `inboxHash` | `String` | Unique inbox identifier |
| `serverSigPk` | `String` | Server signature public key |
| `publicKeyB64` | `String` | ML-KEM-768 public key (base64url) |
| `secretKeyB64` | `String` | ML-KEM-768 secret key (base64url) |
| `exportedAt` | `String` | ISO 8601 export timestamp |

### Validation

```java
ExportedInbox exported = client.exportInbox(inbox);

// Validate data integrity
try {
    exported.validate();
} catch (InvalidImportDataException e) {
    System.err.println("Export data is invalid: " + e.getMessage());
}

// Check expiration manually
Instant expires = Instant.parse(exported.getExpiresAt());
if (expires.isBefore(Instant.now())) {
    throw new IllegalStateException("Inbox has expired");
}
```

## Security Best Practices

### Use Temporary Files

```java
Path tempFile = Files.createTempFile("inbox-", ".json");
try {
    client.exportInboxToFile(inbox, tempFile);
    // Use file...
} finally {
    Files.deleteIfExists(tempFile);
}
```

### Never Commit to Version Control

```gitignore
# .gitignore
*-inbox.json
*.inbox.json
/test-exports/
```

### Encrypt for Persistent Storage

```java
// If you must persist, encrypt the export
ExportedInbox exported = client.exportInbox(inbox);
String json = gson.toJson(exported);
String encrypted = encryptionService.encrypt(json);
Files.writeString(Path.of("inbox.enc"), encrypted);
```

## Use Cases

### Debug Failed Tests

Export inbox on test failure for later debugging:

```java
class EmailTest {
    private Inbox inbox;
    private boolean failed = false;

    @AfterEach
    void cleanup(TestInfo info) throws IOException {
        if (failed && inbox != null) {
            Path path = Path.of(
                "build/failed-inboxes",
                info.getDisplayName().replaceAll("[^a-zA-Z0-9]", "_") + ".json"
            );
            Files.createDirectories(path.getParent());
            client.exportInboxToFile(inbox, path);
            System.out.println("Exported inbox to: " + path);
        }
    }

    @Test
    void testEmailFlow() {
        try {
            inbox = client.createInbox();
            // Test code...
        } catch (AssertionError | Exception e) {
            failed = true;
            throw e;
        }
    }
}
```

Reproduce the issue later:

```java
Inbox inbox = client.importInboxFromFile(
    Path.of("build/failed-inboxes/testEmailFlow.json")
);

for (Email email : inbox.listEmails()) {
    System.out.println("Subject: " + email.getSubject());
    System.out.println("From: " + email.getFrom());

    // Get full content
    Email full = inbox.getEmail(email.getId());
    System.out.println("Text: " + full.getText());
    System.out.println("---");
}
```

### Manual Testing

Create a long-lived inbox for manual testing:

```java
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .ttl(Duration.ofHours(24))
        .build()
);

System.out.println("Send test emails to: " + inbox.getEmailAddress());
System.out.println("Expires: " + inbox.getExpiresAt());

// Export for later use
client.exportInboxToFile(inbox, Path.of("manual-test-inbox.json"));
```

Check results later:

```java
Inbox inbox = client.importInboxFromFile(Path.of("manual-test-inbox.json"));
List<Email> emails = inbox.listEmails();
System.out.println("Received " + emails.size() + " emails");
```

### Raw Email Analysis

Get raw MIME content for detailed debugging:

```java
Inbox inbox = client.importInboxFromFile(Path.of("debug-inbox.json"));

for (Email email : inbox.listEmails()) {
    System.out.println("=== " + email.getSubject() + " ===");

    // Get raw MIME content
    String raw = inbox.getRawEmail(email.getId());
    System.out.println(raw);
}
```

## Error Handling

### Invalid Import Data

```java
try {
    Inbox inbox = client.importInbox(exported);
} catch (InvalidImportDataException e) {
    System.err.println("Invalid data: " + e.getMessage());
    // Data may be corrupted, incomplete, or tampered with
}
```

### Inbox Already Exists

```java
try {
    Inbox inbox = client.importInbox(exported);
} catch (InboxAlreadyExistsException e) {
    // Inbox was already imported in this client
    Inbox existing = client.getInbox(exported.getEmailAddress());
}
```

### Expired Inbox

Check expiration before importing:

```java
ExportedInbox exported = loadFromFile(path);

Instant expires = Instant.parse(exported.getExpiresAt());
if (expires.isBefore(Instant.now())) {
    throw new IllegalStateException(
        "Inbox expired at " + exported.getExpiresAt()
    );
}

Inbox inbox = client.importInbox(exported);
```

### File Not Found

```java
try {
    Inbox inbox = client.importInboxFromFile(Path.of("inbox.json"));
} catch (IOException e) {
    System.err.println("Could not read file: " + e.getMessage());
}
```

## Testing Patterns

### JUnit 5 Extension

```java
class SaveOnFailureExtension implements TestWatcher {
    @Override
    public void testFailed(ExtensionContext context, Throwable cause) {
        // Get inbox from test instance
        Object testInstance = context.getRequiredTestInstance();
        if (testInstance instanceof EmailTestBase base) {
            Inbox inbox = base.getInbox();
            if (inbox != null) {
                try {
                    Path path = Path.of(
                        "build/failed-inboxes",
                        context.getDisplayName() + ".json"
                    );
                    Files.createDirectories(path.getParent());
                    base.getClient().exportInboxToFile(inbox, path);
                } catch (IOException e) {
                    // Ignore
                }
            }
        }
    }
}

@ExtendWith(SaveOnFailureExtension.class)
abstract class EmailTestBase {
    protected abstract Inbox getInbox();
    protected abstract VaultSandboxClient getClient();
}
```

### Reusable Test Data Helper

```java
class TestInboxes {
    private static final Path EXPORTS_DIR = Path.of("src/test/resources/inboxes");
    private final VaultSandboxClient client;

    public TestInboxes(VaultSandboxClient client) {
        this.client = client;
    }

    public void save(String name, Inbox inbox) throws IOException {
        Files.createDirectories(EXPORTS_DIR);
        client.exportInboxToFile(inbox, EXPORTS_DIR.resolve(name + ".json"));
    }

    public Inbox load(String name) throws IOException {
        return client.importInboxFromFile(EXPORTS_DIR.resolve(name + ".json"));
    }
}
```

## Limitations

| Limitation | Description |
|------------|-------------|
| Inboxes expire | Export doesn't extend TTL - inbox still expires at original time |
| Same API key required | Import must use the same API key that created the inbox |
| Contains private keys | Security risk if export files are leaked |
| Metadata only | Export contains credentials, not the emails themselves |

## Best Practices

1. **Security First**
   - Use temp files and delete after use
   - Never log or commit private keys
   - Encrypt exports if persistence is required

2. **Check Expiration**
   - Validate expiration before import
   - Use appropriate TTL when creating inboxes
   - Handle expired imports gracefully

3. **Validate Data**
   - Call `validate()` before import
   - Catch and handle import exceptions
   - Log failures for debugging

4. **Appropriate Use Cases**
   - Debugging failed tests
   - Manual testing scenarios
   - Cross-environment verification
   - Not for long-term storage (inboxes expire)

## Next Steps

- [Managing Inboxes](/client-java/guides/managing-inboxes/) - Create and configure inboxes
- [Waiting for Emails](/client-java/guides/waiting-for-emails/) - Email delivery strategies
- [CI/CD Testing](/client-java/testing/cicd/) - Continuous integration patterns
