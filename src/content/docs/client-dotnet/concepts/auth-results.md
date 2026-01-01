---
title: Authentication Results
description: Understanding email authentication (SPF, DKIM, DMARC) in VaultSandbox
---

VaultSandbox validates email authentication for every received email, providing detailed SPF, DKIM, DMARC, and reverse DNS results.

## What is Email Authentication?

Email authentication helps verify that an email:

- Came from the claimed sender domain (**SPF**)
- Wasn't modified in transit (**DKIM**)
- Complies with the domain's policy (**DMARC**)
- Came from a legitimate mail server (**Reverse DNS**)

## AuthenticationResults Record

Every email has an `AuthResults` property containing detailed authentication data:

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.AuthResults is not null)
{
    // SPF result
    if (email.AuthResults.Spf is not null)
    {
        Console.WriteLine(email.AuthResults.Spf.Result);   // SpfStatus enum
        Console.WriteLine(email.AuthResults.Spf.Domain);   // Sender domain
        Console.WriteLine(email.AuthResults.Spf.Ip);       // Sending IP
    }

    // DKIM results (can have multiple signatures)
    if (email.AuthResults.Dkim is not null)
    {
        foreach (var dkim in email.AuthResults.Dkim)
        {
            Console.WriteLine(dkim.Result);    // DkimStatus enum
            Console.WriteLine(dkim.Domain);    // Signing domain
            Console.WriteLine(dkim.Selector);  // DKIM selector
        }
    }

    // DMARC result
    if (email.AuthResults.Dmarc is not null)
    {
        Console.WriteLine(email.AuthResults.Dmarc.Result);   // DmarcStatus enum
        Console.WriteLine(email.AuthResults.Dmarc.Policy);   // DmarcPolicy enum
        Console.WriteLine(email.AuthResults.Dmarc.Aligned);  // bool?
    }

    // Reverse DNS result
    if (email.AuthResults.ReverseDns is not null)
    {
        Console.WriteLine(email.AuthResults.ReverseDns.Verified);  // bool
        Console.WriteLine(email.AuthResults.ReverseDns.Hostname);  // PTR hostname
    }
}
```

## SPF (Sender Policy Framework)

Verifies the sending server is authorized to send from the sender's domain.

### SpfResult Record

```csharp
public sealed record SpfResult
{
    public SpfStatus Result { get; init; }
    public string? Domain { get; init; }
    public string? Ip { get; init; }
    public string? Details { get; init; }
}
```

### SpfStatus Enum

| Status      | Description                                |
| ----------- | ------------------------------------------ |
| `Pass`      | Sending server is authorized               |
| `Fail`      | Sending server is NOT authorized           |
| `SoftFail`  | Probably not authorized (policy says ~all) |
| `Neutral`   | Domain makes no assertion                  |
| `None`      | No SPF record found                        |
| `TempError` | Temporary error during check               |
| `PermError` | Permanent error in SPF record              |

### SPF Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.AuthResults?.Spf is not null)
{
    Console.WriteLine($"SPF: {email.AuthResults.Spf.Result}");
    // SPF: Pass

    // Assert in tests
    Assert.Equal(SpfStatus.Pass, email.AuthResults.Spf.Result);
}
```

## DKIM (DomainKeys Identified Mail)

Cryptographically verifies the email hasn't been modified and came from the claimed domain. An email can have multiple DKIM signatures.

### DkimResult Record

```csharp
public sealed record DkimResult
{
    public DkimStatus Result { get; init; }
    public string? Domain { get; init; }
    public string? Selector { get; init; }
    public string? Signature { get; init; }
}
```

### DkimStatus Enum

| Status | Description             |
| ------ | ----------------------- |
| `Pass` | Signature is valid      |
| `Fail` | Signature is invalid    |
| `None` | No DKIM signature found |

