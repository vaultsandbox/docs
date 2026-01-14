---
title: Error Handling
description: Complete guide to exception handling and retry behavior in VaultSandbox .NET Client
---

The VaultSandbox .NET Client provides comprehensive exception handling with automatic retries for transient failures and specific exception types for different failure scenarios.

## Exception Hierarchy

All SDK exceptions inherit from the base `VaultSandboxException` class, allowing you to catch all SDK-specific exceptions with a single catch block.

```
VaultSandboxException (base class)
├── ApiException
├── NetworkException
├── VaultSandboxTimeoutException
├── InboxNotFoundException
├── EmailNotFoundException
├── InboxAlreadyExistsException
├── InvalidImportDataException
├── DecryptionException
├── SignatureVerificationException
├── ServerKeyMismatchException
├── SseException
└── StrategyException
```

## Automatic Retries

The SDK automatically retries failed HTTP requests for transient errors. This helps mitigate temporary network issues or server-side problems.

### Default Retry Behavior

By default, requests are retried for these HTTP status codes:

- `408` - Request Timeout
- `429` - Too Many Requests (Rate Limiting)
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable
- `504` - Gateway Timeout

### Configuration

Configure retry behavior when building the client:

```csharp
using VaultSandbox.Client;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY"))
    .WithMaxRetries(5)                              // Default: 3
    .WithRetryDelay(TimeSpan.FromSeconds(2))        // Default: 1s
    .Build();
```

### Retry Strategy

The SDK uses **exponential backoff** for retries:

- 1st retry: `RetryDelay`
- 2nd retry: `RetryDelay * 2`
- 3rd retry: `RetryDelay * 4`
- And so on...

#### Example

```csharp
// With RetryDelay: 1s and MaxRetries: 3
// Retry schedule:
//   1st attempt: immediate
//   2nd attempt: after 1s
//   3rd attempt: after 2s
//   4th attempt: after 4s
//   Total time: up to 7 seconds + request time
```

## Exception Types

### VaultSandboxException

Base class for all SDK exceptions. Use this to catch any SDK-specific exception.

```csharp
public class VaultSandboxException : Exception
{
    public override string Message { get; }
}
```

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var inbox = await client.CreateInboxAsync();
    // Use inbox...
}
catch (VaultSandboxException ex)
{
    Console.WriteLine($"VaultSandbox error: {ex.Message}");
}
catch (Exception ex)
{
    Console.WriteLine($"Unexpected error: {ex}");
}
```

---

### ApiException

Thrown for API-level errors such as invalid requests or permission denied.

```csharp
public class ApiException : VaultSandboxException
{
    public int StatusCode { get; }
    public string? ResponseBody { get; }
}
```

#### Properties

- `StatusCode`: HTTP status code from the API
- `ResponseBody`: Optional response body from the server
- `Message`: Error message from the server

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var inbox = await client.CreateInboxAsync();
}
catch (ApiException ex)
{
    Console.WriteLine($"API Error ({ex.StatusCode}): {ex.Message}");

    switch (ex.StatusCode)
    {
        case 400:
            Console.WriteLine("Bad request - check parameters");
            // e.g., "clientKemPk is required when encryption is enabled"
            break;
        case 401:
            Console.WriteLine("Invalid API key");
            break;
        case 403:
            Console.WriteLine("Permission denied");
            break;
        case 409:
            Console.WriteLine("Conflict - inbox already exists");
            break;
        case 429:
            Console.WriteLine("Rate limit exceeded");
            break;
    }
}
```

#### Common API Errors

| Status | Error Message | Description |
| ------ | ------------- | ----------- |
| 400 | `clientKemPk is required when encryption is enabled` | Server requires encryption but no KEM public key was provided |
| 409 | `An inbox with the same client KEM public key already exists` | Encrypted inbox conflict |
| 409 | `An inbox with this email address already exists` | Plain inbox conflict |

---

### NetworkException

Thrown when there is a network-level failure (e.g., cannot connect to server).

