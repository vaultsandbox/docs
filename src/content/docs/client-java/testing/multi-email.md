---
title: Multi-Email Scenarios
description: Guide for testing scenarios involving multiple emails in Java
---

This guide covers testing scenarios that involve multiple emails, including waiting for email counts, testing sequences, parallel sending, and bulk operations.

## Overview

Multi-email testing covers:

- Waiting for multiple emails
- Email sequences and workflows
- Parallel email sending
- Bulk email operations
- Multiple inbox testing

## Using waitForEmailCount()

### Basic Usage

```java
@Test
void shouldReceiveMultipleEmails() {
    // Send 3 emails
    for (int i = 0; i < 3; i++) {
        emailService.send(inbox.getEmailAddress(), "Email " + i);
    }

    // Wait for all 3
    List<Email> emails = inbox.waitForEmailCount(3);

    assertThat(emails).hasSize(3);
}
```

### With Timeout

```java
List<Email> emails = inbox.waitForEmailCount(
    5,
    Duration.ofSeconds(60)
);
```

### With Filter

Wait for emails and filter them:

```java
// Wait for emails and filter to notifications
List<Email> emails = inbox.waitForEmailCount(3, Duration.ofSeconds(30));
List<Email> notifications = emails.stream()
    .filter(e -> e.getSubject() != null && e.getSubject().contains("Notification"))
    .collect(Collectors.toList());
```

## Testing Email Sequences

### Order Confirmation Flow

Test a complete order lifecycle with multiple sequential emails:

```java
@Test
void shouldReceiveOrderEmails() {
    // Place order
    Order order = orderService.placeOrder(
        inbox.getEmailAddress(),
        cart
    );

    // Wait for confirmation
    Email confirmation = inbox.waitForEmail(
        EmailFilter.subjectContains("Order Confirmation")
    );
    assertThat(confirmation.getText()).contains(order.getId());

    // Ship order
    orderService.shipOrder(order.getId());

    // Wait for shipping notification
    Email shipping = inbox.waitForEmail(
        EmailFilter.subjectContains("Shipped")
    );
    assertThat(shipping.getText()).contains("tracking");

    // Deliver order
    orderService.deliverOrder(order.getId());

    // Wait for delivery confirmation
    Email delivered = inbox.waitForEmail(
        EmailFilter.subjectContains("Delivered")
    );
    assertThat(delivered).isNotNull();
}
```

### User Onboarding Flow

Test multi-step user registration and verification:

```java
@Test
void shouldCompleteOnboardingFlow() {
    // Register user
    userService.register(inbox.getEmailAddress(), "password");

    // 1. Welcome email
    Email welcome = inbox.waitForEmail(
        EmailFilter.subjectContains("Welcome")
    );
    assertThat(welcome).isNotNull();

    // 2. Verification email
    Email verify = inbox.waitForEmail(
        EmailFilter.subjectContains("Verify")
    );
    String verifyLink = extractLink(verify, "/verify");

    // Complete verification
    userService.verify(verifyLink);

    // 3. Verification confirmed email
    Email confirmed = inbox.waitForEmail(
        EmailFilter.subjectContains("Verified")
    );
    assertThat(confirmed).isNotNull();
}

private String extractLink(Email email, String pathContains) {
    return email.getLinks().stream()
        .filter(link -> link.contains(pathContains))
        .findFirst()
        .orElseThrow(() -> new AssertionError("Link not found"));
}
```

## Parallel Email Testing

### Concurrent Sending with ExecutorService

```java
@Test
void shouldHandleConcurrentEmails() throws Exception {
    int emailCount = 10;

    // Send emails in parallel
    ExecutorService executor = Executors.newFixedThreadPool(5);
    List<Future<?>> futures = new ArrayList<>();

    for (int i = 0; i < emailCount; i++) {
        int index = i;
        futures.add(executor.submit(() ->
            emailService.send(inbox.getEmailAddress(), "Parallel " + index)
        ));
    }

    // Wait for all sends to complete
    for (Future<?> future : futures) {
        future.get(10, TimeUnit.SECONDS);
    }
    executor.shutdown();

    // Wait for all emails
    List<Email> emails = inbox.waitForEmailCount(
        emailCount,
        Duration.ofSeconds(60)
    );

    assertThat(emails).hasSize(emailCount);
}
```

### Using CompletableFuture

