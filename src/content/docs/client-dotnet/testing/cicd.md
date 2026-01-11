---
title: CI/CD Integration
description: Learn how to integrate VaultSandbox email testing into your CI/CD pipelines with .NET
---

VaultSandbox is designed specifically for automated testing in CI/CD pipelines. This guide shows you how to integrate email testing into popular CI/CD platforms using xUnit, NUnit, and MSTest.

## xUnit Setup

xUnit is the most popular testing framework for .NET. Use `IAsyncLifetime` for proper async setup and teardown.

### Basic Test Class

```csharp
using VaultSandbox.Client;
using Xunit;

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
            try { await _client.DeleteInboxAsync(_inbox.EmailAddress); }
            catch { /* Log but don't fail */ }
        }
    }

    [Fact]
    public async Task Should_Receive_Welcome_Email()
    {
        await SendWelcomeEmail(_inbox.EmailAddress);

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Welcome"
        });

        Assert.Contains("Welcome", email.Subject);
        Assert.Equal("noreply@example.com", email.From);
    }
}
```

### Collection Fixture (Shared Client)

Share a single client across multiple test classes for efficiency:

```csharp
using VaultSandbox.Client;
using Xunit;

public class VaultSandboxFixture : IAsyncLifetime
{
    public IVaultSandboxClient Client { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
            .Build();

        // Validate connection
        var isValid = await Client.ValidateApiKeyAsync();
        if (!isValid)
            throw new InvalidOperationException("Invalid VaultSandbox API key");
    }

    public async Task DisposeAsync()
    {
        try
        {
            var deleted = await Client.DeleteAllInboxesAsync();
            if (deleted > 0)
                Console.WriteLine($"Cleaned up {deleted} orphaned inboxes");
        }
        catch { /* Log but don't fail */ }
    }
}

[CollectionDefinition("VaultSandbox")]
public class VaultSandboxCollection : ICollectionFixture<VaultSandboxFixture> { }

[Collection("VaultSandbox")]
public class EmailTests
{
    private readonly VaultSandboxFixture _fixture;

    public EmailTests(VaultSandboxFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Test_Email_Flow()
    {
        var inbox = await _fixture.Client.CreateInboxAsync();
        try
        {
            // Test logic
            await SendEmail(inbox.EmailAddress);

            var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(10)
            });

            Assert.NotNull(email);
        }
        finally
        {
            await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
        }
    }
}
```

### Test Categories

Use traits to categorize email tests for selective execution:

```csharp
[Fact]
[Trait("Category", "Email")]
[Trait("Category", "Integration")]
public async Task Should_Receive_Email()
{
    // Test implementation
}
```

Run only email tests:

```bash
dotnet test --filter Category=Email
```

## NUnit Setup

NUnit provides `[OneTimeSetUp]`, `[SetUp]`, `[TearDown]`, and `[OneTimeTearDown]` for lifecycle management.

```csharp
using NUnit.Framework;
using VaultSandbox.Client;

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
            try { await _client.DeleteInboxAsync(_inbox.EmailAddress); }
            catch { /* Ignore */ }
        }
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        await _client.DeleteAllInboxesAsync();
    }

    [Test]
    public async Task Should_Receive_Email()
    {
        await SendEmail(_inbox.EmailAddress);

        var email = await _inbox.WaitForEmailAsync();

        Assert.That(email, Is.Not.Null);
        Assert.That(email.Subject, Does.Contain("Expected Subject"));
    }

    [Test]
    [Category("Email")]
    public async Task Should_Validate_Email_Authentication()
    {
        await SendEmail(_inbox.EmailAddress);

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(15)
        });

        var validation = email.AuthResults?.Validate();
        Assert.That(validation?.Passed, Is.True, "Email should pass auth checks");
    }
}
```

## MSTest Setup

MSTest uses `[ClassInitialize]`, `[TestInitialize]`, `[TestCleanup]`, and `[ClassCleanup]`.

```csharp
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VaultSandbox.Client;

[TestClass]
public class EmailTests
{
    private static IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;

    [ClassInitialize]
    public static void ClassInitialize(TestContext context)
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
            .Build();
    }

    [TestInitialize]
    public async Task TestInitialize()
    {
        _inbox = await _client.CreateInboxAsync();
    }

    [TestCleanup]
    public async Task TestCleanup()
    {
        if (_inbox != null)
        {
            try { await _client.DeleteInboxAsync(_inbox.EmailAddress); }
            catch { /* Ignore */ }
        }
    }

    [ClassCleanup]
    public static async Task ClassCleanup()
    {
        await _client.DeleteAllInboxesAsync();
    }

    [TestMethod]
    [TestCategory("Email")]
    public async Task Should_Receive_Email()
    {
        await SendEmail(_inbox.EmailAddress);

        var email = await _inbox.WaitForEmailAsync();

        Assert.IsNotNull(email);
    }
}
```