```csharp
public class NetworkException : VaultSandboxException
{
    public override string Message { get; }
}
```

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var inbox = await client.CreateInboxAsync();
}
catch (NetworkException ex)
{
    Console.WriteLine($"Network error: {ex.Message}");
    Console.WriteLine("Check your internet connection and server URL");
}
```

---

### VaultSandboxTimeoutException

Thrown by methods like `WaitForEmailAsync()` and `WaitForEmailCountAsync()` when the timeout is reached before the condition is met.

```csharp
public class VaultSandboxTimeoutException : VaultSandboxException
{
    public TimeSpan Timeout { get; }
}
```

#### Properties

- `Timeout`: The timeout duration that was exceeded
- `Message`: Error message describing the timeout

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(5),
        Subject = "Welcome",
        UseRegex = true
    });
}
catch (VaultSandboxTimeoutException ex)
{
    Console.WriteLine("Timed out waiting for email");
    Console.WriteLine("Email may not have been sent or took too long to deliver");

    // Check what emails did arrive
    var emails = await inbox.GetEmailsAsync();
    Console.WriteLine($"Found {emails.Count} emails:");
    foreach (var e in emails)
    {
        Console.WriteLine($"  - {e.Subject}");
    }
}
```

---

### InboxNotFoundException

Thrown when an inbox does not exist on the server.

```csharp
public class InboxNotFoundException : VaultSandboxException
{
    public string EmailAddress { get; }
}
```

#### Properties

- `EmailAddress`: The email address of the inbox that was not found
- `Message`: Error message describing the issue

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var emails = await inbox.GetEmailsAsync();
}
catch (InboxNotFoundException ex)
{
    Console.WriteLine("Inbox no longer exists");
    Console.WriteLine("It may have expired or been deleted");
}
```

---

### EmailNotFoundException

Thrown when an email does not exist.

```csharp
public class EmailNotFoundException : VaultSandboxException
{
    public string EmailId { get; }
}
```

#### Properties

- `EmailId`: The identifier of the email that was not found
- `Message`: Error message describing the issue

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var email = await inbox.GetEmailAsync("non-existent-id");
}
catch (EmailNotFoundException ex)
{
    Console.WriteLine("Email not found");
    Console.WriteLine("It may have been deleted");
}
```

---

### InboxAlreadyExistsException

Thrown when attempting to create an inbox that conflicts with an existing one. The conflict can occur due to:

- **Encrypted inboxes**: An inbox with the same client KEM public key already exists
- **Plain inboxes**: An inbox with the same email address already exists
- **Import**: The inbox is already imported in this client

```csharp
public class InboxAlreadyExistsException : VaultSandboxException
{
    public string EmailAddress { get; }
}
```

#### Properties

- `EmailAddress`: The email address of the inbox that already exists
- `Message`: Error message describing the issue

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var inbox = await client.CreateInboxAsync(new CreateInboxOptions
    {
        EmailAddress = "test@inbox.vaultsandbox.com"
    });
}
catch (InboxAlreadyExistsException ex)
{
    Console.WriteLine($"Inbox conflict: {ex.Message}");
    // For encrypted: "An inbox with the same client KEM public key already exists"
    // For plain: "An inbox with this email address already exists"
}

try
{
    var inbox = await client.ImportInboxAsync(exportedData);
}
catch (InboxAlreadyExistsException ex)
{
    Console.WriteLine("Inbox already imported in this client");
    Console.WriteLine("Use a new client instance or delete the existing inbox");
}
```

---

### InvalidImportDataException

Thrown when imported inbox data fails validation (missing fields, invalid keys, server mismatch, etc.).

```csharp
public class InvalidImportDataException : VaultSandboxException
{
    public override string Message { get; }
}
```

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var corruptedData = JsonSerializer.Deserialize<InboxExport>(corruptedJson);
    var inbox = await client.ImportInboxAsync(corruptedData);
}
catch (InvalidImportDataException ex)
{
    Console.WriteLine($"Invalid import data: {ex.Message}");
    Console.WriteLine("The exported data may be corrupted or from a different server");
}
```

