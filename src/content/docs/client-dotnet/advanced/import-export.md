---
title: Inbox Import/Export
description: Learn how to export and import inboxes for test reproducibility and cross-environment sharing
---

VaultSandbox allows you to export and import inboxes, including their encryption keys and metadata. This enables advanced workflows like test reproducibility, manual testing, cross-environment sharing, and debugging.

## Overview

When you export an inbox, you get an `InboxExport` record containing:

- Version (always 1)
- Email address
- Inbox identifier (hash)
- Expiration time
- **Secret encryption key** (sensitive! public key is derived from this)
- **Server public signing key**
- Export timestamp

This exported data can be imported into another client instance, allowing you to access the same inbox from different environments or at different times.

:::warning[Security]
**Exported inbox data contains private encryption keys.** Anyone with this data can:

- Read all emails in the inbox
- Impersonate the inbox to receive new emails
- Decrypt all future emails sent to the inbox

**Never:**

- Commit exported data to version control
- Share exported data over insecure channels
- Store exported data in plaintext in production
- Log exported data (contains `SecretKey`)

**Always:**

- Treat exported data as sensitive credentials
- Encrypt exported files at rest
- Use secure channels for sharing
- Rotate/delete inboxes after use
- Add `*.inbox.json` to your `.gitignore`
  :::

## Use Cases

### 1. Test Reproducibility

Export an inbox at the end of a test run to reproduce issues later:

```csharp
using VaultSandbox.Client;
using Xunit;

public class EmailFlowTests : IAsyncLifetime
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;

    public async Task InitializeAsync()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(TestConfig.Url)
            .WithApiKey(TestConfig.ApiKey)
            .Build();

        _inbox = await _client.CreateInboxAsync();
    }

    public async Task DisposeAsync()
    {
        if (_inbox != null)
        {
            await _client.DeleteInboxAsync(_inbox.EmailAddress);
        }
    }

    [Fact]
    public async Task Should_Receive_Welcome_Email()
    {
        try
        {
            await SendWelcomeEmail(_inbox.EmailAddress);

            var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(10),
                Subject = "Welcome",
                UseRegex = true
            });

            Assert.Contains("Welcome", email.Subject);
        }
        catch (Exception)
        {
            // Export on test failure for debugging
            var exportData = await _inbox.ExportAsync();
            var filename = $"./debug/inbox-{DateTime.UtcNow:yyyyMMddHHmmss}.json";
            Directory.CreateDirectory("./debug");
            await File.WriteAllTextAsync(filename,
                JsonSerializer.Serialize(exportData, new JsonSerializerOptions { WriteIndented = true }));
            Console.WriteLine($"Inbox exported to {filename}");
            throw;
        }
    }
}
```

### 2. Manual Testing

Export an inbox from automated tests for manual verification:

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .Build();

var inbox = await client.CreateInboxAsync();

// Export for manual testing
await client.ExportInboxToFileAsync(inbox, "./manual-test-inbox.json");

Console.WriteLine($"Manual test inbox: {inbox.EmailAddress}");
Console.WriteLine("Exported to: ./manual-test-inbox.json");

// Continue with automated tests...
```

Then manually inspect:

```bash
# Use the exported inbox in a manual test script
dotnet run --project scripts/CheckInbox -- ./manual-test-inbox.json
```

### 3. Cross-Environment Sharing

Export an inbox from one environment and import it in another:

```csharp
// Development environment
var devClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://dev.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("DEV_API_KEY")!)
    .Build();

var inbox = await devClient.CreateInboxAsync();
var exportData = await inbox.ExportAsync();

// Save to shared location
await File.WriteAllTextAsync(
    "./shared/staging-inbox.json",
    JsonSerializer.Serialize(exportData, new JsonSerializerOptions { WriteIndented = true }));

// ---

// Staging environment
var stagingClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://dev.vaultsandbox.com") // Must match!
    .WithApiKey(Environment.GetEnvironmentVariable("STAGING_API_KEY")!)
    .Build();

var exportedData = JsonSerializer.Deserialize<InboxExport>(
    await File.ReadAllTextAsync("./shared/staging-inbox.json"))!;

var importedInbox = await stagingClient.ImportInboxAsync(exportedData);
Console.WriteLine($"Imported inbox: {importedInbox.EmailAddress}");
```

### 4. Debugging Production Issues

Export a problematic inbox from production for local debugging:

```csharp
// Production: Export the inbox
var inbox = await client.CreateInboxAsync();
// ... test runs, issue occurs ...

await client.ExportInboxToFileAsync(inbox, "./production-issue-123.json");

// ---