## GitHub Actions

### Basic Workflow

```yaml
# .github/workflows/test.yml
name: Email Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  email-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'

      - name: Restore dependencies
        run: dotnet restore

      - name: Build
        run: dotnet build --no-restore

      - name: Run email tests
        env:
          VAULTSANDBOX_URL: ${{ secrets.VAULTSANDBOX_URL }}
          VAULTSANDBOX_API_KEY: ${{ secrets.VAULTSANDBOX_API_KEY }}
        run: dotnet test --no-build --filter Category=Email --logger trx --results-directory TestResults

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: TestResults/*.trx
```

### With Self-Hosted Gateway

Run the VaultSandbox Gateway as a service container:

```yaml
# .github/workflows/test-with-gateway.yml
name: Email Tests (Self-Hosted)

on: [push, pull_request]

jobs:
  email-tests:
    runs-on: ubuntu-latest

    services:
      vaultsandbox:
        image: vaultsandbox/gateway:latest
        ports:
          - 3000:3000
          - 2525:25
        env:
          API_KEYS: test-api-key-12345
          SMTP_HOST: 0.0.0.0
          SMTP_PORT: 25

    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'

      - name: Wait for VaultSandbox
        run: |
          timeout 30 bash -c 'until nc -z localhost 3000; do sleep 1; done'

      - name: Run tests
        env:
          VAULTSANDBOX_URL: http://localhost:3000
          VAULTSANDBOX_API_KEY: test-api-key-12345
        run: dotnet test --filter Category=Email
```

### Parallel Testing

Run test groups in parallel across multiple jobs:

```yaml
# .github/workflows/test-parallel.yml
name: Parallel Email Tests

on: [push, pull_request]

jobs:
  email-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-group: [Auth, Transactional, Notifications]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '9.0.x'

      - run: dotnet restore

      - name: Run test group
        env:
          VAULTSANDBOX_URL: ${{ secrets.VAULTSANDBOX_URL }}
          VAULTSANDBOX_API_KEY: ${{ secrets.VAULTSANDBOX_API_KEY }}
        run: dotnet test --filter "Category=${{ matrix.test-group }}"
```

## GitLab CI

### Basic Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - test

variables:
  DOTNET_VERSION: '9.0'

