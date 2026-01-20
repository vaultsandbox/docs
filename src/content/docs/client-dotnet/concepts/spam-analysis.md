---
title: Spam Analysis
description: Working with spam analysis results in the .NET SDK
---

VaultSandbox can analyze incoming emails for spam using [Rspamd](https://rspamd.com/). When enabled, emails include spam scores, classifications, and detailed rule information.

For server configuration and setup, see the [Gateway Spam Analysis documentation](/gateway/spam-analysis/).

## Enabling Spam Analysis

### Check Server Availability

First, verify spam analysis is enabled on the server:

```csharp
var info = await client.GetServerInfoAsync();

if (info.SpamAnalysisEnabled)
{
    Console.WriteLine("Spam analysis is available");
}
else
{
    Console.WriteLine("Spam analysis is not enabled on this server");
}
```

### Create Inbox with Spam Analysis

Enable spam analysis when creating an inbox:

```csharp
var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    SpamAnalysis = true
});

// Emails received by this inbox will include spam analysis results
Console.WriteLine($"Inbox created: {inbox.EmailAddress}");
```

If not specified, inboxes use the server's default setting (`VSB_SPAM_ANALYSIS_INBOX_DEFAULT`).

## Accessing Spam Results

### SpamAnalysisResult Structure

Every email may include a `SpamAnalysis` property:

```csharp
public sealed record SpamAnalysisResult
{
    public required SpamAnalysisStatus Status { get; init; }
    public double? Score { get; init; }
    public double? RequiredScore { get; init; }
    public SpamAction? Action { get; init; }
    public bool? IsSpam { get; init; }
    public IReadOnlyList<SpamSymbol>? Symbols { get; init; }
    public int? ProcessingTimeMs { get; init; }
    public string? Info { get; init; }
}

public enum SpamAnalysisStatus
{
    Analyzed,
    Skipped,
    Error
}

public enum SpamAction
{
    NoAction,
    Greylist,
    AddHeader,
    RewriteSubject,
    SoftReject,
    Reject
}

public sealed record SpamSymbol
{
    public required string Name { get; init; }
    public required double Score { get; init; }
    public string? Description { get; init; }
    public IReadOnlyList<string>? Options { get; init; }
}
```

### Basic Usage

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.SpamAnalysis is not null)
{
    Console.WriteLine($"Status: {email.SpamAnalysis.Status}");

    if (email.SpamAnalysis.Status == SpamAnalysisStatus.Analyzed)
    {
        Console.WriteLine($"Score: {email.SpamAnalysis.Score}");
        Console.WriteLine($"Required: {email.SpamAnalysis.RequiredScore}");
        Console.WriteLine($"Is spam: {email.SpamAnalysis.IsSpam}");
        Console.WriteLine($"Action: {email.SpamAnalysis.Action}");
    }
}
```

### Helper Methods

The `Email` class provides convenient methods:

```csharp
// Check if email is spam
bool? isSpam = email.GetIsSpam();
// Returns: true (spam), false (not spam), or null (not analyzed)

