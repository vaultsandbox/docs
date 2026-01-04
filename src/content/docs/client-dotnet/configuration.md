---
title: Client Configuration
description: Configure the VaultSandbox .NET client for your environment
---

This page covers all configuration options for the VaultSandbox .NET client.

## Basic Configuration

### Using the Builder Pattern

```csharp
using VaultSandbox.Client;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://mail.example.com")
    .WithApiKey("your-api-key")
    .Build();
```

## Configuration Options

| Property                | Type             | Required | Default | Description                    |
| ----------------------- | ---------------- | -------- | ------- | ------------------------------ |
| BaseUrl                 | string           | Yes      | -       | Gateway server URL             |
| ApiKey                  | string           | Yes      | -       | API key for authentication     |
| HttpTimeoutMs           | int              | No       | 30000   | HTTP request timeout (ms)      |
| WaitTimeoutMs           | int              | No       | 30000   | Default wait timeout (ms)      |
| PollIntervalMs          | int              | No       | 2000    | Polling interval (ms)          |
| MaxRetries              | int              | No       | 3       | Maximum retry attempts         |
| RetryDelayMs            | int              | No       | 1000    | Initial retry delay (ms)       |
| SseReconnectIntervalMs  | int              | No       | 5000    | SSE reconnect interval (ms)    |
| SseMaxReconnectAttempts | int              | No       | 10      | Maximum SSE reconnect attempts |
| DefaultDeliveryStrategy | DeliveryStrategy | No       | Auto    | Delivery strategy              |
| DefaultInboxTtlSeconds  | int              | No       | 3600    | Default inbox TTL (seconds)    |

### Required Options

#### BaseUrl

**Type**: `string`

**Description**: Base URL of your VaultSandbox Gateway

**Examples**:

```csharp
.WithBaseUrl("https://mail.example.com")
.WithBaseUrl("http://localhost:3000") // Local development
```

**Requirements**:

- Must include protocol (`https://` or `http://`)
- Should not include trailing slash
- Must be accessible from your application

#### ApiKey

**Type**: `string`

**Description**: API key for authentication

**Example**:

```csharp
.WithApiKey("vs_1234567890abcdef...")
```

**Best practices**:

- Store in environment variables or secure configuration
- Never commit to version control
- Rotate periodically

### Optional Options

#### HttpTimeout

**Builder Method**: `WithHttpTimeout(TimeSpan)`

**Default**: 30 seconds

**Description**: Timeout for individual HTTP requests

```csharp
.WithHttpTimeout(TimeSpan.FromSeconds(60))
```

#### WaitTimeout

**Builder Method**: `WithWaitTimeout(TimeSpan)`

**Default**: 30 seconds

**Description**: Default timeout for `WaitForEmailAsync` operations

```csharp
.WithWaitTimeout(TimeSpan.FromMinutes(2))
```

#### PollInterval

**Builder Method**: `WithPollInterval(TimeSpan)`

**Default**: 2 seconds

**Description**: Polling interval when using polling strategy

```csharp
.WithPollInterval(TimeSpan.FromSeconds(1))
```

**Considerations**:

- Lower = more responsive, more API calls
- Higher = fewer API calls, slower detection
- Subject to rate limiting

#### MaxRetries

**Builder Method**: `WithMaxRetries(int)`

**Default**: 3

**Description**: Maximum retry attempts for failed HTTP requests

```csharp
.WithMaxRetries(5)
```

#### RetryDelay

**Builder Method**: `WithRetryDelay(TimeSpan)`

**Default**: 1 second

**Description**: Base delay between retry attempts (uses exponential backoff)

```csharp
.WithRetryDelay(TimeSpan.FromMilliseconds(500))
```

#### SseReconnectInterval

**Builder Method**: `WithSseReconnectInterval(TimeSpan)`

**Default**: 5 seconds

**Description**: Initial delay before SSE reconnection attempt

```csharp
.WithSseReconnectInterval(TimeSpan.FromSeconds(2))
```

#### SseMaxReconnectAttempts

**Builder Method**: `WithSseMaxReconnectAttempts(int)`

**Default**: 10

