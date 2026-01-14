---
title: Email API
description: Complete API reference for the Email class and related types
---

The `Email` class represents a decrypted email with all content and metadata. Email objects are largely immutable after construction.

## Class Overview

```java
public class Email
```

An email contains standard properties (from, to, subject, body) plus additional metadata like authentication results (SPF, DKIM, DMARC) and extracted content (links, attachments).

**Content availability:**

- Emails from `inbox.listEmails()`, `inbox.getEmail()`, and `waitForEmail()` have **full content**
- Use `inbox.listEmailsMetadataOnly()` if you only need metadata (returns `EmailMetadata` objects)

## Core Properties

| Property     | Type           | Description             |
| ------------ | -------------- | ----------------------- |
| `id`         | `String`       | Unique email identifier |
| `from`       | `String`       | Sender email address    |
| `to`         | `List<String>` | Recipient addresses     |
| `subject`    | `String`       | Email subject line      |
| `receivedAt` | `Instant`      | When email was received |
| `isRead`     | `boolean`      | Read status             |

### Getters

```java
public String getId()
public String getFrom()
public List<String> getTo()
public String getSubject()
public Instant getReceivedAt()
public boolean isRead()
```

## Content Properties

| Property | Type     | Description                   |
| -------- | -------- | ----------------------------- |
| `text`   | `String` | Plain text body (may be null) |
| `html`   | `String` | HTML body (may be null)       |

### Getters

```java
public String getText()    // May return null
public String getHtml()    // May return null
```

**Note:** Both may be `null` if the email doesn't contain that content type (e.g., plain text only or HTML only emails).

## Advanced Properties

| Property      | Type                  | Description                 |
| ------------- | --------------------- | --------------------------- |
| `links`       | `List<String>`        | URLs extracted from content |
| `attachments` | `List<Attachment>`    | File attachments            |
| `authResults` | `AuthResults`         | SPF/DKIM/DMARC results      |
| `headers`     | `Map<String, String>` | Raw email headers           |
| `metadata`    | `Map<String, Object>` | Additional metadata         |

### Getters

```java
public List<String> getLinks()
public List<Attachment> getAttachments()
public AuthResults getAuthResults()        // May return null
public Map<String, String> getHeaders()
public Map<String, Object> getMetadata()
```

## Methods

### markAsRead()

Marks this email as read.

```java
public void markAsRead()
```

Updates both the server state and the local `isRead()` flag.

**Throws:**

- `ApiException` - on API errors
- `NetworkException` - on network connectivity issues

### delete()

Deletes this email from the inbox.

```java
public void delete()
```

**Throws:**

- `ApiException` - on API errors
- `NetworkException` - on network connectivity issues

### getRaw()

Gets the raw RFC822 MIME content.

```java
public String getRaw()
```

**Returns:** Raw email string including all headers

**Throws:**

- `ApiException` - on API errors
- `NetworkException` - on network connectivity issues

## Attachment Class

Represents an email attachment.

```java
public class Attachment
```

### Properties

| Property      | Type     | Description       |
| ------------- | -------- | ----------------- |
| `filename`    | `String` | Original filename |
| `contentType` | `String` | MIME type         |
| `size`        | `int`    | Size in bytes     |
| `content`     | `byte[]` | Decrypted content |

### Getters

```java
public String getFilename()
public String getContentType()
public int getSize()
public byte[] getContent()    // Returns defensive copy, may be null
```

### saveTo(Path path)

Saves the attachment content to a file.

```java
public void saveTo(Path path) throws IOException
```

**Parameters:**

- `path` - Destination file path

**Throws:**

- `IOException` - on write errors
- `IllegalStateException` - if content is not available

### Example

```java
for (Attachment att : email.getAttachments()) {
    System.out.printf("File: %s (%s, %d bytes)%n",
        att.getFilename(),
        att.getContentType(),
        att.getSize());

    // Save to disk
    att.saveTo(Path.of("/tmp", att.getFilename()));

    // Or process in memory
    byte[] content = att.getContent();
}
```

## AuthResults Class

Email authentication validation results.

```java
public class AuthResults
```

### Getters

```java
public SpfResult getSpf()
public List<DkimResult> getDkim()
public DmarcResult getDmarc()
public ReverseDnsResult getReverseDns()
```

### validate()

Returns a summary of passed and failed authentication checks.

```java
public AuthValidation validate()
```

**Returns:** `AuthValidation` with lists of passed and failed checks

**Example:**

```java
AuthResults auth = email.getAuthResults();
if (auth != null) {
    AuthValidation validation = auth.validate();
    System.out.println("Passed: " + validation.getPassed());
    System.out.println("Failed: " + validation.getFailed());
}
```

