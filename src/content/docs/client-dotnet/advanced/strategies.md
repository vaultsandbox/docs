---
title: Delivery Strategies
description: Learn about SSE and polling delivery strategies in VaultSandbox Client for .NET
---

VaultSandbox Client supports two email delivery strategies: **Server-Sent Events (SSE)** for real-time updates and **Polling** for compatibility. SSE is the default strategy, providing near-instant email notifications.

## Overview

When you wait for emails or watch for new email notifications, the SDK needs to know when emails arrive. It does this using one of two strategies:

1. **SSE (Server-Sent Events)**: Real-time push notifications from the server (default)
2. **Polling**: Periodic checking for new emails

## Strategy Comparison

| Feature             | SSE                             | Polling                     |
| ------------------- | ------------------------------- | --------------------------- |
| **Latency**         | Near-instant (~100ms)           | Poll interval (default: 2s) |
| **Server Load**     | Lower (persistent connection)   | Higher (repeated requests)  |
| **Network Traffic** | Lower (only when emails arrive) | Higher (constant polling)   |
| **Compatibility**   | Requires persistent connections | Works everywhere            |
| **Firewall/Proxy**  | May be blocked                  | Always works                |
| **Battery Impact**  | Lower (push-based)              | Higher (constant requests)  |

## DeliveryStrategy Enum

```csharp
public enum DeliveryStrategy
{
    Sse,      // Server-Sent Events (default)
    Polling   // Polling only
}
```

## SSE Strategy (Default)

Server-Sent Events provide real-time push notifications when emails arrive.

### Advantages

- **Near-instant delivery**: Emails appear within milliseconds
- **Lower server load**: Single persistent connection
- **Efficient**: Only transmits when emails arrive
- **Battery-friendly**: No constant polling

### Configuration

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .UseSseDelivery()
    .WithSseReconnectInterval(TimeSpan.FromSeconds(5))
    .WithSseMaxReconnectAttempts(10)
    .Build();
```

### SSE Configuration Options

| Option                    | Type       | Default     | Description                       |
| ------------------------- | ---------- | ----------- | --------------------------------- |
| `SseReconnectInterval`    | `TimeSpan` | `2 seconds` | Initial delay before reconnection |
| `SseMaxReconnectAttempts` | `int`      | `10`        | Maximum reconnection attempts     |

### Reconnection Behavior

SSE uses **exponential backoff** for reconnections:

```
1st attempt: SseReconnectInterval (2s)
2nd attempt: SseReconnectInterval * 2 (4s)
3rd attempt: SseReconnectInterval * 4 (8s)
...up to SseMaxReconnectAttempts
```

### Example Usage

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .UseSseDelivery()
    .Build();

var inbox = await client.CreateInboxAsync();

// Real-time subscription using IAsyncEnumerable (uses SSE)
using var cts = new CancellationTokenSource();

await foreach (var email in inbox.WatchAsync(cts.Token))
{
    Console.WriteLine($"Instant notification: {email.Subject}");

    // Cancel after first email (or based on your logic)
    if (ShouldStop(email))
    {
        cts.Cancel();
    }
}

// Waiting also uses SSE (faster than polling)
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "Welcome",
    UseRegex = true
});
```

### When to Use SSE

- **Real-time monitoring**: When you need instant email notifications
- **Long-running tests**: Reduces overall test time
- **High email volume**: More efficient than polling
- **Development/local**: Fast feedback during development

### Limitations

- Requires persistent HTTP connection support
- May not work behind some corporate proxies
- Some cloud environments may close long-lived connections
- Requires server-side SSE support

## Polling Strategy

Polling periodically checks for new emails at a configured interval.

### Advantages

- **Universal compatibility**: Works in all environments
- **Firewall-friendly**: Standard HTTP requests
- **Predictable**: Easy to reason about behavior
- **Resilient**: Automatically recovers from transient failures

### Configuration

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromSeconds(2))
    .Build();
```

### Polling Configuration Options

| Option         | Type       | Default     | Description                  |
| -------------- | ---------- | ----------- | ---------------------------- |
| `PollInterval` | `TimeSpan` | `2 seconds` | How often to poll for emails |

### Example Usage

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromSeconds(1))
    .Build();

var inbox = await client.CreateInboxAsync();

// Polling-based subscription using IAsyncEnumerable
using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));

await foreach (var email in inbox.WatchAsync(cts.Token))
{
    Console.WriteLine($"Polled notification: {email.Subject}");
}

// Waiting uses polling (checks every PollInterval)
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "Welcome",
    UseRegex = true
});
```

### Choosing Poll Interval

Different intervals suit different scenarios:

```csharp
// Fast polling (500ms) - Development/local testing
var fastClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("http://localhost:3000")
    .WithApiKey("dev-key")
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromMilliseconds(500))
    .Build();

// Standard polling (2s) - Default, good balance
var standardClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromSeconds(2))
    .Build();

// Slow polling (5s) - CI/CD or rate-limited environments
var slowClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromSeconds(5))
    .Build();
```

### When to Use Polling

- **Corporate networks**: Restrictive firewall/proxy environments
- **CI/CD pipelines**: Guaranteed compatibility
- **Rate-limited APIs**: Avoid hitting request limits
- **Debugging**: Predictable request timing
- **Low email volume**: Polling overhead is minimal

### Performance Optimization

For `WaitForEmailAsync()`, you can override the polling interval per-operation:

```csharp
// Default client polling: 2s
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromSeconds(2))
    .Build();

var inbox = await client.CreateInboxAsync();

// Override for specific operation (faster polling)
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(30),
    PollInterval = TimeSpan.FromSeconds(1) // Check every 1s for this operation
});
```

## Choosing the Right Strategy

### Use SSE (Default)

SSE is the default strategy and recommended for most use cases:

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    // UseSseDelivery() is the default, can be omitted
    .Build();
```

**Best for:**

- General testing
- Local development
- Real-time monitoring dashboards
- High-volume email testing
- Latency-sensitive tests

**Note:** If SSE fails to connect, an `SseException` will be thrown. Consider using polling if you're in an environment where SSE may be blocked.

### Use Polling

When compatibility is more important than speed:

```csharp
var isCI = Environment.GetEnvironmentVariable("CI") == "true";

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .UsePollingDelivery()
    .WithPollInterval(isCI ? TimeSpan.FromSeconds(3) : TimeSpan.FromSeconds(1))
    .Build();
```

**Best for:**

- CI/CD environments (guaranteed to work)
- Corporate networks with restrictive proxies
- When SSE is known to be problematic
- Rate-limited scenarios

## Dependency Injection Configuration

### Via Options

```csharp
// appsettings.json
{
    "VaultSandbox": {
        "BaseUrl": "https://smtp.vaultsandbox.com",
        "ApiKey": "your-api-key",
        "DefaultDeliveryStrategy": "Sse",
        "PollIntervalMs": 2000,
        "SseReconnectIntervalMs": 2000,
        "SseMaxReconnectAttempts": 10
    }
}
```

```csharp
// Program.cs or Startup.cs
services.AddVaultSandboxClient(options =>
{
    options.BaseUrl = configuration["VaultSandbox:BaseUrl"]!;
    options.ApiKey = configuration["VaultSandbox:ApiKey"]!;
    options.DefaultDeliveryStrategy = Enum.Parse<DeliveryStrategy>(
        configuration["VaultSandbox:DefaultDeliveryStrategy"] ?? "Sse");
    options.PollIntervalMs = int.Parse(
        configuration["VaultSandbox:PollIntervalMs"] ?? "2000");
    options.SseReconnectIntervalMs = int.Parse(
        configuration["VaultSandbox:SseReconnectIntervalMs"] ?? "2000");
    options.SseMaxReconnectAttempts = int.Parse(
        configuration["VaultSandbox:SseMaxReconnectAttempts"] ?? "10");
});
```

### Via Configuration Binding

```csharp
services.AddVaultSandboxClient();
services.Configure<VaultSandboxClientOptions>(
    configuration.GetSection("VaultSandbox"));
```

## Environment-Specific Configuration

### Development

Fast feedback with SSE (default):

```csharp
// appsettings.Development.json
{
    "VaultSandbox": {
        "BaseUrl": "http://localhost:3000",
        "DefaultDeliveryStrategy": "Sse"
    }
}
```

```csharp
// Configuration helper
public static IVaultSandboxClient CreateClient(IConfiguration configuration)
{
    var builder = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(configuration["VaultSandbox:BaseUrl"]!)
        .WithApiKey(configuration["VaultSandbox:ApiKey"]!);

    var strategy = configuration["VaultSandbox:DefaultDeliveryStrategy"];

    return strategy switch
    {
        "Polling" => builder.UsePollingDelivery().Build(),
        _ => builder.UseSseDelivery().Build() // SSE is default
    };
}
```

### CI/CD

Reliable polling:

```csharp
// appsettings.CI.json
{
    "VaultSandbox": {
        "BaseUrl": "https://smtp.vaultsandbox.com",
        "DefaultDeliveryStrategy": "Polling",
        "PollIntervalMs": 3000
    }
}
```

### Production Testing

SSE with tuned reconnection:

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .UseSseDelivery()
    .WithSseReconnectInterval(TimeSpan.FromSeconds(5))
    .WithSseMaxReconnectAttempts(5)
    .Build();
```

