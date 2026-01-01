---
title: Email Objects
description: Understanding email objects and their properties in VaultSandbox
---

Email objects in VaultSandbox represent decrypted emails with all their content, headers, and metadata.

## Email Structure

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(30)
});

Console.WriteLine(email.Id);           // "email_abc123"
Console.WriteLine(email.From);         // "sender@example.com"
Console.WriteLine(email.To);           // ["recipient@mail.example.com"]
Console.WriteLine(email.Subject);      // "Welcome to our service"
Console.WriteLine(email.Text);         // Plain text content
Console.WriteLine(email.Html);         // HTML content
Console.WriteLine(email.ReceivedAt);   // DateTimeOffset
Console.WriteLine(email.IsRead);       // false
Console.WriteLine(email.Links);        // ["https://example.com/verify"]
Console.WriteLine(email.Attachments);  // IReadOnlyList<EmailAttachment>
Console.WriteLine(email.AuthResults);  // SPF/DKIM/DMARC results
```

## Core Properties

### Id

**Type**: `string`

Unique identifier for the email.

```csharp
var emailId = email.Id;
// Later...
var sameEmail = await inbox.GetEmailAsync(emailId);
```

### From

**Type**: `string`

Sender's email address (from the `From` header).

```csharp
Console.WriteLine(email.From);  // "noreply@example.com"

// Use in assertions (xUnit)
Assert.Equal("support@example.com", email.From);
```

### To

**Type**: `IReadOnlyList<string>`

List of recipient email addresses.

```csharp
Console.WriteLine(email.To[0]);  // "user@mail.example.com"

// Multiple recipients
foreach (var recipient in email.To)
{
    Console.WriteLine(recipient);
}

// Check if sent to specific address
Assert.Contains(inbox.EmailAddress, email.To);
```

### Subject

**Type**: `string`

Email subject line.

```csharp
Console.WriteLine(email.Subject);  // "Password Reset Request"

// Use in filtering
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Subject = "Password Reset"
});
```

### Text

**Type**: `string?`

Plain text content of the email.

```csharp
Console.WriteLine(email.Text);
// "Hello,\n\nClick here to reset your password:\nhttps://..."

// May be null if email is HTML-only
if (email.Text is not null)
{
    Assert.Contains("reset your password", email.Text);
}
```

### Html

**Type**: `string?`

HTML content of the email.

```csharp
Console.WriteLine(email.Html);
// "<html><body><p>Hello,</p><a href='https://...'>Reset Password</a></body></html>"

// May be null if email is plain text only
if (email.Html is not null)
{
    Assert.Contains("<a href", email.Html);
}
```

### ReceivedAt

**Type**: `DateTimeOffset`

When the email was received by the gateway.

```csharp
Console.WriteLine(email.ReceivedAt);  // 2024-01-15T12:00:00.000+00:00

// Check if email arrived recently
var age = DateTimeOffset.UtcNow - email.ReceivedAt;
Assert.True(age < TimeSpan.FromMinutes(1));  // Received within last minute
```

### IsRead

**Type**: `bool`

Whether the email has been marked as read.

```csharp
Console.WriteLine(email.IsRead);  // false

// Mark as read using instance method
await email.MarkAsReadAsync();

