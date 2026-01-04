---
title: Inboxes
description: Understanding VaultSandbox inboxes and how to work with them
---

Inboxes are the core concept in VaultSandbox. Each inbox is an isolated, encrypted email destination with its own unique address and encryption keys.

## What is an Inbox?

An inbox is a temporary, encrypted email destination that:

- Has a **unique email address** (e.g., `a1b2c3d4@mail.example.com`)
- Uses **client-side encryption** (ML-KEM-768 keypair)
- **Expires automatically** after a configurable time-to-live (TTL)
- Is **isolated** from other inboxes
- Stores emails **in memory** on the gateway

## Creating Inboxes

### Basic Creation

```java
import com.vaultsandbox.client.VaultSandboxClient;
import com.vaultsandbox.client.ClientConfig;
import com.vaultsandbox.client.Inbox;

ClientConfig config = ClientConfig.builder()
    .apiKey("your-api-key")
    .baseUrl("https://gateway.example.com")
    .build();

VaultSandboxClient client = VaultSandboxClient.create(config);

Inbox inbox = client.createInbox();

System.out.println(inbox.getEmailAddress()); // "a1b2c3d4@mail.example.com"
System.out.println(inbox.getHash());         // "Rr02MLnP7F0pRVC..."
System.out.println(inbox.getExpiresAt());    // Instant
```

### With Options

```java
import com.vaultsandbox.client.CreateInboxOptions;
import java.time.Duration;

Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .ttl(Duration.ofHours(1))
        .emailAddress("test@mail.example.com")
        .build()
);
```

**Note**: Requesting a specific email address may fail if it's already in use. The server will return an error.

## Inbox Properties

### emailAddress

**Type**: `String`

The full email address for this inbox.

```java
System.out.println(inbox.getEmailAddress());
// "a1b2c3d4@mail.example.com"
```

Send emails to this address to have them appear in the inbox.

### hash (inboxHash)

**Type**: `String`

A unique cryptographic hash identifier for the inbox. Used internally for encryption and identification.

```java
System.out.println(inbox.getHash());
// "Rr02MLnP7F0pRVC6QdcpSIeyklqu3PDkYglvsfN7Oss"
```

**Note**: This is not the same as the local part of the email address. The email address local part (e.g., `a1b2c3d4` in `a1b2c3d4@mail.example.com`) is different from the `inboxHash`.

### expiresAt

**Type**: `Instant`

When the inbox will automatically expire and be deleted.

```java
System.out.println(inbox.getExpiresAt());
// 2024-01-16T12:00:00Z

// Check if inbox is expiring soon
Duration untilExpiry = Duration.between(Instant.now(), inbox.getExpiresAt());
System.out.printf("Expires in %.1f hours%n", untilExpiry.toHours());
```

## Inbox Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                  Inbox Lifecycle                        │
└─────────────────────────────────────────────────────────┘

1. Creation
   client.createInbox() → Inbox object
   ↓
   - Keypair generated client-side
   - Public key sent to server
   - Unique email address assigned
   - TTL timer starts

2. Active
   ↓
   - Receive emails
   - List/read emails
   - Wait for emails
   - Monitor for new emails

3. Expiration (TTL reached) or Manual Deletion
   ↓
   inbox.delete() or TTL expires
   - All emails deleted
   - Inbox address freed
   - Keypair destroyed
```

## Working with Inboxes

### Listing Emails

```java
List<Email> emails = inbox.listEmails();

System.out.printf("%d emails in inbox%n", emails.size());
for (Email email : emails) {
    System.out.printf("%s: %s%n", email.getFrom(), email.getSubject());
}
```

### Getting a Specific Email

```java
Email email = inbox.getEmail("email-id-123");

System.out.println(email.getSubject());
System.out.println(email.getText());
```

### Waiting for Emails

```java
// Wait for any email (uses default timeout)
Email email = inbox.waitForEmail();

// Wait with custom timeout
Email email = inbox.waitForEmail(EmailFilter.any(), Duration.ofSeconds(30));

// Wait for specific email
Email email = inbox.waitForEmail(
    EmailFilter.subjectContains("Password Reset"),
    Duration.ofSeconds(30)
);

