---
title: Inboxes
description: Understanding VaultSandbox inboxes and how to work with them
---

Inboxes are the core concept in VaultSandbox. Each inbox is an isolated, encrypted email destination with its own unique address and encryption keys.

## What is an Inbox?

An inbox is a temporary, encrypted email destination that:

- Has a **unique email address** (e.g., `a1b2c3d4@mail.example.com`)
- Uses **client-side encryption** (ML-KEM-768 keypair)
- **Expires automatically** after a configurable time-to-live (TTL)
- Is **isolated** from other inboxes
- Stores emails **in memory** on the gateway

## Creating Inboxes

### Basic Creation

```csharp
using VaultSandbox.Client;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(url)
    .WithApiKey(apiKey)
    .Build();

var inbox = await client.CreateInboxAsync();

Console.WriteLine(inbox.EmailAddress);  // "a1b2c3d4@mail.example.com"
Console.WriteLine(inbox.InboxHash);     // "Rr02MLnP7F0pRVC6QdcpSIeyklqu3PDkYglvsfN7Oss"
Console.WriteLine(inbox.ExpiresAt);     // DateTimeOffset
```

### With Options

```csharp
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromHours(1),  // Default: 1 hour
    EmailAddress = "test@mail.example.com"  // Request specific address
});
```

**Note**: Requesting a specific email address may fail if it's already in use. The server will return an error.

### With Email Auth Disabled

```csharp
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    EmailAuth = false  // Skip SPF/DKIM/DMARC/PTR checks
});
```

### With Encryption Override

```csharp
// Check server policy first
var serverInfo = await client.GetServerInfoAsync();
var canOverride = serverInfo.EncryptionPolicy is EncryptionPolicy.Enabled or EncryptionPolicy.Disabled;

if (canOverride)
{
    // Create a plain (unencrypted) inbox
    var plainInbox = await client.CreateInboxAsync(new CreateInboxOptions
    {
        Encryption = InboxEncryption.Plain
    });
}
```

## Inbox Properties

### EmailAddress

**Type**: `string`

The full email address for this inbox.

```csharp
Console.WriteLine(inbox.EmailAddress);
// "a1b2c3d4@mail.example.com"
```

Send emails to this address to have them appear in the inbox.

### InboxHash

**Type**: `string`

A unique cryptographic hash identifier for the inbox. This is used internally for encryption and identification purposes.

```csharp
Console.WriteLine(inbox.InboxHash);
// "Rr02MLnP7F0pRVC6QdcpSIeyklqu3PDkYglvsfN7Oss"
```

**Note**: This is not the same as the local part of the email address. The email address local part (e.g., `a1b2c3d4` in `a1b2c3d4@mail.example.com`) is different from the `InboxHash`.

### ExpiresAt

**Type**: `DateTimeOffset`

When the inbox will automatically expire and be deleted.

```csharp
Console.WriteLine(inbox.ExpiresAt);
// 2024-01-16T12:00:00.000+00:00

// Check if inbox is expiring soon
var timeUntilExpiry = inbox.ExpiresAt - DateTimeOffset.UtcNow;
Console.WriteLine($"Expires in {timeUntilExpiry.TotalHours:F1} hours");
```

### EmailAuth

**Type**: `bool`

Whether email authentication checks (SPF, DKIM, DMARC, Reverse DNS) are enabled for this inbox. When `false`, all authentication results will show `Skipped` status.

```csharp
Console.WriteLine(inbox.EmailAuth);
// true

if (!inbox.EmailAuth)
{
    Console.WriteLine("Auth checks are disabled for this inbox");
}
```

### Encrypted

**Type**: `bool`

Whether this inbox uses end-to-end encryption. Determined by the server's encryption policy and any per-inbox override requested during creation.

```csharp
Console.WriteLine(inbox.Encrypted);
// true

if (inbox.Encrypted)
{
    Console.WriteLine("Emails are end-to-end encrypted");
}
else
{
    Console.WriteLine("Emails are stored in plain text");
}
```

## Inbox Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                  Inbox Lifecycle                        │
└─────────────────────────────────────────────────────────┘

1. Creation
   client.CreateInboxAsync() → IInbox
   ↓
   - Keypair generated client-side
   - Public key sent to server
   - Unique email address assigned
   - TTL timer starts

2. Active
   ↓
   - Receive emails
   - List/read emails
   - Wait for emails
   - Monitor for new emails

