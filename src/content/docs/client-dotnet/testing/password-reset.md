---
title: Testing Password Reset Flows
description: Learn how to test password reset email flows with VaultSandbox Client for .NET
---

Password reset flows are one of the most common email testing scenarios. This guide demonstrates how to use VaultSandbox to test password reset emails end-to-end, including link extraction and email validation.

## Basic Password Reset Test

Here's a complete example of testing a password reset flow:

```csharp
using VaultSandbox.Client;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://smtp.vaultsandbox.com")
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .Build();

var inbox = await client.CreateInboxAsync();

try
{
    // Trigger password reset in your application
    await YourApp.RequestPasswordResetAsync(inbox.EmailAddress);

    // Wait for and validate the reset email
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10),
        Subject = "Reset your password",
        UseRegex = true
    });

    // Extract reset link
    var resetLink = email.Links?.FirstOrDefault(url => url.Contains("/reset-password"));
    Console.WriteLine($"Reset link: {resetLink}");

    // Validate email authentication
    var authValidation = email.AuthResults?.Validate();
    Console.WriteLine($"Auth passed: {authValidation?.Passed}");
}
finally
{
    await client.DeleteInboxAsync(inbox.EmailAddress);
}
```

## xUnit Integration

Integrate password reset testing into your xUnit test suite:

```csharp
using System.Text.RegularExpressions;
using System.Web;
using VaultSandbox.Client;
using Xunit;

[Collection("VaultSandbox")]
public class PasswordResetTests
{
    private readonly VaultSandboxFixture _fixture;
    private readonly HttpClient _appClient;

    public PasswordResetTests(VaultSandboxFixture fixture)
    {
        _fixture = fixture;
        _appClient = new HttpClient { BaseAddress = new Uri("https://app.example.com") };
    }

    [Fact]
    public async Task Should_Send_Password_Reset_Email_With_Valid_Link()
    {
        var inbox = await _fixture.Client.CreateInboxAsync();

        try
        {
            // Trigger password reset
            await RequestPasswordResetAsync(inbox.EmailAddress);

            // Wait for email
            var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(10),
                Subject = "Reset your password",
                UseRegex = true
            });

            // Validate sender
            Assert.Equal("noreply@example.com", email.From);

            // Validate content
            Assert.Contains("requested a password reset", email.Text);
            Assert.NotNull(email.Html);

            // Extract and validate reset link
            var resetLink = email.Links?.FirstOrDefault(url => url.Contains("/reset-password"));
            Assert.NotNull(resetLink);
            Assert.Matches(@"^https://", resetLink);
            Assert.Contains("token=", resetLink);
        }
        finally
        {
            await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
        }
    }

    [Fact]
    public async Task Should_Contain_User_Information_In_Reset_Email()
    {
        var inbox = await _fixture.Client.CreateInboxAsync();

        try
        {
            var userEmail = inbox.EmailAddress;
            var userName = "John Doe";

            await RequestPasswordResetAsync(userEmail, userName);

            var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(10),
                Subject = "Reset your password",
                UseRegex = true
            });

            // Verify personalization
            Assert.Contains(userName, email.Text);
            Assert.Contains(userEmail, email.To);
        }
        finally
        {
            await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
        }
    }

    [Fact]
    public async Task Should_Validate_Reset_Link_Is_Functional()
    {
        var inbox = await _fixture.Client.CreateInboxAsync();

        try
        {
            await RequestPasswordResetAsync(inbox.EmailAddress);

            var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(10),
                Subject = "Reset your password",
                UseRegex = true
            });

            var resetLink = email.Links?.FirstOrDefault(url => url.Contains("/reset-password"));
            Assert.NotNull(resetLink);

            // Test that the link is accessible
            var response = await _appClient.GetAsync(resetLink);
            Assert.True(response.IsSuccessStatusCode);
        }
        finally
        {
            await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
        }
    }

    private async Task RequestPasswordResetAsync(string email, string? name = null)
    {
        await _appClient.PostAsJsonAsync("/api/auth/forgot-password", new
        {
            Email = email,
            Name = name
        });
    }
}
```

## Complete End-to-End Flow

Test the full password reset cycle from request to login with new password:

```csharp
[Collection("VaultSandbox")]
public class PasswordResetE2ETests
{
    private readonly VaultSandboxFixture _fixture;
    private readonly HttpClient _appClient;

    public PasswordResetE2ETests(VaultSandboxFixture fixture)
    {
        _fixture = fixture;
        _appClient = new HttpClient { BaseAddress = new Uri("https://app.example.com") };
    }

    [Fact]
    public async Task User_Can_Reset_Password_Via_Email()
    {
        var inbox = await _fixture.Client.CreateInboxAsync();

        try
        {
            // 1. Register user
            var registerResponse = await _appClient.PostAsJsonAsync("/api/auth/register", new
            {
                Email = inbox.EmailAddress,
                Password = "OldPassword123!"
            });
            registerResponse.EnsureSuccessStatusCode();

            // 2. Request password reset
            var resetResponse = await _appClient.PostAsJsonAsync("/api/auth/forgot-password", new
            {
                Email = inbox.EmailAddress
            });
            resetResponse.EnsureSuccessStatusCode();

            // 3. Wait for reset email
            var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(30),
                Subject = "Password Reset",
                UseRegex = true
            });

            // 4. Assert email received with correct content
            Assert.Contains("Password Reset", email.Subject);
            Assert.NotNull(email.Links);
            Assert.NotEmpty(email.Links);

            // 5. Extract reset link and token
            var resetLink = email.Links?.FirstOrDefault(l => l.Contains("/reset-password"));
            Assert.NotNull(resetLink);

            var uri = new Uri(resetLink);
            var token = HttpUtility.ParseQueryString(uri.Query)["token"];
            Assert.NotNull(token);

            // 6. Complete reset with new password
            var completeResponse = await _appClient.PostAsJsonAsync("/api/auth/reset-password", new
            {
                Token = token,
                NewPassword = "NewPassword456!"
            });
            completeResponse.EnsureSuccessStatusCode();

            // 7. Verify new password works
            var loginResponse = await _appClient.PostAsJsonAsync("/api/auth/login", new
            {
                Email = inbox.EmailAddress,
                Password = "NewPassword456!"
            });
            Assert.True(loginResponse.IsSuccessStatusCode);
        }
        finally
        {
            await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
        }
    }

    [Fact]
    public async Task Reset_Email_Passes_Authentication()
    {
        var inbox = await _fixture.Client.CreateInboxAsync();

        try
        {
            await _appClient.PostAsJsonAsync("/api/auth/forgot-password", new
            {
                Email = inbox.EmailAddress
            });

            var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(30),
                Subject = "Password Reset",
                UseRegex = true
            });

            var validation = email.AuthResults?.Validate();
            Assert.True(validation?.Passed, "Reset email should pass all auth checks");
        }
        finally
        {
            await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
        }
    }
}
```

## Link Extraction Patterns

VaultSandbox automatically extracts all links from emails. Here are common patterns for finding password reset links:

```csharp
// Find by path
var resetLink = email.Links?.FirstOrDefault(url => url.Contains("/reset-password"));

// Find by domain
var resetLink = email.Links?.FirstOrDefault(url => url.Contains("yourdomain.com/reset"));

// Find by query parameter
var resetLink = email.Links?.FirstOrDefault(url => url.Contains("token="));

// Find using regex
var resetLink = email.Links?.FirstOrDefault(url =>
    Regex.IsMatch(url, @"/reset.*token=", RegexOptions.IgnoreCase));

// Extract token from link
var uri = new Uri(resetLink);
var token = HttpUtility.ParseQueryString(uri.Query)["token"];
Assert.NotNull(token);
Assert.True(token.Length > 20, "Token should be sufficiently long");
```

## Validating Email Content

Test the content and formatting of your password reset emails:

```csharp
[Fact]
public async Task Should_Have_Properly_Formatted_Reset_Email()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        await RequestPasswordResetAsync(inbox.EmailAddress);

        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Reset your password",
            UseRegex = true
        });

        // Validate plain text version
        Assert.NotNull(email.Text);
        Assert.Contains("reset your password", email.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("undefined", email.Text);
        Assert.DoesNotContain("[object Object]", email.Text);

        // Validate HTML version
        Assert.NotNull(email.Html);
        Assert.Contains("<a href=", email.Html);
        Assert.Contains("reset", email.Html, StringComparison.OrdinalIgnoreCase);

        // Validate email has exactly one reset link
        var resetLinks = (email.Links ?? []).Where(url => url.Contains("/reset-password")).ToList();
        Assert.Single(resetLinks);

        // Validate headers
        Assert.NotNull(email.Headers);
        Assert.True(email.Headers.ContainsKey("content-type"));
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Testing Security Features

Validate email authentication to ensure your emails won't be marked as spam:

```csharp
[Fact]
public async Task Should_Pass_Email_Authentication_Checks()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        await RequestPasswordResetAsync(inbox.EmailAddress);

        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Reset your password",
            UseRegex = true
        });

        var validation = email.AuthResults?.Validate();

        // Check that validation was performed
        Assert.NotNull(validation);

        // Log any failures for debugging
        if (validation.Passed == false)
        {
            Console.WriteLine($"Email authentication failures: {string.Join(", ", validation.Failures)}");
        }

        // Check individual authentication methods (if configured)
        if (email.AuthResults?.Spf is not null)
        {
            Assert.True(
                email.AuthResults.Spf.Status is SpfStatus.Pass or SpfStatus.Neutral or SpfStatus.SoftFail,
                $"SPF status should be acceptable, was: {email.AuthResults.Spf.Status}");
        }

        if (email.AuthResults?.Dkim?.Any() == true)
        {
            Assert.True(
                email.AuthResults.Dkim[0].Status is DkimStatus.Pass or DkimStatus.None,
                $"DKIM status should be acceptable, was: {email.AuthResults.Dkim[0].Status}");
        }
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Testing Reset Token Expiration

Test that your password reset emails include expiration information:

```csharp
[Fact]
public async Task Should_Include_Expiration_Time_In_Reset_Email()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        await RequestPasswordResetAsync(inbox.EmailAddress);

        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Reset your password",
            UseRegex = true
        });

        // Validate expiration is mentioned
        Assert.NotNull(email.Text);
        var textLower = email.Text.ToLower();
        var hasExpiration = textLower.Contains("expires") ||
                           textLower.Contains("valid for") ||
                           textLower.Contains("24 hours") ||
                           textLower.Contains("1 hour");

        Assert.True(hasExpiration, "Reset email should mention expiration");
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Testing Multiple Reset Requests

Test what happens when a user requests multiple password resets:

```csharp
[Fact]
public async Task Should_Handle_Multiple_Reset_Requests()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        // Request multiple resets
        await RequestPasswordResetAsync(inbox.EmailAddress);
        await RequestPasswordResetAsync(inbox.EmailAddress);

        // Wait for both emails
        await inbox.WaitForEmailCountAsync(2, new WaitForEmailCountOptions
        {
            Timeout = TimeSpan.FromSeconds(15)
        });

        var emails = await inbox.GetEmailsAsync();
        Assert.Equal(2, emails.Count);

        // Both should have reset links
        foreach (var email in emails)
        {
            var resetLink = email.Links?.FirstOrDefault(url => url.Contains("/reset-password"));
            Assert.NotNull(resetLink);
        }

        // Tokens should be different (if your app invalidates old tokens)
        var link1 = emails[0].Links!.First(url => url.Contains("/reset-password"));
        var link2 = emails[1].Links!.First(url => url.Contains("/reset-password"));

        var token1 = HttpUtility.ParseQueryString(new Uri(link1).Query)["token"];
        var token2 = HttpUtility.ParseQueryString(new Uri(link2).Query)["token"];

        Assert.NotEqual(token1, token2);
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## NUnit Password Reset Tests

For NUnit, the structure is similar with different attributes:

```csharp
using NUnit.Framework;
using VaultSandbox.Client;

[TestFixture]
public class PasswordResetTests
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;
    private HttpClient _appClient = null!;

    [OneTimeSetUp]
    public void OneTimeSetUp()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
            .Build();

        _appClient = new HttpClient { BaseAddress = new Uri("https://app.example.com") };
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

    [Test]
    public async Task Should_Send_Password_Reset_Email()
    {
        await _appClient.PostAsJsonAsync("/api/auth/forgot-password", new
        {
            Email = _inbox.EmailAddress
        });

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Reset",
            UseRegex = true
        });

        Assert.That(email, Is.Not.Null);
        Assert.That(email.Subject, Does.Contain("Reset"));

        var resetLink = email.Links?.FirstOrDefault(url => url.Contains("/reset-password"));
        Assert.That(resetLink, Is.Not.Null);
    }
}
```

## Best Practices

### Use Specific Subject Filters

Always filter by subject to ensure you're testing the right email:

```csharp
// Good: Specific subject filter
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10),
    Subject = "Reset your password",
    UseRegex = true
});

// Avoid: No filter (might match wrong email in CI)
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(10)
});
```

### Clean Up Inboxes

Always delete inboxes after tests to avoid hitting limits:

```csharp
public async Task DisposeAsync()
{
    if (_inbox != null)
    {
        await _client.DeleteInboxAsync(_inbox.EmailAddress);
    }
}
```

### Use Appropriate Timeouts

Set realistic timeouts based on your email delivery speed:

```csharp
// Local development: shorter timeout
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(5)
});

// CI/CD: longer timeout to account for slower environments
var isCI = Environment.GetEnvironmentVariable("CI") == "true";
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = isCI ? TimeSpan.FromSeconds(30) : TimeSpan.FromSeconds(10)
});
```

### Test Complete Flow

Don't just validate that the email was sent - test that the link actually works:

```csharp
[Fact]
public async Task Should_Complete_Full_Password_Reset_Flow()
{
    var inbox = await _fixture.Client.CreateInboxAsync();

    try
    {
        // 1. Request reset
        await RequestPasswordResetAsync(inbox.EmailAddress);

        // 2. Get email
        var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10),
            Subject = "Reset your password",
            UseRegex = true
        });

        // 3. Extract link
        var resetLink = email.Links?.FirstOrDefault(url => url.Contains("/reset-password"));
        Assert.NotNull(resetLink);

        // 4. Visit reset page
        var response = await _appClient.GetAsync(resetLink);
        Assert.True(response.IsSuccessStatusCode);

        // 5. Submit new password
        var newPassword = "NewSecurePassword123!";
        await SubmitPasswordResetAsync(resetLink, newPassword);

        // 6. Verify login with new password
        var loginSuccess = await LoginAsync(inbox.EmailAddress, newPassword);
        Assert.True(loginSuccess);
    }
    finally
    {
        await _fixture.Client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

## Next Steps

- [Testing Multi-Email Scenarios](/client-dotnet/testing/multi-email/) - Handle multiple emails
- [CI/CD Integration](/client-dotnet/testing/cicd/) - Run tests in your pipeline
- [Working with Attachments](/client-dotnet/guides/attachments/) - Test emails with attachments