```java
@Test
void shouldProcessEmailsConcurrently() {
    // Send 5 emails
    CompletableFuture<Void> sending = CompletableFuture.allOf(
        IntStream.range(0, 5)
            .mapToObj(i -> CompletableFuture.runAsync(() ->
                emailService.send(inbox.getEmailAddress(), "Email " + i)
            ))
            .toArray(CompletableFuture[]::new)
    );

    sending.join();

    // Wait for all
    List<Email> emails = inbox.waitForEmailCount(5);
    assertThat(emails).hasSize(5);
}
```

## Multiple Inbox Testing

### Different Recipients

Test broadcasting to multiple recipients:

```java
@Test
void shouldSendToMultipleRecipients() {
    Inbox inbox1 = client.createInbox();
    Inbox inbox2 = client.createInbox();
    Inbox inbox3 = client.createInbox();

    try {
        // Send to all
        notificationService.broadcast(
            List.of(
                inbox1.getEmailAddress(),
                inbox2.getEmailAddress(),
                inbox3.getEmailAddress()
            ),
            "Broadcast message"
        );

        // Verify all received
        assertThat(inbox1.waitForEmail()).isNotNull();
        assertThat(inbox2.waitForEmail()).isNotNull();
        assertThat(inbox3.waitForEmail()).isNotNull();
    } finally {
        client.deleteInbox(inbox1.getEmailAddress());
        client.deleteInbox(inbox2.getEmailAddress());
        client.deleteInbox(inbox3.getEmailAddress());
    }
}
```

### Using InboxMonitor

Monitor multiple inboxes simultaneously:

```java
@Test
void shouldMonitorMultipleInboxes() throws Exception {
    Inbox inbox1 = client.createInbox();
    Inbox inbox2 = client.createInbox();

    try {
        List<Email> received = Collections.synchronizedList(new ArrayList<>());
        CountDownLatch latch = new CountDownLatch(2);

        InboxMonitor monitor = client.monitorInboxes(inbox1, inbox2);
        monitor.onEmail(email -> {
            received.add(email);
            latch.countDown();
        });

        // Send to each inbox
        emailService.send(inbox1.getEmailAddress(), "To inbox 1");
        emailService.send(inbox2.getEmailAddress(), "To inbox 2");

        // Wait for both
        assertThat(latch.await(30, TimeUnit.SECONDS)).isTrue();
        assertThat(received).hasSize(2);
    } finally {
        client.deleteInbox(inbox1.getEmailAddress());
        client.deleteInbox(inbox2.getEmailAddress());
    }
}
```

## Bulk Operations

### Processing All Emails

```java
@Test
void shouldProcessBulkEmails() {
    // Generate many emails
    for (int i = 0; i < 50; i++) {
        emailService.send(inbox.getEmailAddress(), "Bulk " + i);
    }

    // Wait for all
    List<Email> emails = inbox.waitForEmailCount(
        50,
        Duration.ofMinutes(2)
    );

    // Process in batches
    Lists.partition(emails, 10).forEach(batch -> {
        batch.parallelStream().forEach(this::processEmail);
    });

    // Mark all as read
    emails.forEach(Email::markAsRead);

    // Verify all read
    List<Email> unread = inbox.listEmails().stream()
        .filter(e -> !e.isRead())
        .collect(Collectors.toList());
    assertThat(unread).isEmpty();
}

private void processEmail(Email email) {
    // Your processing logic
}
```

### Bulk Deletion

```java
@Test
void shouldDeleteOldEmails() {
    List<Email> emails = inbox.listEmails();

    Instant cutoff = Instant.now().minus(Duration.ofHours(1));

    // Delete old emails
    long deleted = emails.stream()
        .filter(e -> e.getReceivedAt().isBefore(cutoff))
        .peek(Email::delete)
        .count();

    System.out.println("Deleted " + deleted + " old emails");
}
```

## Testing Email Ordering

Verify emails arrive and can be sorted by timestamp:

```java
@Test
void shouldReceiveEmailsInOrder() throws InterruptedException {
    // Send emails with timestamps
    for (int i = 0; i < 5; i++) {
        emailService.send(
            inbox.getEmailAddress(),
            "Email " + i + " at " + Instant.now()
        );
        Thread.sleep(100); // Ensure different timestamps
    }

    // Wait for all
    List<Email> emails = inbox.waitForEmailCount(5);

    // Verify ordering by received time
    List<Email> sorted = new ArrayList<>(emails);
    sorted.sort(Comparator.comparing(Email::getReceivedAt));

    for (int i = 0; i < sorted.size() - 1; i++) {
        assertThat(sorted.get(i).getReceivedAt())
            .isBeforeOrEqualTo(sorted.get(i + 1).getReceivedAt());
    }
}
```