---

### DecryptionException

Thrown if the client fails to decrypt an email. This is rare and may indicate data corruption or a bug.

```csharp
public class DecryptionException : VaultSandboxException
{
    public override string Message { get; }
}
```

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var emails = await inbox.GetEmailsAsync();
}
catch (DecryptionException ex)
{
    Console.WriteLine($"Failed to decrypt email: {ex.Message}");
    Console.WriteLine("This is a critical error - please report it");

    // Log for investigation
    Console.WriteLine($"Inbox: {inbox.EmailAddress}");
    Console.WriteLine($"Time: {DateTimeOffset.UtcNow:O}");
}
```

#### Handling

Decryption exceptions should **always** be logged and investigated as they may indicate:

- Data corruption
- SDK bug
- MITM attack (rare)
- Server-side encryption issue

---

### SignatureVerificationException

Thrown if the cryptographic signature of a message from the server cannot be verified. This is a **critical security error** that may indicate a man-in-the-middle (MITM) attack.

```csharp
public class SignatureVerificationException : VaultSandboxException
{
    public override string Message { get; }
}
```

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var inbox = await client.CreateInboxAsync();
}
catch (SignatureVerificationException ex)
{
    Console.WriteLine("CRITICAL: Signature verification failed!");
    Console.WriteLine("This may indicate a MITM attack");
    Console.WriteLine($"Message: {ex.Message}");

    // Alert security team
    await AlertSecurityTeamAsync(new SecurityAlert
    {
        Error = ex.Message,
        Timestamp = DateTimeOffset.UtcNow,
        ServerUrl = client.Options.BaseUrl
    });

    throw; // Do not continue
}
```

#### Handling

Signature verification exceptions should **never** be ignored:

1. **Log immediately** with full context
2. **Alert security/operations team**
3. **Stop processing** - do not continue with the operation
4. **Investigate** - check for network issues, proxy problems, or actual attacks

---

### ServerKeyMismatchException

Thrown when the server's public key doesn't match what was expected, potentially indicating a server change or attack.

```csharp
public class ServerKeyMismatchException : VaultSandboxException
{
    public string ExpectedKey { get; }
    public string ActualKey { get; }
}
```

#### Properties

- `ExpectedKey`: The expected server signing key (base64url-encoded)
- `ActualKey`: The actual server signing key received in the payload (base64url-encoded)
- `Message`: Error message describing the mismatch

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var inbox = await client.ImportInboxAsync(exportedData);
}
catch (ServerKeyMismatchException ex)
{
    Console.WriteLine("Server key mismatch detected");
    Console.WriteLine("The inbox may have been exported from a different server");
    Console.WriteLine($"Details: {ex.Message}");
}
```

---

### SseException

Thrown for errors related to the Server-Sent Events (SSE) connection.

```csharp
public class SseException : VaultSandboxException
{
    public override string Message { get; }
}
```

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"))
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY"))
    .UseSseDelivery()
    .Build();

try
{
    var inbox = await client.CreateInboxAsync();
    await foreach (var email in inbox.WatchAsync())
    {
        Console.WriteLine($"New email: {email.Subject}");
    }
}
catch (SseException ex)
{
    Console.WriteLine($"SSE connection error: {ex.Message}");
    Console.WriteLine("Falling back to polling strategy");

    // Recreate client with polling
    var pollingClient = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"))
        .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY"))
        .UsePollingDelivery()
        .Build();
}
```

---

### StrategyException

Thrown when a delivery strategy is not set or is invalid.

```csharp
public class StrategyException : VaultSandboxException
{
    public override string Message { get; }
}
```

