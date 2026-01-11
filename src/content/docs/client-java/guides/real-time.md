---
title: Real-Time Email Monitoring
description: Guide for using Server-Sent Events subscriptions for real-time email monitoring in VaultSandbox Java client
---

Real-time monitoring allows your tests to react instantly when emails arrive, without polling. This guide covers subscription patterns, multi-inbox monitoring, and advanced async patterns.

## Basic Subscription

### Single Inbox

```java
Subscription subscription = inbox.onNewEmail(email -> {
    System.out.println("Received: " + email.getSubject());
    System.out.println("From: " + email.getFrom());
});

// Later, unsubscribe
subscription.unsubscribe();
```

### With Processing

```java
Subscription subscription = inbox.onNewEmail(email -> {
    // Extract verification code
    String code = extractVerificationCode(email.getText());

    // Verify the user
    verifyUser(code);

    // Mark as processed
    email.markAsRead();
});
```

## Monitoring Multiple Inboxes

Use `InboxMonitor` to receive emails from multiple inboxes through a single callback:

```java
InboxMonitor monitor = client.monitorInboxes(inbox1, inbox2, inbox3);

monitor.onEmail(email -> {
    System.out.println("Email to: " + email.getTo());
    System.out.println("Subject: " + email.getSubject());
});
```

### Multiple Callbacks

```java
InboxMonitor monitor = client.monitorInboxes(inbox1, inbox2);

// Add multiple callbacks
monitor.onEmail(this::processEmail);
monitor.onEmail(this::logEmail);
monitor.onEmail(email -> metrics.recordEmail());
```

### Removing Callbacks

```java
Consumer<Email> callback = email -> processEmail(email);

monitor.onEmail(callback);

// Later, remove the specific callback
monitor.removeCallback(callback);
```

### Using Try-With-Resources

`InboxMonitor` implements `Closeable`:

```java
try (InboxMonitor monitor = client.monitorInboxes(inbox1, inbox2, inbox3)) {
    monitor.onEmail(email -> {
        System.out.println("Received: " + email.getSubject());
    });

    // Trigger emails to be sent...
    sendTestEmails();

    // Wait for processing
    Thread.sleep(5000);
} // Automatically unsubscribes and cleans up
```

## Unsubscribing

### Basic Unsubscribe

```java
Subscription sub = inbox.onNewEmail(handler);

// When done
sub.unsubscribe();
```

### Conditional Unsubscribe

Unsubscribe after finding a specific email:

```java
AtomicReference<Subscription> subRef = new AtomicReference<>();

subRef.set(inbox.onNewEmail(email -> {
    if (email.getSubject().contains("Verification")) {
        processEmail(email);
        subRef.get().unsubscribe(); // Unsubscribe after finding target
    }
}));
```

### With Try-Finally

```java
Subscription sub = inbox.onNewEmail(handler);
try {
    // Do work that may trigger emails
    triggerEmailFlow();
    Thread.sleep(10000);
} finally {
    sub.unsubscribe();
}
```

## Real-World Patterns

### Wait for Specific Email with CompletableFuture

```java
CompletableFuture<Email> waitForEmail(Inbox inbox, EmailFilter filter, Duration timeout) {
    CompletableFuture<Email> future = new CompletableFuture<>();
    AtomicReference<Subscription> subRef = new AtomicReference<>();

    subRef.set(inbox.onNewEmail(email -> {
        if (filter.matches(email)) {
            future.complete(email);
            subRef.get().unsubscribe();
        }
    }));

    // Timeout handling
    CompletableFuture.delayedExecutor(timeout.toMillis(), TimeUnit.MILLISECONDS)
        .execute(() -> {
            if (!future.isDone()) {
                future.completeExceptionally(
                    new TimeoutException("No matching email within " + timeout));
                subRef.get().unsubscribe();
            }
        });

    return future;
}

// Usage
Email email = waitForEmail(inbox, EmailFilter.subjectContains("Code"), Duration.ofSeconds(30))
    .get(35, TimeUnit.SECONDS);
```

### Collect Multiple Emails

```java
List<Email> collectEmails(Inbox inbox, int count, Duration timeout)
        throws InterruptedException {
    List<Email> collected = Collections.synchronizedList(new ArrayList<>());
    CountDownLatch latch = new CountDownLatch(count);

    Subscription sub = inbox.onNewEmail(email -> {
        collected.add(email);
        latch.countDown();
    });

    try {
        boolean completed = latch.await(timeout.toMillis(), TimeUnit.MILLISECONDS);
        if (!completed) {
            throw new TimeoutException(
                "Only received " + collected.size() + " of " + count + " emails");
        }
        return collected;
    } finally {
        sub.unsubscribe();
    }
}
```

### Email Processing Pipeline

```java
ExecutorService executor = Executors.newFixedThreadPool(4);

inbox.onNewEmail(email -> {
    CompletableFuture
        .supplyAsync(() -> validateEmail(email), executor)
        .thenApply(this::extractData)
        .thenApply(this::processData)
        .thenAccept(this::saveResult)
        .exceptionally(ex -> {
            log.error("Pipeline failed for email: " + email.getId(), ex);
            return null;
        });
});
```

