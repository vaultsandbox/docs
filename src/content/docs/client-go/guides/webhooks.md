---
title: Webhooks
description: Set up webhooks to receive real-time notifications when emails arrive
---

Webhooks provide a way to receive HTTP callbacks when events occur in your inbox. Instead of polling or maintaining SSE connections, your application receives push notifications automatically.

## Creating a Webhook

Create a webhook for an inbox to receive notifications when emails arrive:

```go
inbox, err := client.CreateInbox(ctx)
if err != nil {
    log.Fatal(err)
}

webhook, err := inbox.CreateWebhook(ctx, "https://your-app.com/webhook/emails",
    vaultsandbox.WithWebhookEvents(vaultsandbox.WebhookEventEmailReceived),
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Webhook ID: %s\n", webhook.ID)
fmt.Printf("Secret: %s\n", webhook.Secret) // Save this for signature verification
```

### Webhook Options

| Option | Description |
| ------ | ----------- |
| `WithWebhookEvents(events...)` | Events that trigger the webhook |
| `WithWebhookTemplate(name)` | Built-in template (slack, discord, teams, etc.) |
| `WithWebhookCustomTemplate(body, contentType)` | Custom payload template |
| `WithWebhookFilter(filter)` | Filter which emails trigger the webhook |
| `WithWebhookDescription(desc)` | Human-readable description |

### Event Types

| Event | Constant | Description |
| ----- | -------- | ----------- |
| `email.received` | `WebhookEventEmailReceived` | Email received by the inbox |
| `email.stored` | `WebhookEventEmailStored` | Email successfully stored |
| `email.deleted` | `WebhookEventEmailDeleted` | Email deleted from the inbox |

## Managing Webhooks

### List Webhooks

```go
response, err := inbox.ListWebhooks(ctx)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Total webhooks: %d\n", response.Total)
for _, wh := range response.Webhooks {
    status := "disabled"
    if wh.Enabled {
        status = "enabled"
    }
    fmt.Printf("- %s: %s (%s)\n", wh.ID, wh.URL, status)
}
```

### Get Webhook Details

```go
webhook, err := inbox.GetWebhook(ctx, "webhook-id")
if err != nil {
    log.Fatal(err)
}

fmt.Printf("URL: %s\n", webhook.URL)
fmt.Printf("Events: %v\n", webhook.Events)
fmt.Printf("Created: %s\n", webhook.CreatedAt.Format(time.RFC3339))

if webhook.Stats != nil {
    fmt.Printf("Deliveries: %d/%d\n",
        webhook.Stats.SuccessfulDeliveries,
        webhook.Stats.TotalDeliveries)
}
```

### Update Webhook

```go
updated, err := inbox.UpdateWebhook(ctx, "webhook-id",
    vaultsandbox.WithUpdateURL("https://your-app.com/webhook/v2/emails"),
    vaultsandbox.WithUpdateEnabled(true),
    vaultsandbox.WithUpdateDescription("Updated webhook endpoint"),
)
if err != nil {
    log.Fatal(err)
}
```

#### Update Options

| Option | Description |
| ------ | ----------- |
| `WithUpdateURL(url)` | Update the webhook endpoint URL |
| `WithUpdateEvents(events...)` | Update the event types that trigger the webhook |
| `WithUpdateTemplate(name)` | Update the built-in template |
| `WithUpdateCustomTemplate(body, contentType)` | Update with a custom payload template |
| `WithUpdateFilter(filter)` | Update the filter configuration |
| `WithClearFilter()` | Remove the filter from the webhook |
| `WithUpdateDescription(desc)` | Update the description |
| `WithUpdateEnabled(enabled)` | Enable or disable the webhook |

### Delete Webhook

```go
err := inbox.DeleteWebhook(ctx, "webhook-id")
if err != nil {
    log.Fatal(err)
}
fmt.Println("Webhook deleted")
```

## Filtering Webhooks

Use filters to control which emails trigger webhooks:

```go
webhook, err := inbox.CreateWebhook(ctx, "https://your-app.com/webhook/emails",
    vaultsandbox.WithWebhookEvents(vaultsandbox.WebhookEventEmailReceived),
    vaultsandbox.WithWebhookFilter(&vaultsandbox.FilterConfig{
        Rules: []vaultsandbox.FilterRule{
            {Field: "from", Operator: vaultsandbox.FilterOperatorDomain, Value: "example.com"},
            {Field: "subject", Operator: vaultsandbox.FilterOperatorContains, Value: "Invoice"},
        },
        Mode: vaultsandbox.FilterModeAll, // All rules must match
    }),
)
```

