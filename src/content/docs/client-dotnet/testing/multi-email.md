---
title: Testing Multi-Email Scenarios
description: Learn how to test scenarios involving multiple emails with VaultSandbox Client for .NET
---

Many real-world email flows involve sending multiple emails in sequence or in parallel. VaultSandbox provides efficient methods for testing these scenarios using `IAsyncEnumerable`, `Task.WhenAll`, and purpose-built waiting methods.

## Waiting for Multiple Emails

The `WaitForEmailCountAsync()` method is the recommended way to test scenarios that send multiple emails. It's more efficient and reliable than using arbitrary timeouts.

### Basic Example

```csharp
using VaultSandbox.Client;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .Build();

var inbox = await client.CreateInboxAsync();

try
{
    // Send multiple emails
    await SendNotificationsAsync(inbox.EmailAddress, count: 3);

    // Wait for all 3 emails to arrive
    await inbox.WaitForEmailCountAsync(3, new WaitForEmailCountOptions
    {
        Timeout = TimeSpan.FromSeconds(30)
    });

    // Now list and verify all emails
    var emails = await inbox.GetEmailsAsync();
    Console.WriteLine($"Received {emails.Count} emails");

    foreach (var email in emails)
    {
        Console.WriteLine($"  - {email.Subject}");
    }
}
finally
{
    await client.DeleteInboxAsync(inbox.EmailAddress);
}
```

## Testing Email Sequences

Test workflows that send emails in a specific sequence:

```csharp
using Xunit;
using VaultSandbox.Client;

[Collection("VaultSandbox")]
public class WelcomeSequenceTests
{
    private readonly VaultSandboxFixture _fixture;

    public WelcomeSequenceTests(VaultSandboxFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Should_Send_Complete_Onboarding_Sequence()
    {
        var inbox = await _fixture.Client.CreateInboxAsync();

        try
        {
            // Trigger user registration
            await RegisterUserAsync(inbox.EmailAddress);

            // Wait for all 4 onboarding emails
            await inbox.WaitForEmailCountAsync(4, new WaitForEmailCountOptions
            {
                Timeout = TimeSpan.FromSeconds(30)
            });

            var emails = await inbox.GetEmailsAsync();

            // Sort by received time to verify sequence
            var orderedEmails = emails.OrderBy(e => e.ReceivedAt).ToList();

            // Verify sequence order and content
            Assert.Contains("Welcome", orderedEmails[0].Subject);
            Assert.Contains("Getting Started", orderedEmails[1].Subject);
            Assert.Contains("Tips and Tricks", orderedEmails[2].Subject);
            Assert.Contains("We're Here to Help", orderedEmails[3].Subject);

            // Verify timing between emails
            var time1 = orderedEmails[0].ReceivedAt;
            var time2 = orderedEmails[1].ReceivedAt;
            var timeDiff = time2 - time1;

            // Emails should be spaced at least 1 second apart
            Assert.True(timeDiff > TimeSpan.FromSeconds(1));
        }
        finally
        {
            await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
        }
    }
}
```

## Testing Batch Notifications

Test scenarios where multiple similar emails are sent at once:

```csharp
[Fact]
public async Task Should_Receive_Batch_Of_Order_Confirmation_Emails()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        var orderIds = new[] { "ORD-001", "ORD-002", "ORD-003" };

        // Place multiple orders
        foreach (var orderId in orderIds)
        {
            await PlaceOrderAsync(inbox.EmailAddress, orderId);
        }

        // Wait for all confirmations
        await inbox.WaitForEmailCountAsync(3, new WaitForEmailCountOptions
        {
            Timeout = TimeSpan.FromSeconds(30)
        });

        var emails = await inbox.GetEmailsAsync();

        // Verify each order has a confirmation
        foreach (var orderId in orderIds)
        {
            var confirmation = emails.FirstOrDefault(email =>
                email.Text?.Contains(orderId) == true);

            Assert.NotNull(confirmation);
            Assert.Contains("Order Confirmation", confirmation.Subject);
        }
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Waiting for Specific Emails in Sequence

Wait for emails one at a time when order matters:

```csharp
[Fact]
public async Task Order_Generates_Confirmation_And_Shipping_Emails()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        // Place order
        var orderId = await PlaceOrderAsync(inbox.EmailAddress);

        // Wait for confirmation
        var confirmation = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Order Confirmed",
            UseRegex = true
        });
        Assert.Contains("Order Confirmed", confirmation.Subject);

        // Simulate shipping
        await ShipOrderAsync(orderId);

        // Wait for shipping notification
        var shipping = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "shipped",
            UseRegex = true
        });
        Assert.NotNull(shipping.Text);
        Assert.Contains("tracking", shipping.Text, StringComparison.OrdinalIgnoreCase);
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Processing Emails in Real-Time

Use `WatchAsync()` with `IAsyncEnumerable` to process emails as they arrive:

```csharp
[Fact]
public async Task Should_Process_Notifications_In_Real_Time()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        var receivedSubjects = new List<string>();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));

        // Start watching in background
        var watchTask = Task.Run(async () =>
        {
            await foreach (var email in inbox.WatchAsync(cts.Token))
            {
                receivedSubjects.Add(email.Subject);
                Console.WriteLine($"Received: {email.Subject}");

                // Stop after receiving 5 emails
                if (receivedSubjects.Count >= 5)
                {
                    cts.Cancel();
                }
            }
        });

        // Trigger multiple notifications
        await SendMultipleNotificationsAsync(inbox.EmailAddress, count: 5);

        // Wait for watch to complete
        try
        {
            await watchTask;
        }
        catch (OperationCanceledException)
        {
            // Expected when we cancel after receiving all emails
        }

        // Verify all were processed
        Assert.Equal(5, receivedSubjects.Count);
        Assert.All(receivedSubjects, subject =>
            Assert.Contains("Notification", subject));
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Testing Parallel Email Flows

Test scenarios where different email types are triggered simultaneously:

```csharp
[Fact]
public async Task Should_Handle_Multiple_Concurrent_Email_Types()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        // Trigger different email flows simultaneously
        await Task.WhenAll(
            SendWelcomeEmailAsync(inbox.EmailAddress),
            SendOrderConfirmationAsync(inbox.EmailAddress, "ORD-123"),
            SendNewsletterSubscriptionAsync(inbox.EmailAddress)
        );

        // Wait for all 3 emails
        await inbox.WaitForEmailCountAsync(3, new WaitForEmailCountOptions
        {
            Timeout = TimeSpan.FromSeconds(30)
        });

        var emails = await inbox.GetEmailsAsync();

        // Verify all email types arrived
        var welcome = emails.FirstOrDefault(e => e.Subject.Contains("Welcome"));
        var order = emails.FirstOrDefault(e => e.Subject.Contains("Order"));
        var newsletter = emails.FirstOrDefault(e => e.Subject.Contains("Newsletter"));

        Assert.NotNull(welcome);
        Assert.NotNull(order);
        Assert.NotNull(newsletter);
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Multiple Users Receiving Emails in Parallel

Test scenarios where multiple users receive emails simultaneously:

```csharp
[Fact]
public async Task Multiple_Users_Receive_Welcome_Emails()
{
    var inbox1 = await _fixture.Client.CreateInboxAsync();
    var inbox2 = await _fixture.Client.CreateInboxAsync();

    try
    {
        // Register both users
        await Task.WhenAll(
            RegisterUserAsync(inbox1.EmailAddress),
            RegisterUserAsync(inbox2.EmailAddress)
        );

        // Wait for emails in parallel using ValueTuple deconstruction
        var (email1, email2) = await (
            inbox1.WaitForEmailAsync(new WaitForEmailOptions
            {
                Subject = "Welcome",
                UseRegex = true
            }),
            inbox2.WaitForEmailAsync(new WaitForEmailOptions
            {
                Subject = "Welcome",
                UseRegex = true
            })
        );

        Assert.Contains("Welcome", email1.Subject);
        Assert.Contains("Welcome", email2.Subject);
    }
    finally
    {
        await Task.WhenAll(
            _fixture.Client.DeleteInboxAsync(inbox1.EmailAddress),
            _fixture.Client.DeleteInboxAsync(inbox2.EmailAddress));
    }
}
```

