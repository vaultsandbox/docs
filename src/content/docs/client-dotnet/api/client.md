---
title: IVaultSandboxClient API
description: Complete API reference for the IVaultSandboxClient interface
---

The `IVaultSandboxClient` is the main entry point for interacting with the VaultSandbox Gateway. It handles authentication, inbox creation, and provides utility methods for managing inboxes.

## Creating a Client

### Builder Pattern

Use `VaultSandboxClientBuilder` to create a client instance with fluent configuration:

```csharp
using VaultSandbox.Client;

// Basic configuration
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey("your-api-key")
    .Build();

// With validation (recommended for production)
var client = await VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey("your-api-key")
    .BuildAndValidateAsync();
```

### Dependency Injection (ASP.NET Core)

Register the client in your service collection:

```csharp
// In Program.cs or Startup.cs
services.AddVaultSandboxClient(options =>
{
    options.BaseUrl = "https://smtp.vaultsandbox.com";
    options.ApiKey = Configuration["VaultSandbox:ApiKey"];
});

// Or bind from configuration
services.AddVaultSandboxClient(Configuration.GetSection("VaultSandbox"));
```

Configuration in `appsettings.json`:

```json
{
	"VaultSandbox": {
		"BaseUrl": "https://smtp.vaultsandbox.com",
		"ApiKey": "your-api-key",
		"WaitTimeoutMs": 30000,
		"PollIntervalMs": 2000
	}
}
```

Inject the client in your services:

```csharp
public class EmailTestService
{
    private readonly IVaultSandboxClient _client;

    public EmailTestService(IVaultSandboxClient client)
    {
        _client = client;
    }
}
```

## VaultSandboxClientBuilder

The builder provides fluent configuration methods for creating a client.

### Methods

| Method                                     | Description                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `Create()`                                 | Static factory method to start building                                |
| `WithBaseUrl(string)`                      | Set the gateway URL                                                    |
| `WithApiKey(string)`                       | Set the API authentication key                                         |
| `WithHttpTimeout(TimeSpan)`                | HTTP request timeout (default: 30s)                                    |
| `WithWaitTimeout(TimeSpan)`                | Default wait timeout for email operations (default: 30s)               |
| `WithPollInterval(TimeSpan)`               | Polling interval for email delivery (default: 2s)                      |
| `WithMaxRetries(int)`                      | Maximum retry attempts for HTTP requests (default: 3)                  |
| `WithRetryDelay(TimeSpan)`                 | Initial delay between retries (default: 1s)                            |
| `WithSseReconnectInterval(TimeSpan)`       | SSE reconnection delay (default: 2s)                                   |
| `WithSseMaxReconnectAttempts(int)`         | Maximum SSE reconnection attempts (default: 10)                        |
| `WithDeliveryStrategy(DeliveryStrategy)`   | Set the delivery strategy directly                                     |
| `UseSseDelivery()`                         | Use Server-Sent Events for email delivery (default)                    |
| `UsePollingDelivery()`                     | Use polling for email delivery                                         |
| `WithDefaultInboxTtl(TimeSpan)`            | Default time-to-live for new inboxes                                   |
| `WithLogging(ILoggerFactory)`              | Add logging support                                                    |
| `WithHttpClient(HttpClient, bool)`         | Use a custom HttpClient instance (optional: dispose client on cleanup) |
| `Build()`                                  | Build the client instance                                              |
| `BuildAndValidateAsync(CancellationToken)` | Build and validate the API key                                         |

### Example

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY"))
    .WithWaitTimeout(TimeSpan.FromSeconds(60))
    .WithPollInterval(TimeSpan.FromSeconds(1))
    .WithMaxRetries(5)
    .WithRetryDelay(TimeSpan.FromSeconds(2))
    .UseSseDelivery()
    .WithLogging(loggerFactory)
    .Build();
```

### Custom HttpClient

```csharp
// Use custom HttpClient, let the builder manage disposal
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey("your-api-key")
    .WithHttpClient(myHttpClient, disposeClient: true)
    .Build();

// Use custom HttpClient, manage disposal yourself
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey("your-api-key")
    .WithHttpClient(sharedHttpClient, disposeClient: false)
    .Build();
