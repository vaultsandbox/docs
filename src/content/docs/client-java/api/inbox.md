---
title: Inbox API
description: Complete API reference for the Inbox class and related types
---

The `Inbox` class represents a test email inbox with methods for receiving and managing emails.

## Class Overview

```java
public class Inbox
```

An inbox has a unique email address that can receive emails. Emails are end-to-end encrypted and can only be decrypted by this inbox's private key.

## Properties

| Property       | Type      | Description                       |
| -------------- | --------- | --------------------------------- |
| `emailAddress` | `String`  | Full email address for this inbox |
| `hash`         | `String`  | Unique identifier hash            |
| `expiresAt`    | `Instant` | When the inbox expires            |
| `serverSigPk`  | `String`  | Server's signature public key     |

### Getters

```java
public String getEmailAddress()
public String getHash()
public Instant getExpiresAt()
public String getServerSigPk()
```

## Email Retrieval Methods

### listEmails()

Lists all emails in the inbox with full content.

```java
public List<Email> listEmails()
```

**Returns:** List of fully hydrated `Email` objects including body text, HTML, headers, attachments, links, and authentication results.

**Throws:**

- `ApiException` - on API errors
- `NetworkException` - on network connectivity issues
- `DecryptionException` - on decryption failure

**Example:**

```java
List<Email> emails = inbox.listEmails();
for (Email email : emails) {
    System.out.println(email.getSubject());
    System.out.println(email.getText());  // Full content available
}
```

### listEmailsMetadataOnly()

Lists all emails returning only metadata (no body content). More efficient when you only need basic email information.

```java
public List<EmailMetadata> listEmailsMetadataOnly()
```

**Returns:** List of `EmailMetadata` objects containing id, from, subject, receivedAt, and isRead.

**Throws:**

- `ApiException` - on API errors
- `NetworkException` - on network connectivity issues
- `DecryptionException` - on decryption failure

**Example:**

```java
List<EmailMetadata> emails = inbox.listEmailsMetadataOnly();
for (EmailMetadata meta : emails) {
    System.out.println(meta.getId() + ": " + meta.getSubject());
    if (!meta.isRead()) {
        // Fetch full email only if needed
        Email full = inbox.getEmail(meta.getId());
    }
}
```

### getEmail(String emailId)

Gets a specific email by ID with full content.

```java
public Email getEmail(String emailId)
```

**Parameters:**

- `emailId` - Unique email identifier

**Returns:** `Email` with full content (body, attachments, headers, auth results)

**Throws:**

- `EmailNotFoundException` - if email doesn't exist
- `ApiException` - on API errors
- `DecryptionException` - on decryption failure

**Example:**

```java
Email email = inbox.getEmail("email-123");
System.out.println(email.getText());
System.out.println(email.getHtml());
```

### getRawEmail(String emailId)

Gets the raw RFC822 MIME content.

```java
public String getRawEmail(String emailId)
```

**Parameters:**

- `emailId` - Unique email identifier

**Returns:** Raw email as string including all headers and MIME boundaries

**Throws:**

- `EmailNotFoundException` - if email doesn't exist
- `ApiException` - on API errors

**Example:**

```java
String raw = inbox.getRawEmail("email-123");
// Parse with javax.mail or similar library
```

## Wait Methods

### waitForEmail()

Wait for any email to arrive.

```java
public Email waitForEmail()
public Email waitForEmail(EmailFilter filter)
public Email waitForEmail(EmailFilter filter, Duration timeout)
public Email waitForEmail(WaitOptions options)
```

**Parameters:**

- `filter` - Optional filter criteria (default: any email)
- `timeout` - Maximum wait time (default: from config)
- `options` - `WaitOptions` with filter, timeout, and poll interval

**Returns:** The matching email

**Throws:**

- `TimeoutException` - if no matching email arrives within timeout

**Examples:**

