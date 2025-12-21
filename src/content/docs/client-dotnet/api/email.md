---
title: Email API
description: Complete API reference for the Email class and related types
---

The `Email` class represents a decrypted email message in VaultSandbox. All emails are automatically decrypted when retrieved, so you can access content, headers, links, and attachments directly.

## Properties

### Id

```csharp
string Id { get; }
```

Unique identifier for this email. Use this to reference the email in API calls.

#### Example

```csharp
var emails = await inbox.GetEmailsAsync();
Console.WriteLine($"Email ID: {emails[0].Id}");

// Get specific email
var email = await inbox.GetEmailAsync(emails[0].Id);
```

---

### InboxId

```csharp
string InboxId { get; }
```

The identifier of the parent inbox that received this email.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync();
Console.WriteLine($"Inbox ID: {email.InboxId}");
```

---

### From

```csharp
string From { get; }
```

The sender's email address.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});
Console.WriteLine($"From: {email.From}");

Assert.That(email.From, Is.EqualTo("noreply@example.com"));
```

---

### To

```csharp
IReadOnlyList<string> To { get; }
```

List of recipient email addresses.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});
Console.WriteLine($"To: {string.Join(", ", email.To)}");

// Check if specific recipient is included
Assert.That(email.To, Does.Contain(inbox.EmailAddress));
```

---

### Subject

```csharp
string Subject { get; }
```

The email subject line.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "Welcome",
    UseRegex = true
});

Console.WriteLine($"Subject: {email.Subject}");
Assert.That(email.Subject, Does.Contain("Welcome"));
```

---

### Text

```csharp
string? Text { get; }
```

Plain text content of the email. May be `null` if the email only has HTML content.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.Text is not null)
{
    Console.WriteLine("Plain text version:");
    Console.WriteLine(email.Text);

    // Validate content
    Assert.That(email.Text, Does.Contain("Thank you for signing up"));
}
```

---

### Html

```csharp
string? Html { get; }
```

HTML content of the email. May be `null` if the email only has plain text.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.Html is not null)
{
    Console.WriteLine("HTML version present");

    // Validate HTML structure
    Assert.That(email.Html, Does.Contain("<a href="));
    Assert.That(email.Html, Does.Contain("</html>"));

    // Check for specific elements
    Assert.That(email.Html, Does.Match(@"<img[^>]+src="""));
}
```

---

### ReceivedAt

```csharp
DateTimeOffset ReceivedAt { get; }
```

The date and time when the email was received by VaultSandbox.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});
Console.WriteLine($"Received at: {email.ReceivedAt:O}");

// Check if email was received recently
var age = DateTimeOffset.UtcNow - email.ReceivedAt;

Assert.That(age.TotalSeconds, Is.LessThan(60)); // Within last minute
```

---

### IsRead

```csharp
bool IsRead { get; }
```

Whether this email has been marked as read.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});
Console.WriteLine($"Read status: {email.IsRead}");

// Mark as read
await inbox.MarkAsReadAsync(email.Id);

// Verify status changed
var updated = await inbox.GetEmailAsync(email.Id);
Assert.That(updated.IsRead, Is.True);
```

---

### Links

```csharp
IReadOnlyList<string>? Links { get; }
```

All URLs automatically extracted from the email content (both text and HTML). May be `null` if no links were found.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "Password Reset",
    UseRegex = true
});

if (email.Links is { Count: > 0 })
{
    Console.WriteLine($"Found {email.Links.Count} links:");
    foreach (var url in email.Links)
    {
        Console.WriteLine($"  - {url}");
    }

    // Find specific link
    var resetLink = email.Links.FirstOrDefault(url => url.Contains("/reset-password"));
    Assert.That(resetLink, Is.Not.Null);
    Assert.That(resetLink, Does.StartWith("https://"));

    // Extract query parameters
    var uri = new Uri(resetLink);
    var queryParams = System.Web.HttpUtility.ParseQueryString(uri.Query);
    var token = queryParams["token"];
    Assert.That(token, Is.Not.Null.And.Not.Empty);
}
```

---

### Headers

```csharp
IReadOnlyDictionary<string, object>? Headers { get; }
```

All email headers as a key-value dictionary. Values can be strings or complex objects (e.g., arrays for multi-value headers like `Received`).

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

Console.WriteLine("Headers:");
Console.WriteLine($"  Content-Type: {email.Headers.GetValueOrDefault("content-type")}");
Console.WriteLine($"  Message-ID: {email.Headers.GetValueOrDefault("message-id")}");

// Check for custom headers
if (email.Headers.TryGetValue("x-custom-header", out var customValue))
{
    Console.WriteLine($"Custom header: {customValue}");
}
```

