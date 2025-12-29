---
title: Waiting for Emails
description: Efficiently wait for and filter emails in your tests
---

VaultSandbox provides powerful methods for waiting for emails with filtering and timeout support.

## Basic Waiting

### Wait for Any Email

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(30)
});

Console.WriteLine($"Received: {email.Subject}");
```

### With Default Timeout

```csharp
// Uses default 30 second timeout
var email = await inbox.WaitForEmailAsync();
```

## Filtering Options

### Filter by Subject

```csharp
// Exact match
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "Password Reset"
});

// Regex match
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "reset",
    UseRegex = true
});
```

### Filter by Sender

```csharp
// Exact match
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    From = "noreply@example.com"
});

// Regex match
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    From = @"@example\.com$",
    UseRegex = true
});
```

### Multiple Filters

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "welcome",
    UseRegex = true,
    From = "support@example.com"
});
```

### Custom Predicate

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Predicate = e => e.To.Contains("specific@example.com")
                     && e.Links?.Count > 0
                     && e.Subject.Contains("Verify")
});
```

## Waiting for Multiple Emails

### Wait for Specific Count

```csharp
// Trigger multiple emails
await SendNotificationsAsync(inbox.EmailAddress, 3);

// Wait for all 3 to arrive
await inbox.WaitForEmailCountAsync(3, new WaitForEmailCountOptions
{
    Timeout = TimeSpan.FromSeconds(30)
});

// Now list all emails
var emails = await inbox.GetEmailsAsync();
Assert.Equal(3, emails.Count);
```

### Process as They Arrive

```csharp
async Task<List<Email>> WaitForEmailsAsync(IInbox inbox, int count)
{
    var emails = new List<Email>();

    for (var i = 0; i < count; i++)
    {
        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(30)
        });
        emails.Add(email);
        Console.WriteLine($"Received {i + 1}/{count}: {email.Subject}");
    }

    return emails;
}

// Usage
var emails = await WaitForEmailsAsync(inbox, 3);
```

## Timeout Handling

### With Exception Handling

```csharp
try
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(5)
    });
    Console.WriteLine($"Email received: {email.Subject}");
}
catch (VaultSandboxTimeoutException)
{
    Console.WriteLine("No email received within 5 seconds");
}
```

### With CancellationToken

```csharp
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));

try
{
    var email = await inbox.WaitForEmailAsync(ct: cts.Token);
    Console.WriteLine($"Received: {email.Subject}");
}
catch (OperationCanceledException)
{
    Console.WriteLine("Operation was cancelled");
}
```

### With Fallback

```csharp
async Task<Email?> WaitForEmailWithFallbackAsync(
    IInbox inbox,
    WaitForEmailOptions options)
{
    try
    {
        return await inbox.WaitForEmailAsync(options);
    }
    catch (VaultSandboxTimeoutException)
    {
        Console.WriteLine("Timeout! Checking if email arrived anyway");
        var emails = await inbox.GetEmailsAsync();
        return emails.LastOrDefault();
    }
}
```

### Retry Pattern

```csharp
async Task<Email> WaitWithRetryAsync(
    IInbox inbox,
    WaitForEmailOptions options,
    int maxRetries = 3)
{
    for (var i = 0; i < maxRetries; i++)
    {
        try
        {
            return await inbox.WaitForEmailAsync(options);
        }
        catch (VaultSandboxTimeoutException) when (i < maxRetries - 1)
        {
            Console.WriteLine($"Attempt {i + 1} failed, retrying...");
        }
    }

    throw new VaultSandboxTimeoutException("Max retries exceeded", options.Timeout ?? TimeSpan.FromSeconds(30));
}
```

## Polling Configuration

### Custom Poll Interval

```csharp
// Poll every 500ms (more responsive)
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    PollInterval = TimeSpan.FromMilliseconds(500)
});