// Wait with filter builder
Email email = inbox.waitForEmail(
    EmailFilter.builder()
        .subject("Welcome")
        .from("noreply@example.com")
        .build(),
    Duration.ofSeconds(30)
);
```

### Wait Methods vs Await Methods

The `waitForEmail` methods throw `TimeoutException` if no email arrives:

```java
try {
    Email email = inbox.waitForEmail(Duration.ofSeconds(10));
} catch (TimeoutException e) {
    System.err.println("No email received within timeout");
}
```

The `awaitEmail` methods return `null` on timeout:

```java
Email email = inbox.awaitEmail(Duration.ofSeconds(10));
if (email == null) {
    System.err.println("No email received within timeout");
}
```

### Waiting for Multiple Emails

```java
// Wait for exactly 3 emails
List<Email> emails = inbox.waitForEmailCount(3, Duration.ofSeconds(30));

System.out.printf("Received %d emails%n", emails.size());
```

### Subscribing to New Emails

```java
Subscription subscription = inbox.onNewEmail(email -> {
    System.out.println("New email: " + email.getSubject());
});

// Later, unsubscribe
subscription.unsubscribe();
```

### Deleting Emails

```java
// Delete specific email by ID
inbox.deleteEmail("email-id-123");

// Or via email object
email.delete();
```

### Deleting Inbox

```java
// Delete inbox and all its emails
inbox.delete();
```

## Inbox Isolation

Each inbox is completely isolated:

```java
Inbox inbox1 = client.createInbox();
Inbox inbox2 = client.createInbox();

// inbox1 cannot access inbox2's emails
// inbox2 cannot access inbox1's emails

// Each has its own:
// - Email address
// - Encryption keys
// - Email storage
// - Expiration time
```

## Time-to-Live (TTL)

Inboxes automatically expire after their TTL.

### Default TTL

```java
// Uses server's default TTL (typically 24 hours)
Inbox inbox = client.createInbox();
```

### Custom TTL

```java
// Expire after 1 hour
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .ttl(Duration.ofHours(1))
        .build()
);

// Expire after 10 minutes (useful for quick tests)
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .ttl(Duration.ofMinutes(10))
        .build()
);

// Expire after 7 days
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .ttl(Duration.ofDays(7))
        .build()
);
```

### Checking Expiration

```java
Duration timeLeft = Duration.between(Instant.now(), inbox.getExpiresAt());
long minutesLeft = timeLeft.toMinutes();

if (minutesLeft < 5) {
    System.err.println("Inbox expiring soon!");
}
```

## Import and Export

Inboxes can be exported and imported for:

- Test reproducibility
- Sharing between environments
- Backup and restore

### Export

```java
// Export via inbox
ExportedInbox exported = inbox.export();

// Or via client
ExportedInbox exported = client.exportInbox(inbox);

// Export to file
client.exportInboxToFile(inbox, Path.of("inbox.json"));
```

### Import

```java
// Import from ExportedInbox object
Inbox inbox = client.importInbox(exported);

// Import from file
Inbox inbox = client.importInboxFromFile(Path.of("inbox.json"));

// Inbox restored with all encryption keys
System.out.println(inbox.getEmailAddress());
```

**Security Warning**: Exported data contains private keys. Treat as sensitive and handle securely.

## Best Practices

### CI/CD Pipelines

**Short TTL for fast cleanup**:

```java
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .ttl(Duration.ofHours(1))
        .build()
);
```

**Always clean up**:

```java
Inbox inbox = null;
try {
    inbox = client.createInbox();
    // Run tests
} finally {
    if (inbox != null) {
        inbox.delete();
    }
}
```

### Manual Testing

**Longer TTL for convenience**:

```java
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .ttl(Duration.ofHours(24))
        .build()
);
```

**Export for reuse**:

```java
// Export after creating
client.exportInboxToFile(inbox, Path.of("test-inbox.json"));

// Reuse in later sessions
Inbox inbox = client.importInboxFromFile(Path.of("test-inbox.json"));
```

## Common Patterns

### Dedicated Test Inbox (JUnit 5)

```java
class EmailTest {
    private static VaultSandboxClient client;
    private Inbox inbox;

