---
title: Managing Inboxes
description: Common operations for creating, using, and deleting inboxes
---

This guide covers common inbox management operations with practical examples.

## Creating Inboxes

### Basic Creation

```csharp
using VaultSandbox.Client;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .Build();

var inbox = await client.CreateInboxAsync();
Console.WriteLine($"Email address: {inbox.EmailAddress}");
```

### With Custom TTL

```csharp
// Expire after 1 hour (good for CI/CD)
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromHours(1)
});

// Expire after 10 minutes (quick tests)
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromMinutes(10)
});

// Expire after 7 days (long-running tests)
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromDays(7)
});
```

### Requesting Specific Address

```csharp
try
{
    var inbox = await client.CreateInboxAsync(new CreateInboxOptions
    {
        EmailAddress = "test@mail.example.com"
    });
    Console.WriteLine($"Got requested address: {inbox.EmailAddress}");
}
catch (InboxAlreadyExistsException)
{
    Console.WriteLine("Address already in use, using random address");
    var inbox = await client.CreateInboxAsync();
}
```

## Listing Emails

### List All Emails

```csharp
var emails = await inbox.GetEmailsAsync();

Console.WriteLine($"Inbox contains {emails.Count} emails");
foreach (var email in emails)
{
    Console.WriteLine($"- {email.From}: {email.Subject}");
}
```

### Filtering Emails

```csharp
var emails = await inbox.GetEmailsAsync();

// Filter by sender
var fromSupport = emails.Where(e => e.From == "support@example.com");

// Filter by subject
var passwordResets = emails.Where(e =>
    Regex.IsMatch(e.Subject, "reset", RegexOptions.IgnoreCase));

// Filter by date
var recentEmails = emails.Where(e =>
    DateTimeOffset.UtcNow - e.ReceivedAt < TimeSpan.FromHours(1));
```

### Sorting Emails

```csharp
var emails = await inbox.GetEmailsAsync();

// Sort by date (newest first)
var sortedByDate = emails.OrderByDescending(e => e.ReceivedAt);

// Sort by sender
var sortedBySender = emails.OrderBy(e => e.From);
```

## Getting Specific Emails

### By ID

```csharp
var emailId = "email_abc123";
var email = await inbox.GetEmailAsync(emailId);

Console.WriteLine(email.Subject);
```

### With Error Handling

```csharp
try
{
    var email = await inbox.GetEmailAsync(emailId);
    Console.WriteLine($"Found: {email.Subject}");
}
catch (EmailNotFoundException)
{
    Console.WriteLine("Email not found");
}
```

## Deleting Emails

### Delete Single Email

```csharp
// By ID
await inbox.DeleteEmailAsync("email_abc123");

// Via email object
var email = await inbox.GetEmailAsync("email_abc123");
await email.DeleteAsync();
```

### Delete Multiple Emails

```csharp
var emails = await inbox.GetEmailsAsync();

// Delete all emails sequentially
foreach (var email in emails)
{
    await email.DeleteAsync();
}

// Or in parallel
await Task.WhenAll(emails.Select(email => email.DeleteAsync()));
```

### Delete by Criteria

```csharp
var emails = await inbox.GetEmailsAsync();

// Delete old emails (older than 24 hours)
var oldEmails = emails.Where(e =>
    DateTimeOffset.UtcNow - e.ReceivedAt > TimeSpan.FromHours(24));

await Task.WhenAll(oldEmails.Select(email => email.DeleteAsync()));
```

## Deleting Inboxes

### Delete Single Inbox

```csharp
await client.DeleteInboxAsync(inbox.EmailAddress);

// Inbox and all emails are now deleted
```

### Delete All Inboxes

```csharp
// Delete all inboxes for this API key
var count = await client.DeleteAllInboxesAsync();
Console.WriteLine($"Deleted {count} inboxes");
```

### Safe Deletion with Cleanup

```csharp
async Task WithInboxAsync(IVaultSandboxClient client, Func<IInbox, Task> action)
{
    var inbox = await client.CreateInboxAsync();
    try
    {
        await action(inbox);
    }
    finally
    {
        await client.DeleteInboxAsync(inbox.EmailAddress);
    }
}

// Usage
await WithInboxAsync(client, async inbox =>
{
    await SendTestEmailAsync(inbox.EmailAddress);
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });
    Assert.Contains("Test", email.Subject);
});
```

## Checking Inbox Status

### Check if Inbox Exists