## Error Handling

### SSE Connection Failures

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var client = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
        .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
        .UseSseDelivery()
        .Build();

    var inbox = await client.CreateInboxAsync();
    // Use inbox...
}
catch (SseException ex)
{
    Console.WriteLine($"SSE failed: {ex.Message}");
    Console.WriteLine("Falling back to polling...");

    // Recreate with polling
    var fallbackClient = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
        .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
        .UsePollingDelivery()
        .Build();

    var inbox = await fallbackClient.CreateInboxAsync();
    // Continue with polling...
}
```

### Handling Watch Errors

```csharp
try
{
    await foreach (var email in inbox.WatchAsync(cancellationToken))
    {
        await ProcessEmailAsync(email);
    }
}
catch (SseException ex)
{
    Console.WriteLine($"SSE error: {ex.Message}");
    // Consider recreating client with polling if SSE is blocked
}
catch (StrategyException ex)
{
    Console.WriteLine($"Strategy error: {ex.Message}");
}
catch (OperationCanceledException)
{
    Console.WriteLine("Watch cancelled");
}
```

### Polling Too Slow

If emails arrive slowly with polling:

```csharp
// Problem: Default 2s polling is too slow
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromSeconds(2))
    .Build();

// Solution 1: Faster polling
var fasterClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromMilliseconds(500))
    .Build();

// Solution 2: Use SSE if available
var sseClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .UseSseDelivery()
    .Build();

// Solution 3: Override poll interval for specific wait
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    PollInterval = TimeSpan.FromMilliseconds(500) // Fast polling for this operation
});
```

## Best Practices

### 1. Use SSE Strategy by Default

SSE is the default and provides the best performance:

```csharp
// Good: Use SSE (default)
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .Build();

// Only specify polling when needed
var ciClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .UsePollingDelivery() // CI may need guaranteed compatibility
    .Build();
```

### 2. Tune for Environment

Configure differently for each environment:

```csharp
public static IVaultSandboxClient CreateClient(IConfiguration config)
{
    var builder = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(config["VaultSandbox:BaseUrl"]!)
        .WithApiKey(config["VaultSandbox:ApiKey"]!);

    var isCI = Environment.GetEnvironmentVariable("CI") == "true";

    if (isCI)
    {
        // CI: Use polling if SSE may be blocked
        return builder
            .UsePollingDelivery()
            .WithPollInterval(TimeSpan.FromSeconds(3))
            .Build();
    }
    else
    {
        // Default: SSE with tuned reconnection
        return builder
            .UseSseDelivery()
            .WithSseReconnectInterval(TimeSpan.FromSeconds(2))
            .WithSseMaxReconnectAttempts(10)
            .Build();
    }
}
```

### 3. Handle SSE Gracefully

Always have a fallback if forcing SSE:

```csharp
async Task<IVaultSandboxClient> CreateClientWithFallbackAsync()
{
    try
    {
        var client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(url)
            .WithApiKey(apiKey)
            .UseSseDelivery()
            .Build();

        // Test SSE connectivity
        var inbox = await client.CreateInboxAsync();
        await client.DeleteInboxAsync(inbox.EmailAddress);

        return client;
    }
    catch (SseException)
    {
        Console.WriteLine("SSE unavailable, using polling");

        return VaultSandboxClientBuilder.Create()
            .WithBaseUrl(url)
            .WithApiKey(apiKey)
            .UsePollingDelivery()
            .Build();
    }
}
```

### 4. Don't Poll Too Aggressively

Avoid very short polling intervals in production:

```csharp
// Avoid: Too aggressive
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromMilliseconds(100)) // 100ms - too frequent!
    .Build();

// Good: Reasonable interval
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromSeconds(2)) // 2s - balanced
    .Build();
```

### 5. Use CancellationToken for Long-Running Operations

Always provide cancellation support for watch operations:

```csharp
using var cts = new CancellationTokenSource();

// Cancel after timeout
cts.CancelAfter(TimeSpan.FromMinutes(5));

// Or cancel on Ctrl+C
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cts.Cancel();
};

try
{
    await foreach (var email in inbox.WatchAsync(cts.Token))
    {
        Console.WriteLine($"Received: {email.Subject}");
    }
}
catch (OperationCanceledException)
{
    Console.WriteLine("Watch operation cancelled");
}
```

## Next Steps

- [Real-time Monitoring Guide](/client-dotnet/guides/real-time/) - Using `WatchAsync` and `IAsyncEnumerable`
- [Configuration Reference](/client-dotnet/configuration/) - All configuration options
- [Error Handling](/client-dotnet/api/errors/) - Handle SSE and strategy errors
- [CI/CD Integration](/client-dotnet/testing/cicd/) - Strategy for CI environments