```

## VaultSandboxClientOptions

Configuration options class for the client.

```csharp
public sealed class VaultSandboxClientOptions
{
    public required string BaseUrl { get; set; }
    public required string ApiKey { get; set; }
    public int HttpTimeoutMs { get; set; } = 30_000;
    public int WaitTimeoutMs { get; set; } = 30_000;
    public int PollIntervalMs { get; set; } = 2_000;
    public int MaxRetries { get; set; } = 3;
    public int RetryDelayMs { get; set; } = 1_000;
    public int SseReconnectIntervalMs { get; set; } = 2_000;
    public int SseMaxReconnectAttempts { get; set; } = 10;
    public DeliveryStrategy DefaultDeliveryStrategy { get; set; } = DeliveryStrategy.Sse;
    public int DefaultInboxTtlSeconds { get; set; } = 3600;

    public void Validate();
}
```

## Methods

### CreateInboxAsync

Creates a new email inbox with automatic key generation and encryption setup.

```csharp
Task<IInbox> CreateInboxAsync(
    CreateInboxOptions? options = null,
    CancellationToken cancellationToken = default)
```

#### Parameters

- `options` (optional): Configuration for the inbox
- `cancellationToken`: Cancellation token for the operation

```csharp
public sealed class CreateInboxOptions
{
    public string? EmailAddress { get; set; }
    public TimeSpan? Ttl { get; set; }
}
```

| Property       | Type        | Description                                        |
| -------------- | ----------- | -------------------------------------------------- |
| `Ttl`          | `TimeSpan?` | Time-to-live for the inbox (min: 60s, max: 7 days) |
| `EmailAddress` | `string?`   | Request a specific email address (max 254 chars)   |

#### Returns

`Task<IInbox>` - The created inbox instance

#### Example

```csharp
// Create inbox with default settings
var inbox = await client.CreateInboxAsync();
Console.WriteLine($"Send email to: {inbox.EmailAddress}");

// Create inbox with custom TTL (1 hour)
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromHours(1)
});

// Request specific email address
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    EmailAddress = "mytest@inbox.vaultsandbox.com"
});
```

#### Errors

- `ApiException` - API-level error (invalid request, permission denied)
- `NetworkException` - Network connection failure
- `InboxAlreadyExistsException` - Requested email address is already in use

---

### DeleteInboxAsync

Deletes a specific inbox by email address.

```csharp
Task DeleteInboxAsync(string emailAddress, CancellationToken cancellationToken = default)
```

#### Parameters

- `emailAddress`: The email address of the inbox to delete
- `cancellationToken`: Cancellation token for the operation

#### Example

```csharp
await client.DeleteInboxAsync("test@inbox.vaultsandbox.com");
Console.WriteLine("Inbox deleted");
```

---

### DeleteAllInboxesAsync

Deletes all inboxes associated with the current API key. Useful for cleanup in test environments.

```csharp
Task<int> DeleteAllInboxesAsync(CancellationToken cancellationToken = default)
```

#### Returns

`Task<int>` - Number of inboxes deleted

#### Example

```csharp
var deleted = await client.DeleteAllInboxesAsync();
Console.WriteLine($"Deleted {deleted} inboxes");
```

#### Best Practice

Use this in test cleanup to avoid orphaned inboxes:

```csharp
[TearDown]
public async Task Cleanup()
{
    var deleted = await _client.DeleteAllInboxesAsync();
    if (deleted > 0)
    {
        Console.WriteLine($"Cleaned up {deleted} orphaned inboxes");
    }
}
```

---

### GetServerInfoAsync

Retrieves information about the VaultSandbox Gateway server.

```csharp
Task<ServerInfo> GetServerInfoAsync(CancellationToken cancellationToken = default)
```

#### Returns

`Task<ServerInfo>` - Server information record

```csharp
public sealed record ServerInfo
{
    public required string ServerSigPk { get; init; }
    public required string Context { get; init; }
    public required int MaxTtl { get; init; }
    public required int DefaultTtl { get; init; }
    public required bool SseConsole { get; init; }
    public required IReadOnlyList<string> AllowedDomains { get; init; }
}
```

| Property         | Type                    | Description                                               |
| ---------------- | ----------------------- | --------------------------------------------------------- |
| `ServerSigPk`    | `string`                | Base64URL-encoded server signing public key for ML-DSA-65 |
| `Context`        | `string`                | Context string for the encryption scheme                  |
| `MaxTtl`         | `int`                   | Maximum time-to-live for inboxes in seconds               |
| `DefaultTtl`     | `int`                   | Default time-to-live for inboxes in seconds               |
| `SseConsole`     | `bool`                  | Whether the server SSE console is enabled                 |
| `AllowedDomains` | `IReadOnlyList<string>` | List of domains allowed for inbox creation                |

#### Example

```csharp
var info = await client.GetServerInfoAsync();
Console.WriteLine($"Server: {info.Context}");
Console.WriteLine($"Max TTL: {info.MaxTtl}s, Default TTL: {info.DefaultTtl}s");
Console.WriteLine($"Allowed domains: {string.Join(", ", info.AllowedDomains)}");
```

---

### ValidateApiKeyAsync

Validates the API key with the server.

```csharp
Task<bool> ValidateApiKeyAsync(CancellationToken cancellationToken = default)
```

#### Returns

`Task<bool>` - `true` if the API key is valid

#### Example

```csharp
var isValid = await client.ValidateApiKeyAsync();
if (!isValid)
{
    throw new InvalidOperationException("Invalid API key");
}
```

#### Usage

Useful for verifying configuration before running tests:

```csharp
[OneTimeSetUp]
public async Task Setup()
{
    _client = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"))
        .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY"))
        .Build();

    var isValid = await _client.ValidateApiKeyAsync();
    if (!isValid)
    {
        throw new InvalidOperationException("VaultSandbox API key is invalid");
    }
}
```

---

### MonitorInboxes

Monitors multiple inboxes simultaneously for new emails.

```csharp
InboxMonitor MonitorInboxes(params IInbox[] inboxes)
```

#### Parameters

- `inboxes`: Array of inbox instances to monitor

#### Returns

`InboxMonitor` - Monitor for multi-inbox watching

#### Example

```csharp
var inbox1 = await client.CreateInboxAsync();
var inbox2 = await client.CreateInboxAsync();