email-tests:
  stage: test
  image: mcr.microsoft.com/dotnet/sdk:9.0
  variables:
    VAULTSANDBOX_URL: $VAULTSANDBOX_URL
    VAULTSANDBOX_API_KEY: $VAULTSANDBOX_API_KEY
  script:
    - dotnet restore
    - dotnet build --no-restore
    - dotnet test --no-build --logger trx --results-directory TestResults
  artifacts:
    paths:
      - TestResults/*.trx
    reports:
      junit: TestResults/*.trx
    when: always
```

### With Docker Compose

```yaml
# .gitlab-ci.yml
stages:
  - test

email-tests:
  stage: test
  image: mcr.microsoft.com/dotnet/sdk:9.0
  services:
    - name: vaultsandbox/gateway:latest
      alias: vaultsandbox
  variables:
    VAULTSANDBOX_URL: http://vaultsandbox:3000
    VAULTSANDBOX_API_KEY: test-api-key-12345
    API_KEYS: test-api-key-12345
    SMTP_HOST: 0.0.0.0
  before_script:
    - apt-get update && apt-get install -y netcat-openbsd
    - timeout 30 sh -c 'until nc -z vaultsandbox 3000; do sleep 1; done'
  script:
    - dotnet restore
    - dotnet test
```

## Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  - main
  - develop

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: UseDotNet@2
    displayName: 'Setup .NET'
    inputs:
      version: '9.0.x'

  - script: dotnet restore
    displayName: 'Restore dependencies'

  - script: dotnet build --no-restore
    displayName: 'Build'

  - script: dotnet test --no-build --logger trx --results-directory $(Build.ArtifactStagingDirectory)/TestResults
    displayName: 'Run tests'
    env:
      VAULTSANDBOX_URL: $(VAULTSANDBOX_URL)
      VAULTSANDBOX_API_KEY: $(VAULTSANDBOX_API_KEY)

  - task: PublishTestResults@2
    displayName: 'Publish test results'
    inputs:
      testResultsFormat: 'VSTest'
      testResultsFiles: '$(Build.ArtifactStagingDirectory)/TestResults/*.trx'
    condition: always()
```

## Environment Variables

### Required Variables

Set these environment variables in your CI platform:

| Variable               | Description            | Example                         |
| ---------------------- | ---------------------- | ------------------------------- |
| `VAULTSANDBOX_URL`     | Gateway URL            | `https://smtp.vaultsandbox.com` |
| `VAULTSANDBOX_API_KEY` | API authentication key | `vs_1234567890abcdef`           |

### Optional Variables

| Variable                  | Description           | Default |
| ------------------------- | --------------------- | ------- |
| `VAULTSANDBOX_STRATEGY`   | Delivery strategy     | `Sse`   |
| `VAULTSANDBOX_TIMEOUT_MS` | Default timeout (ms)  | `30000` |
| `VAULTSANDBOX_POLL_MS`    | Polling interval (ms) | `2000`  |

### Configuration Helper

Create a helper class to manage configuration across environments:

```csharp
public static class VaultSandboxConfig
{
    public static IVaultSandboxClient CreateClient()
    {
        var url = Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")
            ?? throw new InvalidOperationException("VAULTSANDBOX_URL is required");

        var apiKey = Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")
            ?? throw new InvalidOperationException("VAULTSANDBOX_API_KEY is required");

        var strategy = Environment.GetEnvironmentVariable("VAULTSANDBOX_STRATEGY") ?? "Sse";
        var timeoutMs = int.Parse(Environment.GetEnvironmentVariable("VAULTSANDBOX_TIMEOUT_MS") ?? "30000");
        var pollMs = int.Parse(Environment.GetEnvironmentVariable("VAULTSANDBOX_POLL_MS") ?? "2000");

        var builder = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(url)
            .WithApiKey(apiKey)
            .WithWaitTimeout(TimeSpan.FromMilliseconds(timeoutMs))
            .WithPollInterval(TimeSpan.FromMilliseconds(pollMs));

        return strategy.ToLower() switch
        {
            "polling" => builder.UsePollingDelivery().Build(),
            _ => builder.UseSseDelivery().Build() // SSE is default
        };
    }
}

// Usage in tests
public class EmailTests : IAsyncLifetime
{
    private IVaultSandboxClient _client = null!;

    public Task InitializeAsync()
    {
        _client = VaultSandboxConfig.CreateClient();
        return Task.CompletedTask;
    }

    // ...
}
```

## Best Practices

### Always Clean Up

Ensure inboxes are deleted even when tests fail:

```csharp
public async Task DisposeAsync()
{
    if (_inbox != null)
    {
        try
        {
            await _client.DeleteInboxAsync(_inbox.EmailAddress);
        }
        catch (Exception ex)
        {
            // Log but don't fail the test
            Console.WriteLine($"Failed to delete inbox: {ex.Message}");
        }
    }
}
```

### Use Global Cleanup

Add a final cleanup step to delete any orphaned inboxes:

```csharp
public class VaultSandboxFixture : IAsyncLifetime
{
    // ...

    public async Task DisposeAsync()
    {
        try
        {
            var deleted = await Client.DeleteAllInboxesAsync();
            if (deleted > 0)
            {
                Console.WriteLine($"Cleaned up {deleted} orphaned inboxes");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to clean up orphaned inboxes: {ex.Message}");
        }
    }
}
```

### Set Appropriate Timeouts

CI environments can be slower than local development:

```csharp
private static readonly TimeSpan CiTimeout = TimeSpan.FromSeconds(30);
private static readonly TimeSpan LocalTimeout = TimeSpan.FromSeconds(10);

private TimeSpan GetTimeout()
{
    var isCI = Environment.GetEnvironmentVariable("CI") == "true";
    return isCI ? CiTimeout : LocalTimeout;
}

[Fact]
public async Task Should_Receive_Email()
{
    var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = GetTimeout(),
        Subject = "Welcome",
        UseRegex = true
    });

    Assert.NotNull(email);
}
```

### Use Test Isolation

Each test should create its own inbox:

```csharp
// Good: Isolated tests
public class EmailTests : IAsyncLifetime
{
    private IInbox _inbox = null!;

    public async Task InitializeAsync()
    {
        _inbox = await _client.CreateInboxAsync(); // Fresh inbox per test
    }

    [Fact]
    public async Task Test1() { /* Uses own inbox */ }

    [Fact]
    public async Task Test2() { /* Uses own inbox */ }
}

// Avoid: Shared inbox across tests
public class EmailTests
{
    private static IInbox _sharedInbox = null!; // BAD: Shared state