// Poll every 5 seconds (less frequent)
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromMinutes(1),
    PollInterval = TimeSpan.FromSeconds(5)
});
```

### Efficient Polling

```csharp
// For quick tests - poll frequently
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(5),
    PollInterval = TimeSpan.FromMilliseconds(200)
});

// For slow email services - poll less frequently
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromMinutes(2),
    PollInterval = TimeSpan.FromSeconds(10)
});
```

## Real-World Examples

### Password Reset Flow

```csharp
[Fact]
public async Task Password_Reset_Email_Contains_Valid_Link()
{
    // Trigger reset
    await _app.RequestPasswordResetAsync(inbox.EmailAddress);

    // Wait for reset email
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10),
        Subject = "reset",
        UseRegex = true,
        From = "security@example.com"
    });

    // Validate content
    Assert.Contains("Password Reset", email.Subject);
    Assert.NotEmpty(email.Links);

    // Extract and test link
    var resetLink = email.Links.FirstOrDefault(url => url.Contains("/reset"));
    Assert.NotNull(resetLink);
}
```

### Welcome Email with Verification

```csharp
[Fact]
public async Task Welcome_Email_With_Verification_Link()
{
    // Sign up
    await _app.SignupAsync(new SignupRequest
    {
        Email = inbox.EmailAddress,
        Name = "Test User"
    });

    // Wait for welcome email with verification link
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10),
        Subject = "welcome",
        UseRegex = true,
        Predicate = e => e.Links?.Any(link => link.Contains("/verify")) == true
    });

    // Extract verification link
    var verifyLink = email.Links.First(url => url.Contains("/verify"));

    // Test verification
    using var httpClient = new HttpClient();
    var response = await httpClient.GetAsync(verifyLink);
    Assert.True(response.IsSuccessStatusCode);
}
```

### Multi-Step Email Flow

```csharp
[Fact]
public async Task Order_Confirmation_And_Shipping_Notification()
{
    // Place order
    var orderId = await _app.PlaceOrderAsync(new OrderRequest
    {
        Email = inbox.EmailAddress,
        Items = ["widget"]
    });

    // Wait for confirmation
    var confirmation = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10),
        Subject = @"order.*confirmed",
        UseRegex = true
    });

    Assert.Contains("Order Confirmed", confirmation.Subject);
    Assert.Contains("Order #", confirmation.Text);

    // Simulate shipping
    await _app.ShipOrderAsync(orderId);

    // Wait for shipping notification
    var shipping = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10),
        Subject = "shipped",
        UseRegex = true
    });

    Assert.Contains("Shipped", shipping.Subject);
    Assert.Contains("tracking", shipping.Text, StringComparison.OrdinalIgnoreCase);
}
```

### Email with Attachments

```csharp
[Fact]
public async Task Invoice_Email_With_Pdf_Attachment()
{
    await _app.SendInvoiceAsync(inbox.EmailAddress);

    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10),
        Subject = "invoice",
        UseRegex = true,
        Predicate = e => e.Attachments?.Count > 0
    });

    // Validate attachment
    var pdf = email.Attachments?.FirstOrDefault(
        att => att.ContentType == "application/pdf");

    Assert.NotNull(pdf);
    Assert.Matches(@"(?i)invoice.*\.pdf", pdf.Filename);
    Assert.True(pdf.Size > 0);
}
```

## Advanced Patterns

### Wait for First Matching Email

```csharp
async Task<Email> WaitForFirstMatchAsync(
    IInbox inbox,
    IEnumerable<Func<Email, bool>> matchers,
    TimeSpan timeout)
{
    var startTime = DateTime.UtcNow;

    while (DateTime.UtcNow - startTime < timeout)
    {
        var emails = await inbox.GetEmailsAsync();

        foreach (var matcher in matchers)
        {
            var match = emails.FirstOrDefault(matcher);
            if (match != null) return match;
        }

        await Task.Delay(TimeSpan.FromSeconds(1));
    }

    throw new VaultSandboxTimeoutException("No matching email found", timeout);
}

