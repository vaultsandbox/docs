---
title: Webhooks
description: Set up webhooks to receive real-time notifications when emails arrive
---

Webhooks provide a way to receive HTTP callbacks when events occur in your inbox. Instead of polling or maintaining SSE connections, your application receives push notifications automatically.

## Creating a Webhook

Create a webhook for an inbox to receive notifications when emails arrive:

```csharp
var inbox = await client.CreateInboxAsync();

var webhook = await inbox.CreateWebhookAsync(new CreateWebhookOptions
{
    Url = "https://your-app.com/webhook/emails",
    Events = [WebhookEventType.EmailReceived]
});

Console.WriteLine($"Webhook ID: {webhook.Id}");
Console.WriteLine($"Secret: {webhook.Secret}"); // Save this for signature verification
```

### Webhook Options

```csharp
public sealed class CreateWebhookOptions
{
    public required string Url { get; set; }
    public required IList<WebhookEventType> Events { get; set; }
    public WebhookTemplateConfig? Template { get; set; }
    public WebhookFilterConfig? Filter { get; set; }
    public string? Description { get; set; }
}
```

| Property      | Type                    | Required | Description                                    |
| ------------- | ----------------------- | -------- | ---------------------------------------------- |
| `Url`         | `string`                | Yes      | The URL to send webhook requests to            |
| `Events`      | `IList<WebhookEventType>` | Yes    | Events that trigger the webhook                |
| `Template`    | `WebhookTemplateConfig` | No       | Payload format template                        |
| `Filter`      | `WebhookFilterConfig`   | No       | Filter which emails trigger the webhook        |
| `Description` | `string`                | No       | Human-readable description (max 500 chars)     |

### Event Types

| Event                              | Description                           |
| ---------------------------------- | ------------------------------------- |
| `WebhookEventType.EmailReceived`   | Email received by the inbox           |
| `WebhookEventType.EmailStored`     | Email successfully stored             |
| `WebhookEventType.EmailDeleted`    | Email deleted from the inbox          |

## Managing Webhooks

### List Webhooks

```csharp
var webhooks = await inbox.ListWebhooksAsync();

Console.WriteLine($"Total webhooks: {webhooks.Count}");
foreach (var webhook in webhooks)
{
    var status = webhook.Enabled ? "enabled" : "disabled";
    Console.WriteLine($"- {webhook.Id}: {webhook.Url} ({status})");
}
```

### Get Webhook Details

```csharp
var webhook = await inbox.GetWebhookAsync("whk_abc123");

Console.WriteLine($"URL: {webhook.Url}");
Console.WriteLine($"Events: {string.Join(", ", webhook.Events)}");
Console.WriteLine($"Scope: {webhook.Scope}");
Console.WriteLine($"Created: {webhook.CreatedAt}");
Console.WriteLine($"Updated: {webhook.UpdatedAt?.ToString() ?? "Never"}");
Console.WriteLine($"Last delivery: {webhook.LastDeliveryAt?.ToString() ?? "Never"}");
Console.WriteLine($"Last delivery status: {webhook.LastDeliveryStatus?.ToString() ?? "N/A"}");

if (webhook.Stats is not null)
{
    Console.WriteLine($"Deliveries: {webhook.Stats.SuccessfulDeliveries}/{webhook.Stats.TotalDeliveries}");
    Console.WriteLine($"Failed: {webhook.Stats.FailedDeliveries}");
    Console.WriteLine($"Success rate: {webhook.Stats.SuccessRate:F1}%");
}
```

### Update Webhook

```csharp
var updated = await inbox.UpdateWebhookAsync("whk_abc123", new UpdateWebhookOptions
{
    Url = "https://your-app.com/webhook/v2/emails",
    Enabled = true,
    Description = "Updated webhook endpoint"
});
```

All available update options:

```csharp
var options = new UpdateWebhookOptions
{
    Url = "https://new-url.com/webhook",                    // New target URL
    Events = [WebhookEventType.EmailReceived,               // New event subscriptions
              WebhookEventType.EmailStored],
    Template = WebhookTemplateConfig.BuiltIn("slack"),      // New template
    Filter = new WebhookFilterConfig { ... },               // New filter config
    Description = "New description",                        // New description
    Enabled = true                                          // Enable/disable
};

// To remove template or filter, use helper methods
options.RemoveTemplate();  // Clears template
options.RemoveFilter();    // Clears filter

var updated = await inbox.UpdateWebhookAsync("whk_abc123", options);
```