    @BeforeAll
    static void initClient() {
        ClientConfig config = ClientConfig.builder()
            .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
            .baseUrl(System.getenv("VAULTSANDBOX_URL"))
            .build();
        client = VaultSandboxClient.create(config);
    }

    @BeforeEach
    void setUp() {
        inbox = client.createInbox();
    }

    @AfterEach
    void tearDown() {
        if (inbox != null) {
            inbox.delete();
        }
    }

    @Test
    void shouldReceivePasswordResetEmail() {
        triggerPasswordReset(inbox.getEmailAddress());

        Email email = inbox.waitForEmail(
            EmailFilter.subjectContains("Password Reset"),
            Duration.ofSeconds(10)
        );

        assertThat(email.getSubject()).contains("Password Reset");
    }
}
```

### Multiple Inboxes

```java
Inbox user1Inbox = client.createInbox();
Inbox user2Inbox = client.createInbox();
Inbox adminInbox = client.createInbox();

// Each inbox receives emails independently
sendWelcomeEmail(user1Inbox.getEmailAddress());
sendWelcomeEmail(user2Inbox.getEmailAddress());
sendAdminReport(adminInbox.getEmailAddress());
```

### Creating Multiple Inboxes

```java
List<Inbox> inboxes = IntStream.range(0, 5)
    .mapToObj(i -> client.createInbox())
    .collect(Collectors.toList());

// Clean up all
inboxes.forEach(Inbox::delete);
```

### Inbox Pool

```java
class InboxPool implements Closeable {
    private final VaultSandboxClient client;
    private final Queue<Inbox> pool = new ConcurrentLinkedQueue<>();
    private final int size;

    public InboxPool(VaultSandboxClient client, int size) {
        this.client = client;
        this.size = size;
    }

    public void initialize() {
        for (int i = 0; i < size; i++) {
            pool.add(client.createInbox());
        }
    }

    public Inbox acquire() {
        Inbox inbox = pool.poll();
        if (inbox == null) {
            return client.createInbox();
        }
        return inbox;
    }

    public void release(Inbox inbox) {
        pool.add(inbox);
    }

    @Override
    public void close() {
        pool.forEach(Inbox::delete);
    }
}
```

## Troubleshooting

### Inbox Not Receiving Emails

**Check**:

1. Email is sent to correct address
2. Inbox hasn't expired
3. DNS/MX records configured correctly
4. SMTP connection successful

```java
// Verify inbox still exists
try {
    List<Email> emails = inbox.listEmails(); // Will error if inbox expired
    System.out.println("Inbox is active");
} catch (InboxNotFoundException e) {
    System.err.println("Inbox has expired");
}
```

### Inbox Already Exists Error

When requesting a specific email address:

```java
try {
    Inbox inbox = client.createInbox(
        CreateInboxOptions.builder()
            .emailAddress("test@mail.example.com")
            .build()
    );
} catch (InboxAlreadyExistsException e) {
    // Address already in use, generate random instead
    Inbox inbox = client.createInbox();
}
```

### Inbox Expired

```java
try {
    List<Email> emails = inbox.listEmails();
} catch (InboxNotFoundException e) {
    System.err.println("Inbox has expired");
    // Create new inbox
    Inbox newInbox = client.createInbox();
}
```

### Invalid Import Data

```java
try {
    Inbox inbox = client.importInboxFromFile(Path.of("old-inbox.json"));
} catch (InvalidImportDataException e) {
    System.err.println("Import failed: " + e.getMessage());
    // Common causes:
    // - Inbox has expired
    // - Invalid key format
    // - Missing required fields
}
```

## Next Steps

- **[Email Objects](/client-java/concepts/emails/)** - Learn about email structure
- **[Managing Inboxes](/client-java/guides/managing-inboxes/)** - Common inbox operations
- **[Import/Export](/client-java/advanced/import-export/)** - Advanced inbox persistence
- **[API Reference: Inbox](/client-java/api/inbox/)** - Complete API documentation