// Get the spam score
double? score = email.GetSpamScore();
// Returns: score value or null (not analyzed)
```

## Status Values

| Status | Description |
| :----- | :---------- |
| `Analyzed` | Email was successfully analyzed by Rspamd |
| `Skipped` | Analysis was skipped (disabled globally or per-inbox) |
| `Error` | Analysis failed (timeout, Rspamd unavailable, etc.) |

## Action Values

Rspamd returns an action recommendation based on the spam score:

| Action | Description |
| :----- | :---------- |
| `NoAction` | Email is likely legitimate |
| `Greylist` | Temporary rejection recommended |
| `AddHeader` | Add spam header but deliver |
| `RewriteSubject` | Modify subject line to indicate spam |
| `SoftReject` | Temporary rejection |
| `Reject` | Email should be rejected |

## Working with Symbols

Symbols represent individual spam detection rules that triggered:

```csharp
if (email.SpamAnalysis?.Symbols is { Count: > 0 })
{
    Console.WriteLine("Triggered rules:");

    foreach (var symbol in email.SpamAnalysis.Symbols)
    {
        var sign = symbol.Score >= 0 ? "+" : "";
        Console.WriteLine($"  {symbol.Name}: {sign}{symbol.Score}");

        if (symbol.Description is not null)
        {
            Console.WriteLine($"    {symbol.Description}");
        }

        if (symbol.Options is { Count: > 0 })
        {
            Console.WriteLine($"    Options: {string.Join(", ", symbol.Options)}");
        }
    }
}
```

Common symbol patterns:

- **Positive scores**: Spam indicators (e.g., `BAYES_SPAM`, `FORGED_SENDER`)
- **Negative scores**: Legitimate indicators (e.g., `DKIM_SIGNED`, `SPF_ALLOW`)

## Testing Patterns

### Verify Emails Are Not Spam (xUnit)

```csharp
[Fact]
public async Task Transactional_Emails_Should_Not_Be_Flagged_As_Spam()
{
    await SendPasswordResetEmail(_inbox.EmailAddress);

    var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    // Check spam status
    Assert.False(email.GetIsSpam());

    // Optionally check score is low
    var score = email.GetSpamScore();
    if (score is not null)
    {
        Assert.True(score < 5);
    }
}
```

### Check Spam Analysis Availability

```csharp
[Fact]
public async Task Spam_Analysis_Should_Be_Performed()
{
    var inbox = await _client.CreateInboxAsync(new CreateInboxOptions
    {
        SpamAnalysis = true
    });

    try
    {
        await SendEmail(inbox.EmailAddress);

        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10)
        });

        Assert.NotNull(email.SpamAnalysis);
        Assert.Equal(SpamAnalysisStatus.Analyzed, email.SpamAnalysis.Status);
    }
    finally
    {
        await _client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

### Analyze Triggered Rules

```csharp
[Fact]
public async Task Should_Have_Valid_DKIM_Signature()
{
    var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    if (email.SpamAnalysis?.Status == SpamAnalysisStatus.Analyzed)
    {
        var symbols = email.SpamAnalysis.Symbols ?? [];
        var dkimSigned = symbols.FirstOrDefault(s =>
            s.Name == "DKIM_SIGNED" || s.Name == "R_DKIM_ALLOW");

        // DKIM_SIGNED has negative score (indicates legitimate email)
        if (dkimSigned is not null)
        {
            Assert.True(dkimSigned.Score < 0);
        }
    }
}
```

### Handle Missing Analysis

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

var spamStatus = email.GetIsSpam();
var spamScore = email.GetSpamScore();

if (spamStatus is null)
{
    Console.WriteLine("Spam analysis not available");
    Console.WriteLine($"Reason: {email.SpamAnalysis?.Info ?? "Unknown"}");
}
else
{
    Console.WriteLine($"Is spam: {spamStatus}");
    Console.WriteLine($"Score: {spamScore}");
}
```

### NUnit Example

```csharp
[Test]
public async Task Transactional_Emails_Should_Not_Be_Flagged_As_Spam()
{
    await SendPasswordResetEmail(_inbox.EmailAddress);

    var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    Assert.That(email.GetIsSpam(), Is.False);

    var score = email.GetSpamScore();
    if (score is not null)
    {
        Assert.That(score, Is.LessThan(5));
    }
}
```

## Complete Example

```csharp
using VaultSandbox.Client;

async Task AnalyzeEmailSpam(CancellationToken cancellationToken)
{
    var client = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
        .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
        .Build();

    try
    {
        // Check if spam analysis is available
        var info = await client.GetServerInfoAsync(cancellationToken);
        if (!info.SpamAnalysisEnabled)
        {
            Console.WriteLine("Spam analysis not available on this server");
            return;
        }

        // Create inbox with spam analysis enabled
        var inbox = await client.CreateInboxAsync(new CreateInboxOptions
        {
            SpamAnalysis = true
        }, cancellationToken);

        Console.WriteLine($"Inbox: {inbox.EmailAddress}");

        // Wait for email
        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(30)
        }, cancellationToken);

        Console.WriteLine("\n=== Email Details ===");
        Console.WriteLine($"From: {email.From}");
        Console.WriteLine($"Subject: {email.Subject}");

        Console.WriteLine("\n=== Spam Analysis ===");

        if (email.SpamAnalysis is null)
        {
            Console.WriteLine("No spam analysis data");
        }
        else if (email.SpamAnalysis.Status != SpamAnalysisStatus.Analyzed)
        {
            Console.WriteLine($"Status: {email.SpamAnalysis.Status}");
            Console.WriteLine($"Info: {email.SpamAnalysis.Info ?? "N/A"}");
        }
        else
        {
            Console.WriteLine($"Score: {email.SpamAnalysis.Score} / {email.SpamAnalysis.RequiredScore}");
            Console.WriteLine($"Is Spam: {email.GetIsSpam()}");
            Console.WriteLine($"Action: {email.SpamAnalysis.Action}");
            Console.WriteLine($"Processing Time: {email.SpamAnalysis.ProcessingTimeMs}ms");

            if (email.SpamAnalysis.Symbols is { Count: > 0 })
            {
                Console.WriteLine("\nTriggered Rules:");

                var topSymbols = email.SpamAnalysis.Symbols
                    .OrderByDescending(s => Math.Abs(s.Score))
                    .Take(10);

                foreach (var s in topSymbols)
                {
                    var sign = s.Score >= 0 ? "+" : "";
                    Console.WriteLine($"  {s.Name}: {sign}{s.Score}");
                }
            }
        }

        await client.DeleteInboxAsync(inbox.EmailAddress, cancellationToken);
    }
    finally
    {
        await client.DisposeAsync();
    }
}
```

## Next Steps

- **[Gateway Spam Analysis](/gateway/spam-analysis/)** - Server configuration and Rspamd setup
- **[Email API Reference](/client-dotnet/api/email/)** - Complete email API documentation
- **[Authentication Results](/client-dotnet/concepts/auth-results/)** - Email authentication (SPF/DKIM/DMARC)
- **[Managing Inboxes](/client-dotnet/guides/managing-inboxes/)** - Inbox creation options