var monitor = client.MonitorInboxes(inbox1, inbox2);

await foreach (var evt in monitor.WatchAsync(cancellationToken))
{
    Console.WriteLine($"New email in {evt.InboxAddress}: {evt.Email.Subject}");
}
```

See [InboxMonitor](#inboxmonitor) for more details.

---

### ImportInboxAsync

Imports a previously exported inbox, restoring all data and encryption keys.

```csharp
Task<IInbox> ImportInboxAsync(
    InboxExport export,
    CancellationToken cancellationToken = default)
```

#### Parameters

- `export`: Previously exported inbox data
- `cancellationToken`: Cancellation token for the operation

#### Returns

`Task<IInbox>` - The imported inbox instance

#### Example

```csharp
var exportedData = JsonSerializer.Deserialize<InboxExport>(savedJson);
var inbox = await client.ImportInboxAsync(exportedData);

Console.WriteLine($"Imported inbox: {inbox.EmailAddress}");

// Use inbox normally
var emails = await inbox.GetEmailsAsync();
```

#### Errors

- `InboxAlreadyExistsException` - Inbox is already imported in this client
- `InvalidImportDataException` - Import data is invalid or corrupted
- `ApiException` - Server rejected the import (inbox may not exist)

---

### ImportInboxFromFileAsync

Imports an inbox from a JSON file.

```csharp
Task<IInbox> ImportInboxFromFileAsync(
    string filePath,
    CancellationToken cancellationToken = default)
```

#### Parameters

- `filePath`: Path to the exported inbox JSON file
- `cancellationToken`: Cancellation token for the operation

#### Returns

`Task<IInbox>` - The imported inbox instance

#### Example

```csharp
// Import from file
var inbox = await client.ImportInboxFromFileAsync("./backup/inbox.json");

Console.WriteLine($"Imported inbox: {inbox.EmailAddress}");

// Monitor for new emails
await foreach (var email in inbox.WatchAsync(cancellationToken))
{
    Console.WriteLine($"New email: {email.Subject}");
}
```

#### Use Cases

- Test reproducibility across runs
- Sharing inboxes between environments
- Manual testing workflows
- Debugging production issues

---

### ExportInboxToFileAsync

Exports an inbox to a JSON file on disk.

```csharp
Task ExportInboxToFileAsync(
    IInbox inbox,
    string filePath,
    CancellationToken cancellationToken = default)
```

#### Parameters

- `inbox`: Inbox instance to export
- `filePath`: Path where the JSON file will be written
- `cancellationToken`: Cancellation token for the operation

#### Example

```csharp
var inbox = await client.CreateInboxAsync();

// Export to file
await client.ExportInboxToFileAsync(inbox, "./backup/inbox.json");