## AuthValidation Class

Summary of authentication check results.

```java
public class AuthValidation
```

### Methods

| Method                   | Return Type    | Description                                   |
| ------------------------ | -------------- | --------------------------------------------- |
| `getPassed()`            | `List<String>` | List of passed checks (e.g., ["SPF", "DKIM"]) |
| `getFailed()`            | `List<String>` | List of failed checks with reasons            |
| `getFailures()`          | `List<String>` | Alias for `getFailed()`                       |
| `isFullyAuthenticated()` | `boolean`      | True if all checks passed                     |
| `isPassed()`             | `boolean`      | Alias for `isFullyAuthenticated()`            |
| `hasSpf()`               | `boolean`      | True if SPF passed                            |
| `hasDkim()`              | `boolean`      | True if DKIM passed                           |
| `hasDmarc()`             | `boolean`      | True if DMARC passed                          |
| `hasReverseDns()`        | `boolean`      | True if reverse DNS passed                    |

**Example:**

```java
AuthValidation validation = auth.validate();

if (validation.isFullyAuthenticated()) {
    System.out.println("All authentication checks passed!");
} else {
    System.out.println("Failed checks: " + validation.getFailed());
}

// Check specific results
if (validation.hasSpf() && validation.hasDkim()) {
    System.out.println("SPF and DKIM both passed");
}
```

## SpfResult Class

SPF (Sender Policy Framework) validation result.

| Property  | Type     | Description                                                        |
| --------- | -------- | ------------------------------------------------------------------ |
| `result`  | `String` | pass, fail, softfail, neutral, none, temperror, permerror, skipped |
| `domain`  | `String` | Checked domain                                                     |
| `ip`      | `String` | IP address of the sending server                                   |
| `details` | `String` | Additional explanation about the result                            |

### Getters

```java
public String getResult()
public String getDomain()
public String getIp()
public String getDetails()
```

## DkimResult Class

DKIM (DomainKeys Identified Mail) signature result.

| Property    | Type     | Description                        |
| ----------- | -------- | ---------------------------------- |
| `result`    | `String` | pass, fail, none, skipped          |
| `domain`    | `String` | Signing domain                     |
| `selector`  | `String` | DKIM selector used                 |
| `signature` | `String` | DKIM signature information         |

### Getters

```java
public String getResult()
public String getDomain()
public String getSelector()
public String getSignature()
```

**Note:** `AuthResults.getDkim()` returns a `List<DkimResult>` since emails can have multiple DKIM signatures.

## DmarcResult Class

DMARC (Domain-based Message Authentication) result.

| Property  | Type      | Description                                        |
| --------- | --------- | -------------------------------------------------- |
| `result`  | `String`  | pass, fail, none, skipped                          |
| `domain`  | `String`  | From domain                                        |
| `policy`  | `String`  | none, quarantine, reject                           |
| `aligned` | `Boolean` | Whether SPF/DKIM align with the From header domain |

### Getters

```java
public String getResult()
public String getDomain()
public String getPolicy()
public Boolean getAligned()  // May return null
public boolean isAligned()   // Returns true if aligned, false otherwise
```

## ReverseDnsResult Class

Reverse DNS verification result.

| Property   | Type     | Description                                   |
| ---------- | -------- | --------------------------------------------- |
| `result`   | `String` | Result: pass, fail, none, skipped             |
| `ip`       | `String` | IP address of the sending server              |
| `hostname` | `String` | Resolved hostname from PTR record             |

### Status Values

| Status    | Meaning                                          |
| --------- | ------------------------------------------------ |
| `pass`    | PTR record matches and resolves correctly        |
| `fail`    | PTR record doesn't match or doesn't resolve      |
| `none`    | No PTR record found                              |
| `skipped` | Check was skipped (inbox has `emailAuth: false`) |

### Getters

```java
public String getResult()
public boolean isVerified()   // Convenience: returns true if result is "pass"
public String getIp()
public String getHostname()
```

:::caution[Breaking Change in v0.7.0]
The `reverseDns` field now uses `result: String` instead of `verified: boolean`.

**Migration:** Replace `isVerified()` or `verified == true` checks with `"pass".equals(getResult())`:

```java
// Before (v0.6.x)
if (rdns.isVerified()) { ... }

// After (v0.7.0) - preferred
if ("pass".equals(rdns.getResult())) { ... }

// Or use convenience method (still works)
if (rdns.isVerified()) { ... }  // isVerified() returns result.equals("pass")
```
:::

## Examples

### Basic Email Access