// Local development: Import and investigate
var localClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com") // Same server as production
    .WithApiKey(Environment.GetEnvironmentVariable("LOCAL_API_KEY")!)
    .Build();

var importedInbox = await localClient.ImportInboxFromFileAsync("./production-issue-123.json");

// Check emails
var emails = await importedInbox.GetEmailsAsync();
Console.WriteLine($"Found {emails.Count} emails");

foreach (var email in emails)
{
    Console.WriteLine();
    Console.WriteLine("---");
    Console.WriteLine($"Subject: {email.Subject}");
    Console.WriteLine($"From: {email.From}");
    Console.WriteLine($"Received: {email.ReceivedAt:O}");
    Console.WriteLine($"Links: {email.Links?.Count ?? 0}");
    Console.WriteLine($"Attachments: {email.Attachments?.Count ?? 0}");
}
```

## Export Methods

### Export to Object

```csharp
Task<InboxExport> ExportAsync()
```

Returns an `InboxExport` record with the inbox data:

```csharp
var inbox = await client.CreateInboxAsync();
var data = await inbox.ExportAsync();

// InboxExport contains:
// - Version: 1
// - EmailAddress: "test123@inbox.vaultsandbox.com"
// - InboxHash: "abc123..."
// - ExpiresAt: DateTimeOffset (when inbox expires)
// - ServerSigPk: "base64url-encoded-server-signing-key"
// - SecretKey: "base64url-encoded-secret-key" (public key derived from this)
// - ExportedAt: DateTimeOffset (when export was created)

// Save to file
await File.WriteAllTextAsync(
    "inbox.json",
    JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true }));
```

### Export to File

```csharp
Task ExportInboxToFileAsync(IInbox inbox, string filePath, CancellationToken ct = default)
```

Directly writes the inbox data to a JSON file:

```csharp
var inbox = await client.CreateInboxAsync();

// Export by inbox instance
await client.ExportInboxToFileAsync(inbox, "./backups/inbox.json");
```

### InboxExport Record

| Property       | Type             | Description                                                                                    |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `Version`      | `int`            | Export format version (always 1)                                                               |
| `EmailAddress` | `string`         | Inbox email address                                                                            |
| `InboxHash`    | `string`         | Unique inbox identifier                                                                        |
| `ExpiresAt`    | `DateTimeOffset` | When the inbox expires (ISO 8601)                                                              |
| `ServerSigPk`  | `string`         | Server ML-DSA-65 signing public key (base64url)                                                |
| `SecretKey`    | `string`         | ML-KEM-768 secret key (base64url, **sensitive!**). Public key is derived from bytes 1152-2400. |
| `ExportedAt`   | `DateTimeOffset` | When this export was created (ISO 8601)                                                        |

## Import Methods

### Import from Object

```csharp
Task<IInbox> ImportInboxAsync(InboxExport export, CancellationToken ct = default)
```

Imports inbox data from an `InboxExport` object:

```csharp
var exportedData = JsonSerializer.Deserialize<InboxExport>(
    await File.ReadAllTextAsync("./backup.json"))!;

var inbox = await client.ImportInboxAsync(exportedData);
Console.WriteLine($"Imported: {inbox.EmailAddress}");

// Use inbox normally
var emails = await inbox.GetEmailsAsync();
```

### Import from File

```csharp
Task<IInbox> ImportInboxFromFileAsync(string filePath, CancellationToken ct = default)
```

Directly imports an inbox from a JSON file:

```csharp
var inbox = await client.ImportInboxFromFileAsync("./backups/inbox.json");
Console.WriteLine($"Imported: {inbox.EmailAddress}");

// Monitor for new emails using IAsyncEnumerable
await foreach (var email in inbox.WatchAsync())
{
    Console.WriteLine($"New email: {email.Subject}");
}
```

## Extension Methods

The `InboxExportExtensions` class provides additional utility methods for working with inbox exports.

### ExportToStreamAsync

Exports inbox data directly to a stream.

```csharp
Task ExportToStreamAsync(this IInbox inbox, Stream stream, CancellationToken cancellationToken = default)
```

#### Example

```csharp
using var fileStream = File.Create("inbox-export.json");
await inbox.ExportToStreamAsync(fileStream);
```

### ExportToJsonAsync

Exports inbox data as a JSON string.

```csharp
Task<string> ExportToJsonAsync(this IInbox inbox)
```

#### Example

```csharp
var json = await inbox.ExportToJsonAsync();
Console.WriteLine(json);

