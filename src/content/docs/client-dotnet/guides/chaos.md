---
title: Chaos Engineering
description: Test email resilience by simulating SMTP failures and network issues
---

Chaos engineering allows you to simulate various SMTP failure scenarios and network issues during email testing. This helps verify your application handles email delivery failures gracefully.

## Prerequisites

Chaos features must be enabled on the gateway server. Check availability:

```csharp
using VaultSandbox.Client;

await using var client = new VaultSandboxClient(
    Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"),
    Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")
);

var serverInfo = await client.GetServerInfoAsync();

if (serverInfo.ChaosEnabled)
{
    Console.WriteLine("Chaos features available");
}
else
{
    Console.WriteLine("Chaos features disabled on this server");
}
```

## Enabling Chaos

### During Inbox Creation

```csharp
using VaultSandbox.Client;

var inbox = await client.CreateInboxAsync(new CreateInboxOptions
{
    Chaos = new SetChaosConfigOptions
    {
        Enabled = true,
        Latency = new LatencyOptions
        {
            Enabled = true,
            MinDelayMs = 1000,
            MaxDelayMs = 5000,
        },
    },
});
```

### After Inbox Creation

```csharp
var chaos = await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    Latency = new LatencyOptions
    {
        Enabled = true,
        MinDelayMs = 1000,
        MaxDelayMs = 5000,
    },
});
```

### Getting Current Configuration

```csharp
var config = await inbox.GetChaosConfigAsync();

Console.WriteLine($"Chaos enabled: {config.Enabled}");
if (config.Latency != null)
{
    Console.WriteLine($"Latency enabled: {config.Latency.Enabled}");
}
```

### Disabling Chaos

```csharp
await inbox.DisableChaosAsync();
```

## Chaos Configuration

```csharp
using VaultSandbox.Client;

// Configuration classes
SetChaosConfigOptions      // Main configuration
LatencyOptions             // Latency injection settings
ConnectionDropOptions      // Connection drop settings
RandomErrorOptions         // Random error settings
GreylistOptions            // Greylisting settings
BlackholeOptions           // Blackhole mode settings
```

| Property         | Type                    | Required | Description                          |
| ---------------- | ----------------------- | -------- | ------------------------------------ |
| `Enabled`        | `bool`                  | Yes      | Master switch for all chaos features |
| `ExpiresAt`      | `DateTimeOffset?`       | No       | Auto-disable chaos after this time   |
| `Latency`        | `LatencyOptions`        | No       | Inject artificial delays             |
| `ConnectionDrop` | `ConnectionDropOptions` | No       | Simulate connection failures         |
| `RandomError`    | `RandomErrorOptions`    | No       | Return random SMTP error codes       |
| `Greylist`       | `GreylistOptions`       | No       | Simulate greylisting behavior        |
| `Blackhole`      | `BlackholeOptions`      | No       | Accept but silently discard emails   |

## Latency Injection

Inject artificial delays into email processing to test timeout handling and slow connections.

```csharp
await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    Latency = new LatencyOptions
    {
        Enabled = true,
        MinDelayMs = 500,       // Minimum delay (default: 500)
        MaxDelayMs = 5000,      // Maximum delay (default: 10000, max: 60000)
        Jitter = true,          // Randomize within range (default: true)
        Probability = 0.5,      // 50% of emails affected (default: 1.0)
    },
});
```

### Configuration Options

| Property     | Type     | Default | Description                                            |
| ------------ | -------- | ------- | ------------------------------------------------------ |
| `Enabled`    | `bool`   | —       | Enable/disable latency injection                       |
| `MinDelayMs` | `int`    | `500`   | Minimum delay in milliseconds                          |
| `MaxDelayMs` | `int`    | `10000` | Maximum delay in milliseconds (max: 60000)             |
| `Jitter`     | `bool`   | `true`  | Randomize delay within range. If false, uses MaxDelay  |
| `Probability`| `double` | `1.0`   | Probability of applying delay (0.0-1.0)                |

### Use Cases