3. Expiration (TTL reached) or Manual Deletion
   ↓
   client.DeleteInboxAsync(emailAddress) or TTL expires
   - All emails deleted
   - Inbox address freed
   - Keypair destroyed
```

## Working with Inboxes

### Listing Emails

```csharp
var emails = await inbox.GetEmailsAsync();

Console.WriteLine($"{emails.Count} emails in inbox");

foreach (var email in emails)
{
    Console.WriteLine($"{email.From}: {email.Subject}");
}
```

### Getting a Specific Email

```csharp
var email = await inbox.GetEmailAsync(emailId);

Console.WriteLine(email.Subject);
Console.WriteLine(email.Text);
```

### Waiting for Emails

```csharp
// Wait for any email
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(30)
});

// Wait for specific email
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(30),
    Subject = "Password Reset",
    From = "noreply@example.com"
});
```

### Deleting Emails

```csharp
// Delete specific email
await inbox.DeleteEmailAsync(emailId);
```

### Deleting Inbox

Inboxes can be deleted via the client or by disposing them:

```csharp
// Delete inbox via client
await client.DeleteInboxAsync(inbox.EmailAddress);

// Or dispose the inbox (stops subscription but doesn't delete from server)
await inbox.DisposeAsync();
```

## Inbox Isolation

Each inbox is completely isolated:

```csharp
var inbox1 = await client.CreateInboxAsync();
var inbox2 = await client.CreateInboxAsync();

// inbox1 cannot access inbox2's emails
// inbox2 cannot access inbox1's emails

// Each has its own:
// - Email address
// - Encryption keys
// - Email storage
// - Expiration time
```

## Time-to-Live (TTL)

Inboxes automatically expire after their TTL:

### Default TTL

```csharp
// Uses server's default TTL (1 hour)
var inbox = await client.CreateInboxAsync();
```

### Custom TTL

```csharp
// Expire after 1 hour
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromHours(1)
});

// Expire after 10 minutes (useful for quick tests)
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromMinutes(10)
});

// Expire after 7 days
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromDays(7)
});
```

### Checking Expiration

```csharp
var timeLeft = inbox.ExpiresAt - DateTimeOffset.UtcNow;

if (timeLeft < TimeSpan.FromMinutes(5))
{
    Console.WriteLine("Inbox expiring soon!");
}
```

## Import and Export

Inboxes can be exported and imported for:

- Test reproducibility
- Sharing between environments
- Backup and restore

### Export

```csharp
var exportData = await inbox.ExportAsync();

// Save to file
await File.WriteAllTextAsync("inbox.json", JsonSerializer.Serialize(exportData));
```

### Import

```csharp
var json = await File.ReadAllTextAsync("inbox.json");
var exportData = JsonSerializer.Deserialize<InboxExport>(json);

var inbox = await client.ImportInboxAsync(exportData!);

// Inbox restored with all encryption keys
```

### File-Based Export/Import

The client also provides convenient file-based methods:

```csharp
// Export to file
await client.ExportInboxToFileAsync(inbox, "inbox.json");

// Import from file
var inbox = await client.ImportInboxFromFileAsync("inbox.json");
```

**Security Warning**: Exported data contains private keys. Treat as sensitive.

## Best Practices

### CI/CD Pipelines

**Short TTL for fast cleanup**:

```csharp
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromHours(1)
});
```

**Always clean up**:

```csharp
var inbox = await client.CreateInboxAsync();
try
{
    // Run tests
}
finally
{
    await client.DeleteInboxAsync(inbox.EmailAddress);
}
```

### Manual Testing

**Longer TTL for convenience**:

```csharp
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromDays(1)
});
```

**Export for reuse**:

```csharp
// Export after creating
var exportData = await inbox.ExportAsync();
await File.WriteAllTextAsync("test-inbox.json", JsonSerializer.Serialize(exportData));

// Reuse in later sessions
var json = await File.ReadAllTextAsync("test-inbox.json");
var importData = JsonSerializer.Deserialize<InboxExport>(json);
var inbox = await client.ImportInboxAsync(importData!);
```

### Production Monitoring

**Monitor expiration**:

```csharp
var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));