```java
// Wait for any email
Email email = inbox.waitForEmail();

// With filter
Email welcome = inbox.waitForEmail(EmailFilter.subjectContains("Welcome"));

// With timeout
Email order = inbox.waitForEmail(
    EmailFilter.from("orders@"),
    Duration.ofSeconds(60)
);

// With full options
Email verification = inbox.waitForEmail(
    WaitOptions.builder()
        .filter(EmailFilter.subjectContains("Verify"))
        .timeout(Duration.ofSeconds(30))
        .pollInterval(Duration.ofMillis(500))
        .build()
);
```

### waitForEmailCount(int count)

Wait for multiple emails to arrive.

```java
public List<Email> waitForEmailCount(int count)
public List<Email> waitForEmailCount(int count, Duration timeout)
```

**Parameters:**

- `count` - Number of emails to wait for
- `timeout` - Maximum wait time (default: from config)

**Returns:** List of received emails

**Throws:**

- `TimeoutException` - if count not reached within timeout

**Example:**

```java
// Wait for 3 emails
List<Email> emails = inbox.waitForEmailCount(3, Duration.ofSeconds(60));
assertEquals(3, emails.size());
```

### awaitEmail()

Wait for email, returning `null` on timeout instead of throwing exception.

```java
public Email awaitEmail()
public Email awaitEmail(EmailFilter filter)
public Email awaitEmail(EmailFilter filter, Duration timeout)
```

**Parameters:**

- `filter` - Optional filter criteria (default: any email)
- `timeout` - Maximum wait time (default: from config)

**Returns:** The matching email, or `null` if timeout

**Example:**

```java
Email email = inbox.awaitEmail(
    EmailFilter.subjectContains("Optional"),
    Duration.ofSeconds(10)
);

if (email != null) {
    // Process email
} else {
    // No email received - continue without it
}
```

## Subscription Methods

### onNewEmail(Consumer<Email> callback)

Subscribe to new email notifications.

```java
public Subscription onNewEmail(Consumer<Email> callback)
```

**Parameters:**

- `callback` - Consumer called when new emails arrive

**Returns:** `Subscription` handle to unsubscribe

**Example:**

```java
Subscription sub = inbox.onNewEmail(email -> {
    System.out.println("New email: " + email.getSubject());
    email.markAsRead();
});

// Later, when done
sub.unsubscribe();
```

## Email Management Methods

### markEmailAsRead(String emailId)

Marks an email as read.

```java
public void markEmailAsRead(String emailId)
```

**Parameters:**

- `emailId` - Email to mark

**Throws:**

- `EmailNotFoundException` - if email doesn't exist
- `ApiException` - on API errors

**Note:** Prefer using `email.markAsRead()` on the Email object.

### deleteEmail(String emailId)

Deletes a specific email.

```java
public void deleteEmail(String emailId)
```

**Parameters:**

- `emailId` - Email to delete

**Throws:**

- `EmailNotFoundException` - if email doesn't exist
- `ApiException` - on API errors

**Note:** Prefer using `email.delete()` on the Email object.

### delete()

Deletes this inbox and all its emails.

```java
public void delete()
```

**Throws:**

- `InboxNotFoundException` - if inbox doesn't exist
- `ApiException` - on API errors

**Example:**

```java
// Cleanup when done
inbox.delete();
```

## Other Methods

### getSyncStatus()

Returns the synchronization status of this inbox.

```java
public SyncStatus getSyncStatus()
```

**Returns:** `SyncStatus` with email count and hash (useful for checking if new emails arrived)

### SyncStatus Properties

| Property      | Type     | Description                                                   |
| ------------- | -------- | ------------------------------------------------------------- |
| `emailCount`  | `int`    | Total number of emails in the inbox                           |
| `emailsHash`  | `String` | Hash of all email IDs (changes when emails are added/removed) |
| `lastUpdated` | `String` | Timestamp of last sync                                        |

**Example:**

```java
SyncStatus status = inbox.getSyncStatus();
System.out.println("Email count: " + status.getEmailCount());
System.out.println("Emails hash: " + status.getEmailsHash());
System.out.println("Last updated: " + status.getLastUpdated());
```

