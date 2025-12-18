---
title: Error Types
description: Exception types and error handling patterns for the VaultSandbox Java client
---

All SDK exceptions extend `VaultSandboxException`, which is a `RuntimeException`. This means exceptions are unchecked and don't need to be declared in method signatures.

## Exception Hierarchy

```
VaultSandboxException (base - extends RuntimeException)
├── ApiException (has statusCode)
│   ├── InboxNotFoundException (404)
│   └── EmailNotFoundException (404)
├── NetworkException
├── TimeoutException
├── DecryptionException
├── SignatureVerificationException
├── SseException
├── StrategyException
├── InboxAlreadyExistsException
└── InvalidImportDataException (has getErrors())
```

## VaultSandboxException (Base)

Base exception for all SDK errors.

```java
public class VaultSandboxException extends RuntimeException {
    public VaultSandboxException(String message)
    public VaultSandboxException(String message, Throwable cause)
}
```

Use this for catch-all handling:

```java
try {
    // SDK operations
} catch (VaultSandboxException e) {
    // Handle any SDK error
    System.err.println("VaultSandbox error: " + e.getMessage());
}
```

## ApiException

Thrown when the API returns an error response.

```java
public class ApiException extends VaultSandboxException {
    public int getStatusCode()
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `statusCode` | `int` | HTTP status code from the API |

### Common Status Codes

| Code | Meaning | Typical Cause |
|------|---------|---------------|
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Invalid API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Inbox or email doesn't exist |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Server Error | Server-side issue |
| 502 | Bad Gateway | Gateway issue |
| 503 | Service Unavailable | Server overloaded |

### Example

```java
try {
    client.createInbox();
} catch (ApiException e) {
    switch (e.getStatusCode()) {
        case 401:
            throw new IllegalStateException("Invalid API key", e);
        case 429:
            // Rate limited - retry after delay
            Thread.sleep(1000);
            client.createInbox();
            break;
        case 500:
        case 502:
        case 503:
            // Server error - may want to retry
            System.err.println("Server error: " + e.getMessage());
            break;
        default:
            throw e;
    }
}
```

## InboxNotFoundException

Thrown when an inbox doesn't exist. Extends `ApiException` with status code 404.

```java
public class InboxNotFoundException extends ApiException {
    // Constructor sets message to "Inbox not found: {emailAddress}"
}
```

### Example

```java
try {
    client.deleteInbox("nonexistent@example.com");
} catch (InboxNotFoundException e) {
    System.out.println("Inbox not found: " + e.getMessage());
    // Inbox may have expired or been deleted
}
```

## EmailNotFoundException

Thrown when an email doesn't exist. Extends `ApiException` with status code 404.

```java
public class EmailNotFoundException extends ApiException {
    // Constructor sets message to "Email not found: {emailId}"
}
```

### Example

```java
try {
    Email email = inbox.getEmail("invalid-email-id");
} catch (EmailNotFoundException e) {
    System.out.println("Email not found: " + e.getMessage());
    // Email may have been deleted
}
```

## InboxAlreadyExistsException

Thrown when importing an inbox that's already registered with the client.

```java
public class InboxAlreadyExistsException extends VaultSandboxException {
    // Constructor sets message to "Inbox already exists: {emailAddress}"
}
```

### Example

```java
try {
    client.importInbox(exportedInbox);
} catch (InboxAlreadyExistsException e) {
    System.out.println("Already registered: " + e.getMessage());
    // Use existing inbox instead
    Inbox existing = client.getInbox(emailAddress);
}
```

## InvalidImportDataException

Thrown when import data is invalid or corrupted.

```java
public class InvalidImportDataException extends VaultSandboxException {
    public List<String> getErrors()
}
```

### Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `getErrors()` | `List<String>` | List of validation errors |

### Example

```java
try {
    client.importInboxFromFile(path);
} catch (InvalidImportDataException e) {
    System.out.println("Import failed: " + e.getMessage());
    for (String error : e.getErrors()) {
        System.out.println("  - " + error);
    }
}
```

## NetworkException

Thrown on network connectivity issues.

```java
public class NetworkException extends VaultSandboxException {
    public NetworkException(String message)
    public NetworkException(String message, Throwable cause)
}
```

### Example

```java
try {
    client.createInbox();
} catch (NetworkException e) {
    System.err.println("Network error: " + e.getMessage());
    // Check internet connection
    // Retry with backoff
}
```

## TimeoutException

Thrown when waiting for email times out.

```java
public class TimeoutException extends VaultSandboxException {
    public TimeoutException(String message)
    public TimeoutException(String message, Throwable cause)
}
```

### Example

```java
try {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
} catch (TimeoutException e) {
    System.out.println("Timeout: " + e.getMessage());
    // Email not received within timeout
    // Check if email was actually sent
    // Consider increasing timeout
}
```

## DecryptionException

Thrown when email decryption fails.

```java
public class DecryptionException extends VaultSandboxException {
    public DecryptionException(String message)
    public DecryptionException(String message, Throwable cause)
}
```

### Possible Causes

- Inbox has expired and keys are no longer valid
- Cryptographic keys are corrupted
- Server-side encryption mismatch
- Data corruption during transmission

### Example

```java
try {
    Email email = inbox.getEmail(emailId);
} catch (DecryptionException e) {
    System.err.println("Decryption failed: " + e.getMessage());
    // Inbox may have expired - create a new one
}
```

## SignatureVerificationException

Thrown when email signature verification fails.

```java
public class SignatureVerificationException extends VaultSandboxException {
    public SignatureVerificationException()  // "SIGNATURE VERIFICATION FAILED - Data may be tampered!"
    public SignatureVerificationException(String message)
    public SignatureVerificationException(String message, Throwable cause)
}
```

### Possible Causes

- Email data was tampered with in transit
- Server signature key mismatch
- Data corruption

### Example

```java
try {
    Email email = inbox.getEmail(emailId);
} catch (SignatureVerificationException e) {
    System.err.println("Security warning: " + e.getMessage());
    // Data integrity compromised - do not trust this email
}
```

## SseException

Thrown on SSE (Server-Sent Events) connection issues.

```java
public class SseException extends VaultSandboxException {
    public SseException(String message)
    public SseException(String message, Throwable cause)
}
```

### Possible Causes

- SSE connection failed after max reconnect attempts
- Firewall blocking SSE connections
- Proxy not supporting SSE
- Network instability

### Example

```java
try {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
} catch (SseException e) {
    System.err.println("SSE failed: " + e.getMessage());
    // Consider using POLLING strategy instead
}
```

## StrategyException

Thrown when the delivery strategy fails.

```java
public class StrategyException extends VaultSandboxException {
    public StrategyException(String message)
    public StrategyException(String message, Throwable cause)
}
```

### Example

```java
try {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
} catch (StrategyException e) {
    System.err.println("Strategy error: " + e.getMessage());
}
```

## Error Handling Patterns

### Catch Specific Exceptions

Handle different error types appropriately:

```java
try {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    processEmail(email);
} catch (TimeoutException e) {
    // Handle timeout specifically
    fail("Email not received within timeout");
} catch (SseException e) {
    // SSE connection issues
    System.err.println("Connection issue: " + e.getMessage());
} catch (ApiException e) {
    // Handle API errors by status code
    System.err.println("API error " + e.getStatusCode() + ": " + e.getMessage());
} catch (VaultSandboxException e) {
    // Catch-all for other SDK errors
    System.err.println("Error: " + e.getMessage());
}
```

### Retry Pattern

Implement retries with exponential backoff:

```java
public Email waitWithRetry(Inbox inbox, int maxAttempts) {
    Exception lastException = null;

    for (int attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return inbox.waitForEmail(Duration.ofSeconds(10));
        } catch (TimeoutException e) {
            lastException = e;
            System.out.println("Attempt " + attempt + " timed out");
            // Continue to next attempt
        } catch (NetworkException e) {
            lastException = e;
            System.out.println("Attempt " + attempt + " network error: " + e.getMessage());
            // Backoff before retry
            try {
                Thread.sleep(1000L * attempt);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new VaultSandboxException("Interrupted", ie);
            }
        }
    }

    throw new VaultSandboxException("Failed after " + maxAttempts + " attempts", lastException);
}
```

### Graceful Degradation

Return null or default values for non-critical errors:

```java
public Email getEmailSafely(Inbox inbox, String emailId) {
    try {
        return inbox.getEmail(emailId);
    } catch (EmailNotFoundException e) {
        // Email was deleted
        return null;
    } catch (DecryptionException e) {
        logger.warn("Decryption failed for {}: {}", emailId, e.getMessage());
        return null;
    }
}
```

### Logging Pattern

Log errors with appropriate context:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

private static final Logger logger = LoggerFactory.getLogger(MyClass.class);

try {
    Inbox inbox = client.createInbox();
} catch (ApiException e) {
    logger.error("API error creating inbox: status={}, message={}",
        e.getStatusCode(), e.getMessage(), e);
    throw e;
} catch (NetworkException e) {
    logger.error("Network error creating inbox: {}", e.getMessage(), e);
    throw e;
} catch (VaultSandboxException e) {
    logger.error("Error creating inbox: {}", e.getMessage(), e);
    throw e;
}
```

