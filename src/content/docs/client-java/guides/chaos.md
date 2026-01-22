---
title: Chaos Engineering
description: Test email resilience by simulating SMTP failures and network issues
---

Chaos engineering allows you to simulate various SMTP failure scenarios and network issues during email testing. This helps verify your application handles email delivery failures gracefully.

## Prerequisites

Chaos features must be enabled on the gateway server. Check availability:

```java
ServerInfo serverInfo = client.getServerInfo();

if (serverInfo.isChaosEnabled()) {
    System.out.println("Chaos features available");
} else {
    System.out.println("Chaos features disabled on this server");
}
```

## Enabling Chaos

### During Inbox Creation

```java
ChaosConfig chaos = ChaosConfig.builder()
    .enabled(true)
    .latency(LatencyConfig.builder()
        .enabled(true)
        .minDelayMs(1000)
        .maxDelayMs(5000)
        .build())
    .build();

Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .chaos(chaos)
        .build()
);
```

### After Inbox Creation

```java
ChaosConfig config = inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    .latency(LatencyConfig.builder()
        .enabled(true)
        .minDelayMs(1000)
        .maxDelayMs(5000)
        .build())
    .build());
```

### Getting Current Configuration

```java
ChaosConfig config = inbox.getChaos();

System.out.println("Chaos enabled: " + config.isEnabled());
if (config.getLatency() != null) {
    System.out.println("Latency enabled: " + config.getLatency().isEnabled());
}
```

### Disabling Chaos

```java
inbox.disableChaos();
```

## Chaos Configuration

```java
import com.vaultsandbox.client.model.ChaosConfig;
import com.vaultsandbox.client.model.LatencyConfig;
import com.vaultsandbox.client.model.ConnectionDropConfig;
import com.vaultsandbox.client.model.RandomErrorConfig;
import com.vaultsandbox.client.model.GreylistConfig;
import com.vaultsandbox.client.model.BlackholeConfig;
```

| Property         | Type                   | Required | Description                            |
| ---------------- | ---------------------- | -------- | -------------------------------------- |
| `enabled`        | `Boolean`              | Yes      | Master switch for all chaos features   |
| `expiresAt`      | `String`               | No       | Auto-disable chaos after this time     |
| `latency`        | `LatencyConfig`        | No       | Inject artificial delays               |
| `connectionDrop` | `ConnectionDropConfig` | No       | Simulate connection failures           |
| `randomError`    | `RandomErrorConfig`    | No       | Return random SMTP error codes         |
| `greylist`       | `GreylistConfig`       | No       | Simulate greylisting behavior          |
| `blackhole`      | `BlackholeConfig`      | No       | Accept but silently discard emails     |

## Latency Injection

Inject artificial delays into email processing to test timeout handling and slow connections.

```java
inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    .latency(LatencyConfig.builder()
        .enabled(true)
        .minDelayMs(500)       // Minimum delay (default: 500)
        .maxDelayMs(5000)      // Maximum delay (default: 10000, max: 60000)
        .jitter(true)          // Randomize within range (default: true)
        .probability(0.5)      // 50% of emails affected (default: 1.0)
        .build())
    .build());
```

### Configuration Options

| Property      | Type      | Default | Description                                            |
| ------------- | --------- | ------- | ------------------------------------------------------ |
| `enabled`     | `Boolean` | —       | Enable/disable latency injection                       |
| `minDelayMs`  | `Integer` | `500`   | Minimum delay in milliseconds                          |
| `maxDelayMs`  | `Integer` | `10000` | Maximum delay in milliseconds (max: 60000)             |
| `jitter`      | `Boolean` | `true`  | Randomize delay within range. If false, uses maxDelay  |
| `probability` | `Double`  | `1.0`   | Probability of applying delay (0.0-1.0)                |

### Use Cases

- Test application timeout handling
- Verify UI responsiveness during slow email delivery
- Test retry logic with variable delays

## Connection Drop

Simulate connection failures by dropping SMTP connections.

