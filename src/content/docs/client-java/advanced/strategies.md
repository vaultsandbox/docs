---
title: Delivery Strategies
description: Deep dive into SSE vs Polling delivery strategies for receiving emails
---

The Java SDK supports two delivery strategies for receiving emails. This guide covers when to use each strategy and how to configure them for optimal performance.

## Strategy Overview

| Strategy    | Description                               |
| ----------- | ----------------------------------------- |
| **SSE**     | Real-time via Server-Sent Events (default) |
| **POLLING** | Periodic HTTP polling                     |

## Strategy Comparison

| Aspect            | SSE             | Polling               |
| ----------------- | --------------- | --------------------- |
| Latency           | Instant (~0ms)  | Poll interval (1-30s) |
| Connection        | Persistent      | Per request           |
| Resource usage    | Lower           | Higher                |
| Firewall friendly | Sometimes       | Always                |
| Recovery          | Auto-reconnect  | Natural               |
| Best for          | Real-time needs | CI/CD, firewalls      |

## SSE Strategy (Default)

Real-time email delivery via Server-Sent Events. Uses a persistent HTTP connection for instant notifications.

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .strategy(StrategyType.SSE)
    .sseReconnectInterval(Duration.ofSeconds(2))
    .sseMaxReconnectAttempts(10)
    .build();
```

### Advantages

- Instant email notification (~0ms latency)
- Lower server load (single persistent connection)
- Efficient resource usage
- Automatic reconnection on temporary failures

### Disadvantages

- May be blocked by some firewalls/proxies
- Requires persistent connection
- May not work in all CI environments
- Connection limits in some environments

### Configuration Options

| Option                    | Type       | Default | Description                              |
| ------------------------- | ---------- | ------- | ---------------------------------------- |
| `sseReconnectInterval`    | `Duration` | 2s      | Time between reconnection attempts       |
| `sseMaxReconnectAttempts` | `int`      | 10      | Max reconnection attempts before failure |

### When to Use

- Development environments
- Real-time monitoring applications
- Interactive testing
- Environments with stable connections
- When minimal latency is critical

### Reconnection Behavior

SSE automatically reconnects on connection failures with exponential backoff:

```java
ClientConfig.builder()
    .apiKey(apiKey)
    .strategy(StrategyType.SSE)
    .sseReconnectInterval(Duration.ofSeconds(2))  // Base interval
    .sseMaxReconnectAttempts(10)  // Fails after 10 attempts
    .build();
```

**Reconnection Flow:**

1. Connection lost
2. Wait `sseReconnectInterval * 2^attempts` (exponential backoff)
3. Attempt reconnection
4. If failed, increment attempt counter
5. Reset counter on successful reconnection
6. Throw `SseException` after `sseMaxReconnectAttempts` failures

## Polling Strategy

Periodic polling for new emails. Uses standard HTTP requests at regular intervals.

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .strategy(StrategyType.POLLING)
    .pollInterval(Duration.ofSeconds(2))
    .maxBackoff(Duration.ofSeconds(30))
    .backoffMultiplier(1.5)
    .jitterFactor(0.3)
    .build();
```

### Advantages

- Works everywhere (no firewall issues)
- Firewall friendly (standard HTTP requests)
- Simple request/response model
- Natural recovery from failures
- No persistent connections required

### Disadvantages

- Higher latency (depends on poll interval)
- More API requests
- Slightly higher resource usage
- Trade-off between latency and request frequency

### Configuration Options

| Option              | Type       | Default | Description                    |
| ------------------- | ---------- | ------- | ------------------------------ |
| `pollInterval`      | `Duration` | 2s      | Base polling interval          |
| `maxBackoff`        | `Duration` | 30s     | Maximum backoff duration       |
| `backoffMultiplier` | `double`   | 1.5     | Exponential backoff multiplier |
| `jitterFactor`      | `double`   | 0.3     | Random jitter factor (0-1)     |

### When to Use

- CI/CD environments
- Behind restrictive firewalls
- When reliability is critical
- Environments with connection limits
- Corporate networks with proxy restrictions

## Exponential Backoff

Polling uses exponential backoff with jitter to prevent thundering herd:

```
nextInterval = min(
    pollInterval * (backoffMultiplier ^ attempts),
    maxBackoff
) * (1 + random(-jitterFactor, jitterFactor))
```

**Example sequence (2s base, 1.5x multiplier, 30s max):**