---

### Attachments

```csharp
IReadOnlyList<EmailAttachment>? Attachments { get; }
```

List of email attachments, automatically decrypted and ready to use. May be `null` if there are no attachments.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "Invoice",
    UseRegex = true
});

if (email.Attachments is not null)
{
    Console.WriteLine($"Attachments: {email.Attachments.Count}");

    foreach (var attachment in email.Attachments)
    {
        Console.WriteLine($"  - {attachment.Filename} ({attachment.Size} bytes)");
        Console.WriteLine($"    Type: {attachment.ContentType}");
    }

    // Find PDF attachment
    var pdf = email.Attachments.FirstOrDefault(a => a.ContentType == "application/pdf");
    if (pdf is not null)
    {
        await File.WriteAllBytesAsync($"./downloads/{pdf.Filename}", pdf.Content);
        Console.WriteLine($"Saved {pdf.Filename}");
    }

    // Process text attachment
    var textFile = email.Attachments.FirstOrDefault(a => a.ContentType.Contains("text"));
    if (textFile is not null)
    {
        var text = System.Text.Encoding.UTF8.GetString(textFile.Content);
        Console.WriteLine($"Text content: {text}");
    }

    // Parse JSON attachment
    var jsonFile = email.Attachments.FirstOrDefault(a => a.ContentType.Contains("json"));
    if (jsonFile is not null)
    {
        var json = System.Text.Encoding.UTF8.GetString(jsonFile.Content);
        var data = JsonSerializer.Deserialize<JsonDocument>(json);
        Console.WriteLine($"JSON data: {data}");
    }
}
```

See the [Attachments Guide](/client-dotnet/guides/attachments) for more examples.

---

### AuthResults

```csharp
AuthenticationResults? AuthResults { get; }
```

Email authentication results including SPF, DKIM, and DMARC validation.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.AuthResults is not null)
{
    // Validate all authentication
    var validation = email.AuthResults.Validate();
    Console.WriteLine($"Authentication passed: {validation.Passed}");

    if (!validation.Passed)
    {
        Console.WriteLine("Failures:");
        foreach (var failure in validation.Failures)
        {
            Console.WriteLine($"  - {failure}");
        }
    }

    // Check individual results
    if (email.AuthResults.Spf is not null)
    {
        Console.WriteLine($"SPF Status: {email.AuthResults.Spf.Status}");
    }

    if (email.AuthResults.Dkim?.Count > 0)
    {
        Console.WriteLine($"DKIM Status: {email.AuthResults.Dkim[0].Status}");
    }

    if (email.AuthResults.Dmarc is not null)
    {
        Console.WriteLine($"DMARC Status: {email.AuthResults.Dmarc.Status}");
    }
}
```

See the [Authentication Guide](/client-dotnet/guides/authentication) for more details.

---

### Metadata

```csharp
IReadOnlyDictionary<string, object>? Metadata { get; }
```

Additional metadata associated with the email.

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.Metadata is not null)
{
    Console.WriteLine("Metadata:");
    foreach (var (key, value) in email.Metadata)
    {
        Console.WriteLine($"  {key}: {value}");
    }
}
```

## Methods

Email instances retrieved through an inbox have access to convenience methods that operate on the email directly.

> **Note:** These methods require the email to be retrieved through an inbox (e.g., via `GetEmailsAsync()`, `WaitForEmailAsync()`, or `WatchAsync()`). Emails created manually or deserialized from JSON cannot use these methods.

### MarkAsReadAsync

Marks this email as read.

```csharp
Task MarkAsReadAsync(CancellationToken cancellationToken = default)
```

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

// Using the convenience method on Email
await email.MarkAsReadAsync();

// Equivalent to:
// await inbox.MarkAsReadAsync(email.Id);
```

---

### DeleteAsync

Deletes this email from the inbox.

```csharp
Task DeleteAsync(CancellationToken cancellationToken = default)
```

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

// Process the email...

// Delete using the convenience method
await email.DeleteAsync();

