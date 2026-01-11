---
title: Real-time Monitoring
description: Subscribe to emails as they arrive using IAsyncEnumerable
---

VaultSandbox supports real-time email notifications via Server-Sent Events (SSE), enabling instant processing of emails as they arrive. The .NET client exposes this through `IAsyncEnumerable<Email>` for natural async enumeration.

## Basic Streaming

### Subscribe to Single Inbox

```csharp
var inbox = await client.CreateInboxAsync();

Console.WriteLine($"Monitoring: {inbox.EmailAddress}");

await foreach (var email in inbox.WatchAsync(cancellationToken))
{
    Console.WriteLine($"New email: {email.Subject}");
    Console.WriteLine($"   From: {email.From}");
    Console.WriteLine($"   Received: {email.ReceivedAt}");
}
```

### With Timeout

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));

try
{
    await foreach (var email in inbox.WatchAsync(cts.Token))
    {
        Console.WriteLine($"Received: {email.Subject}");
        await ProcessEmailAsync(email);
    }
}
catch (OperationCanceledException)
{
    Console.WriteLine("Monitoring stopped after timeout");
}
```

## Processing Patterns

### Conditional Processing

```csharp
await foreach (var email in inbox.WatchAsync(cancellationToken))
{
    if (email.Subject.Contains("urgent", StringComparison.OrdinalIgnoreCase))
    {
        await HandleUrgentEmailAsync(email);
    }
    else
    {
        await HandleNormalEmailAsync(email);
    }
}
```

### Break on Condition

```csharp
await foreach (var email in inbox.WatchAsync(cancellationToken))
{
    if (email.Subject.Contains("Verification"))
    {
        await ProcessVerificationEmailAsync(email);
        break;  // Stop monitoring after finding the email
    }
}
```

### Filter with LINQ

```csharp
// Process only emails from specific sender
await foreach (var email in inbox.WatchAsync(cancellationToken)
    .Where(e => e.From == "alerts@example.com"))
{
    await HandleAlertAsync(email);
}

// Take first 5 emails
await foreach (var email in inbox.WatchAsync(cancellationToken).Take(5))
{
    Console.WriteLine($"Email {email.Subject}");
}
```

## Monitoring Multiple Inboxes

### Using InboxMonitor

```csharp
var inbox1 = await client.CreateInboxAsync();
var inbox2 = await client.CreateInboxAsync();
var inbox3 = await client.CreateInboxAsync();

var monitor = client.MonitorInboxes(inbox1, inbox2, inbox3);

await foreach (var evt in monitor.WatchAsync(cancellationToken))
{
    Console.WriteLine($"Email in {evt.InboxAddress}");
    Console.WriteLine($"   Subject: {evt.Email.Subject}");
    Console.WriteLine($"   From: {evt.Email.From}");
}
```

### Monitoring with Handlers

```csharp
var monitor = client.MonitorInboxes(inbox1, inbox2);

await foreach (var evt in monitor.WatchAsync(cancellationToken))
{
    if (evt.Email.From == "alerts@example.com")
    {
        await HandleAlertAsync(evt.Email);
    }
    else if (evt.Email.Subject.Contains("Invoice"))
    {
        await HandleInvoiceAsync(evt.Inbox, evt.Email);
    }
    else
    {
        Console.WriteLine($"Other email: {evt.Email.Subject}");
    }
}
```

## Real-World Patterns

### Wait for Specific Email

```csharp
async Task<Email> WaitForSpecificEmailAsync(
    IInbox inbox,
    Func<Email, bool> predicate,
    TimeSpan timeout,
    CancellationToken cancellationToken = default)
{
    using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    cts.CancelAfter(timeout);

    try
    {
        await foreach (var email in inbox.WatchAsync(cts.Token))
        {
            if (predicate(email))
            {
                return email;
            }
        }

        throw new VaultSandboxTimeoutException("Stream ended without matching email", timeout);
    }
    catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
    {
        throw new VaultSandboxTimeoutException("Timeout waiting for email", timeout);
    }
}

// Usage
var email = await WaitForSpecificEmailAsync(
    inbox,
    e => e.Subject.Contains("Password Reset"),
    TimeSpan.FromSeconds(10));