```java
inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    .connectionDrop(ConnectionDropConfig.builder()
        .enabled(true)
        .probability(0.3)    // 30% of connections dropped
        .graceful(false)     // Abrupt RST instead of graceful FIN
        .build())
    .build());
```

### Configuration Options

| Property      | Type      | Default | Description                                  |
| ------------- | --------- | ------- | -------------------------------------------- |
| `enabled`     | `Boolean` | —       | Enable/disable connection dropping           |
| `probability` | `Double`  | `1.0`   | Probability of dropping connection (0.0-1.0) |
| `graceful`    | `Boolean` | `true`  | Use graceful close (FIN) vs abrupt (RST)     |

### Use Cases

- Test connection reset handling
- Verify TCP error recovery
- Test application behavior when SMTP connections fail mid-delivery

## Random Errors

Return random SMTP error codes to test error handling.

```java
inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    .randomError(RandomErrorConfig.builder()
        .enabled(true)
        .errorRate(0.1)                              // 10% of emails return errors
        .errorTypes(ChaosErrorType.TEMPORARY)        // Only 4xx errors
        .build())
    .build());
```

### Configuration Options

| Property     | Type                   | Default     | Description                       |
| ------------ | ---------------------- | ----------- | --------------------------------- |
| `enabled`    | `Boolean`              | —           | Enable/disable random errors      |
| `errorRate`  | `Double`               | `0.1`       | Probability of returning an error |
| `errorTypes` | `List<ChaosErrorType>` | `TEMPORARY` | Types of errors to return         |

### Error Types

| Type        | SMTP Codes | Description                          |
| ----------- | ---------- | ------------------------------------ |
| `TEMPORARY` | 4xx        | Temporary failures, should retry     |
| `PERMANENT` | 5xx        | Permanent failures, should not retry |

### Use Cases

- Test 4xx SMTP error handling and retry logic
- Test 5xx SMTP error handling and failure notifications
- Verify application handles both error types correctly

## Greylisting Simulation

Simulate greylisting behavior where the first delivery attempt is rejected and subsequent retries are accepted.

```java
inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    .greylist(GreylistConfig.builder()
        .enabled(true)
        .retryWindowMs(300000)           // 5 minute window
        .maxAttempts(2)                  // Accept on second attempt
        .trackBy(GreylistTrackBy.IP_SENDER)  // Track by IP and sender combination
        .build())
    .build());
```

### Configuration Options

| Property        | Type              | Default     | Description                              |
| --------------- | ----------------- | ----------- | ---------------------------------------- |
| `enabled`       | `Boolean`         | —           | Enable/disable greylisting               |
| `retryWindowMs` | `Integer`         | `300000`    | Window for tracking retries (5 min)      |
| `maxAttempts`   | `Integer`         | `2`         | Attempts before accepting                |
| `trackBy`       | `GreylistTrackBy` | `IP_SENDER` | How to identify unique delivery attempts |

### Tracking Methods

| Method      | Description                           |
| ----------- | ------------------------------------- |
| `IP`        | Track by sender IP only               |
| `SENDER`    | Track by sender email only            |
| `IP_SENDER` | Track by combination of IP and sender |

### Use Cases

- Test SMTP retry behavior when mail servers use greylisting
- Verify retry intervals and backoff logic
- Test handling of temporary 4xx rejections

## Blackhole Mode

Accept emails but silently discard them without storing.

```java
inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    .blackhole(BlackholeConfig.builder()
        .enabled(true)
        .triggerWebhooks(false)     // Don't trigger webhooks for discarded emails
        .build())
    .build());
```

### Configuration Options

| Property          | Type      | Default | Description                           |
| ----------------- | --------- | ------- | ------------------------------------- |
| `enabled`         | `Boolean` | —       | Enable/disable blackhole mode         |
| `triggerWebhooks` | `Boolean` | `false` | Trigger webhooks for discarded emails |

### Use Cases