### export()

Exports this inbox's credentials for later import.

```java
public ExportedInbox export()
```

**Returns:** `ExportedInbox` containing credentials

**Security Warning:** Contains private keys - store securely!

**Example:**

```java
ExportedInbox exported = inbox.export();
// Equivalent to: client.exportInbox(inbox)
```

## EmailFilter Class

Filter for matching emails based on various criteria.

```java
public final class EmailFilter
```

### Static Factory Methods

```java
EmailFilter.any()                           // Matches all emails
EmailFilter.subjectContains(String text)    // Subject contains substring
EmailFilter.subjectMatches(Pattern regex)   // Subject matches regex
EmailFilter.from(String sender)             // From address contains substring
EmailFilter.fromMatches(Pattern regex)      // From address matches regex
EmailFilter.matching(Predicate<Email> pred) // Custom predicate
```

### Combination Methods

```java
EmailFilter filter1 = EmailFilter.subjectContains("Order");
EmailFilter filter2 = EmailFilter.from("shop@");

// Combine with AND
EmailFilter combined = filter1.and(filter2);
```

### Builder Pattern

For complex filters:

```java
EmailFilter filter = EmailFilter.builder()
    .subject("Welcome")              // Subject contains
    .from("noreply@")                // From contains
    .subjectMatches("Order #\\d+")   // Subject matches regex
    .fromMatches(Pattern.compile(".*@example\\.com"))
    .where(email -> email.getAttachments().size() > 0)  // Custom predicate
    .build();
```

### Builder Methods

| Method                    | Description                        |
| ------------------------- | ---------------------------------- |
| `subject(String)`         | Subject contains substring         |
| `subjectMatches(String)`  | Subject matches regex string       |
| `subjectMatches(Pattern)` | Subject matches regex pattern      |
| `from(String)`            | From address contains substring    |
| `fromMatches(String)`     | From address matches regex string  |
| `fromMatches(Pattern)`    | From address matches regex pattern |
| `where(Predicate<Email>)` | Custom predicate                   |

### Filter Examples

```java
// Simple - subject contains
EmailFilter.subjectContains("Password Reset")

// Simple - from address
EmailFilter.from("noreply@myapp.com")

// Regex pattern
EmailFilter.subjectMatches(Pattern.compile("Invoice #\\d+"))

// Combined filters
EmailFilter.subjectContains("Order")
    .and(EmailFilter.from("shop@"))
    .and(EmailFilter.matching(e -> e.getAttachments().size() > 0))

// Custom predicate
EmailFilter.matching(email -> {
    return email.getLinks().stream()
        .anyMatch(link -> link.contains("/verify"));
})
```

## WaitOptions Class

Configuration for wait operations.

```java
public final class WaitOptions
```

### Builder

```java
WaitOptions options = WaitOptions.builder()
    .filter(EmailFilter.subjectContains("Reset"))
    .timeout(Duration.ofSeconds(30))
    .pollInterval(Duration.ofSeconds(1))
    .build();
```

### Properties

| Property       | Type          | Default     | Description                       |
| -------------- | ------------- | ----------- | --------------------------------- |
| `filter`       | `EmailFilter` | `any()`     | Filter criteria                   |
| `timeout`      | `Duration`    | from config | Maximum wait time                 |
| `pollInterval` | `Duration`    | from config | Poll frequency (polling strategy) |

## EmailMetadata Class

Lightweight representation of an email containing only metadata (no body content).

```java
public class EmailMetadata
```

### Properties

| Property     | Type      | Description                               |
| ------------ | --------- | ----------------------------------------- |
| `id`         | `String`  | Unique email identifier                   |
| `from`       | `String`  | Sender's email address                    |
| `subject`    | `String`  | Email subject line                        |
| `receivedAt` | `String`  | When the email was received               |
| `isRead`     | `boolean` | Whether the email has been marked as read |