### Delete Webhook

```csharp
// Using inbox method
await inbox.DeleteWebhookAsync("whk_abc123");

// Or using webhook instance
var webhook = await inbox.GetWebhookAsync("whk_abc123");
await webhook.DeleteAsync();

Console.WriteLine("Webhook deleted");
```

## Filtering Webhooks

Use filters to control which emails trigger webhooks:

```csharp
var webhook = await inbox.CreateWebhookAsync(new CreateWebhookOptions
{
    Url = "https://your-app.com/webhook/emails",
    Events = [WebhookEventType.EmailReceived],
    Filter = new WebhookFilterConfig
    {
        Rules =
        [
            new WebhookFilterRuleConfig
            {
                Field = FilterableField.FromAddress,
                Operator = FilterOperator.Domain,
                Value = "example.com"
            },
            new WebhookFilterRuleConfig
            {
                Field = FilterableField.Subject,
                Operator = FilterOperator.Contains,
                Value = "Invoice"
            }
        ],
        Mode = FilterMode.All  // All = AND, Any = OR
    }
});
```

### Filterable Fields

| Field                        | Description                     |
| ---------------------------- | ------------------------------- |
| `FilterableField.Subject`    | Email subject line              |
| `FilterableField.FromAddress`| Sender email address            |
| `FilterableField.FromName`   | Sender display name             |
| `FilterableField.ToAddress`  | Recipient email address         |
| `FilterableField.ToName`     | Recipient display name          |
| `FilterableField.BodyText`   | Plain text body                 |
| `FilterableField.BodyHtml`   | HTML body                       |

### Filter Operators

| Operator                    | Description                            | Example Value                |
| --------------------------- | -------------------------------------- | ---------------------------- |
| `FilterOperator.Equals`     | Exact match                            | `"noreply@example.com"`      |
| `FilterOperator.Contains`   | Contains substring                     | `"Reset"`                    |
| `FilterOperator.StartsWith` | Starts with string                     | `"RE:"`                      |
| `FilterOperator.EndsWith`   | Ends with string                       | `"@company.com"`             |
| `FilterOperator.Domain`     | Email domain match                     | `"example.com"`              |
| `FilterOperator.Regex`      | Regular expression match               | `@"Order #\d+"`              |
| `FilterOperator.Exists`     | Field exists and is non-empty          | `"true"`                     |

### Case Sensitivity

```csharp
var webhook = await inbox.CreateWebhookAsync(new CreateWebhookOptions
{
    Url = "https://your-app.com/webhook/emails",
    Events = [WebhookEventType.EmailReceived],
    Filter = new WebhookFilterConfig
    {
        Rules =
        [
            new WebhookFilterRuleConfig
            {
                Field = FilterableField.Subject,
                Operator = FilterOperator.Contains,
                Value = "urgent",
                CaseSensitive = false  // Case-insensitive match
            }
        ],
        Mode = FilterMode.All
    }
});
```

### Require Authentication

Only trigger webhooks for authenticated emails:

```csharp
var webhook = await inbox.CreateWebhookAsync(new CreateWebhookOptions
{
    Url = "https://your-app.com/webhook/verified-emails",
    Events = [WebhookEventType.EmailReceived],
    Filter = new WebhookFilterConfig
    {
        Rules = [],
        Mode = FilterMode.All,
        RequireAuth = true  // Only emails passing SPF/DKIM/DMARC
    }
});
```

## Templates

Templates control the webhook payload format.

### Built-in Templates

| Template       | Description                                      |
| -------------- | ------------------------------------------------ |
| `default`      | Full email data in standard JSON format          |
| `slack`        | Slack-compatible message blocks                  |
| `discord`      | Discord webhook embed format                     |
| `teams`        | Microsoft Teams adaptive card                    |
| `simple`       | Minimal payload with essential fields only       |
| `notification` | Push notification-friendly compact format        |
| `zapier`       | Zapier-optimized flat structure                  |