## Testing Email Deduplication

Verify duplicate emails are handled correctly:

```java
@Test
void shouldNotDuplicateEmails() throws InterruptedException {
    String messageId = UUID.randomUUID().toString();

    // Send same email twice (simulating retry)
    emailService.sendWithMessageId(inbox.getEmailAddress(), "Test", messageId);
    emailService.sendWithMessageId(inbox.getEmailAddress(), "Test", messageId);

    // Wait a bit
    Thread.sleep(5000);

    // Should only have one email
    List<Email> emails = inbox.listEmails();
    long uniqueMessageIds = emails.stream()
        .map(e -> e.getHeaders().get("Message-ID"))
        .filter(Objects::nonNull)
        .distinct()
        .count();

    assertThat(emails).hasSize(1);
}
```

## Stress Testing

```java
@Test
@Tag("stress")
void shouldHandleHighVolume() throws InterruptedException {
    int totalEmails = 100;
    AtomicInteger sent = new AtomicInteger();

    // Send many emails concurrently
    ExecutorService executor = Executors.newFixedThreadPool(10);
    for (int i = 0; i < totalEmails; i++) {
        int index = i;
        executor.submit(() -> {
            emailService.send(inbox.getEmailAddress(), "Stress " + index);
            sent.incrementAndGet();
        });
    }
    executor.shutdown();
    executor.awaitTermination(2, TimeUnit.MINUTES);

    assertThat(sent.get()).isEqualTo(totalEmails);

    // Wait for all emails
    List<Email> emails = inbox.waitForEmailCount(
        totalEmails,
        Duration.ofMinutes(5)
    );

    assertThat(emails).hasSize(totalEmails);
}
```

## Best Practices

### Use Appropriate Wait Times

Scale timeout with expected email count:

```java
int count = 50;
Duration timeout = Duration.ofSeconds(count * 2); // 2 seconds per email
List<Email> emails = inbox.waitForEmailCount(count, timeout);
```

### Clean Up Efficiently

Delete all inboxes at once rather than individually:

```java
@AfterEach
void tearDown() {
    client.deleteAllInboxes();
}
```

### Use Filters to Avoid Interference

Use unique identifiers to prevent test interference:

```java
String testId = UUID.randomUUID().toString();
emailService.send(inbox.getEmailAddress(), "Test " + testId);

Email email = inbox.waitForEmail(
    EmailFilter.subjectContains(testId)
);
```

### Handle Partial Failures

Log received emails when tests fail for debugging:

```java
@Test
void shouldHandlePartialDelivery() {
    int expected = 5;

    for (int i = 0; i < expected; i++) {
        emailService.send(inbox.getEmailAddress(), "Email " + i);
    }

    try {
        List<Email> emails = inbox.waitForEmailCount(
            expected,
            Duration.ofSeconds(30)
        );
        assertThat(emails).hasSize(expected);
    } catch (TimeoutException e) {
        // Log what we did receive for debugging
        List<Email> received = inbox.listEmails();
        System.out.println("Only received " + received.size() + "/" + expected);
        throw e;
    }
}
```

## Java Concurrency Utilities

| Utility                        | Use Case                             |
| ------------------------------ | ------------------------------------ |
| `ExecutorService`              | Parallel email sending               |
| `CompletableFuture`            | Async operations with composition    |
| `CountDownLatch`               | Synchronizing on multiple events     |
| `AtomicInteger`                | Thread-safe counters                 |
| `Stream API`                   | Bulk processing and filtering        |
| `Collections.synchronizedList` | Thread-safe collection for callbacks |

## Related Pages

- [Waiting for Emails](/client-java/guides/waiting-for-emails/) - Email waiting patterns
- [Password Reset Testing](/client-java/testing/password-reset/) - Single email flow testing
- [CI/CD Integration](/client-java/testing/cicd/) - CI/CD pipeline setup
- [Real-Time Monitoring](/client-java/guides/real-time/) - Subscription-based patterns