**Description**: Maximum SSE reconnection attempts before giving up

```csharp
.WithSseMaxReconnectAttempts(20)
```

#### DeliveryStrategy

**Builder Methods**: `UseAutoDelivery()`, `UseSseDelivery()`, `UsePollingDelivery()`

**Default**: Auto

**Description**: Email delivery strategy

```csharp
.UseAutoDelivery()      // Recommended - tries SSE, falls back to polling
.UseSseDelivery()       // Force SSE only
.UsePollingDelivery()   // Force polling only
```

#### DefaultInboxTtl

**Builder Method**: `WithDefaultInboxTtl(TimeSpan)`

**Default**: 1 hour

**Description**: Default time-to-live for created inboxes

```csharp
.WithDefaultInboxTtl(TimeSpan.FromMinutes(30))
```

## Builder Pattern Examples

### Full Configuration

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://gateway.example.com")
    .WithApiKey("api-key")
    .WithHttpTimeout(TimeSpan.FromSeconds(60))
    .WithWaitTimeout(TimeSpan.FromMinutes(2))
    .WithPollInterval(TimeSpan.FromSeconds(1))
    .WithMaxRetries(5)
    .WithRetryDelay(TimeSpan.FromSeconds(2))
    .WithSseReconnectInterval(TimeSpan.FromSeconds(3))
    .WithSseMaxReconnectAttempts(15)
    .UseAutoDelivery()
    .WithDefaultInboxTtl(TimeSpan.FromMinutes(30))
    .Build();
```

### With Logging

```csharp
var loggerFactory = LoggerFactory.Create(builder =>
{
    builder.AddConsole().SetMinimumLevel(LogLevel.Debug);
});

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://gateway.example.com")
    .WithApiKey("api-key")
    .WithLogging(loggerFactory)
    .Build();
```

### With Custom HttpClient

```csharp
var httpClient = new HttpClient
{
    BaseAddress = new Uri("https://gateway.example.com"),
    Timeout = TimeSpan.FromSeconds(60)
};

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://gateway.example.com")
    .WithApiKey("api-key")
    .WithHttpClient(httpClient, disposeClient: true)
    .Build();
```

## Dependency Injection Configuration

### Via IConfiguration Section

```csharp
// Program.cs
builder.Services.AddVaultSandboxClient(builder.Configuration);
```

```json
// appsettings.json
{
	"VaultSandbox": {
		"BaseUrl": "https://gateway.example.com",
		"ApiKey": "your-api-key",
		"HttpTimeoutMs": 60000,
		"WaitTimeoutMs": 120000,
		"PollIntervalMs": 1000,
		"MaxRetries": 5,
		"DefaultDeliveryStrategy": "Auto",
		"DefaultInboxTtlSeconds": 1800
	}
}
```

### Via Custom Configuration Section

```csharp
builder.Services.AddVaultSandboxClient(
    builder.Configuration.GetSection("MyCustomSection"));
```

### Via Configuration Action

```csharp
builder.Services.AddVaultSandboxClient(options =>
{
    options.BaseUrl = Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!;
    options.ApiKey = Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!;
    options.MaxRetries = 5;
    options.DefaultDeliveryStrategy = DeliveryStrategy.Auto;
});
```

### Via Builder Delegate

```csharp
builder.Services.AddVaultSandboxClient((clientBuilder, sp) =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var loggerFactory = sp.GetRequiredService<ILoggerFactory>();

    clientBuilder
        .WithBaseUrl(config["VaultSandbox:BaseUrl"]!)
        .WithApiKey(config["VaultSandbox:ApiKey"]!)
        .WithLogging(loggerFactory)
        .WithMaxRetries(5)
        .UseAutoDelivery();
});
```

## Environment Variables

Store configuration in environment variables:

```bash
export VAULTSANDBOX_URL=https://mail.example.com
export VAULTSANDBOX_API_KEY=vs_1234567890abcdef...
```

### Usage

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .Build();
```

## Configuration Examples