## Multiple Inbox Monitoring

Monitor multiple inboxes simultaneously for emails:

```csharp
[Fact]
public async Task Should_Monitor_Multiple_Inboxes_For_Notifications()
{
    var userInbox = await _fixture.Client.CreateInboxAsync();
    var adminInbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        var receivedEmails = new List<(string Inbox, Email Email)>();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));

        // Monitor both inboxes (using MonitorInboxes if available)
        var monitor = _fixture.Client.MonitorInboxes(userInbox, adminInbox);

        var monitorTask = Task.Run(async () =>
        {
            await foreach (var evt in monitor.WatchAsync(cts.Token))
            {
                receivedEmails.Add((evt.InboxAddress, evt.Email));

                if (receivedEmails.Count >= 2)
                {
                    cts.Cancel();
                }
            }
        });

        // Trigger emails (sends to both user and admin)
        await CreateUserAsync(userInbox.EmailAddress, adminInbox.EmailAddress);

        try
        {
            await monitorTask;
        }
        catch (OperationCanceledException) { }

        Assert.Equal(2, receivedEmails.Count);
        Assert.Contains(receivedEmails, e => e.Inbox == userInbox.EmailAddress);
        Assert.Contains(receivedEmails, e => e.Inbox == adminInbox.EmailAddress);
    }
    finally
    {
        await Task.WhenAll(
            _fixture.Client.DeleteInboxAsync(userInbox.EmailAddress),
            _fixture.Client.DeleteInboxAsync(adminInbox.EmailAddress));
    }
}
```

## Filtering and Validating Multiple Emails

Use LINQ to validate email collections:

```csharp
[Fact]
public async Task Should_Validate_All_Notification_Emails()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        await SendBulkNotificationsAsync(inbox.EmailAddress, count: 10);

        await inbox.WaitForEmailCountAsync(10, new WaitForEmailCountOptions
        {
            Timeout = TimeSpan.FromSeconds(30)
        });

        var emails = await inbox.GetEmailsAsync();

        // All should be from the same sender
        var uniqueSenders = emails.Select(e => e.From).Distinct().ToList();
        Assert.Single(uniqueSenders);
        Assert.Equal("notifications@example.com", uniqueSenders[0]);

        // All should have valid authentication
        foreach (var email in emails)
        {
            var validation = email.AuthResults?.Validate();
            Assert.NotNull(validation);
        }

        // All should have links
        var emailsWithLinks = emails.Where(e => e.Links?.Any() == true).ToList();
        Assert.Equal(10, emailsWithLinks.Count);

        // Check that all emails are unique
        var subjects = emails.Select(e => e.Subject).ToHashSet();
        Assert.Equal(10, subjects.Count);
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Testing with Multiple Inboxes

Test scenarios involving multiple recipients:

```csharp
[Fact]
public async Task Should_Send_Emails_To_Multiple_Recipients()
{
    var inboxes = new List<IInbox>();

    try
    {
        // Create multiple inboxes
        for (var i = 0; i < 3; i++)
        {
            inboxes.Add(await _fixture.Client.CreateInboxAsync());
        }

        // Send announcement to all
        var addresses = inboxes.Select(i => i.EmailAddress).ToArray();
        await SendAnnouncementAsync(addresses);

        // Wait for emails in all inboxes
        await Task.WhenAll(inboxes.Select(inbox =>
            inbox.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(10),
                Subject = "Announcement",
                UseRegex = true
            })));

        // Verify all received the same content
        var emails = new List<Email>();
        foreach (var inbox in inboxes)
        {
            var inboxEmails = await inbox.GetEmailsAsync();
            emails.Add(inboxEmails.First());
        }

        Assert.All(emails, email =>
        {
            Assert.Equal(emails[0].Subject, email.Subject);
            Assert.Equal(emails[0].Text, email.Text);
        });
    }
    finally
    {
        await Task.WhenAll(inboxes.Select(i => _fixture.Client.DeleteInboxAsync(i.EmailAddress)));
    }
}
```

## Email Count Waiting for Newsletters

```csharp
[Fact]
public async Task Newsletter_Sends_To_All_Subscribers()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        // Subscribe to 3 newsletters
        await SubscribeToNewslettersAsync(inbox.EmailAddress, ["tech", "sports", "music"]);

        // Trigger all newsletters
        await SendAllNewslettersAsync();

        // Wait for all 3
        await inbox.WaitForEmailCountAsync(3, new WaitForEmailCountOptions
        {
            Timeout = TimeSpan.FromSeconds(30)
        });

        var emails = await inbox.GetEmailsAsync();
        Assert.Equal(3, emails.Count);

        var subjects = emails.Select(e => e.Subject).ToList();
        Assert.Contains(subjects, s => s.Contains("Tech"));
        Assert.Contains(subjects, s => s.Contains("Sports"));
        Assert.Contains(subjects, s => s.Contains("Music"));
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Testing Email Timing

