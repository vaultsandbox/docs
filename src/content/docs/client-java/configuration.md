---
title: Configuration
description: Configuration options for the VaultSandbox Java client
---

The Java client uses a builder pattern for configuration. Both the API key and base URL are required since VaultSandbox is self-hosted.

## Basic Configuration

```java
ClientConfig config = ClientConfig.builder()
    .apiKey("your-api-key")
    .baseUrl("https://gateway.example.com")
    .build();

VaultSandboxClient client = VaultSandboxClient.create(config);
```

### With Additional Options

```java
ClientConfig config = ClientConfig.builder()
    .apiKey("your-api-key")
    .baseUrl("https://gateway.example.com")
    .strategy(StrategyType.SSE)
    .waitTimeout(Duration.ofSeconds(60))
    .build();

VaultSandboxClient client = VaultSandboxClient.create(config);
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `String` | required | API key for authentication |
| `baseUrl` | `String` | required | Gateway API endpoint URL |
| `strategy` | `StrategyType` | `AUTO` | Email delivery strategy |
| `httpTimeout` | `Duration` | 30s | HTTP request timeout |
| `waitTimeout` | `Duration` | 30s | Default email wait timeout |
| `maxRetries` | `int` | 3 | Maximum retry attempts |
| `retryDelay` | `Duration` | 1s | Initial retry delay |
| `retryOn` | `Set<Integer>` | 408, 429, 500-504 | HTTP status codes to retry |
| `sseReconnectInterval` | `Duration` | 5s | SSE reconnection interval |
| `sseMaxReconnectAttempts` | `int` | 10 | Max SSE reconnection attempts |
| `pollInterval` | `Duration` | 2s | Polling check frequency |
| `maxBackoff` | `Duration` | 30s | Maximum backoff duration |
| `backoffMultiplier` | `double` | 1.5 | Exponential backoff factor |
| `jitterFactor` | `double` | 0.3 | Random jitter factor (0-1) |

## Delivery Strategies

The `strategy` option controls how the client receives emails:

| Strategy | Description | Best For |
|----------|-------------|----------|
| `AUTO` | Tries SSE first, falls back to polling | Most use cases (recommended) |
| `SSE` | Server-Sent Events for real-time delivery | Low-latency requirements |
| `POLLING` | Periodic HTTP requests | CI/CD, firewalled environments |

```java
import com.vaultsandbox.client.StrategyType;

// Real-time delivery
ClientConfig.builder()
    .apiKey(apiKey)
    .strategy(StrategyType.SSE)
    .build();

// Reliable polling
ClientConfig.builder()
    .apiKey(apiKey)
    .strategy(StrategyType.POLLING)
    .pollInterval(Duration.ofSeconds(1))
    .build();
```

## Environment-Specific Configuration

### Production

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
    .strategy(StrategyType.AUTO)
    .httpTimeout(Duration.ofSeconds(30))
    .maxRetries(3)
    .build();
```

### CI/CD

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
    .strategy(StrategyType.POLLING)  // More reliable in CI
    .pollInterval(Duration.ofSeconds(1))
    .waitTimeout(Duration.ofSeconds(60))
    .build();
```

### Development

```java
ClientConfig config = ClientConfig.builder()
    .apiKey("dev-api-key")
    .strategy(StrategyType.SSE)  // Fastest feedback
    .httpTimeout(Duration.ofSeconds(10))
    .build();
```

### High-Reliability

```java
ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .strategy(StrategyType.AUTO)
    .maxRetries(5)
    .retryDelay(Duration.ofMillis(500))
    .sseMaxReconnectAttempts(20)
    .build();
```

## Environment Variables

Use environment variables for sensitive configuration:

```java
String apiKey = System.getenv("VAULTSANDBOX_API_KEY");
if (apiKey == null || apiKey.isBlank()) {
    throw new IllegalStateException("VAULTSANDBOX_API_KEY not set");
}

String baseUrl = System.getenv("VAULTSANDBOX_URL");
if (baseUrl == null || baseUrl.isBlank()) {
    throw new IllegalStateException("VAULTSANDBOX_URL not set");
}

ClientConfig config = ClientConfig.builder()
    .apiKey(apiKey)
    .baseUrl(baseUrl)
    .build();
```

## Resource Management

The client implements `Closeable` and should be closed when done.

### Try-with-resources (Preferred)

```java
try (VaultSandboxClient client = VaultSandboxClient.create(config)) {
    Inbox inbox = client.createInbox();
    Email email = inbox.waitForEmail();
    // Process email
}
// Client automatically closed
```

### Manual Close

```java
VaultSandboxClient client = VaultSandboxClient.create(config);
try {
    Inbox inbox = client.createInbox();
    Email email = inbox.waitForEmail();
    // Process email
} finally {
    client.close();
}
```

### Shared Client in Tests

For JUnit 5, use `@BeforeAll` and `@AfterAll`:

```java
class EmailTests {
    private static VaultSandboxClient client;

    @BeforeAll
    static void setup() {
        ClientConfig config = ClientConfig.builder()
            .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
            .baseUrl(System.getenv("VAULTSANDBOX_URL"))
            .build();
        client = VaultSandboxClient.create(config);
    }

    @AfterAll
    static void teardown() {
        if (client != null) {
            client.close();
        }
    }

    @Test
    void testEmailFlow() {
        Inbox inbox = client.createInbox();
        // Test code
    }
}
```

## Logging

The SDK uses SLF4J for logging. Configure your logging framework to see SDK logs:

### Logback

```xml
<!-- logback.xml -->
<configuration>
    <logger name="com.vaultsandbox" level="DEBUG"/>
</configuration>
```

### Log4j2

```xml
<!-- log4j2.xml -->
<Configuration>
    <Loggers>
        <Logger name="com.vaultsandbox" level="DEBUG"/>
    </Loggers>
</Configuration>
```

## Reading Configuration

Access the current configuration from an existing client:

```java
VaultSandboxClient client = VaultSandboxClient.create(config);
ClientConfig currentConfig = client.getConfig();

System.out.println("Base URL: " + currentConfig.getBaseUrl());
System.out.println("Strategy: " + currentConfig.getStrategy());
System.out.println("Wait Timeout: " + currentConfig.getWaitTimeout());
```

## Best Practices

1. **Use environment variables** for API keys - never commit secrets
2. **Use try-with-resources** for automatic cleanup
3. **Use POLLING in CI/CD** - more reliable than SSE in containerized environments
4. **Set appropriate timeouts** - longer for slow mail servers, shorter for fast feedback
5. **Configure retries** - balance reliability vs test duration
6. **Share client instances** - create once per test class, not per test method

## Next Steps

- [Managing Inboxes](/client-java/guides/managing-inboxes/) - Create and manage test inboxes
- [Waiting for Emails](/client-java/guides/waiting-for-emails/) - Email delivery strategies
- [Delivery Strategies](/client-java/advanced/strategies/) - Deep dive into SSE and polling