| Attempt | Interval |
| ------- | -------- |
| 1       | 2s       |
| 2       | 3s       |
| 3       | 4.5s     |
| 4       | 6.75s    |
| 5       | 10.1s    |
| ...     | ...      |
| Max     | 30s      |

Jitter adds randomness (±30% by default) to spread out requests.

## Strategy Selection Guide

```
┌─────────────────────────────────────┐
│         Choose Strategy             │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│ Need real-time (<100ms latency)?    │
└─────────────────────────────────────┘
        │               │
       Yes              No
        │               │
        ▼               ▼
┌───────────────┐ ┌───────────────────┐
│ Environment   │ │ Use POLLING       │
│ supports SSE? │ │                   │
└───────────────┘ └───────────────────┘
    │       │
   Yes      No
    │       │
    ▼       ▼
┌───────┐ ┌───────────────────────────┐
│ SSE   │ │ Use POLLING               │
│       │ │                           │
└───────┘ └───────────────────────────┘
```

**Quick Decision:**

| Environment            | Recommended Strategy |
| ---------------------- | -------------------- |
| Development            | SSE                  |
| CI/CD                  | POLLING              |
| Production tests       | SSE                  |
| Behind firewall        | POLLING              |
| Real-time requirements | SSE                  |

## Environment-Specific Configuration

### Local Development

```java
// Fastest feedback with real-time updates
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .strategy(StrategyType.SSE)
    .sseReconnectInterval(Duration.ofSeconds(2))
    .build();
```

### CI/CD

```java
// Most reliable in containerized/restricted environments
ClientConfig config = ClientConfig.builder()
    .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
    .strategy(StrategyType.POLLING)
    .pollInterval(Duration.ofSeconds(2))
    .waitTimeout(Duration.ofSeconds(60))
    .build();
```

### Production Integration Tests

```java
// SSE for real-time delivery
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .strategy(StrategyType.SSE)
    .sseReconnectInterval(Duration.ofSeconds(2))
    .sseMaxReconnectAttempts(5)
    .build();
```

### High-Throughput Testing

```java
// Frequent polling for high email volume scenarios
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .strategy(StrategyType.POLLING)
    .pollInterval(Duration.ofSeconds(1))  // Frequent checks
    .maxBackoff(Duration.ofSeconds(5))    // Quick recovery
    .build();
```

### Low Latency Configuration

```java
// Fast reconnection for low-latency requirements
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .strategy(StrategyType.SSE)
    .sseReconnectInterval(Duration.ofSeconds(1))
    .sseMaxReconnectAttempts(5)
    .build();
```

## Error Handling

### SSE Exceptions

```java
import com.vaultsandbox.client.exception.SseException;

try {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
} catch (SseException e) {
    // SSE connection permanently failed
    System.err.println("SSE failed: " + e.getMessage());
    // Consider switching to POLLING strategy
}
```

### Timeout Handling

```java
import com.vaultsandbox.client.exception.TimeoutException;

try {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
} catch (TimeoutException e) {
    // Email not received within timeout
    System.err.println("Timeout waiting for email");
}
```

## Troubleshooting

| Issue               | Possible Cause          | Solution                        |
| ------------------- | ----------------------- | ------------------------------- |
| SSE not connecting  | Firewall blocking       | Use POLLING                     |
| High latency        | Slow poll interval      | Decrease `pollInterval`         |
| Missed emails       | Backoff too aggressive  | Reduce `maxBackoff`             |
| Too many requests   | Poll interval too short | Increase `pollInterval`         |
| Frequent reconnects | Unstable network        | Increase `sseReconnectInterval` |
| Connection timeouts | Network issues          | Increase `httpTimeout`          |

## Best Practices

1. **Use SSE for real-time needs** - Default strategy with instant delivery
2. **Use POLLING in CI/CD** - Most reliable in restricted environments
3. **Configure timeouts appropriately** - Match your test requirements
4. **Test both strategies** - Ensure code works with either strategy
5. **Set reasonable reconnect limits** - Balance retry vs fail-fast
6. **Use jitter in polling** - Prevents thundering herd on server

## Related Pages

- [Configuration](/client-java/configuration/) - All configuration options
- [Waiting for Emails](/client-java/guides/waiting-for-emails/) - Email waiting patterns
- [Real-time Subscriptions](/client-java/guides/real-time/) - Subscribing to email events
- [CI/CD Integration](/client-java/testing/cicd/) - CI/CD setup guide