### DKIM Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.AuthResults?.Dkim is { Count: > 0 })
{
    // Check if at least one DKIM signature passed
    var anyPassed = email.AuthResults.Dkim.Any(d => d.Result == DkimStatus.Pass);
    Console.WriteLine($"DKIM: {(anyPassed ? "Pass" : "Fail")}");

    // Assert in tests
    Assert.Contains(email.AuthResults.Dkim, d => d.Result == DkimStatus.Pass);
}
```

## DMARC (Domain-based Message Authentication)

Checks that SPF or DKIM align with the From address and enforces the domain's policy.

### DmarcResult Record

```csharp
public sealed record DmarcResult
{
    public DmarcStatus Result { get; init; }
    public DmarcPolicy? Policy { get; init; }
    public bool? Aligned { get; init; }
    public string? Domain { get; init; }
}
```

### DmarcStatus Enum

| Status | Description                              |
| ------ | ---------------------------------------- |
| `Pass` | DMARC check passed (SPF or DKIM aligned) |
| `Fail` | DMARC check failed                       |
| `None` | No DMARC policy found                    |

### DmarcPolicy Enum

| Policy       | Description                      |
| ------------ | -------------------------------- |
| `None`       | No action specified              |
| `Quarantine` | Mark as suspicious/spam          |
| `Reject`     | Reject the email                 |

### DMARC Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.AuthResults?.Dmarc is not null)
{
    Console.WriteLine($"DMARC: {email.AuthResults.Dmarc.Result}");
    // DMARC: Pass

    // Assert in tests
    Assert.Equal(DmarcStatus.Pass, email.AuthResults.Dmarc.Result);
}
```

## Reverse DNS

Verifies the sending server's IP resolves to a hostname that matches the sending domain.

### ReverseDnsResult Record

```csharp
public sealed record ReverseDnsResult
{
    public bool Verified { get; init; }
    public string? Ip { get; init; }
    public string? Hostname { get; init; }
}
```

### Reverse DNS Example

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

if (email.AuthResults?.ReverseDns is not null)
{
    Console.WriteLine($"Reverse DNS Verified: {email.AuthResults.ReverseDns.Verified}");
    // Reverse DNS Verified: True
}
```

## Validation Helper

The `Validate()` method provides a summary of all authentication checks:

```csharp
if (email.AuthResults is not null)
{
    var validation = email.AuthResults.Validate();

    Console.WriteLine(validation.Passed);           // Overall pass/fail
    Console.WriteLine(validation.SpfPassed);        // SPF check
    Console.WriteLine(validation.DkimPassed);       // DKIM check
    Console.WriteLine(validation.DmarcPassed);      // DMARC check
    Console.WriteLine(validation.ReverseDnsPassed); // Reverse DNS check

    foreach (var failure in validation.Failures)
    {
        Console.WriteLine(failure);                 // Failure descriptions
    }
}
```

### AuthValidation Record

```csharp
public sealed record AuthValidation
{
    public required bool Passed { get; init; }           // True if SPF, DKIM, and DMARC passed
    public required bool SpfPassed { get; init; }        // SPF passed
    public required bool DkimPassed { get; init; }       // At least one DKIM signature passed
    public required bool DmarcPassed { get; init; }      // DMARC passed
    public required bool ReverseDnsPassed { get; init; } // Reverse DNS passed
    public required IReadOnlyList<string> Failures { get; init; } // Failure descriptions
}
```

### Validation Examples

**All checks pass**:

```csharp
var validation = email.AuthResults!.Validate();

// {
//   Passed: true,
//   SpfPassed: true,
//   DkimPassed: true,
//   DmarcPassed: true,
//   ReverseDnsPassed: true,
//   Failures: []
// }

Assert.True(validation.Passed);
```

**Some checks fail**:

```csharp
var validation = email.AuthResults!.Validate();

// {
//   Passed: false,
//   SpfPassed: false,
//   DkimPassed: true,
//   DmarcPassed: false,
//   ReverseDnsPassed: true,
//   Failures: [
//     "SPF check failed: Fail (domain: example.com)",
//     "DMARC policy: Fail (policy: Reject)"
//   ]
// }

