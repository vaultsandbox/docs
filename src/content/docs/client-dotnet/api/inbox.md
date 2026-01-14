---
title: IInbox API
description: Complete API reference for the IInbox interface and InboxMonitor
---

The `IInbox` interface represents a single email inbox in VaultSandbox. It provides methods for managing emails, waiting for new messages, and monitoring in real-time using `IAsyncEnumerable`.

## Properties

### EmailAddress

```csharp
string EmailAddress { get; }
```

The email address for this inbox. Use this address to send test emails.

#### Example

```csharp
var inbox = await client.CreateInboxAsync();
Console.WriteLine($"Send email to: {inbox.EmailAddress}");

// Use in your application
await emailService.SendWelcomeEmailAsync(inbox.EmailAddress);
```

---

### InboxHash

```csharp
string InboxHash { get; }
```

Unique identifier for this inbox. Used internally for API operations.

#### Example

```csharp
Console.WriteLine($"Inbox ID: {inbox.InboxHash}");
```

---

### ExpiresAt

```csharp
DateTimeOffset ExpiresAt { get; }
```

The date and time when this inbox will expire and be automatically deleted.

#### Example

```csharp
var inbox = await client.CreateInboxAsync();
Console.WriteLine($"Inbox expires at: {inbox.ExpiresAt:O}");

var timeUntilExpiry = inbox.ExpiresAt - DateTimeOffset.UtcNow;
Console.WriteLine($"Time remaining: {timeUntilExpiry.TotalSeconds:F0}s");
```

---

### IsDisposed

```csharp
bool IsDisposed { get; }
```

Indicates whether the inbox has been disposed. Once disposed, the inbox instance should no longer be used.

#### Example

```csharp
var inbox = await client.CreateInboxAsync();

// Use inbox...

await client.DeleteInboxAsync(inbox.EmailAddress);

if (inbox.IsDisposed)
{
    Console.WriteLine("Inbox has been disposed");
}
```

---

### EmailAuth

```csharp
bool EmailAuth { get; }
```

Indicates whether email authentication checks (SPF, DKIM, DMARC, PTR) are enabled for this inbox. When `false`, all authentication checks return `Skipped` status.

#### Example

```csharp
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    EmailAuth = false
});

Console.WriteLine($"Email auth enabled: {inbox.EmailAuth}");
// Email auth enabled: False
```

---

### Encrypted

```csharp
bool Encrypted { get; }
```

Indicates whether this inbox uses end-to-end encryption. When `true`, emails are encrypted client-side and the `ServerSigPk` property is available.

#### Example

```csharp
var inbox = await client.CreateInboxAsync();

Console.WriteLine($"Inbox encrypted: {inbox.Encrypted}");

// Check encryption status
if (inbox.Encrypted)
{
    Console.WriteLine("Emails are end-to-end encrypted");
}
else
{
    Console.WriteLine("Emails are stored in plain text on server");
}
```

## Methods

### GetEmailsAsync

Lists all emails in the inbox with full content. Emails are automatically decrypted.

```csharp
Task<IReadOnlyList<Email>> GetEmailsAsync(CancellationToken cancellationToken = default)
```

#### Returns

`Task<IReadOnlyList<Email>>` - List of decrypted email records with full content, sorted by received time (newest first)

#### Example

```csharp
var emails = await inbox.GetEmailsAsync();

Console.WriteLine($"Inbox has {emails.Count} emails");

foreach (var email in emails)
{
    Console.WriteLine($"- {email.Subject} from {email.From}");
    Console.WriteLine($"  Body: {email.Text?[..Math.Min(100, email.Text?.Length ?? 0)]}...");
}
```

---

### GetEmailsMetadataOnlyAsync

Lists all emails in the inbox with metadata only (no body content). This is more efficient when you only need basic email information like subject, sender, and received time.

```csharp
Task<IReadOnlyList<EmailMetadata>> GetEmailsMetadataOnlyAsync(CancellationToken cancellationToken = default)
```

#### Returns

`Task<IReadOnlyList<EmailMetadata>>` - List of email metadata records (without body content)

```csharp
public sealed record EmailMetadata(
    string Id,
    string From,
    string Subject,
    DateTimeOffset ReceivedAt,
    bool IsRead);
```

| Property     | Type             | Description                               |
| ------------ | ---------------- | ----------------------------------------- |
| `Id`         | `string`         | Unique identifier for the email           |
| `From`       | `string`         | Sender's email address                    |
| `Subject`    | `string`         | Email subject line                        |
| `ReceivedAt` | `DateTimeOffset` | When the email was received               |
| `IsRead`     | `bool`           | Whether the email has been marked as read |