// Equivalent to:
// await inbox.DeleteEmailAsync(email.Id);
```

---

### GetRawAsync

Gets the raw MIME source of this email.

```csharp
Task<string> GetRawAsync(CancellationToken cancellationToken = default)
```

#### Returns

`Task<string>` - The raw email content in MIME format

#### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

// Get raw source using the convenience method
var raw = await email.GetRawAsync();

// Save to .eml file
await File.WriteAllTextAsync($"email-{email.Id}.eml", raw);

// Equivalent to:
// var raw = await inbox.GetEmailRawAsync(email.Id);
```

---

## EmailAttachment Record

Represents an email attachment.

```csharp
public sealed record EmailAttachment
{
    public required string Filename { get; init; }
    public required string ContentType { get; init; }
    public required long Size { get; init; }
    public required byte[] Content { get; init; }
    public string? ContentId { get; init; }
    public string? ContentDisposition { get; init; }
    public string? Checksum { get; init; }
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `Filename` | `string` | Original file name |
| `ContentType` | `string` | MIME type (e.g., `application/pdf`) |
| `Size` | `long` | Size in bytes |
| `Content` | `byte[]` | Binary content |
| `ContentId` | `string?` | Content-ID for inline attachments |
| `ContentDisposition` | `string?` | `inline` or `attachment` |
| `Checksum` | `string?` | SHA-256 hash of the content |

### Example

```csharp
foreach (var attachment in email.Attachments ?? [])
{
    Console.WriteLine($"File: {attachment.Filename}");
    Console.WriteLine($"Type: {attachment.ContentType}");
    Console.WriteLine($"Size: {attachment.Size} bytes");
    Console.WriteLine($"Disposition: {attachment.ContentDisposition}");
    Console.WriteLine($"Checksum: {attachment.Checksum}");

    // Save to disk
    await File.WriteAllBytesAsync(attachment.Filename, attachment.Content);

    // Verify checksum if available
    if (attachment.Checksum is not null)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var computedHash = Convert.ToHexString(sha256.ComputeHash(attachment.Content));
        Assert.That(computedHash, Is.EqualTo(attachment.Checksum).IgnoreCase);
    }
}
```

## AuthenticationResults Record

Email authentication validation results.

```csharp
public sealed record AuthenticationResults
{
    public SpfResult? Spf { get; init; }
    public IReadOnlyList<DkimResult>? Dkim { get; init; }
    public DmarcResult? Dmarc { get; init; }
    public ReverseDnsResult? ReverseDns { get; init; }

    public AuthValidation Validate();
}
```

### SpfResult

SPF (Sender Policy Framework) validation result.

```csharp
public sealed record SpfResult
{
    public required SpfStatus Status { get; init; }
    public string? Domain { get; init; }
    public string? Ip { get; init; }
    public string? Info { get; init; }
}

public enum SpfStatus
{
    Pass,
    Fail,
    SoftFail,
    Neutral,
    None,
    TempError,
    PermError
}
```

### DkimResult

DKIM (DomainKeys Identified Mail) validation result.

```csharp
public sealed record DkimResult
{
    public required DkimStatus Status { get; init; }
    public string? Domain { get; init; }
    public string? Selector { get; init; }
    public string? Info { get; init; }
}

public enum DkimStatus
{
    Pass,
    Fail,
    None
}
```

### DmarcResult

DMARC (Domain-based Message Authentication) validation result.

```csharp
public sealed record DmarcResult
{
    public required DmarcStatus Status { get; init; }
    public DmarcPolicy? Policy { get; init; }
    public bool? Aligned { get; init; }
    public string? Domain { get; init; }
    public string? Info { get; init; }
}

public enum DmarcStatus
{
    Pass,
    Fail,
    None
}

public enum DmarcPolicy
{
    None,
    Quarantine,
    Reject
}
```

### ReverseDnsResult

Reverse DNS lookup result.

```csharp
public sealed record ReverseDnsResult
{
    public required ReverseDnsStatus Status { get; init; }
    public string? Ip { get; init; }
    public string? Hostname { get; init; }
    public string? Info { get; init; }
}