### Production Configuration

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .WithMaxRetries(5)
    .WithRetryDelay(TimeSpan.FromSeconds(2))
    .WithSseReconnectInterval(TimeSpan.FromSeconds(5))
    .WithSseMaxReconnectAttempts(10)
    .UseAutoDelivery()
    .Build();
```

### CI/CD Configuration

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .WithPollInterval(TimeSpan.FromSeconds(1))
    .WithMaxRetries(3)
    .WithRetryDelay(TimeSpan.FromMilliseconds(500))
    .UseAutoDelivery()
    .Build();
```

### Development Configuration

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("http://localhost:3000")
    .WithApiKey("dev-api-key")
    .WithPollInterval(TimeSpan.FromMilliseconds(500))
    .WithMaxRetries(1)
    .UsePollingDelivery()
    .Build();
```

### High-Reliability Configuration

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .WithMaxRetries(10)
    .WithRetryDelay(TimeSpan.FromSeconds(2))
    .WithSseReconnectInterval(TimeSpan.FromSeconds(1))
    .WithSseMaxReconnectAttempts(int.MaxValue)
    .UseAutoDelivery()
    .Build();
```

## Strategy Selection Guide

### Auto (Recommended)

**Use when**: You want optimal performance with automatic fallback

**Behavior**:

1. Tries SSE first
2. Falls back to polling if SSE fails
3. Automatically reconnects on errors

**Pros**:

- Best of both worlds
- No manual configuration needed
- Resilient to network issues

**Cons**:

- Slightly more complex internally

### SSE (Server-Sent Events)

**Use when**: You need real-time, low-latency delivery

**Behavior**:

- Persistent connection to server
- Push-based email notification
- Instant delivery

**Pros**:

- Real-time delivery (no polling delay)
- Efficient (no repeated HTTP requests)
- Deterministic tests

**Cons**:

- Requires persistent connection
- May be blocked by some proxies/firewalls
- More complex error handling

### Polling

**Use when**: SSE is blocked or unreliable

**Behavior**:

- Periodic HTTP requests for new emails
- Pull-based email retrieval
- Configurable interval

**Pros**:

- Works in all network environments
- No persistent connection required
- Simple and predictable

**Cons**:

- Delay based on polling interval
- More HTTP requests
- Less efficient than SSE

## Resource Management

### IAsyncDisposable Pattern

The client implements `IAsyncDisposable`. Always dispose properly:

```csharp
await using var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://gateway.example.com")
    .WithApiKey("api-key")
    .Build();

// Use client...
// Automatically disposed at end of scope
```

Or explicitly:

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://gateway.example.com")
    .WithApiKey("api-key")
    .Build();

try
{
    // Use client...
}
finally
{
    await client.DisposeAsync();
}
```

## Best Practices

### Security

**DO**:

```csharp
// Use environment variables or secure configuration
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .Build();
```

**DON'T**:

```csharp
// Never hard-code credentials
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://mail.example.com")
    .WithApiKey("vs_1234567890...")  // Never do this
    .Build();
```

### Resource Management

**DO**:

```csharp
await using var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .Build();

await RunTestsAsync(client);
// Automatically disposed
```

**DON'T**:

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .Build();

await RunTestsAsync(client);
// Forgot to dispose - resources leak
```

### Error Handling

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var inbox = await client.CreateInboxAsync();
}
catch (ApiException ex)
{
    Console.WriteLine($"API error: {ex.StatusCode} - {ex.Message}");
}
catch (NetworkException ex)
{
    Console.WriteLine($"Network error: {ex.Message}");
}
catch (VaultSandboxTimeoutException ex)
{
    Console.WriteLine($"Timeout after {ex.Timeout.TotalSeconds}s");
}
catch (VaultSandboxException ex)
{
    Console.WriteLine($"VaultSandbox error: {ex.Message}");
}
```

## Next Steps

- **[Core Concepts: Inboxes](/client-dotnet/concepts/inboxes/)** - Learn about inboxes
- **[Managing Inboxes](/client-dotnet/guides/managing-inboxes/)** - Common inbox operations
- **[Testing Patterns](/client-dotnet/testing/password-reset/)** - Integrate with your tests
- **[API Reference: Client](/client-dotnet/api/client/)** - Full API documentation