#### Example

```csharp
// Get just metadata - more efficient for listing
var emailsMetadata = await inbox.GetEmailsMetadataOnlyAsync();

Console.WriteLine($"Inbox has {emailsMetadata.Count} emails");

foreach (var metadata in emailsMetadata)
{
    Console.WriteLine($"- [{(metadata.IsRead ? "Read" : "Unread")}] {metadata.Subject}");
    Console.WriteLine($"  From: {metadata.From} at {metadata.ReceivedAt:g}");
}

// Fetch full content only for emails you need
var importantEmail = emailsMetadata.FirstOrDefault(m => m.Subject.Contains("Important"));
if (importantEmail is not null)
{
    var fullEmail = await inbox.GetEmailAsync(importantEmail.Id);
    Console.WriteLine($"Body: {fullEmail.Text}");
}
```

#### When to Use

Use `GetEmailsMetadataOnlyAsync` when:

- You need to display a list of emails without their content
- You want to filter emails before fetching full content
- You're building a UI that shows email summaries
- Performance is important and you don't need email bodies

Use `GetEmailsAsync` when:

- You need access to email body (`Text`, `Html`)
- You need attachments, links, or headers
- You're processing all emails and need their full content

---

### GetEmailAsync

Retrieves a specific email by ID.

```csharp
Task<Email> GetEmailAsync(string emailId, CancellationToken cancellationToken = default)
```

#### Parameters

- `emailId`: The unique identifier for the email
- `cancellationToken`: Cancellation token for the operation

#### Returns

`Task<Email>` - The decrypted email record

#### Example

```csharp
var emails = await inbox.GetEmailsAsync();
var firstEmail = await inbox.GetEmailAsync(emails[0].Id);

Console.WriteLine($"Subject: {firstEmail.Subject}");
Console.WriteLine($"Body: {firstEmail.Text}");
```

#### Errors

- `EmailNotFoundException` - Email does not exist

---

### GetEmailCountAsync

Gets the current number of emails in the inbox without fetching the full email data.

```csharp
Task<int> GetEmailCountAsync(CancellationToken cancellationToken = default)
```

#### Returns

`Task<int>` - The number of emails in the inbox

#### Example

```csharp
var count = await inbox.GetEmailCountAsync();
Console.WriteLine($"Inbox has {count} emails");

// Useful for checking if emails have arrived without fetching all data
if (count > 0)
{
    var emails = await inbox.GetEmailsAsync();
    // Process emails...
}
```

---

### WaitForEmailAsync

Waits for an email matching specified criteria. This is the recommended way to handle email arrival in tests.

```csharp
Task<Email> WaitForEmailAsync(
    WaitForEmailOptions? options = null,
    CancellationToken cancellationToken = default)
```

#### Parameters

- `options` (optional): Wait configuration options
- `cancellationToken`: Cancellation token for the operation

```csharp
public sealed class WaitForEmailOptions
{
    public TimeSpan? Timeout { get; set; }
    public TimeSpan? PollInterval { get; set; }
    public string? Subject { get; set; }
    public string? From { get; set; }
    public bool UseRegex { get; set; }
    public Func<Email, bool>? Predicate { get; set; }
}
```

| Property       | Type                 | Default | Description                                                         |
| -------------- | -------------------- | ------- | ------------------------------------------------------------------- |
| `Timeout`      | `TimeSpan?`          | 30s     | Maximum time to wait                                                |
| `PollInterval` | `TimeSpan?`          | 2s      | Polling interval                                                    |
| `Subject`      | `string?`            | -       | Filter by subject (exact match or regex based on `UseRegex`)        |
| `From`         | `string?`            | -       | Filter by sender address (exact match or regex based on `UseRegex`) |
| `UseRegex`     | `bool`               | `false` | When `true`, `Subject` and `From` are treated as regex patterns     |
| `Predicate`    | `Func<Email, bool>?` | -       | Custom filter function                                              |

#### Returns

`Task<Email>` - The first email matching the criteria

#### Examples

```csharp
// Wait for any email
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

// Wait for email with specific subject (exact match)
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "Password Reset"
});

// Wait for email with subject pattern (regex)
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "Password Reset",
    UseRegex = true
});

// Wait for email from specific sender
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    From = "noreply@example.com"
});

// Wait with custom predicate
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(15),
    Predicate = e => e.To.Contains("user@example.com")
});

// Combine multiple filters
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "Welcome",
    From = "noreply@",
    UseRegex = true,
    Predicate = e => e.Links.Count > 0
});
```