Console.WriteLine(email.IsRead);  // true
```

### Links

**Type**: `IReadOnlyList<string>?`

All URLs extracted from the email (text and HTML).

```csharp
if (email.Links is not null)
{
    foreach (var link in email.Links)
    {
        Console.WriteLine(link);
    }
    // https://example.com/verify?token=abc123
    // https://example.com/unsubscribe
    // https://example.com/privacy

    // Find specific link
    var verifyLink = email.Links.FirstOrDefault(url => url.Contains("/verify"));
    Assert.NotNull(verifyLink);

    // Test link
    using var httpClient = new HttpClient();
    var response = await httpClient.GetAsync(verifyLink);
    Assert.True(response.IsSuccessStatusCode);
}
```

### Attachments

**Type**: `IReadOnlyList<EmailAttachment>?`

List of email attachments.

```csharp
if (email.Attachments is not null)
{
    Console.WriteLine($"{email.Attachments.Count} attachments");

    foreach (var attachment in email.Attachments)
    {
        Console.WriteLine(attachment.Filename);     // "invoice.pdf"
        Console.WriteLine(attachment.ContentType);  // "application/pdf"
        Console.WriteLine(attachment.Size);         // 15234 bytes
        Console.WriteLine(attachment.Content);      // byte[]
    }
}
```

See [Working with Attachments](/client-dotnet/guides/attachments/) for details.

### AuthResults

**Type**: `AuthenticationResults?`

Email authentication results (SPF, DKIM, DMARC, reverse DNS).

```csharp
if (email.AuthResults is not null)
{
    Console.WriteLine($"SPF: {email.AuthResults.Spf?.Result}");
    Console.WriteLine($"DKIM: {email.AuthResults.Dkim?.FirstOrDefault()?.Result}");
    Console.WriteLine($"DMARC: {email.AuthResults.Dmarc?.Result}");

    // Validate all checks
    var validation = email.AuthResults.Validate();
    if (!validation.Passed)
    {
        Console.WriteLine($"Authentication failed: {string.Join(", ", validation.Failures)}");
    }
}
```

See [Authentication Results](/client-dotnet/concepts/auth-results/) for details.

### Headers

**Type**: `IReadOnlyDictionary<string, object>?`

All email headers. Values can be strings or complex objects depending on the header.

```csharp
if (email.Headers is not null)
{
    foreach (var (key, value) in email.Headers)
    {
        Console.WriteLine($"{key}: {value}");
    }
    // from: noreply@example.com
    // to: user@mail.example.com
    // subject: Welcome
    // message-id: <abc123@example.com>
    // date: Mon, 15 Jan 2024 12:00:00 +0000
    // content-type: text/html; charset=utf-8

    // Access specific headers
    if (email.Headers.TryGetValue("message-id", out var messageId))
    {
        Console.WriteLine($"Message ID: {messageId}");
    }
}
```

### Metadata

**Type**: `IReadOnlyDictionary<string, object>?`

Additional metadata associated with the email.

```csharp
if (email.Metadata?.TryGetValue("emailSizeBytes", out var size) == true)
{
    Console.WriteLine($"Email size: {size} bytes");
}
```

## Email Instance Methods

Emails retrieved through an inbox have instance methods for common operations:

### MarkAsReadAsync

Mark the email as read.

```csharp
await email.MarkAsReadAsync();
Console.WriteLine(email.IsRead);  // true
```

### DeleteAsync

Delete the email from the inbox.

```csharp
await email.DeleteAsync();
```

### GetRawAsync

Get the raw email source (decrypted MIME).

```csharp
var raw = await email.GetRawAsync();
Console.WriteLine(raw);
// "From: sender@example.com\r\nTo: recipient@example.com\r\n..."
```

## Inbox Methods for Emails

You can also use inbox methods to work with emails by ID:

### GetEmailAsync

Get a specific email by ID.

```csharp
var email = await inbox.GetEmailAsync(emailId);
Console.WriteLine(email.Subject);
```

### MarkAsReadAsync

Mark an email as read via the inbox.

```csharp
await inbox.MarkAsReadAsync(email.Id);
```

### DeleteEmailAsync

Delete an email from the inbox.

```csharp
await inbox.DeleteEmailAsync(email.Id);

// Email is now deleted
try
{
    await inbox.GetEmailAsync(email.Id);
}
catch (EmailNotFoundException)
{
    Console.WriteLine("Email deleted");
}
```

### GetEmailRawAsync

Get the raw source of an email.

```csharp
var raw = await inbox.GetEmailRawAsync(email.Id);
Console.WriteLine(raw);
// "From: sender@example.com\r\nTo: recipient@example.com\r\n..."
```

## Common Patterns

### Content Validation

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Subject = "Welcome",
    Timeout = TimeSpan.FromSeconds(10)
});

// Validate sender
Assert.Equal("noreply@example.com", email.From);

// Validate content
Assert.Contains("Thank you for signing up", email.Text!);
Assert.Contains("<h1>Welcome</h1>", email.Html!);

// Validate links
var verifyLink = email.Links?.FirstOrDefault(url => url.Contains("/verify"));
Assert.NotNull(verifyLink);
Assert.StartsWith("https://", verifyLink);
```

### Link Extraction and Testing

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Subject = "Reset"
});

// Extract reset link
var resetLink = email.Links?.FirstOrDefault(url =>
    url.Contains("reset-password") || url.Contains("token="));

Assert.NotNull(resetLink);

// Extract token from link
var uri = new Uri(resetLink);
var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
var token = query["token"];

Assert.NotNull(token);
Assert.True(token.Length > 20);

// Test the link
using var httpClient = new HttpClient();
var response = await httpClient.GetAsync(resetLink);
Assert.Equal(HttpStatusCode.OK, response.StatusCode);
```

### Multi-Part Emails

```csharp
// Email with both text and HTML
if (email.Text is not null && email.Html is not null)
{
    // Validate both versions have key content
    Assert.Contains("Welcome", email.Text);
    Assert.Contains("<h1>Welcome</h1>", email.Html);
}

// HTML-only email
if (email.Html is not null && email.Text is null)
{
    Console.WriteLine("HTML-only email");
    Assert.Contains("<!DOCTYPE html>", email.Html);
}

// Plain text only
if (email.Text is not null && email.Html is null)
{
    Console.WriteLine("Plain text email");
}
```

### Time-Based Assertions

```csharp
var startTime = DateTimeOffset.UtcNow;

// Trigger email
await SendWelcomeEmail(inbox.EmailAddress);

// Wait and receive
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