### Filter Operators

| Operator | Constant | Description |
| -------- | -------- | ----------- |
| `equals` | `FilterOperatorEquals` | Exact match |
| `contains` | `FilterOperatorContains` | Contains substring |
| `starts_with` | `FilterOperatorStartsWith` | Starts with string |
| `ends_with` | `FilterOperatorEndsWith` | Ends with string |
| `domain` | `FilterOperatorDomain` | Email domain match |
| `regex` | `FilterOperatorRegex` | Regular expression match |
| `exists` | `FilterOperatorExists` | Field exists and is non-empty |

### Filter Modes

| Mode | Constant | Description |
| ---- | -------- | ----------- |
| `all` | `FilterModeAll` | All rules must match (AND) |
| `any` | `FilterModeAny` | At least one rule must match (OR) |

### Case Sensitivity

```go
webhook, err := inbox.CreateWebhook(ctx, "https://your-app.com/webhook/emails",
    vaultsandbox.WithWebhookEvents(vaultsandbox.WebhookEventEmailReceived),
    vaultsandbox.WithWebhookFilter(&vaultsandbox.FilterConfig{
        Rules: []vaultsandbox.FilterRule{
            {
                Field:         "subject",
                Operator:      vaultsandbox.FilterOperatorContains,
                Value:         "urgent",
                CaseSensitive: false, // Case-insensitive match
            },
        },
        Mode: vaultsandbox.FilterModeAll,
    }),
)
```

### Require Authentication

Only trigger webhooks for authenticated emails:

```go
webhook, err := inbox.CreateWebhook(ctx, "https://your-app.com/webhook/verified-emails",
    vaultsandbox.WithWebhookEvents(vaultsandbox.WebhookEventEmailReceived),
    vaultsandbox.WithWebhookFilter(&vaultsandbox.FilterConfig{
        Rules:       []vaultsandbox.FilterRule{},
        Mode:        vaultsandbox.FilterModeAll,
        RequireAuth: true, // Only emails passing SPF/DKIM/DMARC
    }),
)
```

## Templates

Templates control the webhook payload format.

### Built-in Templates

```go
// Slack-formatted payload
slackWebhook, err := inbox.CreateWebhook(ctx, "https://hooks.slack.com/services/...",
    vaultsandbox.WithWebhookEvents(vaultsandbox.WebhookEventEmailReceived),
    vaultsandbox.WithWebhookTemplate("slack"),
)

// Discord-formatted payload
discordWebhook, err := inbox.CreateWebhook(ctx, "https://discord.com/api/webhooks/...",
    vaultsandbox.WithWebhookEvents(vaultsandbox.WebhookEventEmailReceived),
    vaultsandbox.WithWebhookTemplate("discord"),
)

// Microsoft Teams
teamsWebhook, err := inbox.CreateWebhook(ctx, "https://outlook.office.com/webhook/...",
    vaultsandbox.WithWebhookEvents(vaultsandbox.WebhookEventEmailReceived),
    vaultsandbox.WithWebhookTemplate("teams"),
)
```

### Custom Templates

```go
customBody := `{
    "email_id": "{{.Email.ID}}",
    "sender": "{{.Email.From}}",
    "subject_line": "{{.Email.Subject}}",
    "received_timestamp": "{{.Email.ReceivedAt}}"
}`

webhook, err := inbox.CreateWebhook(ctx, "https://your-app.com/webhook/emails",
    vaultsandbox.WithWebhookEvents(vaultsandbox.WebhookEventEmailReceived),
    vaultsandbox.WithWebhookCustomTemplate(customBody, "application/json"),
)
```

### Available Templates

Retrieve the list of available built-in templates:

```go
templates, err := client.GetWebhookTemplates(ctx)
if err != nil {
    log.Fatal(err)
}

for _, tmpl := range templates {
    fmt.Printf("- %s (%s)\n", tmpl.Label, tmpl.Value)
}
```

## Testing Webhooks

### Send Test Request