// Or save to file
await File.WriteAllTextAsync("inbox.json", json);
```

### ParseExportFromStreamAsync

Parses an `InboxExport` from a stream (static method).

```csharp
static Task<InboxExport> ParseExportFromStreamAsync(Stream stream, CancellationToken cancellationToken = default)
```

#### Example

```csharp
using var fileStream = File.OpenRead("inbox-export.json");
var export = await InboxExportExtensions.ParseExportFromStreamAsync(fileStream);

var inbox = await client.ImportInboxAsync(export);
```

### ParseExportFromJson

Parses an `InboxExport` from a JSON string (static method).

```csharp
static InboxExport ParseExportFromJson(string json)
```

#### Example

```csharp
var json = await File.ReadAllTextAsync("inbox.json");
var export = InboxExportExtensions.ParseExportFromJson(json);

var inbox = await client.ImportInboxAsync(export);
```

### Complete Extension Methods Example

```csharp
using VaultSandbox.Client;
using VaultSandbox.Client.Extensions;

// Export to JSON string
var inbox = await client.CreateInboxAsync();
var json = await inbox.ExportToJsonAsync();

// Save to file via stream
using (var stream = File.Create("backup.json"))
{
    await inbox.ExportToStreamAsync(stream);
}

// Parse from JSON string
var exportFromJson = InboxExportExtensions.ParseExportFromJson(json);

// Parse from stream
using (var stream = File.OpenRead("backup.json"))
{
    var exportFromStream = await InboxExportExtensions.ParseExportFromStreamAsync(stream);
    var importedInbox = await client.ImportInboxAsync(exportFromStream);
}
```

## Import Validation

The SDK performs comprehensive validation when importing inbox data:

1. **Version validation** - Must be version 1
2. **Required fields** - `EmailAddress`, `InboxHash`, `SecretKey`, and `ServerSigPk` must be present
3. **Email format** - Must contain exactly one `@` character
4. **Expiration check** - Inbox must not be expired
5. **Base64URL encoding** - Keys must be valid base64url (rejects standard Base64 with `+`, `/`, `=`)
6. **Key sizes** - Secret key must be 2400 bytes (ML-KEM-768), server signing key must be 1952 bytes (ML-DSA-65)

The SDK throws exceptions for invalid imports:

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var inbox = await client.ImportInboxAsync(data);
}
catch (InvalidImportDataException ex)
{
    Console.WriteLine($"Invalid import data: {ex.Message}");
    // Possible causes:
    // - Unsupported export version
    // - Missing required fields
    // - Invalid email address format
    // - Invalid Base64URL encoding
    // - Invalid key sizes
    // - Inbox has expired
}
catch (InboxAlreadyExistsException)
{
    Console.WriteLine("Inbox already imported in this client");
    // The inbox is already available in this client instance
}
catch (ApiException ex) when (ex.StatusCode == 404)
{
    Console.WriteLine("Inbox no longer exists on server (expired?)");
}
```

## Complete Examples

### Manual Testing Workflow

```csharp
// scripts/ExportTestInbox/Program.cs
using VaultSandbox.Client;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .Build();

var inbox = await client.CreateInboxAsync();

Console.WriteLine($"Created test inbox: {inbox.EmailAddress}");
Console.WriteLine($"Expires at: {inbox.ExpiresAt:O}");

// Export for manual use
Directory.CreateDirectory("./tmp");
await client.ExportInboxToFileAsync(inbox, "./tmp/test-inbox.json");
Console.WriteLine("Exported to: ./tmp/test-inbox.json");

Console.WriteLine();
Console.WriteLine("Send test emails to this address, then run:");
Console.WriteLine("  dotnet run --project scripts/CheckTestInbox");
```

```csharp
// scripts/CheckTestInbox/Program.cs
using VaultSandbox.Client;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .Build();

// Import the test inbox
var inbox = await client.ImportInboxFromFileAsync("./tmp/test-inbox.json");
Console.WriteLine($"Monitoring: {inbox.EmailAddress}");
Console.WriteLine();

// Show existing emails
var emails = await inbox.GetEmailsAsync();
Console.WriteLine($"Found {emails.Count} existing emails:");
Console.WriteLine();

var index = 1;
foreach (var email in emails)
{
    Console.WriteLine($"{index}. \"{email.Subject}\" from {email.From}");
    Console.WriteLine($"   Received: {email.ReceivedAt:G}");
    Console.WriteLine($"   Links: {email.Links?.Count ?? 0}");
    Console.WriteLine();
    index++;
}

// Monitor for new emails
Console.WriteLine("Waiting for new emails (Ctrl+C to exit)...");
Console.WriteLine();

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cts.Cancel();
};

try
{
    await foreach (var email in inbox.WatchAsync(cts.Token))
    {
        Console.WriteLine("New email received!");
        Console.WriteLine($"   Subject: {email.Subject}");
        Console.WriteLine($"   From: {email.From}");
        Console.WriteLine($"   Received: {email.ReceivedAt:G}");
        Console.WriteLine();
    }
}
catch (OperationCanceledException)
{
    Console.WriteLine("Monitoring stopped.");
}
```