```

### Collect Multiple Emails

```csharp
async Task<List<Email>> CollectEmailsAsync(
    IInbox inbox,
    int count,
    TimeSpan timeout,
    CancellationToken cancellationToken = default)
{
    var emails = new List<Email>();
    using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
    cts.CancelAfter(timeout);

    try
    {
        await foreach (var email in inbox.WatchAsync(cts.Token))
        {
            emails.Add(email);
            Console.WriteLine($"Received {emails.Count}/{count}");

            if (emails.Count >= count)
            {
                return emails;
            }
        }

        throw new VaultSandboxTimeoutException(
            $"Stream ended: only received {emails.Count}/{count}", timeout);
    }
    catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
    {
        throw new VaultSandboxTimeoutException(
            $"Timeout: only received {emails.Count}/{count}", timeout);
    }
}

// Usage
var emails = await CollectEmailsAsync(inbox, 3, TimeSpan.FromSeconds(20));
```

### Process Email Pipeline

```csharp
async Task ProcessEmailPipelineAsync(
    IInbox inbox,
    CancellationToken cancellationToken)
{
    await foreach (var email in inbox.WatchAsync(cancellationToken))
    {
        try
        {
            Console.WriteLine($"Processing: {email.Subject}");

            // Step 1: Validate
            var validation = email.AuthResults?.Validate();
            if (validation?.Passed != true)
            {
                Console.WriteLine($"Failed auth: {string.Join(", ", validation?.Failures ?? [])}");
                continue;
            }

            // Step 2: Extract data
            var links = email.Links;
            var attachments = email.Attachments;

            // Step 3: Store/process
            await StoreEmailAsync(email);

            // Step 4: Notify
            await NotifyProcessedAsync(email.Id);

            Console.WriteLine($"Processed: {email.Subject}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error processing: {ex.Message}");
        }
    }
}
```

## Integration with Channels

```csharp
using System.Threading.Channels;

var channel = Channel.CreateUnbounded<Email>();

// Producer task
var producerTask = Task.Run(async () =>
{
    try
    {
        await foreach (var email in inbox.WatchAsync(cancellationToken))
        {
            await channel.Writer.WriteAsync(email, cancellationToken);
        }
    }
    finally
    {
        channel.Writer.Complete();
    }
});

// Consumer
await foreach (var email in channel.Reader.ReadAllAsync(cancellationToken))
{
    await ProcessAsync(email);
}

await producerTask;
```

## Testing with Real-Time Monitoring

### Integration Test

```csharp
[Fact]
public async Task Real_Time_Email_Processing()
{
    var inbox = await _client.CreateInboxAsync();
    var received = new List<Email>();

    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

    // Start monitoring in background
    var monitorTask = Task.Run(async () =>
    {
        try
        {
            await foreach (var email in inbox.WatchAsync(cts.Token))
            {
                received.Add(email);
                if (received.Count >= 2) break;
            }
        }
        catch (OperationCanceledException) { }
    });

    // Send test emails
    await SendEmailAsync(inbox.EmailAddress, "Test 1");
    await SendEmailAsync(inbox.EmailAddress, "Test 2");

    // Wait for monitor to complete
    await monitorTask;

    Assert.Equal(2, received.Count);
    Assert.Equal("Test 1", received[0].Subject);
    Assert.Equal("Test 2", received[1].Subject);

    await _client.DeleteInboxAsync(inbox.EmailAddress);
}
```

### Async Processing Test

```csharp
[Fact]
public async Task Processes_Emails_Asynchronously()
{
    var inbox = await _client.CreateInboxAsync();
    var processed = new List<string>();

    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

    var monitorTask = Task.Run(async () =>
    {
        await foreach (var email in inbox.WatchAsync(cts.Token))
        {
            await ProcessEmailAsync(email);
            processed.Add(email.Id);
            break;
        }
    });

    await SendEmailAsync(inbox.EmailAddress, "Test");

    await monitorTask;

    Assert.Single(processed);

    await _client.DeleteInboxAsync(inbox.EmailAddress);
}
```

## Error Handling

### Handle Stream Errors

```csharp
try
{
    await foreach (var email in inbox.WatchAsync(cancellationToken))
    {
        try
        {
            await ProcessEmailAsync(email);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error processing email: {ex.Message}");
            // Continue processing other emails
        }
    }
}
catch (VaultSandboxException ex)
{
    Console.WriteLine($"Stream error: {ex.Message}");
}
```

### Graceful Shutdown

```csharp
class EmailProcessor : IAsyncDisposable
{
    private readonly CancellationTokenSource _cts = new();
    private Task? _processingTask;

    public void Start(IInbox inbox)
    {
        _processingTask = ProcessAsync(inbox, _cts.Token);
    }

    private async Task ProcessAsync(IInbox inbox, CancellationToken cancellationToken)
    {
        try
        {
            await foreach (var email in inbox.WatchAsync(cancellationToken))
            {
                await HandleEmailAsync(email);
            }
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine("Processing cancelled");
        }
    }

