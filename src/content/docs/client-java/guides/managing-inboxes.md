---
title: Managing Inboxes
description: Guide for creating, managing, and deleting test inboxes in VaultSandbox Java client
---

This guide covers common inbox operations including creation, email management, and cleanup patterns for testing.

## Creating Inboxes

### Basic Creation

```java
VaultSandboxClient client = VaultSandboxClient.create(apiKey);
Inbox inbox = client.createInbox();

System.out.println("Send emails to: " + inbox.getEmailAddress());
System.out.println("Expires at: " + inbox.getExpiresAt());
```

### With Custom TTL

```java
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .ttl(Duration.ofHours(2))
        .build()
);
```

### With Specific Domain or Address

```java
// Request specific domain
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .emailAddress("yourdomain.com")
        .build()
);

// Request specific full address
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .emailAddress("test-user@yourdomain.com")
        .build()
);
```

### Multiple Options

```java
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .emailAddress("testing@yourdomain.com")
        .ttl(Duration.ofMinutes(30))
        .build()
);
```

## Inbox Properties

| Property | Type | Description |
|----------|------|-------------|
| `emailAddress` | `String` | The inbox email address |
| `expiresAt` | `Instant` | When the inbox expires |

```java
Inbox inbox = client.createInbox();

String address = inbox.getEmailAddress();  // "abc123@vaultsandbox.com"
Instant expires = inbox.getExpiresAt();    // 2024-01-15T12:00:00Z
```

## Listing Emails

### Get All Emails

```java
List<Email> emails = inbox.listEmails();

for (Email email : emails) {
    System.out.println("From: " + email.getFrom());
    System.out.println("Subject: " + email.getSubject());
    System.out.println("Received: " + email.getReceivedAt());
}
```

:::note
`listEmails()` returns emails with metadata only (from, to, subject, receivedAt). Use `inbox.getEmail(id)` to fetch full content including body and attachments.
:::

### With Stream API

```java
inbox.listEmails().stream()
    .filter(e -> e.getSubject().contains("Important"))
    .forEach(this::processEmail);
```

## Filtering Emails

### Using EmailFilter with Streams

```java
// Filter by subject
List<Email> filtered = inbox.listEmails().stream()
    .filter(e -> e.getSubject().contains("Welcome"))
    .collect(Collectors.toList());

// Filter by sender
List<Email> fromSupport = inbox.listEmails().stream()
    .filter(e -> e.getFrom().contains("support@"))
    .collect(Collectors.toList());
```

### Using EmailFilter Predicates

```java
// Create reusable filters
EmailFilter welcomeFilter = EmailFilter.subjectContains("Welcome");
EmailFilter supportFilter = EmailFilter.from("support@");

// Combine filters
EmailFilter combined = welcomeFilter.and(supportFilter);

// Apply to list
List<Email> matching = inbox.listEmails().stream()
    .filter(combined::matches)
    .collect(Collectors.toList());
```

### Custom Predicates

```java
// Filter by attachment count
List<Email> withAttachments = inbox.listEmails().stream()
    .filter(e -> !e.getAttachments().isEmpty())
    .collect(Collectors.toList());

// Filter by multiple criteria
List<Email> recent = inbox.listEmails().stream()
    .filter(e -> e.getReceivedAt().isAfter(Instant.now().minus(Duration.ofMinutes(5))))
    .filter(e -> !e.isRead())
    .collect(Collectors.toList());
```

## Sorting Emails

### By Received Date

```java
// Newest first
List<Email> sorted = inbox.listEmails().stream()
    .sorted(Comparator.comparing(Email::getReceivedAt).reversed())
    .collect(Collectors.toList());

// Oldest first
List<Email> oldest = inbox.listEmails().stream()
    .sorted(Comparator.comparing(Email::getReceivedAt))
    .collect(Collectors.toList());
```

### By Subject

```java
List<Email> bySubject = inbox.listEmails().stream()
    .sorted(Comparator.comparing(Email::getSubject,
        Comparator.nullsLast(String::compareToIgnoreCase)))
    .collect(Collectors.toList());
```

## Getting Specific Emails

### By ID

```java
Email email = inbox.getEmail(emailId);
```

### First Email

```java
Email first = inbox.listEmails().stream()
    .findFirst()
    .orElseThrow(() -> new AssertionError("No emails found"));
```

### Latest Email

```java
Email latest = inbox.listEmails().stream()
    .max(Comparator.comparing(Email::getReceivedAt))
    .orElseThrow(() -> new AssertionError("No emails found"));
```

### First Matching Filter

```java
Email welcome = inbox.listEmails().stream()
    .filter(e -> e.getSubject().contains("Welcome"))
    .findFirst()
    .orElseThrow(() -> new AssertionError("Welcome email not found"));
```