```csharp
// Slack-formatted payload
var slackWebhook = await inbox.CreateWebhookAsync(new CreateWebhookOptions
{
    Url = "https://hooks.slack.com/services/...",
    Events = [WebhookEventType.EmailReceived],
    Template = WebhookTemplateConfig.BuiltIn("slack")
});

// Discord-formatted payload
var discordWebhook = await inbox.CreateWebhookAsync(new CreateWebhookOptions
{
    Url = "https://discord.com/api/webhooks/...",
    Events = [WebhookEventType.EmailReceived],
    Template = WebhookTemplateConfig.BuiltIn("discord")
});

// Microsoft Teams
var teamsWebhook = await inbox.CreateWebhookAsync(new CreateWebhookOptions
{
    Url = "https://outlook.office.com/webhook/...",
    Events = [WebhookEventType.EmailReceived],
    Template = WebhookTemplateConfig.BuiltIn("teams")
});
```

### Custom Templates

```csharp
var webhook = await inbox.CreateWebhookAsync(new CreateWebhookOptions
{
    Url = "https://your-app.com/webhook/emails",
    Events = [WebhookEventType.EmailReceived],
    Template = WebhookTemplateConfig.Custom(
        body: """
        {
            "email_id": "{{email.id}}",
            "sender": "{{email.from}}",
            "subject_line": "{{email.subject}}",
            "received_timestamp": "{{email.receivedAt}}"
        }
        """,
        contentType: "application/json"
    )
});
```

## Testing Webhooks

### Send Test Request

```csharp
// Using inbox method
var result = await inbox.TestWebhookAsync("whk_abc123");

// Or using webhook instance
var webhook = await inbox.GetWebhookAsync("whk_abc123");
var result = await webhook.TestAsync();

if (result.Success)
{
    Console.WriteLine("Test successful!");
    Console.WriteLine($"Status: {result.StatusCode}");
    Console.WriteLine($"Response time: {result.ResponseTime}ms");
}
else
{
    Console.WriteLine($"Test failed: {result.Error}");
}
```

### Test Response

```csharp
public sealed class WebhookTestResult
{
    public bool Success { get; }
    public int? StatusCode { get; }
    public int? ResponseTime { get; }
    public string? ResponseBody { get; }
    public string? Error { get; }
}
```

### Webhook Properties

When retrieving a webhook, the following properties are available:

```csharp
public sealed class Webhook
{
    public string Id { get; }                              // Webhook ID (whk_ prefix)
    public string Url { get; }                             // Target URL
    public IReadOnlyList<WebhookEventType> Events { get; } // Subscribed events
    public WebhookScope Scope { get; }                     // Global or Inbox scope
    public string? InboxEmail { get; }                     // Inbox email (for inbox-scoped)
    public string? InboxHash { get; }                      // Inbox hash (for inbox-scoped)
    public bool Enabled { get; }                           // Whether active
    public string? Secret { get; }                         // Signing secret (whsec_ prefix)
    public WebhookTemplate? Template { get; }              // Template configuration
    public WebhookFilter? Filter { get; }                  // Filter configuration
    public string? Description { get; }                    // Optional description
    public DateTimeOffset CreatedAt { get; }               // Creation timestamp
    public DateTimeOffset? UpdatedAt { get; }              // Last update timestamp
    public DateTimeOffset? LastDeliveryAt { get; }         // Last delivery attempt
    public WebhookDeliveryStatus? LastDeliveryStatus { get; } // Last delivery status
    public WebhookStats? Stats { get; }                    // Delivery statistics
}
```

### Webhook Scope

| Scope                    | Description                              |
| ------------------------ | ---------------------------------------- |
| `WebhookScope.Global`    | Receives events for all inboxes          |
| `WebhookScope.Inbox`     | Receives events for a specific inbox only |

### Delivery Status

| Status                           | Description              |
| -------------------------------- | ------------------------ |
| `WebhookDeliveryStatus.Success`  | Delivery was successful  |
| `WebhookDeliveryStatus.Failed`   | Delivery failed          |

### Webhook Statistics

```csharp
public sealed class WebhookStats
{
    public int TotalDeliveries { get; }       // Total delivery attempts
    public int SuccessfulDeliveries { get; }  // Successful deliveries
    public int FailedDeliveries { get; }      // Failed deliveries
    public double SuccessRate { get; }        // Success rate (0-100)
}
```

## Rotating Secrets

Rotate webhook secrets periodically for security:

```csharp
// Using inbox method
var result = await inbox.RotateWebhookSecretAsync("whk_abc123");

// Or using webhook instance
var webhook = await inbox.GetWebhookAsync("whk_abc123");
var result = await webhook.RotateSecretAsync();

Console.WriteLine($"Webhook ID: {result.Id}");
Console.WriteLine($"New secret: {result.Secret}");
Console.WriteLine($"Old secret valid until: {result.PreviousSecretValidUntil}");

// Update your application with the new secret
// The old secret remains valid during the 1-hour grace period
```

### Secret Rotation Response

```csharp
public sealed class WebhookSecretRotation
{
    public string Id { get; }                             // Webhook ID
    public string Secret { get; }                         // New signing secret
    public DateTimeOffset PreviousSecretValidUntil { get; } // Grace period end
}
```

## Verifying Webhook Signatures

Always verify webhook signatures in your endpoint. Webhooks include the following headers:

| Header              | Description                                      |
| ------------------- | ------------------------------------------------ |
| `X-Vault-Signature` | HMAC-SHA256 signature (format: `sha256=<hex>`)   |
| `X-Vault-Timestamp` | Unix timestamp                                   |
| `X-Vault-Event`     | Event type                                       |
| `X-Vault-Delivery`  | Unique delivery ID                               |

The signature is computed over `{timestamp}.{raw_request_body}`:

### ASP.NET Core Minimal API

```csharp
using System.Security.Cryptography;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var webhookSecret = Environment.GetEnvironmentVariable("WEBHOOK_SECRET")!;

app.MapPost("/webhook/emails", async (HttpContext context) =>
{
    // Read raw body
    context.Request.EnableBuffering();
    using var reader = new StreamReader(context.Request.Body, leaveOpen: true);
    var rawBody = await reader.ReadToEndAsync();
    context.Request.Body.Position = 0;

    // Get headers
    var signature = context.Request.Headers["X-Vault-Signature"].ToString();
    var timestamp = context.Request.Headers["X-Vault-Timestamp"].ToString();

    // Verify signature
    if (!VerifyWebhookSignature(rawBody, signature, timestamp, webhookSecret))
    {
        return Results.Unauthorized();
    }

    // Validate timestamp (prevent replay attacks)
    if (!IsTimestampValid(timestamp, toleranceSeconds: 300))
    {
        return Results.Unauthorized();
    }

    // Process the webhook
    var payload = await context.Request.ReadFromJsonAsync<WebhookPayload>();
    Console.WriteLine($"Received event: {payload?.Type}");

    return Results.Ok();
});

static bool VerifyWebhookSignature(string rawBody, string signature, string timestamp, string secret)
{
    var signedPayload = $"{timestamp}.{rawBody}";
    using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
    var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(signedPayload));
    var expectedSignature = "sha256=" + Convert.ToHexString(hash).ToLowerInvariant();

    return CryptographicOperations.FixedTimeEquals(
        Encoding.UTF8.GetBytes(signature),
        Encoding.UTF8.GetBytes(expectedSignature));
}

static bool IsTimestampValid(string timestamp, int toleranceSeconds = 300)
{
    if (!long.TryParse(timestamp, out var webhookTime))
        return false;

    var currentTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    return Math.Abs(currentTime - webhookTime) <= toleranceSeconds;
}

record WebhookPayload(string Id, string Type, long CreatedAt, JsonElement Data);

app.Run();
```

### ASP.NET Core Controller

```csharp
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("webhook")]
public class WebhookController : ControllerBase
{
    private readonly string _webhookSecret;

    public WebhookController(IConfiguration configuration)
    {
        _webhookSecret = configuration["WebhookSecret"]!;
    }

    [HttpPost("emails")]
    public async Task<IActionResult> HandleWebhook()
    {
        // Read raw body
        Request.EnableBuffering();
        using var reader = new StreamReader(Request.Body, leaveOpen: true);
        var rawBody = await reader.ReadToEndAsync();
        Request.Body.Position = 0;

        // Get headers
        var signature = Request.Headers["X-Vault-Signature"].ToString();
        var timestamp = Request.Headers["X-Vault-Timestamp"].ToString();

        // Verify signature
        if (!VerifySignature(rawBody, signature, timestamp))
        {
            return Unauthorized("Invalid signature");
        }

        // Process the webhook
        var payload = await Request.ReadFromJsonAsync<WebhookPayload>();

        switch (payload?.Type)
        {
            case "email.received":
                await HandleEmailReceived(payload.Data);
                break;
            case "email.stored":
                await HandleEmailStored(payload.Data);
                break;
            case "email.deleted":
                await HandleEmailDeleted(payload.Data);
                break;
        }

        return Ok();
    }

    private bool VerifySignature(string rawBody, string signature, string timestamp)
    {
        var signedPayload = $"{timestamp}.{rawBody}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_webhookSecret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(signedPayload));
        var expectedSignature = "sha256=" + Convert.ToHexString(hash).ToLowerInvariant();

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(signature),
            Encoding.UTF8.GetBytes(expectedSignature));
    }

    private Task HandleEmailReceived(JsonElement data) => Task.CompletedTask;
    private Task HandleEmailStored(JsonElement data) => Task.CompletedTask;
    private Task HandleEmailDeleted(JsonElement data) => Task.CompletedTask;
}

record WebhookPayload(string Id, string Type, long CreatedAt, JsonElement Data);
```