Console.WriteLine("Inbox exported to ./backup/inbox.json");
```

#### Security Warning

Exported data contains private encryption keys. Store securely and never commit to version control.

## InboxMonitor

The `InboxMonitor` class allows you to monitor multiple inboxes simultaneously using `IAsyncEnumerable`.

### Creating a Monitor

```csharp
var inbox1 = await client.CreateInboxAsync();
var inbox2 = await client.CreateInboxAsync();

var monitor = client.MonitorInboxes(inbox1, inbox2);
```

### WatchAsync

Streams email arrival events from all monitored inboxes.

```csharp
IAsyncEnumerable<InboxEmailEvent> WatchAsync(CancellationToken cancellationToken = default)
```

#### Returns

`IAsyncEnumerable<InboxEmailEvent>` - Stream of email events

```csharp
public sealed record InboxEmailEvent(IInbox Inbox, Email Email)
{
    public IInbox Inbox { get; } = Inbox;
    public Email Email { get; } = Email;
    public string InboxAddress => Inbox.EmailAddress;
}
```

#### Example

```csharp
var monitor = client.MonitorInboxes(inbox1, inbox2);

await foreach (var evt in monitor.WatchAsync(cancellationToken))
{
    Console.WriteLine($"Email received in {evt.InboxAddress}");
    Console.WriteLine($"Subject: {evt.Email.Subject}");
}
```

### DisposeAsync

Stops monitoring and cleans up resources.

```csharp
await monitor.DisposeAsync();
```

### Complete Example

```csharp
using VaultSandbox.Client;

async Task MonitorMultipleInboxes(CancellationToken cancellationToken)
{
    var client = VaultSandboxClientBuilder.Create()
        .WithBaseUrl("https://smtp.vaultsandbox.com")
        .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY"))
        .Build();

    // Create multiple inboxes
    var inbox1 = await client.CreateInboxAsync();
    var inbox2 = await client.CreateInboxAsync();

    Console.WriteLine($"Inbox 1: {inbox1.EmailAddress}");
    Console.WriteLine($"Inbox 2: {inbox2.EmailAddress}");

    // Monitor both inboxes
    await using var monitor = client.MonitorInboxes(inbox1, inbox2);

    await foreach (var evt in monitor.WatchAsync(cancellationToken))
    {
        Console.WriteLine($"\nNew email in {evt.InboxAddress}:");
        Console.WriteLine($"  Subject: {evt.Email.Subject}");
        Console.WriteLine($"  From: {evt.Email.From}");
    }

    // Clean up
    await client.DeleteInboxAsync(inbox1.EmailAddress);
    await client.DeleteInboxAsync(inbox2.EmailAddress);
}
```

## Complete Example

Here's a complete example showing typical client usage:

```csharp
using VaultSandbox.Client;

async Task Main(CancellationToken cancellationToken)
{
    // Create client
    var client = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"))
        .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY"))
        .UseSseDelivery()
        .WithMaxRetries(5)
        .Build();

    try
    {
        // Verify API key
        var isValid = await client.ValidateApiKeyAsync(cancellationToken);
        if (!isValid)
        {
            throw new InvalidOperationException("Invalid API key");
        }

        // Get server info
        var info = await client.GetServerInfoAsync(cancellationToken);
        Console.WriteLine($"Connected to VaultSandbox (default TTL: {info.DefaultTtl}s)");

        // Create inbox
        var inbox = await client.CreateInboxAsync(cancellationToken: cancellationToken);
        Console.WriteLine($"Created inbox: {inbox.EmailAddress}");

        // Export for later use
        await client.ExportInboxToFileAsync(inbox, "./inbox-backup.json", cancellationToken);

        // Wait for email
        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(30),
            Subject = "Test"
        }, cancellationToken);

        Console.WriteLine($"Received: {email.Subject}");

        // Clean up
        await client.DeleteInboxAsync(inbox.EmailAddress, cancellationToken);

        // Delete any other orphaned inboxes
        var deleted = await client.DeleteAllInboxesAsync(cancellationToken);
        Console.WriteLine($"Cleaned up {deleted} total inboxes");
    }
    finally
    {
        // Dispose the client
        if (client is IAsyncDisposable asyncDisposable)
        {
            await asyncDisposable.DisposeAsync();
        }
    }
}
```

## Next Steps

- [IInbox API Reference](/client-dotnet/api/inbox/) - Learn about inbox methods
- [Email API Reference](/client-dotnet/api/email/) - Work with email records
- [Error Handling](/client-dotnet/api/errors/) - Handle exceptions gracefully
- [Import/Export Guide](/client-dotnet/advanced/import-export/) - Advanced import/export usage