public enum ReverseDnsStatus
{
    Pass,
    Fail,
    None
}
```

### AuthValidation

Summary of authentication validation.

```csharp
public sealed record AuthValidation
{
    public required bool Passed { get; init; }
    public required bool SpfPassed { get; init; }
    public required bool DkimPassed { get; init; }
    public required bool DmarcPassed { get; init; }
    public required bool ReverseDnsPassed { get; init; }
    public required IReadOnlyList<string> Failures { get; init; }
}
```

### Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.AuthResults is not null)
{
    var validation = email.AuthResults.Validate();

    Console.WriteLine($"Overall: {(validation.Passed ? "PASS" : "FAIL")}");
    Console.WriteLine($"SPF: {(validation.SpfPassed ? "PASS" : "FAIL")}");
    Console.WriteLine($"DKIM: {(validation.DkimPassed ? "PASS" : "FAIL")}");
    Console.WriteLine($"DMARC: {(validation.DmarcPassed ? "PASS" : "FAIL")}");

    if (!validation.Passed)
    {
        Console.WriteLine("\nFailures:");
        foreach (var failure in validation.Failures)
        {
            Console.WriteLine($"  - {failure}");
        }
    }
}
```

## Complete Example

```csharp
using System.Text.Json;
using System.Text.RegularExpressions;
using VaultSandbox.Client;

async Task CompleteEmailExample(CancellationToken cancellationToken)
{
    var client = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"))
        .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY"))
        .Build();

    try
    {
        var inbox = await client.CreateInboxAsync(cancellationToken: cancellationToken);
        Console.WriteLine($"Created inbox: {inbox.EmailAddress}");

        // Trigger test email
        await SendTestEmailAsync(inbox.EmailAddress);

        // Wait for email
        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Test",
            UseRegex = true
        }, cancellationToken);

        // Basic info
        Console.WriteLine("\n=== Email Details ===");
        Console.WriteLine($"ID: {email.Id}");
        Console.WriteLine($"From: {email.From}");
        Console.WriteLine($"To: {string.Join(", ", email.To)}");
        Console.WriteLine($"Subject: {email.Subject}");
        Console.WriteLine($"Received: {email.ReceivedAt:O}");
        Console.WriteLine($"Read: {email.IsRead}");

        // Content
        Console.WriteLine("\n=== Content ===");
        if (email.Text is not null)
        {
            Console.WriteLine("Plain text:");
            Console.WriteLine(email.Text[..Math.Min(200, email.Text.Length)] + "...");
        }
        if (email.Html is not null)
        {
            Console.WriteLine("HTML version present");
        }

        // Links
        Console.WriteLine("\n=== Links ===");
        Console.WriteLine($"Found {email.Links?.Count ?? 0} links:");
        foreach (var link in email.Links ?? [])
        {
            Console.WriteLine($"  - {link}");
        }

        // Attachments
        Console.WriteLine("\n=== Attachments ===");
        if (email.Attachments is not null)
        {
            Console.WriteLine($"Found {email.Attachments.Count} attachments:");
            foreach (var att in email.Attachments)
            {
                Console.WriteLine($"  - {att.Filename} ({att.ContentType}, {att.Size} bytes)");

                // Save attachment
                await File.WriteAllBytesAsync($"./downloads/{att.Filename}", att.Content, cancellationToken);
                Console.WriteLine($"    Saved to ./downloads/{att.Filename}");
            }
        }

        // Authentication
        Console.WriteLine("\n=== Authentication ===");
        if (email.AuthResults is not null)
        {
            var validation = email.AuthResults.Validate();
            Console.WriteLine($"Overall: {(validation.Passed ? "PASS" : "FAIL")}");
            Console.WriteLine($"SPF: {validation.SpfPassed}");
            Console.WriteLine($"DKIM: {validation.DkimPassed}");
            Console.WriteLine($"DMARC: {validation.DmarcPassed}");

            if (!validation.Passed)
            {
                Console.WriteLine($"Failures: {string.Join(", ", validation.Failures)}");
            }
        }

        // Mark as read
        await inbox.MarkAsReadAsync(email.Id, cancellationToken);
        Console.WriteLine("\nMarked as read");

        // Get raw source
        var raw = await inbox.GetEmailRawAsync(email.Id, cancellationToken);
        await File.WriteAllTextAsync($"email-{email.Id}.eml", raw, cancellationToken);
        Console.WriteLine($"Saved raw source to email-{email.Id}.eml");

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

- [IInbox API Reference](/client-dotnet/api/inbox) - Learn about inbox methods
- [Attachments Guide](/client-dotnet/guides/attachments) - Working with attachments
- [Authentication Guide](/client-dotnet/guides/authentication) - Email authentication testing
- [Waiting for Emails](/client-dotnet/guides/waiting-for-emails) - Best practices for email waiting