- Test behavior when emails are silently lost
- Test webhook integration even when emails aren't stored
- Simulate email delivery that succeeds at SMTP level but fails at storage

## Auto-Expiring Chaos

Set chaos to automatically disable after a specific time:

```java
import java.time.Instant;
import java.time.temporal.ChronoUnit;

// Enable chaos for 1 hour
String expiresAt = Instant.now().plus(1, ChronoUnit.HOURS).toString();

inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    .expiresAt(expiresAt)
    .latency(LatencyConfig.builder()
        .enabled(true)
        .maxDelayMs(3000)
        .build())
    .build());
```

After `expiresAt`, chaos is automatically disabled and normal email delivery resumes.

## Combining Chaos Scenarios

Multiple chaos features can be enabled simultaneously:

```java
inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    // 30% of emails delayed 1-5 seconds
    .latency(LatencyConfig.builder()
        .enabled(true)
        .minDelayMs(1000)
        .maxDelayMs(5000)
        .probability(0.3)
        .build())
    // 10% of emails return temporary errors
    .randomError(RandomErrorConfig.builder()
        .enabled(true)
        .errorRate(0.1)
        .errorTypes(ChaosErrorType.TEMPORARY)
        .build())
    .build());
```

## Complete Example

```java
import com.vaultsandbox.client.VaultSandboxClient;
import com.vaultsandbox.client.Inbox;
import com.vaultsandbox.client.CreateInboxOptions;
import com.vaultsandbox.client.model.*;

public class ChaosExample {
    public static void main(String[] args) {
        VaultSandboxClient client = VaultSandboxClient.builder()
            .url(System.getenv("VAULTSANDBOX_URL"))
            .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
            .build();

        try {
            // Check if chaos is available
            ServerInfo serverInfo = client.getServerInfo();
            if (!serverInfo.isChaosEnabled()) {
                System.out.println("Chaos features not available on this server");
                return;
            }

            // Create inbox with chaos enabled
            ChaosConfig chaos = ChaosConfig.builder()
                .enabled(true)
                .latency(LatencyConfig.builder()
                    .enabled(true)
                    .minDelayMs(2000)
                    .maxDelayMs(5000)
                    .probability(0.5)
                    .build())
                .randomError(RandomErrorConfig.builder()
                    .enabled(true)
                    .errorRate(0.1)
                    .errorTypes(ChaosErrorType.TEMPORARY)
                    .build())
                .build();

            Inbox inbox = client.createInbox(
                CreateInboxOptions.builder()
                    .chaos(chaos)
                    .build()
            );

            System.out.println("Testing with chaos: " + inbox.getEmailAddress());

            // Get current chaos configuration
            ChaosConfig config = inbox.getChaos();
            System.out.println("Chaos enabled: " + config.isEnabled());
            if (config.getLatency() != null) {
                System.out.println("Latency enabled: " + config.getLatency().isEnabled());
            }

            // Send test emails and verify handling
            // Your test logic here...

            // Update chaos configuration
            inbox.setChaos(ChaosConfig.builder()
                .enabled(true)
                .greylist(GreylistConfig.builder()
                    .enabled(true)
                    .maxAttempts(3)
                    .build())
                .build());

            // More testing...

            // Disable chaos for normal operation tests
            inbox.disableChaos();

            // Clean up
            inbox.delete();

        } finally {
            client.close();
        }
    }
}
```

## Testing Patterns

### Test Retry Logic

```java
import com.vaultsandbox.client.strategy.WaitOptions;
import java.time.Duration;

// Enable greylisting to test retry behavior
inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    .greylist(GreylistConfig.builder()
        .enabled(true)
        .maxAttempts(2)
        .build())
    .build());

// Send email - first attempt will fail, retry should succeed
sendEmail(inbox.getEmailAddress());

// If your mail sender retries correctly, email should arrive
Email email = inbox.waitForEmail(WaitOptions.builder()
    .timeout(Duration.ofMillis(60000))
    .build());
```

### Test Timeout Handling