- Test application timeout handling
- Verify UI responsiveness during slow email delivery
- Test retry logic with variable delays

## Connection Drop

Simulate connection failures by dropping SMTP connections.

```csharp
await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    ConnectionDrop = new ConnectionDropOptions
    {
        Enabled = true,
        Probability = 0.3,    // 30% of connections dropped
        Graceful = false,     // Abrupt RST instead of graceful FIN
    },
});
```

### Configuration Options

| Property      | Type     | Default | Description                                  |
| ------------- | -------- | ------- | -------------------------------------------- |
| `Enabled`     | `bool`   | —       | Enable/disable connection dropping           |
| `Probability` | `double` | `1.0`   | Probability of dropping connection (0.0-1.0) |
| `Graceful`    | `bool`   | `true`  | Use graceful close (FIN) vs abrupt (RST)     |

### Use Cases

- Test connection reset handling
- Verify TCP error recovery
- Test application behavior when SMTP connections fail mid-delivery

## Random Errors

Return random SMTP error codes to test error handling.

```csharp
await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    RandomError = new RandomErrorOptions
    {
        Enabled = true,
        ErrorRate = 0.1,                              // 10% of emails return errors
        ErrorTypes = new[] { RandomErrorType.Temporary }, // Only 4xx errors
    },
});
```

### Configuration Options

| Property     | Type                 | Default                        | Description                       |
| ------------ | -------------------- | ------------------------------ | --------------------------------- |
| `Enabled`    | `bool`               | —                              | Enable/disable random errors      |
| `ErrorRate`  | `double`             | `0.1`                          | Probability of returning an error |
| `ErrorTypes` | `RandomErrorType[]`  | `[RandomErrorType.Temporary]`  | Types of errors to return         |

### Error Types

| Type        | SMTP Codes | Description                          |
| ----------- | ---------- | ------------------------------------ |
| `Temporary` | 4xx        | Temporary failures, should retry     |
| `Permanent` | 5xx        | Permanent failures, should not retry |

### Use Cases

- Test 4xx SMTP error handling and retry logic
- Test 5xx SMTP error handling and failure notifications
- Verify application handles both error types correctly

## Greylisting Simulation

Simulate greylisting behavior where the first delivery attempt is rejected and subsequent retries are accepted.

```csharp
await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    Greylist = new GreylistOptions
    {
        Enabled = true,
        RetryWindowMs = 300000,              // 5 minute window
        MaxAttempts = 2,                     // Accept on second attempt
        TrackBy = GreylistTrackBy.IpSender,  // Track by IP and sender combination
    },
});
```

### Configuration Options

| Property        | Type              | Default                    | Description                              |
| --------------- | ----------------- | -------------------------- | ---------------------------------------- |
| `Enabled`       | `bool`            | —                          | Enable/disable greylisting               |
| `RetryWindowMs` | `int`             | `300000`                   | Window for tracking retries (5 min)      |
| `MaxAttempts`   | `int`             | `2`                        | Attempts before accepting                |
| `TrackBy`       | `GreylistTrackBy` | `GreylistTrackBy.IpSender` | How to identify unique delivery attempts |

### Tracking Methods

| Method     | Description                           |
| ---------- | ------------------------------------- |
| `Ip`       | Track by sender IP only               |
| `Sender`   | Track by sender email only            |
| `IpSender` | Track by combination of IP and sender |

### Use Cases

- Test SMTP retry behavior when mail servers use greylisting
- Verify retry intervals and backoff logic
- Test handling of temporary 4xx rejections

## Blackhole Mode

Accept emails but silently discard them without storing.

```csharp
await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    Blackhole = new BlackholeOptions
    {
        Enabled = true,
        TriggerWebhooks = false,  // Don't trigger webhooks for discarded emails
    },
});
```

### Configuration Options

| Property          | Type   | Default | Description                           |
| ----------------- | ------ | ------- | ------------------------------------- |
| `Enabled`         | `bool` | —       | Enable/disable blackhole mode         |
| `TriggerWebhooks` | `bool` | `false` | Trigger webhooks for discarded emails |