```java
Email email = inbox.waitForEmail();

System.out.println("ID: " + email.getId());
System.out.println("From: " + email.getFrom());
System.out.println("To: " + email.getTo());
System.out.println("Subject: " + email.getSubject());
System.out.println("Received: " + email.getReceivedAt());
System.out.println("Read: " + email.isRead());

// Content (check for null)
if (email.getText() != null) {
    System.out.println("Text body:\n" + email.getText());
}
if (email.getHtml() != null) {
    System.out.println("HTML body:\n" + email.getHtml());
}
```

### Working with Links

```java
List<String> links = email.getLinks();
System.out.println("Found " + links.size() + " links");

// Find specific link
Optional<String> resetLink = links.stream()
    .filter(l -> l.contains("/reset-password"))
    .findFirst();

if (resetLink.isPresent()) {
    String url = resetLink.get();
    System.out.println("Reset link: " + url);
    // Navigate to URL or extract token
}

// Find all links matching a pattern
List<String> confirmLinks = links.stream()
    .filter(l -> l.contains("/confirm") || l.contains("/verify"))
    .collect(Collectors.toList());
```

### Working with Attachments

```java
List<Attachment> attachments = email.getAttachments();

if (attachments.isEmpty()) {
    System.out.println("No attachments");
} else {
    for (Attachment att : attachments) {
        System.out.printf("Attachment: %s (%s, %d bytes)%n",
            att.getFilename(),
            att.getContentType(),
            att.getSize());

        // Save to temp directory
        Path dest = Path.of(System.getProperty("java.io.tmpdir"), att.getFilename());
        att.saveTo(dest);
        System.out.println("Saved to: " + dest);
    }
}
```

### Checking Authentication

```java
AuthResults auth = email.getAuthResults();

if (auth == null) {
    System.out.println("No authentication results available");
    return;
}

// Check individual results
if (auth.getSpf() != null) {
    System.out.println("SPF: " + auth.getSpf().getResult() +
        " (domain: " + auth.getSpf().getDomain() + ")");
}

if (auth.getDkim() != null && !auth.getDkim().isEmpty()) {
    for (DkimResult dkim : auth.getDkim()) {
        System.out.println("DKIM: " + dkim.getResult() +
            " (domain: " + dkim.getDomain() +
            ", selector: " + dkim.getSelector() + ")");
    }
}

if (auth.getDmarc() != null) {
    System.out.println("DMARC: " + auth.getDmarc().getResult() +
        " (policy: " + auth.getDmarc().getPolicy() + ")");
}

if (auth.getReverseDns() != null) {
    System.out.println("Reverse DNS: " + auth.getReverseDns().getResult() +
        " (ip: " + auth.getReverseDns().getIp() +
        ", hostname: " + auth.getReverseDns().getHostname() + ")");
}

// Use validation summary
AuthValidation validation = auth.validate();
System.out.println("Passed checks: " + validation.getPassed());
System.out.println("Failed checks: " + validation.getFailed());
System.out.println("Fully authenticated: " + validation.isFullyAuthenticated());
```

### Accessing Headers

```java
Map<String, String> headers = email.getHeaders();

// Get specific header
String contentType = headers.get("Content-Type");
if (contentType != null) {
    System.out.println("Content-Type: " + contentType);
}

String messageId = headers.get("Message-ID");
String inReplyTo = headers.get("In-Reply-To");

// List all headers
System.out.println("All headers:");
headers.forEach((name, value) ->
    System.out.println("  " + name + ": " + value)
);
```

### Managing Email State

```java
// Check and update read status
if (!email.isRead()) {
    // Process email
    processEmail(email);

    // Mark as read
    email.markAsRead();
    System.out.println("Marked as read");
}

// Delete when done
email.delete();
System.out.println("Email deleted");
```

### Getting Raw Email

```java
// Get raw MIME content
String raw = email.getRaw();
System.out.println("Raw email length: " + raw.length() + " bytes");

// Parse with javax.mail or similar
// MimeMessage message = new MimeMessage(session, new ByteArrayInputStream(raw.getBytes()));
```

## Thread Safety

- Email objects are largely immutable after construction
- The `isRead` flag uses `volatile` for thread-safe reads
- Methods that modify state (`markAsRead()`, `delete()`) make API calls
- All collection properties return immutable copies

## Related Pages

- [Inbox API](/client-java/api/inbox/) - Inbox class reference
- [Attachments Guide](/client-java/guides/attachments/) - Working with attachments
- [Authentication Results](/client-java/concepts/auth-results/) - SPF/DKIM/DMARC validation
- [Waiting for Emails](/client-java/guides/waiting-for-emails/) - Email retrieval patterns