### First-Match Pattern

Stop after receiving the first matching email:

```java
CompletableFuture<Email> firstMatch(List<Inbox> inboxes, EmailFilter filter) {
    CompletableFuture<Email> future = new CompletableFuture<>();
    List<Subscription> subscriptions = new ArrayList<>();

    for (Inbox inbox : inboxes) {
        Subscription sub = inbox.onNewEmail(email -> {
            if (filter.matches(email) && future.complete(email)) {
                // Unsubscribe all on first match
                subscriptions.forEach(Subscription::unsubscribe);
            }
        });
        subscriptions.add(sub);
    }

    return future;
}
```

## Testing with Real-Time Monitoring

### JUnit Integration

```java
@Test
void shouldReceiveEmailInRealTime() throws Exception {
    CompletableFuture<Email> future = new CompletableFuture<>();

    Subscription sub = inbox.onNewEmail(future::complete);
    try {
        // Trigger email send
        emailService.sendWelcomeEmail(inbox.getEmailAddress());

        // Wait for email
        Email email = future.get(30, TimeUnit.SECONDS);
        assertThat(email.getSubject()).contains("Welcome");
    } finally {
        sub.unsubscribe();
    }
}
```

### Concurrent Email Testing

```java
@Test
void shouldHandleConcurrentEmails() throws Exception {
    List<Email> received = Collections.synchronizedList(new ArrayList<>());
    CountDownLatch latch = new CountDownLatch(5);

    Subscription sub = inbox.onNewEmail(email -> {
        received.add(email);
        latch.countDown();
    });

    try {
        // Send 5 emails concurrently
        IntStream.range(0, 5).parallel().forEach(i ->
            emailService.send(inbox.getEmailAddress(), "Email " + i, "Body " + i)
        );

        // Wait for all
        assertThat(latch.await(30, TimeUnit.SECONDS)).isTrue();
        assertThat(received).hasSize(5);
    } finally {
        sub.unsubscribe();
    }
}
```

### Multi-Inbox Test

```java
@Test
void shouldReceiveEmailsToMultipleRecipients() throws Exception {
    Inbox inbox1 = client.createInbox();
    Inbox inbox2 = client.createInbox();
    Inbox inbox3 = client.createInbox();

    try (InboxMonitor monitor = client.monitorInboxes(inbox1, inbox2, inbox3)) {
        Set<String> receivedAddresses = ConcurrentHashMap.newKeySet();
        CountDownLatch latch = new CountDownLatch(3);

        monitor.onEmail(email -> {
            receivedAddresses.addAll(email.getTo());
            latch.countDown();
        });

        // Send to all three
        sendGroupEmail(List.of(
            inbox1.getEmailAddress(),
            inbox2.getEmailAddress(),
            inbox3.getEmailAddress()
        ));

        assertThat(latch.await(30, TimeUnit.SECONDS)).isTrue();
        assertThat(receivedAddresses).hasSize(3);
    } finally {
        inbox1.delete();
        inbox2.delete();
        inbox3.delete();
    }
}
```

## SSE Configuration

Configure SSE behavior through `ClientConfig`:

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .strategy(StrategyType.SSE)
    .sseReconnectInterval(Duration.ofSeconds(2))
    .sseMaxReconnectAttempts(10)
    .build();

VaultSandboxClient client = VaultSandboxClient.create(config);
```

### Configuration Options

| Option                    | Default   | Description                             |
| ------------------------- | --------- | --------------------------------------- |
| `strategy`                | `SSE`     | Delivery strategy (SSE, POLLING)        |
| `sseReconnectInterval`    | 2 seconds | Time between reconnection attempts      |
| `sseMaxReconnectAttempts` | 10        | Maximum reconnection attempts           |
| `pollInterval`            | 2 seconds | Polling interval (for POLLING strategy) |

### Force SSE Strategy

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .strategy(StrategyType.SSE)
    .build();
```

### Force Polling Strategy

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .strategy(StrategyType.POLLING)
    .pollInterval(Duration.ofSeconds(1))
    .build();
```

## SSE vs Polling Comparison

| Aspect            | SSE                       | Polling                          |
| ----------------- | ------------------------- | -------------------------------- |
| Latency           | Instant delivery          | Poll interval delay              |
| Connection        | Persistent                | Per request                      |
| Resource usage    | Lower (single connection) | Higher (repeated requests)       |
| Firewall friendly | Usually works             | Always works                     |
| Recovery          | Auto-reconnect            | Natural retry                    |
| Best for          | Real-time requirements    | Firewall-restricted environments |

## Advanced Patterns

### Rate-Limited Processing

```java
Semaphore semaphore = new Semaphore(5); // Max 5 concurrent

