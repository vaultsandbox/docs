---
title: Waiting for Emails
description: Efficient patterns for waiting for emails in VaultSandbox Java tests
---

This guide covers efficient patterns for waiting for emails in your tests, including filtering, timeouts, and handling multiple emails.

## Basic Waiting

### Wait for Any Email

```java
Email email = inbox.waitForEmail();
```

Uses the default timeout configured on the client (30 seconds by default).

### Wait with Custom Timeout

```java
Email email = inbox.waitForEmail(
    EmailFilter.any(),
    Duration.ofSeconds(60)
);
```

### Wait with Filter

```java
Email email = inbox.waitForEmail(
    EmailFilter.subjectContains("Welcome")
);
```

## Await vs Wait

The library provides two patterns for handling timeouts:

### waitForEmail - Throws on Timeout

```java
try {
    Email email = inbox.waitForEmail(Duration.ofSeconds(10));
    // Process email
} catch (TimeoutException e) {
    fail("Email not received within timeout");
}
```

### awaitEmail - Returns Null on Timeout

```java
Email email = inbox.awaitEmail(
    EmailFilter.any(),
    Duration.ofSeconds(30)
);

if (email == null) {
    // Handle timeout gracefully
    System.out.println("No email received");
    return;
}

// Process email
```

## Filtering While Waiting

### By Subject

```java
// Contains substring
Email email = inbox.waitForEmail(
    EmailFilter.subjectContains("Password Reset")
);

// Regex matching
Email email = inbox.waitForEmail(
    EmailFilter.subjectMatches(Pattern.compile("Order #\\d+"))
);
```

### By Sender

```java
// Contains substring
Email email = inbox.waitForEmail(
    EmailFilter.from("noreply@example.com")
);

// Regex matching
Email email = inbox.waitForEmail(
    EmailFilter.fromMatches(Pattern.compile(".*@example\\.com"))
);
```

### Custom Predicate

```java
// Wait for email with attachments
Email email = inbox.waitForEmail(
    EmailFilter.matching(e -> !e.getAttachments().isEmpty())
);

// Wait for email with specific link
Email email = inbox.waitForEmail(
    EmailFilter.matching(e -> e.getLinks().stream()
        .anyMatch(link -> link.contains("/verify")))
);

// Wait for unread email
Email email = inbox.waitForEmail(
    EmailFilter.matching(e -> !e.isRead())
);
```

### Combined Filters

```java
EmailFilter filter = EmailFilter.subjectContains("Invoice")
    .and(EmailFilter.from("billing@"))
    .and(EmailFilter.matching(e -> !e.getAttachments().isEmpty()));

Email email = inbox.waitForEmail(filter, Duration.ofSeconds(30));
```

## Using the Builder Pattern

```java
// Build filter with builder
EmailFilter filter = EmailFilter.builder()
    .subject("Welcome")
    .from("noreply@")
    .where(e -> e.getLinks().size() > 0)
    .build();

Email email = inbox.waitForEmail(filter);
```

## Waiting for Multiple Emails

### Wait for Count

```java
List<Email> emails = inbox.waitForEmailCount(3);
```

### Wait for Count with Timeout

```java
List<Email> emails = inbox.waitForEmailCount(
    3,
    Duration.ofSeconds(60)
);
```

### Process Multiple Sequentially

```java
// Wait for confirmation email
Email confirmation = inbox.waitForEmail(
    EmailFilter.subjectContains("Order Confirmation"),
    Duration.ofSeconds(30)
);

// Wait for shipping email (different email)
Email shipping = inbox.waitForEmail(
    EmailFilter.subjectContains("Shipped"),
    Duration.ofSeconds(60)
);
```

## Wait Options Configuration

For advanced control, use `WaitOptions`:

```java
WaitOptions options = WaitOptions.builder()
    .filter(EmailFilter.subjectContains("Reset"))
    .timeout(Duration.ofSeconds(30))
    .pollInterval(Duration.ofMillis(500))  // Custom poll interval
    .build();

Email email = inbox.waitForEmail(options);
```

### Configuration Options

| Option         | Description                        |
| -------------- | ---------------------------------- |
| `filter`       | Email filter criteria              |
| `timeout`      | Maximum wait time                  |
| `pollInterval` | Poll interval for polling strategy |

## Timeout Handling

### With Exception (Default)

```java
@Test
void shouldReceiveEmail() {
    try {
        Email email = inbox.waitForEmail(Duration.ofSeconds(10));
        assertThat(email).isNotNull();
    } catch (TimeoutException e) {
        fail("Email not received within timeout");
    }
}
```

### With Fallback

```java
Email email = inbox.awaitEmail(
    EmailFilter.subjectContains("Optional"),
    Duration.ofSeconds(5)
);

if (email != null) {
    processOptionalEmail(email);
} else {
    useDefaultBehavior();
}
```