#### Errors

- `VaultSandboxTimeoutException` - No matching email received within timeout period

---

### WaitForEmailCountAsync

Waits until the inbox has at least the specified number of emails. More efficient than using arbitrary timeouts when testing multiple emails.

```csharp
Task WaitForEmailCountAsync(
    int count,
    WaitForEmailCountOptions? options = null,
    CancellationToken cancellationToken = default)
```

#### Parameters

- `count`: Minimum number of emails to wait for
- `options` (optional): Wait configuration options
- `cancellationToken`: Cancellation token for the operation

```csharp
public sealed class WaitForEmailCountOptions
{
    public TimeSpan? Timeout { get; set; }
}
```

| Property  | Type        | Default | Description          |
| --------- | ----------- | ------- | -------------------- |
| `Timeout` | `TimeSpan?` | 30s     | Maximum time to wait |

#### Returns

`Task` - Completes when the inbox has at least the specified number of emails

#### Example

```csharp
// Trigger multiple emails
await notificationService.SendMultipleNotificationsAsync(inbox.EmailAddress, 3);

// Wait for all 3 to arrive
await inbox.WaitForEmailCountAsync(3, new WaitForEmailCountOptions
{
    Timeout = TimeSpan.FromSeconds(30)
});

// Now process all emails
var emails = await inbox.GetEmailsAsync();
Assert.That(emails.Count, Is.GreaterThanOrEqualTo(3));
```

#### Errors

- `VaultSandboxTimeoutException` - Required count not reached within timeout

---

### WatchAsync

Streams new emails in real-time as they arrive. This is the .NET equivalent of event-based subscriptions.

```csharp
IAsyncEnumerable<Email> WatchAsync(CancellationToken cancellationToken = default)
```

#### Returns

`IAsyncEnumerable<Email>` - Async stream of emails as they arrive

#### Example

```csharp
var inbox = await client.CreateInboxAsync();

Console.WriteLine($"Monitoring: {inbox.EmailAddress}");

// Stream new emails using await foreach
await foreach (var email in inbox.WatchAsync(cancellationToken))
{
    Console.WriteLine($"New email: \"{email.Subject}\"");
    Console.WriteLine($"From: {email.From}");

    // Process email...
    if (email.Subject.Contains("Stop"))
    {
        break; // Exit the stream
    }
}
```

#### Best Practice

Use a `CancellationToken` to control the stream lifetime:

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));

try
{
    await foreach (var email in inbox.WatchAsync(cts.Token))
    {
        Console.WriteLine($"Received: {email.Subject}");
    }
}
catch (OperationCanceledException)
{
    Console.WriteLine("Monitoring stopped");
}
```

---

### GetSyncStatusAsync

Gets the current synchronization status of the inbox with the server.

```csharp
Task<InboxSyncStatus> GetSyncStatusAsync(CancellationToken cancellationToken = default)
```

#### Returns

`Task<InboxSyncStatus>` - Sync status information

```csharp
public sealed record InboxSyncStatus
{
    public required int EmailCount { get; init; }
    public required string EmailsHash { get; init; }
}
```

#### Example

```csharp
var status = await inbox.GetSyncStatusAsync();
Console.WriteLine($"Email count: {status.EmailCount}");
Console.WriteLine($"Emails hash: {status.EmailsHash}");
```

---

### GetEmailRawAsync

Gets the raw, decrypted source of a specific email (original MIME format).

```csharp
Task<string> GetEmailRawAsync(string emailId, CancellationToken cancellationToken = default)
```

#### Parameters

- `emailId`: The unique identifier for the email
- `cancellationToken`: Cancellation token for the operation

#### Returns

`Task<string>` - The raw MIME source of the email

#### Example

```csharp
var emails = await inbox.GetEmailsAsync();
var raw = await inbox.GetEmailRawAsync(emails[0].Id);

Console.WriteLine("Raw MIME source:");
Console.WriteLine(raw);

// Save to file for debugging
await File.WriteAllTextAsync("email.eml", raw);
```

---

### MarkAsReadAsync

Marks a specific email as read.

```csharp
Task MarkAsReadAsync(string emailId, CancellationToken cancellationToken = default)
```

#### Parameters

- `emailId`: The unique identifier for the email
- `cancellationToken`: Cancellation token for the operation

#### Example

```csharp
var emails = await inbox.GetEmailsAsync();
await inbox.MarkAsReadAsync(emails[0].Id);