    [ClassInitialize]
    public static async Task Initialize(TestContext context)
    {
        _sharedInbox = await _client.CreateInboxAsync();
    }
}
```

### Handle Flaky Tests

Configure retries for occasionally flaky email tests. In xUnit, use the `Xunit.Retry` package:

```csharp
// Install: dotnet add package Xunit.Retry

[RetryFact(MaxRetries = 3)]
public async Task Should_Receive_Email()
{
    var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10),
        Subject = "Welcome",
        UseRegex = true
    });

    Assert.NotNull(email);
}
```

Or implement a simple retry helper:

```csharp
public static class TestRetry
{
    public static async Task ExecuteWithRetryAsync(Func<Task> action, int maxRetries = 3)
    {
        var attempts = 0;
        while (true)
        {
            try
            {
                attempts++;
                await action();
                return;
            }
            catch when (attempts < maxRetries)
            {
                await Task.Delay(TimeSpan.FromSeconds(1));
            }
        }
    }
}

// Usage
[Fact]
public async Task Should_Receive_Email()
{
    await TestRetry.ExecuteWithRetryAsync(async () =>
    {
        var email = await _inbox.WaitForEmailAsync();
        Assert.NotNull(email);
    });
}
```

### Log Helpful Debug Info

Add logging to help debug CI failures:

```csharp
[Fact]
public async Task Should_Receive_Welcome_Email()
{
    Console.WriteLine($"Created inbox: {_inbox.EmailAddress}");

    await SendWelcomeEmail(_inbox.EmailAddress);
    Console.WriteLine("Triggered welcome email");

    var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10),
        Subject = "Welcome",
        UseRegex = true
    });

    Console.WriteLine($"Received email: {email.Subject}");
    Assert.Equal("noreply@example.com", email.From);
}
```

## Troubleshooting

### Tests Timeout in CI

**Symptoms:** Tests pass locally but timeout in CI

**Solutions:**

- Increase timeout values for CI environment
- Check network connectivity to VaultSandbox Gateway
- Verify API key is correctly set in CI environment
- Use longer polling intervals to reduce API load

```csharp
var isCI = Environment.GetEnvironmentVariable("CI") == "true";

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .WithPollInterval(isCI ? TimeSpan.FromSeconds(3) : TimeSpan.FromSeconds(1))
    .Build();
```

### Rate Limiting

**Symptoms:** Tests fail with HTTP 429 status codes

**Solutions:**

- Reduce test parallelization
- Increase retry delay
- Use fewer inboxes per test
- Configure rate limit handling

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .WithMaxRetries(5)
    .WithRetryDelay(TimeSpan.FromSeconds(2))
    .Build();
```

### Orphaned Inboxes

**Symptoms:** Running out of inbox quota

**Solutions:**

- Always use `DisposeAsync()` to delete inboxes
- Add global cleanup with `DeleteAllInboxesAsync()`
- Run manual cleanup script

```csharp
// Manual cleanup script
using VaultSandbox.Client;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .Build();

var deleted = await client.DeleteAllInboxesAsync();
Console.WriteLine($"Deleted {deleted} inboxes");
```

### Connection Issues

**Symptoms:** Cannot connect to VaultSandbox Gateway

**Solutions:**

- Verify URL is correct and accessible from CI
- Check firewall rules
- Ensure service is running (for self-hosted)
- Test connectivity in CI

```yaml
# GitHub Actions
- name: Test connectivity
  run: curl -f $VAULTSANDBOX_URL/health || exit 1
  env:
    VAULTSANDBOX_URL: ${{ secrets.VAULTSANDBOX_URL }}
```

## Performance Optimization

### Parallel Test Execution

Run tests in parallel for faster CI builds:

```bash
# Run with multiple threads
dotnet test --parallel

# Limit parallelization (useful for rate limiting)
dotnet test -- xUnit.MaxParallelThreads=4
```

### Reduce API Calls

Minimize API calls by fetching all emails at once:

```csharp
// Good: Single API call
var emails = await _inbox.GetEmailsAsync();
var welcome = emails.FirstOrDefault(e => e.Subject.Contains("Welcome"));

// Avoid: Multiple API calls
var email1 = await _inbox.GetEmailAsync(id1);
var email2 = await _inbox.GetEmailAsync(id2);
```

### Use SSE for Real-time Tests

Enable SSE strategy for faster delivery when supported:

```csharp
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .UseSseDelivery() // Faster than polling
    .Build();
```

## Next Steps

- [Password Reset Testing](/client-dotnet/testing/password-reset/) - Specific test patterns
- [Multi-Email Scenarios](/client-dotnet/testing/multi-email/) - Testing multiple emails
- [Error Handling](/client-dotnet/api/errors/) - Handle failures gracefully