### Test Debugging Workflow with xUnit

```csharp
// tests/EmailTests.cs
using VaultSandbox.Client;
using Xunit;
using Xunit.Abstractions;

public class EmailTests : IAsyncLifetime
{
    private readonly ITestOutputHelper _output;
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;
    private string? _testName;

    public EmailTests(ITestOutputHelper output)
    {
        _output = output;
    }

    public async Task InitializeAsync()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(TestConfig.Url)
            .WithApiKey(TestConfig.ApiKey)
            .Build();

        _inbox = await _client.CreateInboxAsync();
    }

    public async Task DisposeAsync()
    {
        // Export on failure (check if test failed via test context if available)
        // This is a simplified example - real implementation may vary
        if (_inbox != null)
        {
            await _client.DeleteInboxAsync(_inbox.EmailAddress);
        }
    }

    [Fact]
    public async Task Should_Process_Order_Confirmation()
    {
        _testName = nameof(Should_Process_Order_Confirmation);

        try
        {
            await TriggerOrderConfirmation(_inbox.EmailAddress);

            var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(30),
                Subject = "Order Confirmation",
                UseRegex = true
            });

            Assert.NotNull(email);
            Assert.Contains("Order #", email.Text);
        }
        catch (Exception ex)
        {
            await ExportInboxForDebugging(ex);
            throw;
        }
    }

    private async Task ExportInboxForDebugging(Exception ex)
    {
        var debugDir = "./debug";
        Directory.CreateDirectory(debugDir);

        var safeName = _testName?.Replace(" ", "-") ?? "unknown";
        var filename = $"inbox-{safeName}-{DateTime.UtcNow:yyyyMMddHHmmss}.json";
        var filepath = Path.Combine(debugDir, filename);

        await _client.ExportInboxToFileAsync(_inbox, filepath);
        _output.WriteLine($"Test failed: {ex.Message}");
        _output.WriteLine($"Exported inbox to: {filepath}");
    }
}
```

### Cross-Environment Sync

```csharp
// scripts/SyncInboxToStaging/Program.cs
using VaultSandbox.Client;

// Export from development
var devClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://dev.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("DEV_API_KEY")!)
    .Build();

var devInbox = await devClient.CreateInboxAsync();
Console.WriteLine($"Created dev inbox: {devInbox.EmailAddress}");

// Export
var exportData = await devInbox.ExportAsync();
Directory.CreateDirectory("./tmp");
var exportPath = "./tmp/staging-sync.json";
await File.WriteAllTextAsync(
    exportPath,
    JsonSerializer.Serialize(exportData, new JsonSerializerOptions { WriteIndented = true }));

Console.WriteLine($"Exported to: {exportPath}");
Console.WriteLine();
Console.WriteLine("Run in staging environment:");
Console.WriteLine("  dotnet run --project scripts/ImportFromDev");

// Keep inbox alive
Console.WriteLine();
Console.WriteLine("Inbox will remain active for manual testing...");
Console.WriteLine("Press Ctrl+C to exit.");
await Task.Delay(Timeout.Infinite);
```

```csharp
// scripts/ImportFromDev/Program.cs
using VaultSandbox.Client;

var stagingClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://dev.vaultsandbox.com") // Same server!
    .WithApiKey(Environment.GetEnvironmentVariable("STAGING_API_KEY")!)
    .Build();

var inbox = await stagingClient.ImportInboxFromFileAsync("./tmp/staging-sync.json");

Console.WriteLine($"Imported inbox: {inbox.EmailAddress}");
Console.WriteLine("Checking for emails...");
Console.WriteLine();

var emails = await inbox.GetEmailsAsync();
foreach (var email in emails)
{
    Console.WriteLine($"- {email.Subject} ({email.From})");
}
```

## Best Practices

### 1. Secure Storage

Never store exported data in plaintext in production:

```csharp
using System.Security.Cryptography;

public static class SecureInboxExport
{
    public static async Task<byte[]> ExportEncryptedAsync(
        IInbox inbox,
        string password)
    {
        var data = await inbox.ExportAsync();
        var json = JsonSerializer.Serialize(data);
        var plaintext = Encoding.UTF8.GetBytes(json);

        // Derive key from password
        using var deriveBytes = new Rfc2898DeriveBytes(
            password,
            saltSize: 16,
            iterations: 100000,
            HashAlgorithmName.SHA256);

        var salt = deriveBytes.Salt;
        var key = deriveBytes.GetBytes(32);
        var iv = RandomNumberGenerator.GetBytes(16);

        // Encrypt
        using var aes = Aes.Create();
        aes.Key = key;
        aes.IV = iv;

        using var encryptor = aes.CreateEncryptor();
        var ciphertext = encryptor.TransformFinalBlock(plaintext, 0, plaintext.Length);

        // Combine salt + iv + ciphertext
        var result = new byte[salt.Length + iv.Length + ciphertext.Length];
        Buffer.BlockCopy(salt, 0, result, 0, salt.Length);
        Buffer.BlockCopy(iv, 0, result, salt.Length, iv.Length);
        Buffer.BlockCopy(ciphertext, 0, result, salt.Length + iv.Length, ciphertext.Length);

        return result;
    }

    public static InboxExport DecryptImport(
        byte[] encrypted,
        string password)
    {
        // Extract salt, iv, ciphertext
        var salt = new byte[16];
        var iv = new byte[16];
        var ciphertext = new byte[encrypted.Length - 32];

        Buffer.BlockCopy(encrypted, 0, salt, 0, 16);
        Buffer.BlockCopy(encrypted, 16, iv, 0, 16);
        Buffer.BlockCopy(encrypted, 32, ciphertext, 0, ciphertext.Length);

        // Derive key
        using var deriveBytes = new Rfc2898DeriveBytes(
            password,
            salt,
            100000,
            HashAlgorithmName.SHA256);
        var key = deriveBytes.GetBytes(32);

        // Decrypt
        using var aes = Aes.Create();
        aes.Key = key;
        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor();
        var plaintext = decryptor.TransformFinalBlock(ciphertext, 0, ciphertext.Length);

        var json = Encoding.UTF8.GetString(plaintext);
        return JsonSerializer.Deserialize<InboxExport>(json)!;
    }
}
```

### 2. Server URL Matching

Imported inboxes must be used with the same server:

```csharp
// Export from server A
var clientA = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://server-a.vaultsandbox.com")
    .WithApiKey("key-a")
    .Build();

var inbox = await clientA.CreateInboxAsync();
var data = await inbox.ExportAsync();

// Import must use same server
var clientB = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://server-a.vaultsandbox.com") // Same server
    .WithApiKey("key-b") // Different API key is OK
    .Build();

await clientB.ImportInboxAsync(data); // Works

// Wrong server will fail
var clientC = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://server-c.vaultsandbox.com") // Different server
    .WithApiKey("key-c")
    .Build();

await clientC.ImportInboxAsync(data); // Throws InvalidImportDataException
```

### 3. Clean Up Exported Inboxes

Delete inboxes when done to avoid quota issues:

```csharp
async Task DebugWithImportedInbox(string filepath)
{
    var client = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(url)
        .WithApiKey(apiKey)
        .Build();

    var inbox = await client.ImportInboxFromFileAsync(filepath);

    try
    {
        // Debug...
        var emails = await inbox.GetEmailsAsync();
        Console.WriteLine($"Found {emails.Count} emails");
    }
    finally
    {
        // Clean up if you're done
        await client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

### 4. Version Exported Data

Include metadata in exports for tracking:

```csharp
public record ExportWithMetadata
{
    public required string Version { get; init; }
    public required DateTimeOffset ExportedAt { get; init; }
    public required string ExportedBy { get; init; }
    public required string Environment { get; init; }
    public required InboxExport Inbox { get; init; }
}

public static async Task<ExportWithMetadata> ExportWithMetadataAsync(IInbox inbox)
{
    var data = await inbox.ExportAsync();

    return new ExportWithMetadata
    {
        Version = "1.0",
        ExportedAt = DateTimeOffset.UtcNow,
        ExportedBy = Environment.UserName,
        Environment = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "Unknown",
        Inbox = data
    };
}

public static async Task<IInbox> ImportWithMetadataAsync(
    IVaultSandboxClient client,
    ExportWithMetadata data)
{
    Console.WriteLine($"Import from: {data.ExportedBy}");
    Console.WriteLine($"Exported at: {data.ExportedAt:O}");
    Console.WriteLine($"Environment: {data.Environment}");

    return await client.ImportInboxAsync(data.Inbox);
}
```

## Next Steps

- [Delivery Strategies](/client-dotnet/advanced/strategies/) - SSE vs Polling
- [Error Handling](/client-dotnet/api/errors/) - Handle import errors
- [VaultSandboxClient API](/client-dotnet/api/client/) - Client import/export methods