```go
result, err := inbox.TestWebhook(ctx, "webhook-id")
if err != nil {
    log.Fatal(err)
}

if result.Success {
    fmt.Println("Test successful!")
    fmt.Printf("Status: %d\n", result.StatusCode)
    fmt.Printf("Response time: %dms\n", result.ResponseTime)
} else {
    fmt.Printf("Test failed: %s\n", result.Error)
}
```

### Test Response Structure

```go
type TestWebhookResponse struct {
    Success      bool   // Whether the test was successful
    StatusCode   int    // HTTP status code returned
    ResponseTime int    // Response time in milliseconds
    Error        string // Error message if test failed
    RequestID    string // Unique identifier for the test request
}
```

## Rotating Secrets

Rotate webhook secrets periodically for security:

```go
result, err := inbox.RotateWebhookSecret(ctx, "webhook-id")
if err != nil {
    log.Fatal(err)
}

fmt.Printf("New secret: %s\n", result.Secret)
if result.PreviousSecretValidUntil != nil {
    fmt.Printf("Old secret valid until: %s\n", result.PreviousSecretValidUntil.Format(time.RFC3339))
}

// Update your application with the new secret
// The old secret remains valid during the grace period
```

## Verifying Webhook Signatures

Always verify webhook signatures in your endpoint. Webhooks include the following headers:

| Header | Description |
| ------ | ----------- |
| `X-Vault-Signature` | HMAC-SHA256 signature |
| `X-Vault-Timestamp` | Unix timestamp |
| `X-Vault-Event` | Event type |
| `X-Vault-Delivery` | Unique delivery ID |

The signature is computed over `${timestamp}.${raw_request_body}`:

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "io"
    "net/http"
    "strings"
)

func verifyWebhookSignature(rawBody []byte, signature, timestamp, secret string) bool {
    signedPayload := fmt.Sprintf("%s.%s", timestamp, string(rawBody))

    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(signedPayload))
    expectedSignature := "sha256=" + hex.EncodeToString(mac.Sum(nil))

    return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    signature := r.Header.Get("X-Vault-Signature")
    timestamp := r.Header.Get("X-Vault-Timestamp")

    rawBody, err := io.ReadAll(r.Body)
    if err != nil {
        http.Error(w, "Failed to read body", http.StatusBadRequest)
        return
    }

    if !verifyWebhookSignature(rawBody, signature, timestamp, webhookSecret) {
        http.Error(w, "Invalid signature", http.StatusUnauthorized)
        return
    }

    // Process the webhook
    fmt.Printf("Received webhook: %s\n", string(rawBody))
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
}
```

## Error Handling

```go
import (
    "errors"

    "github.com/vaultsandbox/client-go"
)

webhook, err := inbox.GetWebhook(ctx, "webhook-id")
if err != nil {
    if errors.Is(err, vaultsandbox.ErrWebhookNotFound) {
        fmt.Println("Webhook not found")
    } else if errors.Is(err, vaultsandbox.ErrInboxNotFound) {
        fmt.Println("Inbox not found")
    } else {
        var apiErr *vaultsandbox.APIError
        if errors.As(err, &apiErr) {
            fmt.Printf("API error (%d): %s\n", apiErr.StatusCode, apiErr.Message)
        }
    }
}
```

## Complete Example

```go
package main

import (
    "context"
    "fmt"
    "log"
    "os"
    "time"

    "github.com/vaultsandbox/client-go"
)