Validate that emails arrive within expected time windows:

```csharp
[Fact]
public async Task Should_Send_Emails_At_Correct_Intervals()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        var startTime = DateTime.UtcNow;

        // Trigger time-based email sequence
        await StartTrialPeriodAsync(inbox.EmailAddress);

        // Wait for initial email immediately
        var welcome = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Welcome to your trial",
            UseRegex = true
        });

        Assert.True(DateTime.UtcNow - startTime < TimeSpan.FromSeconds(5));

        // Wait for reminder email (should come after delay)
        await inbox.WaitForEmailCountAsync(2, new WaitForEmailCountOptions
        {
            Timeout = TimeSpan.FromMinutes(1)
        });

        var emails = await inbox.GetEmailsAsync();
        var reminder = emails.FirstOrDefault(email =>
            email.Subject.Contains("Trial Reminder"));

        Assert.NotNull(reminder);

        var timeBetween = reminder.ReceivedAt - welcome.ReceivedAt;

        // Reminder should come at least 30 seconds after welcome
        Assert.True(timeBetween > TimeSpan.FromSeconds(30));
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Best Practices

### Use WaitForEmailCountAsync() for Known Quantities

When you know exactly how many emails to expect, always use `WaitForEmailCountAsync()`:

```csharp
// Good: Efficient and reliable
await inbox.WaitForEmailCountAsync(3, new WaitForEmailCountOptions
{
    Timeout = TimeSpan.FromSeconds(30)
});

// Avoid: Arbitrary timeout with manual polling
await Task.Delay(TimeSpan.FromSeconds(10));
var emails = await inbox.GetEmailsAsync();
```

### Set Appropriate Timeouts

Calculate timeouts based on expected email count and delivery speed:

```csharp
// For fast local testing
await inbox.WaitForEmailCountAsync(5, new WaitForEmailCountOptions
{
    Timeout = TimeSpan.FromSeconds(10) // ~2s per email
});

// For CI/CD or production gateways
await inbox.WaitForEmailCountAsync(5, new WaitForEmailCountOptions
{
    Timeout = TimeSpan.FromSeconds(30) // ~6s per email
});