### Resource Cleanup

Always clean up resources in finally blocks:

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .build();
VaultSandboxClient client = VaultSandboxClient.create(config);
Inbox inbox = null;
try {
    inbox = client.createInbox();
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    processEmail(email);
} catch (TimeoutException e) {
    // Handle timeout
} finally {
    if (inbox != null) {
        try {
            client.deleteInbox(inbox.getEmailAddress());
        } catch (Exception e) {
            logger.warn("Failed to cleanup inbox", e);
        }
    }
    client.close();
}
```

Or use try-with-resources:

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .build();
try (VaultSandboxClient client = VaultSandboxClient.create(config)) {
    Inbox inbox = client.createInbox();
    try {
        Email email = inbox.waitForEmail(Duration.ofSeconds(30));
        processEmail(email);
    } finally {
        client.deleteInbox(inbox.getEmailAddress());
    }
}
```

### JUnit 5 Testing

Use assertions for expected exceptions:

```java
import static org.junit.jupiter.api.Assertions.*;

@Test
void testInboxNotFound() {
    assertThrows(InboxNotFoundException.class, () -> {
        client.deleteInbox("nonexistent@example.com");
    });
}

@Test
void testTimeout() {
    Inbox inbox = client.createInbox();

    TimeoutException e = assertThrows(TimeoutException.class, () -> {
        inbox.waitForEmail(Duration.ofMillis(100));
    });

    assertTrue(e.getMessage().contains("timeout"));
}

@Test
void testApiErrorStatusCode() {
    ApiException e = assertThrows(ApiException.class, () -> {
        // Operation that causes API error
    });

    assertEquals(404, e.getStatusCode());
}
```

## Best Practices

1. **Be Specific** - Catch specific exceptions when you need different handling for each type

2. **Don't Swallow** - Always log or rethrow exceptions; never silently ignore them

3. **Use Finally/Try-with-Resources** - Clean up resources properly even when exceptions occur

4. **Set Appropriate Timeouts** - Configure timeouts based on your requirements to fail fast

5. **Retry Smartly** - Use exponential backoff for transient failures (network, rate limits)

6. **Test Error Paths** - Write tests that verify error handling behavior

7. **Log Context** - Include relevant information (IDs, status codes) in log messages

8. **Fail Fast** - Don't catch exceptions too broadly if you can't handle them meaningfully

## Java-Specific Notes

- All exceptions are **unchecked** (extend `RuntimeException`)
- Use **multi-catch** for similar handling: `catch (NetworkException | TimeoutException e)`
- Use **pattern matching** (Java 16+): `if (e instanceof ApiException api)`
- Integrate with **SLF4J** for logging

## Related Pages

- [VaultSandboxClient API](/client-java/api/client/) - Client methods and exceptions
- [Inbox API](/client-java/api/inbox/) - Inbox methods and exceptions
- [Delivery Strategies](/client-java/advanced/strategies/) - SSE vs Polling error handling
