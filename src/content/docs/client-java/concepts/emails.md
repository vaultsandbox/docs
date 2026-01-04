---
title: Email Objects
description: Understanding email objects and their properties in VaultSandbox
---

Email objects in VaultSandbox represent decrypted emails with all their content, headers, and metadata.

## Email Structure

```java
Email email = inbox.waitForEmail(Duration.ofSeconds(30));

System.out.println(email.getId());         // "email_abc123"
System.out.println(email.getFrom());       // "sender@example.com"
System.out.println(email.getTo());         // ["recipient@mail.example.com"]
System.out.println(email.getSubject());    // "Welcome to our service"
System.out.println(email.getText());       // Plain text content
System.out.println(email.getHtml());       // HTML content
System.out.println(email.getReceivedAt()); // Instant
System.out.println(email.isRead());        // false
System.out.println(email.getLinks());      // ["https://example.com/verify"]
System.out.println(email.getAttachments()); // List of attachments
System.out.println(email.getAuthResults()); // SPF/DKIM/DMARC results
```

## Core Properties

### id

**Type**: `String`

Unique identifier for the email.

```java
String emailId = email.getId();
// Later...
Email sameEmail = inbox.getEmail(emailId);
```

### from

**Type**: `String`

Sender's email address (from the `From` header).

```java
System.out.println(email.getFrom()); // "noreply@example.com"

// Use in assertions
assertThat(email.getFrom()).isEqualTo("support@example.com");
```

### to

**Type**: `List<String>`

List of recipient email addresses (immutable).

```java
System.out.println(email.getTo()); // ["user@mail.example.com"]

// Multiple recipients
System.out.println(email.getTo()); // ["user1@...", "user2@..."]

// Check if sent to specific address
assertThat(email.getTo()).contains(inbox.getEmailAddress());
```

### subject

**Type**: `String`

Email subject line. May be `null` if not present.

```java
System.out.println(email.getSubject()); // "Password Reset Request"

// Use in filtering
Email email = inbox.waitForEmail(
    EmailFilter.subjectContains("Password Reset"),
    Duration.ofSeconds(10)
);
```

### text

**Type**: `String` (nullable)

Plain text content of the email.

```java
System.out.println(email.getText());
// "Hello,\n\nClick here to reset your password:\nhttps://..."

// May be null if email is HTML-only
if (email.getText() != null) {
    assertThat(email.getText()).contains("reset your password");
}
```

### html

**Type**: `String` (nullable)

HTML content of the email.

```java
System.out.println(email.getHtml());
// "<html><body><p>Hello,</p><a href='...'>Reset Password</a></body></html>"

// May be null if email is plain text only
if (email.getHtml() != null) {
    assertThat(email.getHtml()).contains("<a href");
}
```

### receivedAt

**Type**: `Instant`

When the email was received by the gateway.

```java
System.out.println(email.getReceivedAt()); // 2024-01-15T12:00:00Z

// Check if email arrived recently
Duration age = Duration.between(email.getReceivedAt(), Instant.now());
assertThat(age.toSeconds()).isLessThan(60); // Received within last minute
```

### isRead

**Type**: `boolean`

Whether the email has been marked as read.

```java
System.out.println(email.isRead()); // false

email.markAsRead();

System.out.println(email.isRead()); // true
```

### links

**Type**: `List<String>`

All URLs extracted from the email (text and HTML). Returns an immutable list.

```java
System.out.println(email.getLinks());
// [
//   "https://example.com/verify?token=abc123",
//   "https://example.com/unsubscribe",
//   "https://example.com/privacy"
// ]

// Find specific link
Optional<String> verifyLink = email.getLinks().stream()
    .filter(url -> url.contains("/verify"))
    .findFirst();
assertThat(verifyLink).isPresent();
```

### attachments

**Type**: `List<Attachment>`

List of email attachments (immutable).

```java
System.out.println(email.getAttachments().size()); // 2

for (Attachment att : email.getAttachments()) {
    System.out.println(att.getFilename());    // "invoice.pdf"
    System.out.println(att.getContentType()); // "application/pdf"
    System.out.println(att.getSize());        // 15234 bytes
    byte[] content = att.getContent();        // byte[]
}
```