inbox.onNewEmail(email -> {
    try {
        semaphore.acquire();
        try {
            processEmail(email);
        } finally {
            semaphore.release();
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
});
```

### Priority Queue Processing

```java
PriorityBlockingQueue<Email> queue = new PriorityBlockingQueue<>(
    10,
    Comparator.comparing(e -> !e.getSubject().contains("URGENT"))
);

inbox.onNewEmail(queue::offer);

// Processor thread
ExecutorService executor = Executors.newSingleThreadExecutor();
executor.submit(() -> {
    while (!Thread.currentThread().isInterrupted()) {
        try {
            Email email = queue.take();
            processEmail(email);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            break;
        }
    }
});
```

### Batching Emails

```java
BlockingQueue<Email> batch = new LinkedBlockingQueue<>();
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);

inbox.onNewEmail(batch::offer);

// Process batch every 5 seconds
scheduler.scheduleAtFixedRate(() -> {
    List<Email> emails = new ArrayList<>();
    batch.drainTo(emails);
    if (!emails.isEmpty()) {
        processBatch(emails);
    }
}, 5, 5, TimeUnit.SECONDS);
```

### Graceful Shutdown Helper

```java
class EmailListener implements AutoCloseable {
    private final List<Subscription> subscriptions = new ArrayList<>();

    public void subscribe(Inbox inbox, Consumer<Email> handler) {
        subscriptions.add(inbox.onNewEmail(handler));
    }

    @Override
    public void close() {
        subscriptions.forEach(Subscription::unsubscribe);
        subscriptions.clear();
    }
}

// Usage
try (EmailListener listener = new EmailListener()) {
    listener.subscribe(inbox1, this::handleEmail);
    listener.subscribe(inbox2, this::handleEmail);

    // Process emails...
    Thread.sleep(30000);
} // Automatically unsubscribes all
```

## Test Cleanup

### AfterEach Cleanup

```java
class RealTimeEmailTest {
    private List<Subscription> subscriptions = new ArrayList<>();
    private Inbox inbox;

    @BeforeEach
    void setUp() {
        inbox = client.createInbox();
    }

    @AfterEach
    void cleanup() {
        // Unsubscribe all
        subscriptions.forEach(Subscription::unsubscribe);
        subscriptions.clear();

        // Delete inbox
        if (inbox != null) {
            try { inbox.delete(); } catch (Exception ignored) {}
        }
    }

    @Test
    void testRealTime() {
        Subscription sub = inbox.onNewEmail(this::handleEmail);
        subscriptions.add(sub);

        // Test...
    }
}
```

### Test Base Class

```java
abstract class RealTimeTestBase {
    protected VaultSandboxClient client;
    protected final List<Subscription> subscriptions = new ArrayList<>();

    @BeforeEach
    void setUpClient() {
        client = VaultSandboxClient.create(
            ClientConfig.builder()
                .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
                .baseUrl(System.getenv("VAULTSANDBOX_URL"))
                .strategy(StrategyType.SSE)
                .build()
        );
    }

    @AfterEach
    void tearDown() {
        subscriptions.forEach(Subscription::unsubscribe);
        subscriptions.clear();
        client.deleteAllInboxes();
        client.close();
    }

    protected Subscription subscribe(Inbox inbox, Consumer<Email> handler) {
        Subscription sub = inbox.onNewEmail(handler);
        subscriptions.add(sub);
        return sub;
    }
}
```

## Error Handling

### Callback Exceptions

Exceptions in callbacks are caught and logged by the library, but don't affect other callbacks:

```java
monitor.onEmail(email -> {
    // This exception won't crash the subscription
    if (email.getSubject() == null) {
        throw new RuntimeException("Missing subject");
    }
    processEmail(email);
});

// Other callbacks still execute
monitor.onEmail(email -> logEmail(email));
```

### Defensive Callbacks

```java
inbox.onNewEmail(email -> {
    try {
        processEmail(email);
    } catch (Exception e) {
        log.error("Failed to process email: " + email.getId(), e);
        // Optionally retry or queue for later
        retryQueue.offer(email);
    }
});
```

## Best Practices

1. **Always unsubscribe when done** - Use try-finally or try-with-resources
2. **Handle exceptions in callbacks** - Don't let exceptions crash your processing
3. **Use thread-safe collections** - Callbacks may be invoked from different threads
4. **Set appropriate timeouts** - Use `CompletableFuture.get()` with timeouts
5. **Consider rate limiting** - Use `Semaphore` for resource-intensive processing
6. **Clean up in tests** - Track subscriptions and unsubscribe in `@AfterEach`

```java
// Good: Try-finally for cleanup
Subscription sub = inbox.onNewEmail(handler);
try {
    // Work...
} finally {
    sub.unsubscribe();
}

// Good: Thread-safe collection
List<Email> emails = Collections.synchronizedList(new ArrayList<>());
inbox.onNewEmail(emails::add);

// Good: Timeout on futures
Email email = future.get(30, TimeUnit.SECONDS);
```

## Next Steps

- [Waiting for Emails](/client-java/guides/waiting-for-emails/) - Blocking wait patterns
- [Delivery Strategies](/client-java/advanced/strategies/) - SSE vs Polling details
- [Managing Inboxes](/client-java/guides/managing-inboxes/) - Inbox lifecycle