## Managing Email State

### Mark as Read

```java
// Via inbox
inbox.markEmailAsRead(emailId);

// Via email object
email.markAsRead();
```

### Check Read Status

```java
List<Email> unread = inbox.listEmails().stream()
    .filter(e -> !e.isRead())
    .collect(Collectors.toList());

System.out.println("Unread emails: " + unread.size());
```

## Deleting Emails

### Single Email

```java
// By ID
inbox.deleteEmail(emailId);

// Via email object
email.delete();
```

### Multiple Emails

```java
// Delete all read emails
inbox.listEmails().stream()
    .filter(Email::isRead)
    .forEach(Email::delete);
```

### By Criteria

```java
// Delete old emails
Instant cutoff = Instant.now().minus(Duration.ofHours(1));

inbox.listEmails().stream()
    .filter(e -> e.getReceivedAt().isBefore(cutoff))
    .forEach(Email::delete);
```

### All Emails in Inbox

```java
inbox.listEmails().forEach(Email::delete);
```

## Deleting Inboxes

### Single Inbox

```java
// Via client
client.deleteInbox(inbox.getEmailAddress());

// Via inbox object
inbox.delete();
```

### All Inboxes

```java
int deletedCount = client.deleteAllInboxes();
System.out.println("Deleted " + deletedCount + " inbox(es)");
```

## Bulk Operations

### Create Multiple Inboxes

```java
List<Inbox> inboxes = IntStream.range(0, 10)
    .mapToObj(i -> client.createInbox())
    .collect(Collectors.toList());

// Use inboxes...

// Clean up
inboxes.forEach(Inbox::delete);
```

### Parallel Processing

```java
List<Inbox> inboxes = IntStream.range(0, 5)
    .mapToObj(i -> client.createInbox())
    .collect(Collectors.toList());

// Process emails in parallel
inboxes.parallelStream()
    .flatMap(inbox -> inbox.listEmails().stream())
    .filter(e -> e.getSubject().contains("Alert"))
    .forEach(this::processAlert);
```

## Testing Patterns

### JUnit 5 Setup/Teardown

```java
class EmailTest {
    private VaultSandboxClient client;
    private Inbox inbox;

    @BeforeEach
    void setUp() {
        client = VaultSandboxClient.create(System.getenv("VAULTSANDBOX_API_KEY"));
        inbox = client.createInbox();
    }

    @AfterEach
    void tearDown() {
        if (inbox != null) {
            try {
                inbox.delete();
            } catch (Exception ignored) {}
        }
        if (client != null) {
            client.close();
        }
    }

    @Test
    void shouldReceiveWelcomeEmail() {
        // Trigger email
        signUpUser(inbox.getEmailAddress());

        // Wait and verify
        Email email = inbox.waitForEmail(
            EmailFilter.subjectContains("Welcome"),
            Duration.ofSeconds(30)
        );

        assertThat(email.getFrom()).isEqualTo("noreply@example.com");
    }
}
```

### Try-With-Resources Pattern

```java
@Test
void shouldProcessEmails() {
    try (VaultSandboxClient client = VaultSandboxClient.create(apiKey)) {
        Inbox inbox = client.createInbox();

        try {
            // Trigger and receive emails
            sendTestEmail(inbox.getEmailAddress());
            Email email = inbox.waitForEmail(Duration.ofSeconds(30));
            assertThat(email).isNotNull();
        } finally {
            inbox.delete();
        }
    }
}
```

### Shared Inbox Pattern

For tests that share a single inbox:

```java
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SharedInboxTest {
    private VaultSandboxClient client;
    private Inbox inbox;

    @BeforeAll
    void setUpClass() {
        client = VaultSandboxClient.create(System.getenv("VAULTSANDBOX_API_KEY"));
        inbox = client.createInbox(
            CreateInboxOptions.builder()
                .ttl(Duration.ofHours(1))
                .build()
        );
    }

    @AfterAll
    void tearDownClass() {
        if (client != null) {
            client.deleteAllInboxes();
            client.close();
        }
    }

    @BeforeEach
    void clearEmails() {
        // Clear emails between tests
        inbox.listEmails().forEach(Email::delete);
    }

    @Test
    void testOne() {
        // Uses shared inbox
    }

    @Test
    void testTwo() {
        // Uses same shared inbox
    }
}
```

### Inbox Pool Pattern

For high-throughput testing:

```java
class InboxPool {
    private final Queue<Inbox> available = new ConcurrentLinkedQueue<>();
    private final VaultSandboxClient client;

    public InboxPool(VaultSandboxClient client) {
        this.client = client;
    }

    public Inbox acquire() {
        Inbox inbox = available.poll();
        if (inbox != null) {
            return inbox;
        }
        return client.createInbox();
    }

    public void release(Inbox inbox) {
        // Clear emails and return to pool
        try {
            inbox.listEmails().forEach(Email::delete);
            available.offer(inbox);
        } catch (Exception e) {
            // Inbox may have expired, don't return to pool
        }
    }

    public void shutdown() {
        Inbox inbox;
        while ((inbox = available.poll()) != null) {
            try {
                inbox.delete();
            } catch (Exception ignored) {}
        }
    }
}
```

Usage:

```java
class PooledInboxTest {
    private static InboxPool pool;
    private Inbox inbox;

    @BeforeAll
    static void setUpPool() {
        VaultSandboxClient client = VaultSandboxClient.create(apiKey);
        pool = new InboxPool(client);
    }

    @AfterAll
    static void tearDownPool() {
        pool.shutdown();
    }

    @BeforeEach
    void acquireInbox() {
        inbox = pool.acquire();
    }

    @AfterEach
    void releaseInbox() {
        pool.release(inbox);
    }

    @Test
    void testWithPooledInbox() {
        // Use inbox...
    }
}
```

### Test Base Class

```java
abstract class EmailTestBase {
    protected VaultSandboxClient client;
    protected Inbox inbox;

    @BeforeEach
    void setUpInbox() {
        client = VaultSandboxClient.create(System.getenv("VAULTSANDBOX_API_KEY"));
        inbox = client.createInbox();
    }

    @AfterEach
    void tearDownInbox() {
        if (inbox != null) {
            try { inbox.delete(); } catch (Exception ignored) {}
        }
        if (client != null) {
            client.close();
        }
    }

    protected Email waitForEmail(String subjectContains) {
        return inbox.waitForEmail(
            EmailFilter.subjectContains(subjectContains),
            Duration.ofSeconds(30)
        );
    }
}

class WelcomeEmailTest extends EmailTestBase {
    @Test
    void shouldSendWelcomeEmail() {
        signUp(inbox.getEmailAddress());
        Email email = waitForEmail("Welcome");
        assertThat(email).isNotNull();
    }
}
```

## Error Handling

### Common Exceptions

```java
try {
    Inbox inbox = client.createInbox();
    Email email = inbox.waitForEmail(Duration.ofSeconds(10));
} catch (ApiException e) {
    System.err.println("API error: " + e.getStatusCode() + " - " + e.getMessage());
} catch (NetworkException e) {
    System.err.println("Network error: " + e.getMessage());
} catch (TimeoutException e) {
    System.err.println("Timeout waiting for email");
} catch (VaultSandboxException e) {
    System.err.println("General error: " + e.getMessage());
}
```

### Inbox Not Found

```java
try {
    client.deleteInbox("nonexistent@vaultsandbox.com");
} catch (InboxNotFoundException e) {
    System.err.println("Inbox does not exist: " + e.getMessage());
}
```

### Graceful Cleanup

```java
void cleanupSafely(Inbox inbox) {
    if (inbox == null) return;

    try {
        inbox.delete();
    } catch (InboxNotFoundException e) {
        // Already deleted, ignore
    } catch (Exception e) {
        System.err.println("Failed to delete inbox: " + e.getMessage());
    }
}
```

## Retrieving Inboxes

### From Client Registry

```java
// Create inbox
Inbox inbox = client.createInbox();
String address = inbox.getEmailAddress();

// Later, retrieve from same client instance
Inbox sameInbox = client.getInbox(address);
```

:::note
`getInbox()` only returns inboxes created or imported by this client instance. For cross-session access, use [Import/Export](/client-java/advanced/import-export/).
:::

## Best Practices

1. **Always clean up inboxes after tests** - Use `@AfterEach` or try-finally blocks
2. **Use appropriate TTLs** - Set shorter TTLs for automated tests, longer for manual testing
3. **Create fresh inboxes for isolation** - Avoid sharing inboxes between unrelated tests
4. **Handle rate limits** - Implement retries for bulk operations
5. **Close the client** - Call `client.close()` when done to release resources

```java
// Good: Fresh inbox per test
@BeforeEach
void setUp() {
    inbox = client.createInbox();
}

@AfterEach
void tearDown() {
    inbox.delete();
}

// Good: Short TTL for automated tests
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .ttl(Duration.ofMinutes(15))
        .build()
);

// Good: Use try-with-resources for client
try (VaultSandboxClient client = VaultSandboxClient.create(apiKey)) {
    // Use client...
}
```

## Next Steps

- [Waiting for Emails](/client-java/guides/waiting-for-emails/) - Delivery strategies and filters
- [Import & Export](/client-java/advanced/import-export/) - Persist inbox credentials
- [API Reference: Inbox](/client-java/api/inbox/) - Complete Inbox API documentation
