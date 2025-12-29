---
title: Email Authentication Testing
description: Test SPF, DKIM, and DMARC email authentication
---

VaultSandbox validates SPF, DKIM, DMARC, and reverse DNS for every email, helping you catch authentication issues before production.

## Why Test Email Authentication?

Email authentication prevents:

- Emails being marked as spam
- Emails being rejected by receivers
- Domain spoofing and phishing
- Delivery failures

Testing authentication ensures your emails will be trusted by Gmail, Outlook, and other providers.

## Basic Authentication Check

### Using Validate()

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});

var validation = email.AuthResults?.Validate();

if (validation?.Passed == true)
{
    Console.WriteLine("All authentication checks passed");
}
else
{
    Console.WriteLine("Authentication failures:");
    foreach (var failure in validation?.Failures ?? [])
    {
        Console.WriteLine($"  - {failure}");
    }
}
```

### Checking Individual Results

```csharp
var auth = email.AuthResults;

if (auth != null)
{
    Console.WriteLine($"SPF: {auth.Spf?.Status}");
    Console.WriteLine($"DKIM: {auth.Dkim?.FirstOrDefault()?.Status}");
    Console.WriteLine($"DMARC: {auth.Dmarc?.Status}");
    Console.WriteLine($"Reverse DNS: {auth.ReverseDns?.Status}");
}
```

## Testing SPF

### Basic SPF Test

```csharp
[Fact]
public async Task Email_Passes_Spf_Check()
{
    await SendEmailAsync(inbox.EmailAddress);

    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    Assert.NotNull(email.AuthResults?.Spf);
    Assert.Equal(SpfStatus.Pass, email.AuthResults.Spf.Status);
}
```

### Detailed SPF Validation

```csharp
[Fact]
public async Task Spf_Validation_Details()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    var spf = email.AuthResults?.Spf;

    if (spf != null)
    {
        Assert.Equal(SpfStatus.Pass, spf.Status);
        Assert.Equal("example.com", spf.Domain);

        Console.WriteLine($"SPF {spf.Status} for {spf.Domain}");
        Console.WriteLine($"Info: {spf.Info}");
    }
}
```

### Handling SPF Failures

```csharp
[Fact]
public async Task Handles_Spf_Failure()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    var spf = email.AuthResults?.Spf;

    if (spf != null && spf.Status != SpfStatus.Pass)
    {
        Console.WriteLine($"SPF {spf.Status}: {spf.Info}");

        // Common failures
        switch (spf.Status)
        {
            case SpfStatus.Fail:
                Console.WriteLine("Server IP not authorized in SPF record");
                Console.WriteLine("Action: Add server IP to SPF record");
                break;
            case SpfStatus.SoftFail:
                Console.WriteLine("Server probably not authorized (~all in SPF)");
                break;
            case SpfStatus.None:
                Console.WriteLine("No SPF record found");
                Console.WriteLine("Action: Add SPF record to DNS");
                break;
        }
    }
}
```

## Testing DKIM

### Basic DKIM Test

```csharp
[Fact]
public async Task Email_Has_Valid_Dkim_Signature()
{
    await SendEmailAsync(inbox.EmailAddress);

    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    Assert.NotNull(email.AuthResults?.Dkim);
    Assert.NotEmpty(email.AuthResults.Dkim);
    Assert.Equal(DkimStatus.Pass, email.AuthResults.Dkim[0].Status);
}
```

### Multiple DKIM Signatures

```csharp
[Fact]
public async Task Validates_All_Dkim_Signatures()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    var dkim = email.AuthResults?.Dkim;

    if (dkim?.Count > 0)
    {
        Console.WriteLine($"Email has {dkim.Count} DKIM signature(s)");

        for (var i = 0; i < dkim.Count; i++)
        {
            var sig = dkim[i];
            Console.WriteLine($"Signature {i + 1}:");
            Console.WriteLine($"  Status: {sig.Status}");
            Console.WriteLine($"  Domain: {sig.Domain}");
            Console.WriteLine($"  Selector: {sig.Selector}");

            Assert.Equal(DkimStatus.Pass, sig.Status);
        }

        // At least one signature should pass
        var anyPassed = dkim.Any(sig => sig.Status == DkimStatus.Pass);
        Assert.True(anyPassed);
    }
}
```

### DKIM Selector Verification

```csharp
[Fact]
public async Task Dkim_Uses_Correct_Selector()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    var dkim = email.AuthResults?.Dkim?.FirstOrDefault();

    if (dkim != null)
    {
        Assert.Equal("default", dkim.Selector);  // Or your expected selector
        Assert.Equal("example.com", dkim.Domain);

        // DKIM DNS record should exist at:
        // {selector}._domainkey.{domain}
        Console.WriteLine($"DKIM key at: {dkim.Selector}._domainkey.{dkim.Domain}");
    }
}
```

## Testing DMARC

### Basic DMARC Test

```csharp
[Fact]
public async Task Email_Passes_Dmarc()
{
    await SendEmailAsync(inbox.EmailAddress);

    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    Assert.NotNull(email.AuthResults?.Dmarc);
    Assert.Equal(DmarcStatus.Pass, email.AuthResults.Dmarc.Status);
}
```

### DMARC Policy Verification

```csharp
[Fact]
public async Task Dmarc_Policy_Is_Enforced()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    var dmarc = email.AuthResults?.Dmarc;

    if (dmarc != null)
    {
        Console.WriteLine($"DMARC status: {dmarc.Status}");
        Console.WriteLine($"DMARC policy: {dmarc.Policy}");

        // Policy should be restrictive in production
        Assert.Contains(dmarc.Policy, new[] { DmarcPolicy.Quarantine, DmarcPolicy.Reject });
    }
}
```

### DMARC Alignment Check

```csharp
[Fact]
public async Task Dmarc_Alignment_Requirements()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    // DMARC requires either SPF or DKIM to align with From domain
    var validation = email.AuthResults?.Validate();

    if (validation?.DmarcPassed != true)
    {
        Console.WriteLine("DMARC failed. Checking alignment:");
        Console.WriteLine($"SPF passed: {validation?.SpfPassed}");
        Console.WriteLine($"DKIM passed: {validation?.DkimPassed}");

        // At least one should pass for DMARC to pass
        Assert.True(validation?.SpfPassed == true || validation?.DkimPassed == true);
    }
}
```

## Testing Reverse DNS

### Basic Reverse DNS Test

```csharp
[Fact]
public async Task Server_Has_Valid_Reverse_Dns()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    var rdns = email.AuthResults?.ReverseDns;

    if (rdns != null)
    {
        Assert.Equal(ReverseDnsStatus.Pass, rdns.Status);
        Assert.NotEmpty(rdns.Hostname);

        Console.WriteLine($"Reverse DNS: {rdns.Ip} -> {rdns.Hostname}");
        Console.WriteLine($"Status: {rdns.Status}");
    }
}
```

## Complete Authentication Test

### All Checks Pass

```csharp
[Fact]
public async Task Email_Passes_All_Authentication_Checks()
{
    await _app.SendProductionEmailAsync(inbox.EmailAddress);

    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    var validation = email.AuthResults?.Validate();

    // All checks should pass in production
    Assert.NotNull(validation);
    Assert.True(validation.Passed);
    Assert.True(validation.SpfPassed);
    Assert.True(validation.DkimPassed);
    Assert.True(validation.DmarcPassed);

    // Log results
    Console.WriteLine("Authentication Results:");
    Console.WriteLine($"  SPF:         {(validation.SpfPassed ? "PASS" : "FAIL")}");
    Console.WriteLine($"  DKIM:        {(validation.DkimPassed ? "PASS" : "FAIL")}");
    Console.WriteLine($"  DMARC:       {(validation.DmarcPassed ? "PASS" : "FAIL")}");
    Console.WriteLine($"  Reverse DNS: {(validation.ReverseDnsPassed ? "PASS" : "FAIL")}");
}
```

### Graceful Failure Handling

```csharp
[Fact]
public async Task Handles_Authentication_Failures_Gracefully()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    var validation = email.AuthResults?.Validate();

    // Log failures without failing test (for non-production)
    if (validation?.Passed != true)
    {
        Console.WriteLine("Authentication issues detected:");
        foreach (var failure in validation?.Failures ?? [])
        {
            Console.WriteLine($"  - {failure}");
        }

        // Provide remediation steps
        if (validation?.SpfPassed != true)
        {
            Console.WriteLine("\nTo fix SPF:");
            Console.WriteLine("  Add to DNS: v=spf1 ip4:YOUR_SERVER_IP -all");
        }

        if (validation?.DkimPassed != true)
        {
            Console.WriteLine("\nTo fix DKIM:");
            Console.WriteLine("  1. Generate DKIM keys");
            Console.WriteLine("  2. Add public key to DNS");
            Console.WriteLine("  3. Configure mail server to sign emails");
        }

        if (validation?.DmarcPassed != true)
        {
            Console.WriteLine("\nTo fix DMARC:");
            Console.WriteLine("  Add to DNS: v=DMARC1; p=none; rua=mailto:dmarc@example.com");
        }
    }

    // In production, this should be Assert.True(validation.Passed)
}
```

## Real-World Testing Patterns

### Pre-Production Validation

```csharp
public class PreProductionAuthTests : IAsyncLifetime
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
        if (_inbox != null) await _client.DeleteInboxAsync(_inbox.EmailAddress);
    }

    [Fact]
    public async Task Validates_Staging_Environment_Email_Auth()
    {
        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10)
        });

        var auth = email.AuthResults;

        // SPF should be configured
        if (auth?.Spf != null)
        {
            if (auth.Spf.Status != SpfStatus.Pass)
            {
                Console.WriteLine("SPF not configured correctly");
                Console.WriteLine($"  Status: {auth.Spf.Status}");
                Console.WriteLine($"  Info: {auth.Spf.Info}");
            }
            Assert.True(auth.Spf.Status is SpfStatus.Pass or SpfStatus.Neutral);
        }

        // DKIM should be present
        if (auth?.Dkim?.Count > 0)
        {
            var anyValid = auth.Dkim.Any(d => d.Status == DkimStatus.Pass);
            if (!anyValid)
            {
                Console.WriteLine("No valid DKIM signatures");
                Console.WriteLine("  Fix: Configure DKIM signing in mail server");
            }
            Assert.True(anyValid);
        }
    }
}
```

### Production Readiness Check

```csharp
[Fact]
public async Task Production_Email_Configuration()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    var validation = email.AuthResults?.Validate();

    // Production requirements
    var productionReady = new
    {
        Spf = validation?.SpfPassed ?? false,
        Dkim = validation?.DkimPassed ?? false,
        Dmarc = validation?.DmarcPassed ?? false,
        AllPassed = validation?.Passed ?? false
    };

    Console.WriteLine("Production Readiness:");
    Console.WriteLine($"  SPF:         {productionReady.Spf}");
    Console.WriteLine($"  DKIM:        {productionReady.Dkim}");
    Console.WriteLine($"  DMARC:       {productionReady.Dmarc}");
    Console.WriteLine($"  All Passed:  {productionReady.AllPassed}");

    // Fail if not production-ready
    if (validation?.Passed != true)
    {
        var issues = string.Join("\n  ", validation?.Failures ?? []);
        throw new Exception(
            $"Email not production-ready:\n  {issues}\n\n" +
            "Fix these issues before deploying to production.");
    }

    Assert.True(validation.Passed);
}
```

## Debugging Authentication Issues

### Verbose Logging

```csharp
void LogAuthenticationDetails(Email email)
{
    var auth = email.AuthResults;

    Console.WriteLine("\n=== Email Authentication Details ===\n");

    // SPF
    if (auth?.Spf != null)
    {
        Console.WriteLine("SPF:");
        Console.WriteLine($"  Status: {auth.Spf.Status}");
        Console.WriteLine($"  Domain: {auth.Spf.Domain}");
        Console.WriteLine($"  Info: {auth.Spf.Info}");
    }
    else
    {
        Console.WriteLine("SPF: No result");
    }

    // DKIM
    if (auth?.Dkim?.Count > 0)
    {
        Console.WriteLine("\nDKIM:");
        for (var i = 0; i < auth.Dkim.Count; i++)
        {
            var sig = auth.Dkim[i];
            Console.WriteLine($"  Signature {i + 1}:");
            Console.WriteLine($"    Status: {sig.Status}");
            Console.WriteLine($"    Domain: {sig.Domain}");
            Console.WriteLine($"    Selector: {sig.Selector}");
            Console.WriteLine($"    Info: {sig.Info}");
        }
    }
    else
    {
        Console.WriteLine("\nDKIM: No signatures");
    }

    // DMARC
    if (auth?.Dmarc != null)
    {
        Console.WriteLine("\nDMARC:");
        Console.WriteLine($"  Status: {auth.Dmarc.Status}");
        Console.WriteLine($"  Domain: {auth.Dmarc.Domain}");
        Console.WriteLine($"  Policy: {auth.Dmarc.Policy}");
    }
    else
    {
        Console.WriteLine("\nDMARC: No result");
    }

    // Reverse DNS
    if (auth?.ReverseDns != null)
    {
        Console.WriteLine("\nReverse DNS:");
        Console.WriteLine($"  Status: {auth.ReverseDns.Status}");
        Console.WriteLine($"  IP: {auth.ReverseDns.Ip}");
        Console.WriteLine($"  Hostname: {auth.ReverseDns.Hostname}");
    }

    // Validation Summary
    var validation = auth?.Validate();
    Console.WriteLine("\nValidation Summary:");
    Console.WriteLine($"  Overall: {(validation?.Passed == true ? "PASS" : "FAIL")}");
    if (validation?.Passed != true)
    {
        Console.WriteLine("  Failures:");
        foreach (var f in validation?.Failures ?? [])
        {
            Console.WriteLine($"    - {f}");
        }
    }
}