// Usage
var email = await WaitForFirstMatchAsync(inbox,
[
    e => e.Subject.Contains("Welcome"),
    e => e.Subject.Contains("Verify"),
    e => e.From == "support@example.com"
], TimeSpan.FromSeconds(30));
```

### Conditional Waiting

```csharp
async Task<Email> WaitConditionallyAsync(
    IInbox inbox,
    WaitForEmailOptions options)
{
    // First check if email already exists
    var existing = await inbox.GetEmailsAsync();
    var match = existing.FirstOrDefault(e =>
        e.Subject.Contains(options.Subject ?? "", StringComparison.OrdinalIgnoreCase));

    if (match != null)
    {
        Console.WriteLine("Email already present");
        return match;
    }

    // Wait for new email
    Console.WriteLine("Waiting for email...");
    return await inbox.WaitForEmailAsync(options);
}
```

## Testing Patterns

### Flake-Free Tests

```csharp
// Good: Use WaitForEmailAsync, not Task.Delay
[Fact]
public async Task Receives_Email()
{
    await SendEmailAsync(inbox.EmailAddress);
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });
    Assert.NotNull(email);
}

// Bad: Arbitrary delay causes flakiness
[Fact]
public async Task Receives_Email_Bad()
{
    await SendEmailAsync(inbox.EmailAddress);
    await Task.Delay(5000);  // May not be enough, or wastes time
    var emails = await inbox.GetEmailsAsync();
    Assert.Single(emails);
}
```

### Fast Tests

```csharp
// Good: Short timeout for fast-sending systems
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(2)
});

// Bad: Unnecessarily long timeout slows tests
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromMinutes(1)
});
```

### Parallel Email Tests

```csharp
[Fact]
public async Task Multiple_Users_Receive_Emails()
{
    var inbox1 = await _client.CreateInboxAsync();
    var inbox2 = await _client.CreateInboxAsync();

    try
    {
        // Send emails
        await Task.WhenAll(
            SendWelcomeAsync(inbox1.EmailAddress),
            SendWelcomeAsync(inbox2.EmailAddress));

        // Wait in parallel
        var results = await Task.WhenAll(
            inbox1.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(10)
            }),
            inbox2.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(10)
            }));

        Assert.Contains("Welcome", results[0].Subject);
        Assert.Contains("Welcome", results[1].Subject);
    }
    finally
    {
        await Task.WhenAll(
            _client.DeleteInboxAsync(inbox1.EmailAddress),
            _client.DeleteInboxAsync(inbox2.EmailAddress));
    }
}
```

## Troubleshooting

### Email Not Arriving

```csharp
try
{
    Console.WriteLine("Waiting for email...");
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10),
        Subject = "test",
        UseRegex = true
    });
    Console.WriteLine($"Received: {email.Subject}");
}
catch (VaultSandboxTimeoutException)
{
    Console.WriteLine("Timeout! Checking inbox manually:");
    var emails = await inbox.GetEmailsAsync();
    Console.WriteLine($"Found {emails.Count} emails:");
    foreach (var e in emails)
    {
        Console.WriteLine($"  - {e.Subject}");
    }
    throw;
}
```

### Filter Not Matching

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Predicate = e =>
    {
        var matches = e.Subject.Contains("Test");
        if (!matches)
        {
            Console.WriteLine($"Subject \"{e.Subject}\" doesn't match");
        }
        return matches;
    }
});
```

## Next Steps

- **[Managing Inboxes](/client-dotnet/guides/managing-inboxes/)** - Learn inbox operations
- **[Real-time Monitoring](/client-dotnet/guides/real-time/)** - Subscribe to emails as they arrive
- **[Testing Patterns](/client-dotnet/testing/password-reset/)** - Real-world testing examples
- **[API Reference: Inbox](/client-dotnet/api/inbox/)** - Complete API documentation