See [Working with Attachments](/client-java/guides/attachments/) for details.

### authResults

**Type**: `AuthResults` (nullable)

Email authentication results (SPF, DKIM, DMARC, reverse DNS). May be `null` if authentication results are not available.

```java
AuthResults auth = email.getAuthResults();

if (auth != null) {
    System.out.println(auth.getSpf().getResult());  // "pass"
    System.out.println(auth.getDkim().size());      // 1
    System.out.println(auth.getDmarc().getResult()); // "pass"

    // Validate all checks
    AuthValidation validation = auth.validate();
    if (!validation.isFullyAuthenticated()) {
        System.err.println("Authentication failed: " + validation.getFailed());
    }
}
```

See [Authentication Results](/client-java/concepts/auth-results/) for details.

### headers

**Type**: `Map<String, String>`

All email headers as a key-value map (immutable).

```java
System.out.println(email.getHeaders());
// {
//   "from": "noreply@example.com",
//   "to": "user@mail.example.com",
//   "subject": "Welcome",
//   "message-id": "<abc123@example.com>",
//   "date": "Mon, 15 Jan 2024 12:00:00 +0000",
//   "content-type": "text/html; charset=utf-8",
//   ...
// }

// Access specific headers
String messageId = email.getHeaders().get("message-id");
String contentType = email.getHeaders().get("content-type");
```

### metadata

**Type**: `Map<String, Object>`

Additional metadata associated with the email (immutable).

```java
System.out.println(email.getMetadata());
// {
//   "emailSizeBytes": 5432,
//   "encryptedAt": "2024-01-15T12:00:00.000Z",
//   ...
// }
```

## Email Methods

### markAsRead()

Mark the email as read.

```java
email.markAsRead();

System.out.println(email.isRead()); // true
```

### delete()

Delete the email from the inbox.

```java
email.delete();

// Email is now deleted
try {
    inbox.getEmail(email.getId());
} catch (EmailNotFoundException e) {
    System.out.println("Email deleted");
}
```

### getRaw()

Get the raw email source (decrypted RFC822 MIME content).

```java
String raw = email.getRaw();

System.out.println(raw);
// "From: sender@example.com\r\nTo: recipient@example.com\r\n..."

// Or through inbox
String raw = inbox.getRawEmail(email.getId());
```

## Common Patterns

### Content Validation

```java
Email email = inbox.waitForEmail(
    EmailFilter.subjectContains("Welcome"),
    Duration.ofSeconds(10)
);

// Validate sender
assertThat(email.getFrom()).isEqualTo("noreply@example.com");

// Validate content
assertThat(email.getText()).contains("Thank you for signing up");
assertThat(email.getHtml()).contains("<h1>Welcome</h1>");

// Validate links
Optional<String> verifyLink = email.getLinks().stream()
    .filter(url -> url.contains("/verify"))
    .findFirst();
assertThat(verifyLink).isPresent();
assertThat(verifyLink.get()).startsWith("https://");
```

### Link Extraction and Testing

```java
Email email = inbox.waitForEmail(
    EmailFilter.subjectContains("Reset"),
    Duration.ofSeconds(10)
);

// Extract reset link
String resetLink = email.getLinks().stream()
    .filter(url -> url.contains("reset-password") || url.contains("token="))
    .findFirst()
    .orElseThrow(() -> new AssertionError("Reset link not found"));

assertThat(resetLink).isNotNull();

// Extract token from link
URI uri = URI.create(resetLink);
String query = uri.getQuery();
String token = Arrays.stream(query.split("&"))
    .filter(param -> param.startsWith("token="))
    .map(param -> param.substring(6))
    .findFirst()
    .orElseThrow();

assertThat(token).isNotEmpty();
assertThat(token.length()).isGreaterThan(20);
```

### Multi-Part Emails