// Usage
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});
LogAuthenticationDetails(email);
```

## Authentication Result Records

### AuthResults Structure

```csharp
// The AuthResults record contains all authentication data
public sealed record AuthenticationResults
{
    public SpfResult? Spf { get; init; }
    public IReadOnlyList<DkimResult>? Dkim { get; init; }
    public DmarcResult? Dmarc { get; init; }
    public ReverseDnsResult? ReverseDns { get; init; }

    public AuthValidation Validate();
}

public sealed record SpfResult
{
    public required SpfStatus Status { get; init; }  // Pass, Fail, SoftFail, Neutral, None, TempError, PermError
    public string? Domain { get; init; }
    public string? Ip { get; init; }
    public string? Info { get; init; }
}

public sealed record DkimResult
{
    public required DkimStatus Status { get; init; }  // Pass, Fail, None
    public string? Domain { get; init; }
    public string? Selector { get; init; }
    public string? Info { get; init; }
}

public sealed record DmarcResult
{
    public required DmarcStatus Status { get; init; }  // Pass, Fail, None
    public DmarcPolicy? Policy { get; init; }          // None, Quarantine, Reject
    public bool? Aligned { get; init; }
    public string? Domain { get; init; }
    public string? Info { get; init; }
}

public sealed record ReverseDnsResult
{
    public required ReverseDnsStatus Status { get; init; }  // Pass, Fail, None
    public string? Ip { get; init; }
    public string? Hostname { get; init; }
    public string? Info { get; init; }
}
```

### AuthValidation Structure

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

## Next Steps

- **[Authentication Results](/client-dotnet/concepts/auth-results/)** - Deep dive into auth results
- **[Email Objects](/client-dotnet/concepts/emails/)** - Understanding email structure
- **[Testing Patterns](/client-dotnet/testing/password-reset/)** - Real-world test examples
- **[Gateway Security](/gateway/security/)** - Understanding the security model