while (await timer.WaitForNextTickAsync())
{
    var timeLeft = inbox.ExpiresAt - DateTimeOffset.UtcNow;
    if (timeLeft < TimeSpan.FromMinutes(10))
    {
        Console.WriteLine($"Inbox {inbox.EmailAddress} expiring in {timeLeft.TotalMinutes:F0} minutes");
    }
}
```

## Common Patterns

### Dedicated Test Inbox (xUnit)

```csharp
public class EmailTests : IAsyncLifetime
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;

    public async Task InitializeAsync()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(url)
            .WithApiKey(apiKey)
            .Build();

        _inbox = await _client.CreateInboxAsync(new CreateInboxOptions
        {
            Ttl = TimeSpan.FromHours(2)
        });
    }

    public async Task DisposeAsync()
    {
        await _client.DeleteInboxAsync(_inbox.EmailAddress);
        await _client.DisposeAsync();
    }

    [Fact]
    public async Task Password_Reset_Should_Send_Email()
    {
        await TriggerPasswordReset(_inbox.EmailAddress);

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10)
        });

        Assert.NotNull(email);
    }
}
```

### Dedicated Test Inbox (NUnit)

```csharp
[TestFixture]
public class EmailTests
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;

    [OneTimeSetUp]
    public async Task SetUp()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(url)
            .WithApiKey(apiKey)
            .Build();

        _inbox = await _client.CreateInboxAsync(new CreateInboxOptions
        {
            Ttl = TimeSpan.FromHours(2)
        });
    }

    [OneTimeTearDown]
    public async Task TearDown()
    {
        await _client.DeleteInboxAsync(_inbox.EmailAddress);
        await _client.DisposeAsync();
    }

    [Test]
    public async Task Password_Reset_Should_Send_Email()
    {
        await TriggerPasswordReset(_inbox.EmailAddress);

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10)
        });

        Assert.That(email, Is.Not.Null);
    }
}
```

### Multiple Inboxes

```csharp
var user1Inbox = await client.CreateInboxAsync();
var user2Inbox = await client.CreateInboxAsync();
var adminInbox = await client.CreateInboxAsync();

// Each inbox receives emails independently
await SendWelcomeEmail(user1Inbox.EmailAddress);
await SendWelcomeEmail(user2Inbox.EmailAddress);
await SendAdminReport(adminInbox.EmailAddress);
```

### Inbox Pool

```csharp
public class InboxPool : IAsyncDisposable
{
    private readonly IVaultSandboxClient _client;
    private readonly ConcurrentQueue<IInbox> _pool = new();
    private readonly int _size;

    public InboxPool(IVaultSandboxClient client, int size = 5)
    {
        _client = client;
        _size = size;
    }

    public async Task InitializeAsync()
    {
        for (var i = 0; i < _size; i++)
        {
            var inbox = await _client.CreateInboxAsync();
            _pool.Enqueue(inbox);
        }
    }

    public IInbox? Get()
    {
        return _pool.TryDequeue(out var inbox) ? inbox : null;
    }

    public async ValueTask DisposeAsync()
    {
        while (_pool.TryDequeue(out var inbox))
        {
            await _client.DeleteInboxAsync(inbox.EmailAddress);
        }
    }
}
```

## Troubleshooting

### Inbox Not Receiving Emails

**Check**:

1. Email is sent to correct address
2. Inbox hasn't expired
3. DNS/MX records configured correctly
4. SMTP connection successful

```csharp
// Verify inbox still exists
try
{
    var emails = await inbox.GetEmailsAsync();  // Will throw if inbox expired
}
catch (InboxNotFoundException)
{
    Console.WriteLine("Inbox has expired");
}
```

### Inbox Already Exists Error

When requesting a specific email address:

```csharp
try
{
    var inbox = await client.CreateInboxAsync(new CreateInboxOptions
    {
        EmailAddress = "test@mail.example.com"
    });
}
catch (InboxAlreadyExistsException)
{
    // Address already in use, generate random instead
    var inbox = await client.CreateInboxAsync();
}
```

### Inbox Expired

```csharp
try
{
    var emails = await inbox.GetEmailsAsync();
}
catch (InboxNotFoundException)
{
    Console.WriteLine("Inbox has expired");
    // Create new inbox
    var newInbox = await client.CreateInboxAsync();
}
```

## Next Steps

- **[Email Objects](/client-dotnet/concepts/emails/)** - Learn about email structure
- **[Managing Inboxes](/client-dotnet/guides/managing-inboxes/)** - Common inbox operations
- **[Import/Export](/client-dotnet/advanced/import-export/)** - Advanced inbox persistence
- **[API Reference: Inbox](/client-dotnet/api/inbox/)** - Complete API documentation