func main() {
    ctx := context.Background()

    client, err := vaultsandbox.New(
        os.Getenv("VAULTSANDBOX_API_KEY"),
        vaultsandbox.WithBaseURL(os.Getenv("VAULTSANDBOX_URL")),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // Create inbox
    inbox, err := client.CreateInbox(ctx)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Inbox: %s\n", inbox.EmailAddress())

    // Create webhook with filter
    webhook, err := inbox.CreateWebhook(ctx, "https://your-app.com/webhook/emails",
        vaultsandbox.WithWebhookEvents(
            vaultsandbox.WebhookEventEmailReceived,
            vaultsandbox.WebhookEventEmailStored,
        ),
        vaultsandbox.WithWebhookDescription("Production email webhook"),
        vaultsandbox.WithWebhookFilter(&vaultsandbox.FilterConfig{
            Rules: []vaultsandbox.FilterRule{
                {Field: "from", Operator: vaultsandbox.FilterOperatorDomain, Value: "example.com"},
            },
            Mode: vaultsandbox.FilterModeAll,
        }),
    )
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Webhook created: %s\n", webhook.ID)
    fmt.Printf("Secret: %s\n", webhook.Secret)

    // Test the webhook
    testResult, err := inbox.TestWebhook(ctx, webhook.ID)
    if err != nil {
        log.Fatal(err)
    }
    if testResult.Success {
        fmt.Println("Webhook test successful!")
    } else {
        fmt.Printf("Webhook test failed: %s\n", testResult.Error)
    }

    // List all webhooks
    response, err := inbox.ListWebhooks(ctx)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Total webhooks: %d\n", response.Total)

    // Update webhook
    _, err = inbox.UpdateWebhook(ctx, webhook.ID,
        vaultsandbox.WithUpdateDescription("Updated description"),
    )
    if err != nil {
        log.Fatal(err)
    }

    // Cleanup
    // err = inbox.DeleteWebhook(ctx, webhook.ID)
    // err = inbox.Delete(ctx)
}
```

## Global Webhooks

:::note
Global webhooks are primarily designed for use with the VaultSandbox CLI. They receive notifications for all inboxes associated with the API key.
:::

The Go client includes support for global webhooks via the `Admin()` interface:

```go
admin := client.Admin()

// Create a global webhook
webhook, err := admin.CreateWebhook(ctx, "https://your-app.com/webhook/all-emails",
    vaultsandbox.WithWebhookEvents(vaultsandbox.WebhookEventEmailReceived),
)

// List global webhooks
response, err := admin.ListWebhooks(ctx)

// Other operations mirror inbox webhooks
webhook, err := admin.GetWebhook(ctx, "webhook-id")
updated, err := admin.UpdateWebhook(ctx, "webhook-id", vaultsandbox.WithUpdateEnabled(false))
result, err := admin.TestWebhook(ctx, "webhook-id")
rotated, err := admin.RotateWebhookSecret(ctx, "webhook-id")
err := admin.DeleteWebhook(ctx, "webhook-id")
```

Global webhooks use the same options and response types as inbox webhooks. The main difference is they have `WebhookScopeGlobal` and receive events from all inboxes rather than a specific one.

## Webhook Metrics

Monitor webhook health and delivery statistics across your account:

```go
metrics, err := client.GetWebhookMetrics(ctx)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Total webhooks: %d (active: %d)\n", metrics.TotalWebhooks, metrics.ActiveWebhooks)
fmt.Printf("Deliveries: %d successful, %d failed (%.1f%% success rate)\n",
    metrics.SuccessfulDeliveries,
    metrics.FailedDeliveries,
    metrics.SuccessRate,
)

// Breakdown by scope
for scope, count := range metrics.ByScope {
    fmt.Printf("  %s: %d\n", scope, count)
}

// Breakdown by event type
for event, count := range metrics.ByEvent {
    fmt.Printf("  %s: %d\n", event, count)
}
```

### Metrics Structure

```go
type WebhookMetrics struct {
    TotalWebhooks        int            // Total registered webhooks
    ActiveWebhooks       int            // Enabled webhooks
    TotalDeliveries      int            // All delivery attempts
    SuccessfulDeliveries int            // Successful deliveries
    FailedDeliveries     int            // Failed deliveries
    SuccessRate          float64        // Success percentage
    ByScope              map[string]int // Counts by scope (global/inbox)
    ByEvent              map[string]int // Counts by event type
}
```

## Webhook vs SSE vs Polling

| Feature | Webhooks | SSE | Polling |
| ------- | -------- | --- | ------- |
| Delivery | Push to your server | Push to client | Pull from client |
| Connection | None required | Persistent | Repeated requests |
| Latency | Near real-time | Real-time | Depends on interval |
| Server required | Yes (webhook endpoint) | No | No |
| Firewall friendly | Yes | Usually | Yes |
| Best for | Server-to-server | Browser/client apps | Simple integrations |

## Next Steps

- [Real-time Monitoring](/client-go/guides/real-time/) - SSE-based monitoring
- [Inbox API Reference](/client-go/api/inbox/) - Complete inbox methods
- [Error Handling](/client-go/api/errors/) - Handle webhook errors