### With Retry

```java
Email email = null;
int maxAttempts = 3;

for (int attempt = 1; attempt <= maxAttempts && email == null; attempt++) {
    System.out.println("Attempt " + attempt + " of " + maxAttempts);
    email = inbox.awaitEmail(
        EmailFilter.subjectContains("Welcome"),
        Duration.ofSeconds(10)
    );
}

if (email == null) {
    fail("Email not received after " + maxAttempts + " attempts");
}
```

## Real-World Examples

### Password Reset Flow

```java
@Test
void shouldReceivePasswordResetEmail() {
    // Trigger password reset
    userService.requestPasswordReset(inbox.getEmailAddress());

    // Wait for email
    Email email = inbox.waitForEmail(
        EmailFilter.subjectContains("Password Reset"),
        Duration.ofSeconds(30)
    );

    // Extract reset link
    String resetLink = email.getLinks().stream()
        .filter(link -> link.contains("/reset"))
        .findFirst()
        .orElseThrow(() -> new AssertionError("Reset link not found"));

    assertThat(resetLink).startsWith("https://");

    // Extract token from link
    URI uri = URI.create(resetLink);
    String query = uri.getQuery();
    String token = Arrays.stream(query.split("&"))
        .filter(p -> p.startsWith("token="))
        .map(p -> p.substring(6))
        .findFirst()
        .orElseThrow();

    assertThat(token).isNotEmpty();
}
```

### Welcome Email Verification

```java
@Test
void shouldReceiveWelcomeEmail() {
    // Register user
    userService.register(inbox.getEmailAddress(), "password123");

    // Wait for welcome email
    Email email = inbox.waitForEmail(
        EmailFilter.subjectContains("Welcome"),
        Duration.ofSeconds(30)
    );

    // Verify sender
    assertThat(email.getFrom()).isEqualTo("noreply@example.com");

    // Verify content
    assertThat(email.getText()).contains("Thank you for signing up");

    // Verify verification link exists
    assertThat(email.getLinks())
        .anyMatch(link -> link.contains("/verify"));
}
```

### Multi-Step Email Flow

```java
@Test
void shouldReceiveOrderEmails() {
    // Place order
    String orderId = orderService.placeOrder(inbox.getEmailAddress(), cart);

    // Wait for confirmation
    Email confirmation = inbox.waitForEmail(
        EmailFilter.subjectContains("Order Confirmation"),
        Duration.ofSeconds(30)
    );
    assertThat(confirmation.getText()).contains(orderId);

    // Ship the order
    orderService.shipOrder(orderId);

    // Wait for shipping notification
    Email shipping = inbox.waitForEmail(
        EmailFilter.subjectContains("Shipped"),
        Duration.ofSeconds(30)
    );
    assertThat(shipping.getText()).contains("tracking");

    // Deliver the order
    orderService.deliverOrder(orderId);

    // Wait for delivery confirmation
    Email delivered = inbox.waitForEmail(
        EmailFilter.subjectContains("Delivered"),
        Duration.ofSeconds(30)
    );
    assertThat(delivered).isNotNull();
}
```

### Email with Attachments

```java
@Test
void shouldReceiveInvoice() {
    billingService.sendInvoice(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(
        EmailFilter.matching(e -> !e.getAttachments().isEmpty()),
        Duration.ofSeconds(30)
    );

    Attachment pdf = email.getAttachments().stream()
        .filter(a -> a.getFilename().endsWith(".pdf"))
        .findFirst()
        .orElseThrow(() -> new AssertionError("PDF attachment not found"));

    assertThat(pdf.getContentType()).isEqualTo("application/pdf");
    assertThat(pdf.getSize()).isGreaterThan(0);
}
```

### Two-Factor Authentication

```java
@Test
void shouldReceive2FACode() {
    // Trigger 2FA
    authService.requestTwoFactorCode(inbox.getEmailAddress());

    // Wait for code email
    Email email = inbox.waitForEmail(
        EmailFilter.subjectContains("Verification Code"),
        Duration.ofSeconds(30)
    );

    // Extract 6-digit code
    Pattern codePattern = Pattern.compile("\\b(\\d{6})\\b");
    Matcher matcher = codePattern.matcher(email.getText());

    assertThat(matcher.find()).isTrue();
    String code = matcher.group(1);

    // Verify the code
    boolean verified = authService.verifyCode(code);
    assertThat(verified).isTrue();
}
```

## Advanced Patterns

### Conditional Waiting

Only wait if email hasn't already arrived:

```java
// Check for existing emails first
Optional<Email> existing = inbox.listEmails().stream()
    .filter(e -> e.getSubject().contains("Target"))
    .findFirst();

Email target = existing.orElseGet(() ->
    inbox.waitForEmail(EmailFilter.subjectContains("Target"))
);
```

### Parallel Email Sending

```java
@Test
void shouldReceiveAllParallelEmails() throws Exception {
    // Send multiple emails in parallel
    CompletableFuture.allOf(
        CompletableFuture.runAsync(() ->
            emailService.sendWelcome(inbox.getEmailAddress())),
        CompletableFuture.runAsync(() ->
            emailService.sendVerification(inbox.getEmailAddress())),
        CompletableFuture.runAsync(() ->
            emailService.sendNewsletter(inbox.getEmailAddress()))
    ).join();

    // Wait for all three
    List<Email> emails = inbox.waitForEmailCount(3, Duration.ofSeconds(30));
    assertThat(emails).hasSize(3);
}
```

### Filtered Collection

```java
// Wait for emails and filter results
List<Email> invoices = inbox.waitForEmailCount(5, Duration.ofSeconds(60))
    .stream()
    .filter(e -> e.getSubject().contains("Invoice"))
    .collect(Collectors.toList());
```

### Time-Based Assertions

```java
@Test
void emailShouldArriveQuickly() {
    Instant start = Instant.now();

    // Trigger email
    emailService.sendImmediate(inbox.getEmailAddress());

    // Wait for email
    Email email = inbox.waitForEmail(Duration.ofSeconds(10));

    // Verify fast delivery
    Duration deliveryTime = Duration.between(start, email.getReceivedAt());
    assertThat(deliveryTime.toSeconds()).isLessThan(5);
}
```

## Testing Best Practices

### Flake-Free Tests

```java
@Test
void flakeFreeTest() {
    // 1. Use generous timeouts for CI environments
    Email email = inbox.waitForEmail(Duration.ofSeconds(60));

    // 2. Use specific filters to avoid matching wrong emails
    Email specific = inbox.waitForEmail(
        EmailFilter.subjectContains("Exact Subject")
            .and(EmailFilter.from("specific@sender.com")),
        Duration.ofSeconds(30)
    );

    // 3. Clear inbox between tests if sharing
    inbox.listEmails().forEach(Email::delete);
}
```

### Fast Tests for Development

```java
@Test
void fastDevelopmentTest() {
    // Shorter timeout for quick feedback
    Email email = inbox.waitForEmail(Duration.ofSeconds(5));
}
```

### Descriptive Failures

```java
@Test
void descriptiveFailureTest() {
    try {
        Email email = inbox.waitForEmail(
            EmailFilter.subjectContains("Expected Subject"),
            Duration.ofSeconds(10)
        );
    } catch (TimeoutException e) {
        // List what we did receive
        List<Email> received = inbox.listEmails();
        String subjects = received.stream()
            .map(Email::getSubject)
            .collect(Collectors.joining(", "));

        fail("Expected email with subject 'Expected Subject' but received: [" +
            subjects + "]");
    }
}
```

## Troubleshooting

### Timeout Errors

1. **Increase timeout** - Network delays can vary
2. **Check email sending** - Verify the trigger actually sends
3. **Use SSE strategy** - Faster than polling
4. **Check filters** - Filter may be too restrictive

```java
// Debug: List all emails to see what arrived
List<Email> all = inbox.listEmails();
System.out.println("Received " + all.size() + " emails:");
for (Email e : all) {
    System.out.println("  - " + e.getSubject() + " from " + e.getFrom());
}
```

### Wrong Email Matched

Use more specific filters:

```java
// Too generic
Email email = inbox.waitForEmail(EmailFilter.from("@example.com"));

// More specific
Email email = inbox.waitForEmail(
    EmailFilter.from("noreply@example.com")
        .and(EmailFilter.subjectContains("Password Reset"))
);
```

### Flaky Tests

1. **Use generous timeouts** - At least 30 seconds for CI
2. **Use specific filters** - Avoid matching wrong emails
3. **Clear inbox between tests** - Prevent cross-test pollution
4. **Fresh inbox per test** - Maximum isolation

```java
@BeforeEach
void setUp() {
    // Fresh inbox for each test
    inbox = client.createInbox();
}

@AfterEach
void tearDown() {
    inbox.delete();
}
```

### Performance

For fastest email detection:

```java
// Use SSE strategy
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .strategy(StrategyType.SSE)
    .build();

VaultSandboxClient client = VaultSandboxClient.create(config);
```

## Next Steps

- [Real-Time Monitoring](/client-java/guides/real-time/) - Subscription-based patterns
- [Managing Inboxes](/client-java/guides/managing-inboxes/) - Inbox lifecycle
- [Delivery Strategies](/client-java/advanced/strategies/) - SSE vs Polling