```csharp
try
{
    var emails = await inbox.GetEmailsAsync();
    Console.WriteLine("Inbox exists");
}
catch (InboxNotFoundException)
{
    Console.WriteLine("Inbox expired or deleted");
}
```

### Check Expiration

```csharp
var expiresIn = inbox.ExpiresAt - DateTimeOffset.UtcNow;

if (expiresIn < TimeSpan.FromMinutes(5))
{
    Console.WriteLine("Inbox expiring soon!");
    Console.WriteLine($"Time left: {expiresIn.TotalMinutes:F0} minutes");
}
```

### Get Sync Status

```csharp
var syncStatus = await inbox.GetSyncStatusAsync();

Console.WriteLine($"Email count: {syncStatus.EmailCount}");
Console.WriteLine($"Emails hash: {syncStatus.EmailsHash}");
```

## Bulk Operations

### Create Multiple Inboxes

```csharp
var inboxes = await Task.WhenAll(
    client.CreateInboxAsync(),
    client.CreateInboxAsync(),
    client.CreateInboxAsync());

Console.WriteLine($"Created {inboxes.Length} inboxes");
foreach (var inbox in inboxes)
{
    Console.WriteLine($"- {inbox.EmailAddress}");
}
```

### Clean Up Multiple Inboxes

```csharp
// Delete all
await Task.WhenAll(inboxes.Select(inbox => client.DeleteInboxAsync(inbox.EmailAddress)));

// Or use convenience method
await client.DeleteAllInboxesAsync();
```

## Testing Patterns

### xUnit Setup/Teardown

```csharp
public class EmailTests : IAsyncLifetime
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;

    public async Task InitializeAsync()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
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
    public async Task Receives_Email()
    {
        await SendEmailAsync(_inbox.EmailAddress);
        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10)
        });
        Assert.NotNull(email);
    }
}
```

### Shared Client with Collection Fixture

```csharp
public class VaultSandboxFixture : IAsyncLifetime
{
    public IVaultSandboxClient Client { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
            .Build();

        await Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        await Client.DeleteAllInboxesAsync();
    }
}

[CollectionDefinition("VaultSandbox")]
public class VaultSandboxCollection : ICollectionFixture<VaultSandboxFixture> { }

[Collection("VaultSandbox")]
public class EmailTests
{
    private readonly IVaultSandboxClient _client;

    public EmailTests(VaultSandboxFixture fixture)
    {
        _client = fixture.Client;
    }

    [Fact]
    public async Task Test_Email_Flow()
    {
        var inbox = await _client.CreateInboxAsync();
        try
        {
            // Use inbox
        }
        finally
        {
            await _client.DeleteInboxAsync(inbox.EmailAddress);
        }
    }
}
```

### Shared Inbox Pattern

```csharp
public class EmailSuite : IAsyncLifetime
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;

    public async Task InitializeAsync()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
            .Build();

        _inbox = await _client.CreateInboxAsync(new CreateInboxOptions
        {
            Ttl = TimeSpan.FromHours(2)
        });
    }

    public async Task DisposeAsync()
    {
        if (_inbox != null)
        {
            await _client.DeleteInboxAsync(_inbox.EmailAddress);
        }
    }

    [Fact]
    public async Task Test_1()
    {
        // Use shared _inbox
    }

    [Fact]
    public async Task Test_2()
    {
        // Use shared _inbox
    }
}
```

### Inbox Pool Pattern

```csharp
public class InboxPool : IAsyncDisposable
{
    private readonly IVaultSandboxClient _client;
    private readonly int _size;
    private readonly Queue<IInbox> _available = new();
    private readonly HashSet<IInbox> _inUse = [];

    public InboxPool(IVaultSandboxClient client, int size = 5)
    {
        _client = client;
        _size = size;
    }

    public async Task InitializeAsync()
    {
        var inboxes = await Task.WhenAll(
            Enumerable.Range(0, _size).Select(_ => _client.CreateInboxAsync()));

        foreach (var inbox in inboxes)
        {
            _available.Enqueue(inbox);
        }
    }

    public IInbox Acquire()
    {
        if (_available.Count == 0)
        {
            throw new InvalidOperationException("No inboxes available");
        }

        var inbox = _available.Dequeue();
        _inUse.Add(inbox);
        return inbox;
    }

    public void Release(IInbox inbox)
    {
        _inUse.Remove(inbox);
        _available.Enqueue(inbox);
    }

    public async ValueTask DisposeAsync()
    {
        var all = _available.Concat(_inUse);
        await Task.WhenAll(all.Select(inbox => _client.DeleteInboxAsync(inbox.EmailAddress)));
    }
}

// Usage
await using var pool = new InboxPool(client, 5);
await pool.InitializeAsync();

var inbox = pool.Acquire();
// Use inbox
pool.Release(inbox);
```