```java
// Email with both text and HTML
boolean hasText = email.getText() != null;
boolean hasHtml = email.getHtml() != null;
boolean isMultipart = hasText && hasHtml;

if (isMultipart) {
    // Validate both versions have key content
    assertThat(email.getText()).contains("Welcome");
    assertThat(email.getHtml()).contains("<h1>Welcome</h1>");
}

// HTML-only email
if (hasHtml && !hasText) {
    System.out.println("HTML-only email");
    assertThat(email.getHtml()).contains("<!DOCTYPE html>");
}

// Plain text only
if (hasText && !hasHtml) {
    System.out.println("Plain text email");
}
```

### Prefer Text, Fallback to HTML

```java
String content = email.getText() != null
    ? email.getText()
    : email.getHtml();
```

### Time-Based Assertions

```java
Instant startTime = Instant.now();

// Trigger email
sendWelcomeEmail(inbox.getEmailAddress());

// Wait and receive
Email email = inbox.waitForEmail(Duration.ofSeconds(10));

// Verify it arrived quickly
Duration deliveryTime = Duration.between(startTime, email.getReceivedAt());
assertThat(deliveryTime.toSeconds()).isLessThan(5); // Within 5 seconds
```

### Email Metadata Analysis

```java
System.out.println("Email details:");
System.out.println("- From: " + email.getFrom());
System.out.println("- Subject: " + email.getSubject());
System.out.println("- Received: " + email.getReceivedAt());
System.out.println("- Size: " + (email.getText() != null ? email.getText().length() : 0) + " chars");
System.out.println("- Links: " + email.getLinks().size());
System.out.println("- Attachments: " + email.getAttachments().size());

// Check email authentication
if (email.getAuthResults() != null) {
    AuthValidation auth = email.getAuthResults().validate();
    System.out.println("- Auth passed: " + auth.isFullyAuthenticated());
    if (!auth.isFullyAuthenticated()) {
        System.out.println("- Auth failures: " + auth.getFailed());
    }
}
```

## Working with Attachments

```java
List<Attachment> attachments = email.getAttachments();

for (Attachment attachment : attachments) {
    String filename = attachment.getFilename();
    String contentType = attachment.getContentType();
    int size = attachment.getSize();
    byte[] content = attachment.getContent();

    System.out.printf("File: %s (%s, %d bytes)%n", filename, contentType, size);

    // Save to file
    attachment.saveTo(Path.of("/tmp/" + filename));
}

// Find specific attachment
Optional<Attachment> pdf = attachments.stream()
    .filter(a -> a.getFilename().endsWith(".pdf"))
    .findFirst();
```

## Email Filtering

Use `EmailFilter` to wait for specific emails:

```java
// Filter by subject
Email email = inbox.waitForEmail(
    EmailFilter.subjectContains("Password Reset"),
    Duration.ofSeconds(10)
);

// Filter by sender
Email email = inbox.waitForEmail(
    EmailFilter.from("noreply@example.com"),
    Duration.ofSeconds(10)
);

// Filter by regex pattern
Email email = inbox.waitForEmail(
    EmailFilter.subjectMatches(Pattern.compile("Order #\\d+")),
    Duration.ofSeconds(10)
);

// Combine filters
EmailFilter filter = EmailFilter.subjectContains("Welcome")
    .and(EmailFilter.from("noreply@"));

Email email = inbox.waitForEmail(filter, Duration.ofSeconds(10));

// Custom predicate
Email email = inbox.waitForEmail(
    EmailFilter.matching(e -> e.getLinks().size() > 0),
    Duration.ofSeconds(10)
);

// Builder pattern
EmailFilter filter = EmailFilter.builder()
    .subject("Welcome")
    .from("support@")
    .where(e -> e.getAttachments().isEmpty())
    .build();
```

## Testing Examples

### JUnit 5 Example