## Error Handling

```csharp
using VaultSandbox.Client.Exceptions;

try
{
    var webhook = await inbox.GetWebhookAsync("whk_abc123");
}
catch (WebhookNotFoundException)
{
    Console.WriteLine("Webhook not found");
}
catch (InboxNotFoundException)
{
    Console.WriteLine("Inbox not found");
}
catch (VaultSandboxException ex)
{
    Console.WriteLine($"API error: {ex.Message}");
}
```

## Complete Example

```csharp
using VaultSandbox.Client;

async Task SetupWebhooksAsync(CancellationToken cancellationToken)
{
    var client = VaultSandboxClientBuilder.Create()
        .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
        .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
        .Build();

    try
    {
        // Create inbox
        var inbox = await client.CreateInboxAsync(cancellationToken: cancellationToken);
        Console.WriteLine($"Inbox: {inbox.EmailAddress}");

        // Create webhook with filter
        var webhook = await inbox.CreateWebhookAsync(new CreateWebhookOptions
        {
            Url = "https://your-app.com/webhook/emails",
            Events = [WebhookEventType.EmailReceived, WebhookEventType.EmailStored],
            Description = "Production email webhook",
            Filter = new WebhookFilterConfig
            {
                Rules =
                [
                    new WebhookFilterRuleConfig
                    {
                        Field = FilterableField.FromAddress,
                        Operator = FilterOperator.Domain,
                        Value = "example.com"
                    }
                ],
                Mode = FilterMode.All
            }
        }, cancellationToken);

        Console.WriteLine($"Webhook created: {webhook.Id}");
        Console.WriteLine($"Secret: {webhook.Secret}");

        // Test the webhook
        var testResult = await webhook.TestAsync(cancellationToken);
        if (testResult.Success)
        {
            Console.WriteLine("Webhook test successful!");
        }
        else
        {
            Console.WriteLine($"Webhook test failed: {testResult.Error}");
        }

        // List all webhooks
        var webhooks = await inbox.ListWebhooksAsync(cancellationToken);
        Console.WriteLine($"Total webhooks: {webhooks.Count}");

        // Update webhook
        await inbox.UpdateWebhookAsync(webhook.Id, new UpdateWebhookOptions
        {
            Description = "Updated description"
        }, cancellationToken);

        // Rotate secret after some time
        // var rotation = await webhook.RotateSecretAsync(cancellationToken);

        // Cleanup
        // await webhook.DeleteAsync(cancellationToken);
        // await client.DeleteInboxAsync(inbox.EmailAddress, cancellationToken);
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

## Webhook vs SSE vs Polling

| Feature           | Webhooks                  | SSE                       | Polling                   |
| ----------------- | ------------------------- | ------------------------- | ------------------------- |
| Delivery          | Push to your server       | Push to client            | Pull from client          |
| Connection        | None required             | Persistent                | Repeated requests         |
| Latency           | Near real-time            | Real-time                 | Depends on interval       |
| Server required   | Yes (webhook endpoint)    | No                        | No                        |
| Firewall friendly | Yes                       | Usually                   | Yes                       |
| Best for          | Server-to-server          | Browser/client apps       | Simple integrations       |

## Next Steps

- [Real-time Monitoring](/client-dotnet/guides/real-time/) - SSE-based monitoring with IAsyncEnumerable
- [Inbox API Reference](/client-dotnet/api/inbox/) - Complete inbox methods
- [Error Handling](/client-dotnet/api/errors/) - Handle webhook errors