    public async ValueTask DisposeAsync()
    {
        _cts.Cancel();
        if (_processingTask != null)
        {
            try
            {
                await _processingTask;
            }
            catch (OperationCanceledException) { }
        }
        _cts.Dispose();
    }
}

// Usage
await using var processor = new EmailProcessor();
processor.Start(inbox);

// ... do other work ...

// Processor is gracefully stopped on dispose
```

## SSE vs Polling

### When to Use SSE (Default)

SSE is the default strategy and recommended for most cases:

- You need instant notification of new emails
- Processing emails as they arrive
- Building real-time dashboards
- Minimizing latency is critical

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .UseSseDelivery()  // Default, can be omitted
    .Build();
```

### When to Use Polling

Use polling when:

- SSE is blocked by firewall/proxy
- Running in environments that don't support persistent connections
- Batch processing is acceptable

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .UsePollingDelivery()
    .WithPollInterval(TimeSpan.FromSeconds(2))
    .Build();
```

## Advanced Patterns

### Rate-Limited Processing

```csharp
await foreach (var email in inbox.WatchAsync(cancellationToken))
{
    await ProcessEmailAsync(email);
    await Task.Delay(TimeSpan.FromSeconds(1), cancellationToken);  // Rate limit
}
```

### Priority Processing

```csharp
await foreach (var email in inbox.WatchAsync(cancellationToken))
{
    var priority = GetPriority(email);

    switch (priority)
    {
        case Priority.High:
            await ProcessImmediatelyAsync(email);
            break;
        case Priority.Medium:
            await QueueForProcessingAsync(email);
            break;
        default:
            await LogAndDiscardAsync(email);
            break;
    }
}

Priority GetPriority(Email email)
{
    if (email.Subject.Contains("URGENT")) return Priority.High;
    if (email.From == "alerts@example.com") return Priority.High;
    if (email.Attachments?.Count > 0) return Priority.Medium;
    return Priority.Low;
}
```

### Parallel Processing with Semaphore

```csharp
using var semaphore = new SemaphoreSlim(3);  // Max 3 concurrent

await Parallel.ForEachAsync(
    inbox.WatchAsync(cancellationToken),
    new ParallelOptions { MaxDegreeOfParallelism = 3 },
    async (email, ct) =>
    {
        await semaphore.WaitAsync(ct);
        try
        {
            await ProcessEmailAsync(email);
        }
        finally
        {
            semaphore.Release();
        }
    });
```

## Cleanup

### Proper Cleanup in Tests

```csharp
public class EmailMonitoringTests : IAsyncLifetime
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;
    private CancellationTokenSource _cts = null!;

    public async Task InitializeAsync()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
            .Build();

        _inbox = await _client.CreateInboxAsync();
        _cts = new CancellationTokenSource();
    }

    public async Task DisposeAsync()
    {
        _cts.Cancel();
        _cts.Dispose();

        if (_inbox != null)
        {
            await _client.DeleteInboxAsync(_inbox.EmailAddress);
        }
    }

    [Fact]
    public async Task Monitors_Emails()
    {
        _cts.CancelAfter(TimeSpan.FromSeconds(5));

        await foreach (var email in _inbox.WatchAsync(_cts.Token))
        {
            Console.WriteLine($"Email: {email.Subject}");
        }
    }
}
```

## Best Practices

### Always Use CancellationToken

```csharp
// Good: Allows graceful cancellation
await foreach (var email in inbox.WatchAsync(cancellationToken))
{
    await ProcessAsync(email);
}

// Bad: No way to stop monitoring
await foreach (var email in inbox.WatchAsync(default))
{
    await ProcessAsync(email);
}
```

### Use ConfigureAwait When Appropriate

```csharp
// In library code, use ConfigureAwait(false)
await foreach (var email in inbox.WatchAsync(cancellationToken)
    .ConfigureAwait(false))
{
    await ProcessAsync(email).ConfigureAwait(false);
}
```

### Handle Reconnection

The SDK automatically handles reconnection. Configure behavior in client options:

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .WithSseReconnectInterval(TimeSpan.FromSeconds(5))
    .WithSseMaxReconnectAttempts(10)
    .Build();
```

## Next Steps

- **[Waiting for Emails](/client-dotnet/guides/waiting-for-emails/)** - Alternative polling-based approach
- **[Managing Inboxes](/client-dotnet/guides/managing-inboxes/)** - Inbox operations
- **[Delivery Strategies](/client-dotnet/advanced/strategies/)** - SSE vs Polling deep dive
- **[Configuration](/client-dotnet/configuration/)** - Configure SSE behavior