Console.WriteLine("Email marked as read");
```

---

### DeleteEmailAsync

Deletes a specific email from the inbox.

```csharp
Task DeleteEmailAsync(string emailId, CancellationToken cancellationToken = default)
```

#### Parameters

- `emailId`: The unique identifier for the email
- `cancellationToken`: Cancellation token for the operation

#### Example

```csharp
var emails = await inbox.GetEmailsAsync();

// Delete first email
await inbox.DeleteEmailAsync(emails[0].Id);

Console.WriteLine("Email deleted");

// Verify deletion
var updated = await inbox.GetEmailsAsync();
Assert.That(updated.Count, Is.EqualTo(emails.Count - 1));
```

---

### Deleting an Inbox

To delete an inbox and all its emails, use the `DeleteInboxAsync` method on the client:

```csharp
await client.DeleteInboxAsync(inbox.EmailAddress);
```

#### Example

```csharp
var inbox = await client.CreateInboxAsync();

// Use inbox...

// Clean up
await client.DeleteInboxAsync(inbox.EmailAddress);
Console.WriteLine("Inbox deleted");
```

#### Best Practice

Always delete inboxes after tests:

```csharp
[TearDown]
public async Task Cleanup()
{
    if (_inbox is not null)
    {
        await _client.DeleteInboxAsync(_inbox.EmailAddress);
    }
}
```

---

### ExportAsync

Exports inbox data and encryption keys for backup or sharing.

```csharp
Task<InboxExport> ExportAsync()
```

#### Returns

`Task<InboxExport>` - Serializable inbox data including sensitive keys

```csharp
public sealed record InboxExport
{
    public int Version { get; init; } = 1;
    public required string EmailAddress { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
    public required string InboxHash { get; init; }
    public string? ServerSigPk { get; init; }  // Only present when inbox is encrypted
    public string? SecretKey { get; init; }    // Only present when inbox is encrypted
    public required bool Encrypted { get; init; }
    public required bool EmailAuth { get; init; }
    public required DateTimeOffset ExportedAt { get; init; }
}
```

**Note**: `ServerSigPk` and `SecretKey` are only present when `Encrypted` is `true`.

#### Example

```csharp
var inbox = await client.CreateInboxAsync();
var data = await inbox.ExportAsync();

// Save for later
var json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
await File.WriteAllTextAsync("inbox-backup.json", json);
```

#### Security Warning

Exported data contains private encryption keys. Store securely!

## Complete Inbox Example

```csharp
using System.Text.Json;
using VaultSandbox.Client;

async Task CompleteInboxExample(CancellationToken cancellationToken)
{
    var client = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"))
        .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY"))
        .Build();

    try
    {
        // Create inbox
        var inbox = await client.CreateInboxAsync(cancellationToken: cancellationToken);
        Console.WriteLine($"Created: {inbox.EmailAddress}");
        Console.WriteLine($"Expires: {inbox.ExpiresAt:O}");

        // Start watching for emails in a separate task
        var watchTask = Task.Run(async () =>
        {
            await foreach (var email in inbox.WatchAsync(cancellationToken))
            {
                Console.WriteLine($"Received: {email.Subject}");
            }
        }, cancellationToken);

        // Trigger test email
        await SendTestEmailAsync(inbox.EmailAddress);

        // Wait for specific email
        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Test",
            UseRegex = true
        }, cancellationToken);

        Console.WriteLine($"Found email: {email.Subject}");
        Console.WriteLine($"Body: {email.Text}");

        // Mark as read
        await inbox.MarkAsReadAsync(email.Id, cancellationToken);

        // Get all emails
        var allEmails = await inbox.GetEmailsAsync(cancellationToken);
        Console.WriteLine($"Total emails: {allEmails.Count}");

        // Export inbox
        var exportData = await inbox.ExportAsync();
        var json = JsonSerializer.Serialize(exportData);
        await File.WriteAllTextAsync("inbox.json", json, cancellationToken);

        // Clean up
        await client.DeleteInboxAsync(inbox.EmailAddress, cancellationToken);
    }
    finally
    {
        if (client is IAsyncDisposable disposable)
        {
            await disposable.DisposeAsync();
        }
    }
}
```

## Next Steps

- [Email API Reference](/client-dotnet/api/email/) - Work with email records
- [IVaultSandboxClient API](/client-dotnet/api/client/) - Learn about client methods
- [Waiting for Emails Guide](/client-dotnet/guides/waiting-for-emails/) - Best practices
- [Real-time Monitoring Guide](/client-dotnet/guides/real-time/) - IAsyncEnumerable patterns