// Verify it arrived quickly
var deliveryTime = email.ReceivedAt - startTime;
Assert.True(deliveryTime < TimeSpan.FromSeconds(5));  // Within 5 seconds
```

### Email Metadata Analysis

```csharp
Console.WriteLine("Email details:");
Console.WriteLine($"- From: {email.From}");
Console.WriteLine($"- Subject: {email.Subject}");
Console.WriteLine($"- Received: {email.ReceivedAt:O}");
Console.WriteLine($"- Size: {email.Text?.Length ?? 0} chars");
Console.WriteLine($"- Links: {email.Links?.Count ?? 0}");
Console.WriteLine($"- Attachments: {email.Attachments?.Count ?? 0}");

// Check email authentication
if (email.AuthResults is not null)
{
    var auth = email.AuthResults.Validate();
    Console.WriteLine($"- Auth passed: {auth.Passed}");
    if (!auth.Passed)
    {
        Console.WriteLine($"- Auth failures: {string.Join(", ", auth.Failures)}");
    }
}
```

## Testing Examples

### xUnit Example

```csharp
public class WelcomeEmailTests : IAsyncLifetime
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;

    public async Task InitializeAsync()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(url)
            .WithApiKey(apiKey)
            .Build();
        _inbox = await _client.CreateInboxAsync();
    }

    public async Task DisposeAsync()
    {
        await _client.DeleteInboxAsync(_inbox.EmailAddress);
        await _client.DisposeAsync();
    }

    [Fact]
    public async Task Should_Send_Welcome_Email_On_Signup()
    {
        await RegisterUser(_inbox.EmailAddress);

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Subject = "Welcome",
            Timeout = TimeSpan.FromSeconds(10)
        });

        Assert.Equal("noreply@example.com", email.From);
        Assert.Contains("Welcome", email.Subject);
        Assert.Contains("Thank you for signing up", email.Text!);

        var verifyLink = email.Links?.FirstOrDefault(url => url.Contains("/verify"));
        Assert.NotNull(verifyLink);
    }

    [Fact]
    public async Task Should_Include_Unsubscribe_Link()
    {
        await RegisterUser(_inbox.EmailAddress);

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10)
        });

        var unsubLink = email.Links?.FirstOrDefault(url =>
            url.Contains("/unsubscribe") || url.Contains("list-unsubscribe"));

        Assert.NotNull(unsubLink);
    }
}
```

### NUnit Example

```csharp
[TestFixture]
public class PasswordResetTests
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
        _inbox = await _client.CreateInboxAsync();
    }

    [OneTimeTearDown]
    public async Task TearDown()
    {
        await _client.DeleteInboxAsync(_inbox.EmailAddress);
        await _client.DisposeAsync();
    }

    [Test]
    public async Task Should_Send_Reset_Email_With_Valid_Token()
    {
        await RequestPasswordReset(_inbox.EmailAddress);

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Subject = "reset",
            Timeout = TimeSpan.FromSeconds(10)
        });

        Assert.That(email.From, Is.EqualTo("security@example.com"));

        var resetLink = email.Links!.First();
        Assert.That(resetLink, Does.StartWith("https://"));
        Assert.That(resetLink, Does.Contain("token="));

        // Verify token format
        var uri = new Uri(resetLink);
        var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
        var token = query["token"];
        Assert.That(token, Has.Length.EqualTo(64));
    }
}
```

## Troubleshooting

### Email Content is Null

```csharp
if (email.Text is null && email.Html is null)
{
    Console.WriteLine("Email has no content");
    Console.WriteLine($"Headers: {string.Join(", ", email.Headers?.Keys ?? [])}");

    var raw = await email.GetRawAsync();
    Console.WriteLine($"Raw: {raw}");
}
```

### Links Not Extracted

```csharp
if (email.Links is null || email.Links.Count == 0)
{
    Console.WriteLine("No links found");
    Console.WriteLine($"Text: {email.Text}");
    Console.WriteLine($"HTML: {email.Html}");

    // Manually extract
    var urlRegex = new Regex(@"https?://[^\s]+", RegexOptions.IgnoreCase);
    var textLinks = email.Text is not null
        ? urlRegex.Matches(email.Text).Select(m => m.Value).ToList()
        : [];
    Console.WriteLine($"Manual extraction: {string.Join(", ", textLinks)}");
}
```

### Decryption Errors

```csharp
try
{
    var email = await inbox.GetEmailAsync(emailId);
}
catch (DecryptionException)
{
    Console.WriteLine("Failed to decrypt email");
    Console.WriteLine("This may indicate:");
    Console.WriteLine("- Wrong private key");
    Console.WriteLine("- Corrupted data");
    Console.WriteLine("- Server issue");
}
```

## Next Steps

- **[Authentication Results](/client-dotnet/concepts/auth-results/)** - Email authentication details
- **[Working with Attachments](/client-dotnet/guides/attachments/)** - Handle email attachments
- **[Email Authentication](/client-dotnet/guides/authentication/)** - Test SPF/DKIM/DMARC
- **[API Reference: Email](/client-dotnet/api/email/)** - Complete API documentation