```java
import com.vaultsandbox.client.exception.TimeoutException;
import com.vaultsandbox.client.strategy.WaitOptions;
import java.time.Duration;

// Enable high latency
inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    .latency(LatencyConfig.builder()
        .enabled(true)
        .minDelayMs(10000)
        .maxDelayMs(15000)
        .build())
    .build());

// Test that your application handles timeouts correctly
try {
    inbox.waitForEmail(WaitOptions.builder()
        .timeout(Duration.ofMillis(5000))
        .build());
} catch (TimeoutException e) {
    // Expected: TimeoutException
    System.out.println("Timeout handled correctly");
}
```

### Test Error Recovery

```java
// Enable high error rate
inbox.setChaos(ChaosConfig.builder()
    .enabled(true)
    .randomError(RandomErrorConfig.builder()
        .enabled(true)
        .errorRate(0.8)
        .errorTypes(ChaosErrorType.TEMPORARY, ChaosErrorType.PERMANENT)
        .build())
    .build());

// Test that your application handles errors and retries appropriately
```

## Error Handling

```java
import com.vaultsandbox.client.exception.InboxNotFoundException;
import com.vaultsandbox.client.exception.ApiException;

try {
    inbox.setChaos(ChaosConfig.builder()
        .enabled(true)
        .latency(LatencyConfig.builder()
            .enabled(true)
            .build())
        .build());
} catch (InboxNotFoundException e) {
    System.err.println("Inbox not found");
} catch (ApiException e) {
    if (e.getStatusCode() == 403) {
        System.err.println("Chaos features are disabled on this server");
    } else {
        System.err.println("API error (" + e.getStatusCode() + "): " + e.getMessage());
    }
}
```

## JUnit 5 Integration

### Chaos Test Base

```java
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.TestInstance;
import com.vaultsandbox.client.VaultSandboxClient;
import com.vaultsandbox.client.Inbox;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class ChaosTestBase {
    protected VaultSandboxClient client;
    protected Inbox inbox;

    @BeforeAll
    void setUp() {
        client = VaultSandboxClient.builder()
            .url(System.getenv("VAULTSANDBOX_URL"))
            .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
            .build();

        // Skip tests if chaos is not available
        ServerInfo serverInfo = client.getServerInfo();
        assumeTrue(serverInfo.isChaosEnabled(),
            "Chaos features not available on this server");
    }

    @AfterEach
    void cleanUp() {
        if (inbox != null) {
            inbox.delete();
            inbox = null;
        }
    }
}
```

### Parameterized Chaos Tests

```java
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.stream.Stream;

class ChaosResilienceTest extends ChaosTestBase {

    static Stream<ChaosConfig> chaosScenarios() {
        return Stream.of(
            ChaosConfig.builder()
                .enabled(true)
                .latency(LatencyConfig.builder()
                    .enabled(true)
                    .minDelayMs(1000)
                    .maxDelayMs(3000)
                    .build())
                .build(),
            ChaosConfig.builder()
                .enabled(true)
                .randomError(RandomErrorConfig.builder()
                    .enabled(true)
                    .errorRate(0.5)
                    .build())
                .build(),
            ChaosConfig.builder()
                .enabled(true)
                .greylist(GreylistConfig.builder()
                    .enabled(true)
                    .maxAttempts(2)
                    .build())
                .build()
        );
    }

    @ParameterizedTest
    @MethodSource("chaosScenarios")
    void testApplicationResilience(ChaosConfig chaosConfig) {
        inbox = client.createInbox(
            CreateInboxOptions.builder()
                .chaos(chaosConfig)
                .build()
        );

        // Test your application's resilience
        // ...
    }
}
```

## Next Steps

- [Inbox API Reference](/client-java/api/inbox/) - Complete inbox methods including chaos
- [CI/CD Integration](/client-java/testing/cicd/) - Integrate chaos testing in pipelines
- [Error Handling](/client-java/api/errors/) - Handle chaos-related errors