### Use Cases

- Test behavior when emails are silently lost
- Test webhook integration even when emails aren't stored
- Simulate email delivery that succeeds at SMTP level but fails at storage

## Auto-Expiring Chaos

Set chaos to automatically disable after a specific time:

```csharp
// Enable chaos for 1 hour
var expiresAt = DateTimeOffset.UtcNow.AddHours(1);

await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    ExpiresAt = expiresAt,
    Latency = new LatencyOptions { Enabled = true, MaxDelayMs = 3000 },
});
```

After `ExpiresAt`, chaos is automatically disabled and normal email delivery resumes.

## Combining Chaos Scenarios

Multiple chaos features can be enabled simultaneously:

```csharp
await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    // 30% of emails delayed 1-5 seconds
    Latency = new LatencyOptions
    {
        Enabled = true,
        MinDelayMs = 1000,
        MaxDelayMs = 5000,
        Probability = 0.3,
    },
    // 10% of emails return temporary errors
    RandomError = new RandomErrorOptions
    {
        Enabled = true,
        ErrorRate = 0.1,
        ErrorTypes = new[] { RandomErrorType.Temporary },
    },
});
```

## Complete Example

```csharp
using VaultSandbox.Client;

async Task TestChaosResilienceAsync()
{
    await using var client = new VaultSandboxClient(
        Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"),
        Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")
    );

    // Check if chaos is available
    var serverInfo = await client.GetServerInfoAsync();
    if (!serverInfo.ChaosEnabled)
    {
        Console.WriteLine("Chaos features not available on this server");
        return;
    }

    // Create inbox with chaos enabled
    await using var inbox = await client.CreateInboxAsync(new CreateInboxOptions
    {
        Chaos = new SetChaosConfigOptions
        {
            Enabled = true,
            Latency = new LatencyOptions
            {
                Enabled = true,
                MinDelayMs = 2000,
                MaxDelayMs = 5000,
                Probability = 0.5,
            },
            RandomError = new RandomErrorOptions
            {
                Enabled = true,
                ErrorRate = 0.1,
                ErrorTypes = new[] { RandomErrorType.Temporary },
            },
        },
    });

    Console.WriteLine($"Testing with chaos: {inbox.EmailAddress}");

    // Get current chaos configuration
    var config = await inbox.GetChaosConfigAsync();
    Console.WriteLine($"Chaos enabled: {config.Enabled}");
    Console.WriteLine($"Latency enabled: {config.Latency?.Enabled ?? false}");

    // Send test emails and verify handling
    // Your test logic here...

    // Update chaos configuration
    await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
    {
        Enabled = true,
        Greylist = new GreylistOptions
        {
            Enabled = true,
            MaxAttempts = 3,
        },
    });

    // More testing...

    // Disable chaos for normal operation tests
    await inbox.DisableChaosAsync();
}
```

## Testing Patterns

### Test Retry Logic

```csharp
// Enable greylisting to test retry behavior
await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    Greylist = new GreylistOptions { Enabled = true, MaxAttempts = 2 },
});

// Send email - first attempt will fail, retry should succeed
await SendEmailAsync(inbox.EmailAddress);

// If your mail sender retries correctly, email should arrive
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions { Timeout = 60000 });
```

### Test Timeout Handling

```csharp
// Enable high latency
await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    Latency = new LatencyOptions
    {
        Enabled = true,
        MinDelayMs = 10000,
        MaxDelayMs = 15000,
    },
});

// Test that your application handles timeouts correctly
try
{
    await inbox.WaitForEmailAsync(new WaitForEmailOptions { Timeout = 5000 });
}
catch (TimeoutException)
{
    // Expected: TimeoutException
    Console.WriteLine("Timeout handled correctly");
}
```

### Test Error Recovery

```csharp
// Enable high error rate
await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
{
    Enabled = true,
    RandomError = new RandomErrorOptions
    {
        Enabled = true,
        ErrorRate = 0.8,
        ErrorTypes = new[] { RandomErrorType.Temporary, RandomErrorType.Permanent },
    },
});

// Test that your application handles errors and retries appropriately
```