#### Example

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var inbox = await client.CreateInboxAsync();
    await foreach (var email in inbox.WatchAsync())
    {
        Console.WriteLine($"New email: {email.Subject}");
    }
}
catch (StrategyException ex)
{
    Console.WriteLine($"Strategy error: {ex.Message}");
    Console.WriteLine("The delivery strategy may not be properly configured");
}
```

## Error Handling Patterns

### Basic Exception Handling

```csharp
using VaultSandbox.Client;
using VaultSandbox.Client.Exceptions;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(baseUrl)
    .WithApiKey(apiKey)
    .Build();

try
{
    var inbox = await client.CreateInboxAsync();
    Console.WriteLine($"Send email to: {inbox.EmailAddress}");

    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });
    Console.WriteLine($"Email received: {email.Subject}");

    await client.DeleteInboxAsync(inbox.EmailAddress);
}
catch (VaultSandboxTimeoutException)
{
    Console.WriteLine("Timed out waiting for email");
}
catch (ApiException ex)
{
    Console.WriteLine($"API Error ({ex.StatusCode}): {ex.Message}");
}
catch (NetworkException ex)
{
    Console.WriteLine($"Network error: {ex.Message}");
}
catch (VaultSandboxException ex)
{
    Console.WriteLine($"VaultSandbox error: {ex.Message}");
}
catch (Exception ex)
{
    Console.WriteLine($"Unexpected error: {ex}");
}
```

### Pattern Matching (C# 9+)

Use pattern matching for cleaner exception handling:

```csharp
try
{
    var inbox = await client.CreateInboxAsync();
    var email = await inbox.WaitForEmailAsync();
}
catch (Exception ex)
{
    var message = ex switch
    {
        VaultSandboxTimeoutException => "Timed out waiting for email",
        ApiException { StatusCode: 401 } => "Invalid API key",
        ApiException { StatusCode: 403 } => "Permission denied",
        ApiException { StatusCode: 429 } => "Rate limit exceeded",
        ApiException api => $"API error ({api.StatusCode}): {api.Message}",
        NetworkException net => $"Network error: {net.Message}",
        SignatureVerificationException => "CRITICAL: Signature verification failed!",
        DecryptionException => "CRITICAL: Decryption failed!",
        VaultSandboxException vsb => $"VaultSandbox error: {vsb.Message}",
        _ => $"Unexpected error: {ex.Message}"
    };

    Console.WriteLine(message);
}
```

### Retry with Custom Logic

```csharp
async Task<Email> WaitForEmailWithRetryAsync(
    IInbox inbox,
    WaitForEmailOptions options,
    int maxAttempts = 3,
    CancellationToken cancellationToken = default)
{
    Exception? lastException = null;

    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            return await inbox.WaitForEmailAsync(options, cancellationToken);
        }
        catch (VaultSandboxTimeoutException ex)
        {
            lastException = ex;
            Console.WriteLine($"Attempt {attempt}/{maxAttempts} timed out");

            if (attempt < maxAttempts)
            {
                Console.WriteLine("Retrying...");
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
        }
        catch (Exception)
        {
            // Non-timeout error, don't retry
            throw;
        }
    }

    throw lastException!;
}

// Usage
try
{
    var email = await WaitForEmailWithRetryAsync(
        inbox,
        new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Welcome",
            UseRegex = true
        },
        maxAttempts: 3,
        cancellationToken);

    Console.WriteLine($"Email received: {email.Subject}");
}
catch (VaultSandboxTimeoutException)
{
    Console.WriteLine("Failed after retries");
}
```

### Graceful Degradation

```csharp
async Task<IReadOnlyList<Email>> GetEmailsWithFallbackAsync(
    IInbox inbox,
    CancellationToken cancellationToken = default)
{
    try
    {
        // Try to wait for new email
        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(5)
        }, cancellationToken);

        return [email];
    }
    catch (VaultSandboxTimeoutException)
    {
        Console.WriteLine("No new emails, checking existing...");
        // Fall back to listing existing emails
        return await inbox.GetEmailsAsync(cancellationToken);
    }
}
```

### Test Cleanup with Exception Handling

```csharp
[TestFixture]
public class EmailTests
{
    private IVaultSandboxClient _client = null!;
    private IInbox? _inbox;