```java
class WelcomeEmailTest {
    private Inbox inbox;

    @BeforeEach
    void setUp() {
        inbox = client.createInbox();
    }

    @AfterEach
    void tearDown() {
        inbox.delete();
    }

    @Test
    void shouldSendWelcomeEmailOnSignup() {
        registerUser(inbox.getEmailAddress());

        Email email = inbox.waitForEmail(
            EmailFilter.subjectContains("Welcome"),
            Duration.ofSeconds(10)
        );

        assertThat(email.getFrom()).isEqualTo("noreply@example.com");
        assertThat(email.getSubject()).contains("Welcome");
        assertThat(email.getText()).contains("Thank you for signing up");

        Optional<String> verifyLink = email.getLinks().stream()
            .filter(url -> url.contains("/verify"))
            .findFirst();
        assertThat(verifyLink).isPresent();
    }

    @Test
    void shouldIncludeUnsubscribeLink() {
        registerUser(inbox.getEmailAddress());

        Email email = inbox.waitForEmail(Duration.ofSeconds(10));

        Optional<String> unsubLink = email.getLinks().stream()
            .filter(url -> url.contains("/unsubscribe") || url.contains("list-unsubscribe"))
            .findFirst();

        assertThat(unsubLink).isPresent();
    }
}
```

### Password Reset Flow

```java
class PasswordResetTest {
    private Inbox inbox;

    @BeforeEach
    void setUp() {
        inbox = client.createInbox();
    }

    @AfterEach
    void tearDown() {
        inbox.delete();
    }

    @Test
    void shouldSendResetEmailWithValidToken() {
        requestPasswordReset(inbox.getEmailAddress());

        Email email = inbox.waitForEmail(
            EmailFilter.subjectMatches(Pattern.compile("(?i)reset")),
            Duration.ofSeconds(10)
        );

        assertThat(email.getFrom()).isEqualTo("security@example.com");

        String resetLink = email.getLinks().get(0);
        assertThat(resetLink).startsWith("https://");
        assertThat(resetLink).contains("token=");

        // Verify token format
        URI uri = URI.create(resetLink);
        String token = Arrays.stream(uri.getQuery().split("&"))
            .filter(p -> p.startsWith("token="))
            .map(p -> p.substring(6))
            .findFirst()
            .orElseThrow();
        assertThat(token).hasSize(64);
    }
}
```

### Grouped Assertions

```java
@Test
void shouldReceiveValidEmail() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(10));

    assertAll(
        () -> assertThat(email.getFrom()).contains("noreply@"),
        () -> assertThat(email.getSubject()).isNotBlank(),
        () -> assertThat(email.getText()).isNotNull(),
        () -> assertThat(email.getLinks()).isNotEmpty()
    );
}
```

## Troubleshooting

### Email Content is Null

```java
if (email.getText() == null && email.getHtml() == null) {
    System.err.println("Email has no content");
    System.out.println("Headers: " + email.getHeaders());
    System.out.println("Raw: " + email.getRaw());
}
```

### Links Not Extracted

```java
if (email.getLinks().isEmpty()) {
    System.out.println("No links found");
    System.out.println("Text: " + email.getText());
    System.out.println("HTML: " + email.getHtml());

    // Manually extract
    Pattern urlPattern = Pattern.compile("https?://[^\\s]+");
    if (email.getText() != null) {
        Matcher matcher = urlPattern.matcher(email.getText());
        while (matcher.find()) {
            System.out.println("Found: " + matcher.group());
        }
    }
}
```

### Decryption Errors

```java
try {
    Email email = inbox.getEmail(emailId);
} catch (DecryptionException e) {
    System.err.println("Failed to decrypt email");
    System.err.println("This may indicate:");
    System.err.println("- Inbox has expired");
    System.err.println("- Corrupted data");
    System.err.println("- Server issue");
}
```

### Attachment Content Not Available

```java
try {
    attachment.saveTo(Path.of("/tmp/file.pdf"));
} catch (IllegalStateException e) {
    System.err.println("Attachment content is not available");
    System.err.println("This may indicate corrupted data or a server issue");
}
```

## Next Steps

- **[Authentication Results](/client-java/concepts/auth-results/)** - Email authentication details
- **[Working with Attachments](/client-java/guides/attachments/)** - Handle email attachments
- **[Email Authentication](/client-java/guides/authentication/)** - Test SPF/DKIM/DMARC
- **[API Reference: Email](/client-java/api/email/)** - Complete API documentation