if (!validation.Passed)
{
    Console.WriteLine("Authentication failures:");
    foreach (var failure in validation.Failures)
    {
        Console.WriteLine($"  - {failure}");
    }
}
```

## Testing Patterns

### Strict Authentication (xUnit)

```csharp
[Fact]
public async Task Email_Should_Pass_All_Authentication_Checks()
{
    await SendEmail(inbox.EmailAddress);

    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    Assert.NotNull(email.AuthResults);

    var validation = email.AuthResults.Validate();

    Assert.True(validation.Passed);
    Assert.True(validation.SpfPassed);
    Assert.True(validation.DkimPassed);
    Assert.True(validation.DmarcPassed);
}
```

### Strict Authentication (NUnit)

```csharp
[Test]
public async Task Email_Should_Pass_All_Authentication_Checks()
{
    await SendEmail(_inbox.EmailAddress);

    var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    Assert.That(email.AuthResults, Is.Not.Null);

    var validation = email.AuthResults!.Validate();

    Assert.That(validation.Passed, Is.True);
    Assert.That(validation.SpfPassed, Is.True);
    Assert.That(validation.DkimPassed, Is.True);
    Assert.That(validation.DmarcPassed, Is.True);
}
```

### Lenient Authentication

```csharp
[Fact]
public async Task Email_Should_Have_Valid_DKIM_Signature()
{
    await SendEmail(inbox.EmailAddress);

    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    Assert.NotNull(email.AuthResults?.Dkim);

    // Only check DKIM (most reliable) - at least one signature must pass
    Assert.Contains(email.AuthResults.Dkim, d => d.Result == DkimStatus.Pass);
}
```

### Handling Missing Authentication

```csharp
[Fact]
public async Task Should_Handle_Emails_Without_Authentication()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    // Some senders don't have SPF/DKIM configured
    if (email.AuthResults is not null)
    {
        var validation = email.AuthResults.Validate();

        // Log results for debugging
        if (!validation.Passed)
        {
            _output.WriteLine($"Auth failures (may be expected for test emails): {string.Join(", ", validation.Failures)}");
        }
    }
}
```

### Testing Specific Checks

```csharp
public class EmailAuthenticationTests : IAsyncLifetime
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;
    private Email _email = null!;

    public async Task InitializeAsync()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(url)
            .WithApiKey(apiKey)
            .Build();

        _inbox = await _client.CreateInboxAsync();
        await SendEmail(_inbox.EmailAddress);
        _email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10)
        });
    }

    public async Task DisposeAsync()
    {
        await _client.DeleteInboxAsync(_inbox.EmailAddress);
        await _client.DisposeAsync();
    }

    [Fact]
    public void SPF_Check_Should_Pass_Or_Be_Neutral()
    {
        if (_email.AuthResults?.Spf is not null)
        {
            var acceptableResults = new[] { SpfStatus.Pass, SpfStatus.Neutral, SpfStatus.SoftFail };
            Assert.Contains(_email.AuthResults.Spf.Result, acceptableResults);
        }
    }

    [Fact]
    public void DKIM_Check_Should_Pass()
    {
        if (_email.AuthResults?.Dkim is { Count: > 0 })
        {
            Assert.Contains(_email.AuthResults.Dkim, d => d.Result == DkimStatus.Pass);
        }
    }

    [Fact]
    public void DMARC_Check_Should_Pass_Or_Not_Exist()
    {
        if (_email.AuthResults?.Dmarc is not null)
        {
            var acceptableResults = new[] { DmarcStatus.Pass, DmarcStatus.None };
            Assert.Contains(_email.AuthResults.Dmarc.Result, acceptableResults);
        }
    }
}
```

## Why Authentication Matters

### Production Readiness

Testing authentication catches issues like:

- **Misconfigured SPF records** - emails rejected by Gmail/Outlook
- **Missing DKIM signatures** - reduced deliverability
- **DMARC failures** - emails sent to spam
- **Reverse DNS mismatches** - flagged as suspicious

### Real-World Example

```csharp
[Fact]
public async Task Production_Email_Configuration_Should_Be_Valid()
{
    await _app.SendWelcomeEmail(_inbox.EmailAddress);

    var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    Assert.NotNull(email.AuthResults);

    var validation = email.AuthResults.Validate();

    // In production, these should all pass
    if (!validation.Passed)
    {
        _output.WriteLine("Email authentication issues detected:");
        foreach (var failure in validation.Failures)
        {
            _output.WriteLine($"   {failure}");
        }

        _output.WriteLine("");
        _output.WriteLine("Action required:");

        if (!validation.SpfPassed)
        {
            _output.WriteLine("- Fix SPF record for your domain");
        }
        if (!validation.DkimPassed)
        {
            _output.WriteLine("- Configure DKIM signing in your email service");
        }
        if (!validation.DmarcPassed)
        {
            _output.WriteLine("- Add/fix DMARC policy");
        }
    }

    // Fail test if authentication fails
    Assert.True(validation.Passed);
}
```

## Troubleshooting

### No Authentication Results

```csharp
if (email.AuthResults is null)
{
    Console.WriteLine("No authentication performed");
    Console.WriteLine("This may happen for:");
    Console.WriteLine("- Emails sent from localhost/internal servers");
    Console.WriteLine("- Test SMTP servers without authentication");
}
```

### All Checks Fail

```csharp
if (email.AuthResults is not null)
{
    var validation = email.AuthResults.Validate();

    if (!validation.Passed)
    {
        Console.WriteLine($"Authentication failed: {string.Join(", ", validation.Failures)}");

        // Common causes:
        // 1. No SPF record: Add "v=spf1 ip4:YOUR_IP -all" to DNS
        // 2. No DKIM: Configure your mail server to sign emails
        // 3. No DMARC: Add "v=DMARC1; p=none" to DNS
        // 4. Wrong IP: Update SPF record with correct server IP
    }
}
```

### Understanding Failure Reasons

```csharp
if (email.AuthResults is not null)
{
    var validation = email.AuthResults.Validate();

    foreach (var failure in validation.Failures)
    {
        if (failure.Contains("SPF"))
        {
            Console.WriteLine("Fix SPF: Update DNS TXT record for your domain");
        }
        if (failure.Contains("DKIM"))
        {
            Console.WriteLine("Fix DKIM: Enable DKIM signing in your email service");
        }
        if (failure.Contains("DMARC"))
        {
            Console.WriteLine("Fix DMARC: Add DMARC policy to DNS");
        }
    }
}
```

## Using Pattern Matching

C# pattern matching makes working with authentication results elegant:

```csharp
var message = email.AuthResults switch
{
    null => "No authentication data available",
    { Spf.Result: SpfStatus.Pass, Dmarc.Result: DmarcStatus.Pass } auth
        when auth.Dkim?.Any(d => d.Result == DkimStatus.Pass) == true
        => "All authentication checks passed",
    { Spf.Result: SpfStatus.Fail } => "SPF check failed - sender not authorized",
    { Dmarc.Result: DmarcStatus.Fail } => "DMARC check failed - policy violation",
    _ when email.AuthResults.Dkim?.All(d => d.Result == DkimStatus.Fail) == true
        => "DKIM check failed - email may have been modified",
    _ => "Some authentication checks did not pass"
};

Console.WriteLine(message);
```

## Next Steps

- **[Email Authentication Guide](/client-dotnet/guides/authentication/)** - Testing authentication in depth
- **[Email Objects](/client-dotnet/concepts/emails/)** - Understanding email structure
- **[Testing Patterns](/client-dotnet/testing/password-reset/)** - Real-world testing examples
- **[API Reference](/client-dotnet/api/client/)** - Complete API documentation