    [SetUp]
    public async Task SetUp()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"))
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY"))
            .Build();

        _inbox = await _client.CreateInboxAsync();
    }

    [TearDown]
    public async Task TearDown()
    {
        // Always clean up, even if test failed
        if (_inbox is not null)
        {
            try
            {
                await _client.DeleteInboxAsync(_inbox.EmailAddress);
            }
            catch (InboxNotFoundException)
            {
                // Inbox already deleted, that's fine
                Console.WriteLine("Inbox already deleted");
            }
            catch (ApiException ex) when (ex.StatusCode == 404)
            {
                // Also acceptable
                Console.WriteLine("Inbox already deleted");
            }
            catch (Exception ex)
            {
                // Log but don't fail the test
                Console.WriteLine($"Failed to delete inbox: {ex.Message}");
            }
        }
    }

    [Test]
    public async Task Should_Receive_Email()
    {
        await SendEmailAsync(_inbox!.EmailAddress);

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Test",
            UseRegex = true
        });

        Assert.That(email.Subject, Does.Contain("Test"));
    }
}
```

## Best Practices

### 1. Always Handle Timeout Exceptions

Timeouts are common in email testing. Always handle them explicitly:

```csharp
try
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });
}
catch (VaultSandboxTimeoutException)
{
    // List what emails did arrive
    var emails = await inbox.GetEmailsAsync();
    Console.WriteLine($"Expected email not found. Received {emails.Count} emails:");
    foreach (var e in emails)
    {
        Console.WriteLine($"  - \"{e.Subject}\" from {e.From}");
    }
    throw;
}
```

### 2. Log Critical Exceptions

Always log signature verification and decryption exceptions:

```csharp
try
{
    var inbox = await client.CreateInboxAsync();
}
catch (Exception ex) when (ex is SignatureVerificationException or DecryptionException)
{
    // Critical security/integrity exception
    _logger.LogCritical(ex, "Security exception occurred. Server: {ServerUrl}, Time: {Timestamp}",
        client.Options.BaseUrl,
        DateTimeOffset.UtcNow);

    // Alert operations team
    await AlertOpsAsync(ex);

    throw;
}
```

### 3. Use Specific Exception Types

Catch specific exceptions before generic ones:

```csharp
// Good: Specific to general
try
{
    // ...
}
catch (InboxNotFoundException)
{
    // Handle not found case specifically
}
catch (ApiException ex) when (ex.StatusCode == 404)
{
    // Handle other 404 cases (email not found)
}
catch (ApiException ex)
{
    // Handle other API errors
}
catch (VaultSandboxTimeoutException)
{
    // Handle timeout case
}
catch (VaultSandboxException ex)
{
    // Handle any other SDK exception
}
catch (Exception ex)
{
    // Handle unexpected exceptions
}

// Avoid: Too generic
try
{
    // ...
}
catch (VaultSandboxException)
{
    // Can't differentiate between exception types
}
```

### 4. Clean Up Resources

Always clean up, even when exceptions occur:

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(baseUrl)
    .WithApiKey(apiKey)
    .Build();

try
{
    var inbox = await client.CreateInboxAsync();
    // Use inbox...
}
catch (Exception ex)
{
    Console.WriteLine($"Error: {ex.Message}");
    throw;
}
finally
{
    if (client is IAsyncDisposable asyncDisposable)
    {
        await asyncDisposable.DisposeAsync();
    }
    else if (client is IDisposable disposable)
    {
        disposable.Dispose();
    }
}
```

Or use `await using` for automatic disposal:

```csharp
await using var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(baseUrl)
    .WithApiKey(apiKey)
    .Build();

var inbox = await client.CreateInboxAsync();
// Client is automatically disposed when scope exits
```

## Next Steps

- [CI/CD Integration](/client-dotnet/testing/cicd/) - Exception handling in CI
- [IVaultSandboxClient API](/client-dotnet/api/client/) - Client configuration