### Getters

```java
public String getId()
public String getFrom()
public String getSubject()
public String getReceivedAt()
public boolean isRead()
```

### Example

```java
List<EmailMetadata> emails = inbox.listEmailsMetadataOnly();
for (EmailMetadata meta : emails) {
    System.out.printf("[%s] %s - %s%n",
        meta.isRead() ? "READ" : "NEW",
        meta.getFrom(),
        meta.getSubject());
}
```

## Subscription Interface

Handle for managing email subscriptions.

```java
@FunctionalInterface
public interface Subscription {
    void unsubscribe();
}
```

### Methods

| Method          | Description            |
| --------------- | ---------------------- |
| `unsubscribe()` | Stops the subscription |

**Example:**

```java
Subscription sub = inbox.onNewEmail(email -> {
    processEmail(email);
});

// When done listening
sub.unsubscribe();
```

## Complete Examples

### Basic Email Retrieval

```java
Inbox inbox = client.createInbox();
System.out.println("Send emails to: " + inbox.getEmailAddress());

// Wait for email
Email email = inbox.waitForEmail();

// Process
System.out.println("From: " + email.getFrom());
System.out.println("Subject: " + email.getSubject());
System.out.println("Body: " + email.getText());

// Cleanup
inbox.delete();
```

### Filtered Waiting

```java
// Wait for password reset email
Email resetEmail = inbox.waitForEmail(
    EmailFilter.subjectContains("Password Reset")
        .and(EmailFilter.from("noreply@")),
    Duration.ofSeconds(30)
);

// Extract reset link
String resetLink = resetEmail.getLinks().stream()
    .filter(l -> l.contains("/reset"))
    .findFirst()
    .orElseThrow(() -> new AssertionError("No reset link found"));

System.out.println("Reset link: " + resetLink);
```

### Real-Time Subscription

```java
List<Email> received = new CopyOnWriteArrayList<>();

Subscription sub = inbox.onNewEmail(email -> {
    System.out.println("Received: " + email.getSubject());
    received.add(email);

    if (email.getSubject().contains("Urgent")) {
        notifyAdmin(email);
    }

    email.markAsRead();
});

// Trigger emails to be sent...

// Wait for expected emails
Thread.sleep(5000);

// Stop listening
sub.unsubscribe();

System.out.println("Received " + received.size() + " emails");
```

### Multiple Emails

```java
// Wait for 3 confirmation emails
List<Email> confirmations = inbox.waitForEmailCount(3, Duration.ofSeconds(60));

// Verify all received
assertEquals(3, confirmations.size());

// Process each
for (Email email : confirmations) {
    assertTrue(email.getSubject().contains("Confirmation"));
    processConfirmation(email);
}
```

### Optional Email (No Exception)

```java
// Check for optional notification
Email notification = inbox.awaitEmail(
    EmailFilter.subjectContains("Notification"),
    Duration.ofSeconds(5)
);

if (notification != null) {
    System.out.println("Got notification: " + notification.getSubject());
} else {
    System.out.println("No notification received (expected in some cases)");
}
```

### Export and Import

```java
// Export inbox for later use
ExportedInbox exported = inbox.export();
saveToFile(exported);

// Later, import in another session
ExportedInbox loaded = loadFromFile();
Inbox restoredInbox = client.importInbox(loaded);

// Continue using the inbox
Email email = restoredInbox.waitForEmail();
```

## Thread Safety

The `Inbox` class is thread-safe:

- Multiple threads can call methods simultaneously
- Email lists are safely copied
- Subscriptions are thread-safe
- Wait operations can be called from different threads

## Related Pages

- [VaultSandboxClient API](/client-java/api/client/) - Creating inboxes
- [Email API](/client-java/api/email/) - Email class reference
- [Waiting for Emails](/client-java/guides/waiting-for-emails/) - Wait patterns
- [Real-time Subscriptions](/client-java/guides/real-time/) - Subscription patterns