// For very large batches
await inbox.WaitForEmailCountAsync(100, new WaitForEmailCountOptions
{
    Timeout = TimeSpan.FromMinutes(2) // ~1.2s per email
});
```

### Verify Email Ordering When Important

If order matters, explicitly check timestamps:

```csharp
var emails = await inbox.GetEmailsAsync();

// Sort by received time
var orderedEmails = emails.OrderBy(e => e.ReceivedAt).ToList();

// Verify first email came before second
Assert.True(orderedEmails[0].ReceivedAt < orderedEmails[1].ReceivedAt);
```

### Clean Up Multiple Inboxes

Use `Task.WhenAll()` to clean up multiple inboxes efficiently:

```csharp
private readonly List<IInbox> _inboxes = [];

public async Task DisposeAsync()
{
    if (_inboxes.Count > 0)
    {
        await Task.WhenAll(_inboxes.Select(inbox =>
        {
            try { return _fixture.Client.DeleteInboxAsync(inbox.EmailAddress); }
            catch { return Task.CompletedTask; }
        }));
    }
}
```

### Use Descriptive Test Names

Make it clear what email scenario you're testing:

```csharp
// Good: Clear what's being tested
[Fact]
public async Task Should_Send_3_Order_Confirmation_Emails_In_Sequence() { }

// Avoid: Vague description
[Fact]
public async Task Should_Work_With_Multiple_Emails() { }
```

### Use CancellationToken for Long-Running Operations

Always provide cancellation support:

```csharp
[Fact]
public async Task Should_Watch_For_Emails_With_Timeout()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));

        var emails = new List<Email>();

        await foreach (var email in inbox.WatchAsync(cts.Token))
        {
            emails.Add(email);

            if (emails.Count >= 3)
            {
                break; // Exit gracefully
            }
        }

        Assert.Equal(3, emails.Count);
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Performance Considerations

### Polling Interval

Adjust the polling interval based on expected email volume:

```csharp
// Default: 2 second polling
await inbox.WaitForEmailCountAsync(10, new WaitForEmailCountOptions
{
    Timeout = TimeSpan.FromSeconds(30)
});

// For time-sensitive tests - configure poll interval at client level
var fastClient = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .WithPollInterval(TimeSpan.FromMilliseconds(500))
    .Build();

await inbox.WaitForEmailCountAsync(10, new WaitForEmailCountOptions
{
    Timeout = TimeSpan.FromSeconds(30)
});

// For large batches - use longer timeout
await inbox.WaitForEmailCountAsync(100, new WaitForEmailCountOptions
{
    Timeout = TimeSpan.FromMinutes(2)
});
```

### Batch Operations

Fetch all emails once rather than making multiple API calls:

```csharp
// Good: Single API call
var emails = await inbox.GetEmailsAsync();
var welcome = emails.FirstOrDefault(e => e.Subject.Contains("Welcome"));
var confirmation = emails.FirstOrDefault(e => e.Subject.Contains("Confirmation"));

// Avoid: Multiple API calls
var email1 = await inbox.GetEmailAsync(id1);
var email2 = await inbox.GetEmailAsync(id2);
var email3 = await inbox.GetEmailAsync(id3);
```

### Parallel Inbox Creation

Create multiple inboxes in parallel:

```csharp
// Good: Parallel creation
var inboxTasks = Enumerable.Range(0, 5)
    .Select(_ => _fixture.Client.CreateInboxAsync());
var inboxes = await Task.WhenAll(inboxTasks);

// Avoid: Sequential creation
var inboxes = new List<IInbox>();
for (var i = 0; i < 5; i++)
{
    inboxes.Add(await _fixture.Client.CreateInboxAsync());
}
```

## Next Steps

- [CI/CD Integration](/client-dotnet/testing/cicd/) - Run multi-email tests in CI
- [Real-time Monitoring](/client-dotnet/guides/real-time/) - Process emails as they arrive
- [Managing Inboxes](/client-dotnet/guides/managing-inboxes/) - Learn more about inbox operations