### NUnit Setup/Teardown

```csharp
[TestFixture]
public class EmailTests
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;

    [OneTimeSetUp]
    public void OneTimeSetUp()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
            .Build();
    }

    [SetUp]
    public async Task SetUp()
    {
        _inbox = await _client.CreateInboxAsync();
    }

    [TearDown]
    public async Task TearDown()
    {
        if (_inbox != null)
        {
            await _client.DeleteInboxAsync(_inbox.EmailAddress);
        }
    }

    [Test]
    public async Task Receives_Email()
    {
        await SendEmailAsync(_inbox.EmailAddress);
        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10)
        });
        Assert.That(email, Is.Not.Null);
    }
}
```

## Error Handling

### Handling Expired Inboxes

```csharp
try
{
    var emails = await inbox.GetEmailsAsync();
}
catch (InboxNotFoundException)
{
    Console.WriteLine("Inbox expired, creating new one");
    inbox = await client.CreateInboxAsync();
}
```

### Handling Creation Errors

```csharp
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
```

## Best Practices

### Always Clean Up

```csharp
// Good: Cleanup in finally block
var inbox = await client.CreateInboxAsync();
try
{
    // Use inbox
}
finally
{
    await client.DeleteInboxAsync(inbox.EmailAddress);
}

// Bad: No cleanup
var inbox = await client.CreateInboxAsync();
// Use inbox
// Inbox never deleted
```

### Use Appropriate TTL

```csharp
// Good: Short TTL for CI/CD
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromHours(1)
});

// Bad: Long TTL wastes resources
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Ttl = TimeSpan.FromDays(7)  // 7 days for a quick test
});
```

### Handle Cleanup Errors

```csharp
async Task SafeDeleteAsync(IVaultSandboxClient client, IInbox inbox)
{
    try
    {
        await client.DeleteInboxAsync(inbox.EmailAddress);
    }
    catch (InboxNotFoundException)
    {
        // Inbox may have already expired - this is fine
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error deleting inbox: {ex.Message}");
    }
}
```

### Use IAsyncDisposable Pattern

```csharp
public class EmailTestContext : IAsyncDisposable
{
    public IVaultSandboxClient Client { get; }
    public IInbox Inbox { get; private set; } = null!;

    public EmailTestContext(IVaultSandboxClient client)
    {
        Client = client;
    }

    public async Task InitializeAsync()
    {
        Inbox = await Client.CreateInboxAsync();
    }

    public async ValueTask DisposeAsync()
    {
        if (Inbox != null)
        {
            await Client.DeleteInboxAsync(Inbox.EmailAddress);
        }
    }
}

// Usage
await using var context = new EmailTestContext(client);
await context.InitializeAsync();

// Use context.Inbox
await SendEmailAsync(context.Inbox.EmailAddress);
```

## Dependency Injection

### Register with IServiceCollection

```csharp
services.AddVaultSandboxClient(options =>
{
    options.BaseUrl = configuration["VaultSandbox:BaseUrl"]!;
    options.ApiKey = configuration["VaultSandbox:ApiKey"]!;
});

// Or from configuration section
services.AddVaultSandboxClient(configuration.GetSection("VaultSandbox"));
```

### Inject in Controllers/Services

```csharp
public class EmailService
{
    private readonly IVaultSandboxClient _client;

    public EmailService(IVaultSandboxClient client)
    {
        _client = client;
    }

    public async Task<string> CreateTestInboxAsync()
    {
        var inbox = await _client.CreateInboxAsync(new CreateInboxOptions
        {
            Ttl = TimeSpan.FromMinutes(30)
        });
        return inbox.EmailAddress;
    }
}
```

## Next Steps

- **[Waiting for Emails](/client-dotnet/guides/waiting-for-emails/)** - Learn about email waiting strategies
- **[Real-time Monitoring](/client-dotnet/guides/real-time/)** - Subscribe to new emails
- **[API Reference: Inbox](/client-dotnet/api/inbox/)** - Complete inbox API documentation
- **[Core Concepts: Inboxes](/client-dotnet/concepts/inboxes/)** - Deep dive into inbox concepts