## Error Handling

```csharp
using VaultSandbox.Client;
using VaultSandbox.Client.Exceptions;

try
{
    await inbox.SetChaosConfigAsync(new SetChaosConfigOptions
    {
        Enabled = true,
        Latency = new LatencyOptions { Enabled = true },
    });
}
catch (InboxNotFoundException)
{
    Console.WriteLine("Inbox not found");
}
catch (ApiException ex) when (ex.StatusCode == 403)
{
    Console.WriteLine("Chaos features are disabled on this server");
}
catch (ApiException ex)
{
    Console.WriteLine($"API error ({ex.StatusCode}): {ex.Message}");
}
```

## xUnit Integration

### Chaos Test Base

```csharp
using VaultSandbox.Client;
using Xunit;

public abstract class ChaosTestBase : IAsyncLifetime
{
    protected VaultSandboxClient Client { get; private set; } = null!;
    protected IInbox Inbox { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Client = new VaultSandboxClient(
            Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"),
            Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")
        );

        var serverInfo = await Client.GetServerInfoAsync();
        if (!serverInfo.ChaosEnabled)
        {
            throw new SkipException("Chaos features not available on this server");
        }

        Inbox = await Client.CreateInboxAsync(new CreateInboxOptions
        {
            Chaos = new SetChaosConfigOptions
            {
                Enabled = true,
                Latency = new LatencyOptions
                {
                    Enabled = true,
                    MinDelayMs = 500,
                    MaxDelayMs = 2000,
                },
            },
        });
    }

    public async Task DisposeAsync()
    {
        if (Inbox != null)
        {
            await Inbox.DisposeAsync();
        }
        Client?.Dispose();
    }
}

public class SlowDeliveryTests : ChaosTestBase
{
    [Fact]
    public async Task HandlesSlowDelivery()
    {
        // Your test code here
    }
}
```

### Parameterized Chaos Tests

```csharp
using VaultSandbox.Client;
using Xunit;

public class ChaosScenarioTests : IAsyncLifetime
{
    private VaultSandboxClient _client = null!;
    private IInbox _inbox = null!;

    public async Task InitializeAsync()
    {
        _client = new VaultSandboxClient(
            Environment.GetEnvironmentVariable("VAULTSANDBOX_URL"),
            Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")
        );
        _inbox = await _client.CreateInboxAsync();
    }

    public async Task DisposeAsync()
    {
        await _inbox.DeleteAsync();
        _client.Dispose();
    }

    [Theory]
    [MemberData(nameof(ChaosConfigurations))]
    public async Task TestChaosScenario(string scenarioName, SetChaosConfigOptions config)
    {
        await _inbox.SetChaosConfigAsync(config);

        // Test your application's resilience
        // ...
    }

    public static IEnumerable<object[]> ChaosConfigurations()
    {
        yield return new object[]
        {
            "Latency",
            new SetChaosConfigOptions
            {
                Enabled = true,
                Latency = new LatencyOptions
                {
                    Enabled = true,
                    MinDelayMs = 1000,
                    MaxDelayMs = 3000,
                },
            },
        };

        yield return new object[]
        {
            "RandomError",
            new SetChaosConfigOptions
            {
                Enabled = true,
                RandomError = new RandomErrorOptions
                {
                    Enabled = true,
                    ErrorRate = 0.5,
                },
            },
        };

        yield return new object[]
        {
            "Greylist",
            new SetChaosConfigOptions
            {
                Enabled = true,
                Greylist = new GreylistOptions
                {
                    Enabled = true,
                    MaxAttempts = 2,
                },
            },
        };
    }
}
```

## Next Steps

- [Inbox API Reference](/client-dotnet/api/inbox/) - Complete inbox methods including chaos
- [CI/CD Integration](/client-dotnet/testing/cicd/) - Integrate chaos testing in pipelines
- [Error Handling](/client-dotnet/api/errors/) - Handle chaos-related errors
