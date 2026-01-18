---
title: Inbox API
description: Complete API reference for the Inbox type and InboxMonitor
---

The `Inbox` type represents a single email inbox in VaultSandbox. It provides methods for managing emails, waiting for new messages, and monitoring in real-time.

## Properties

### EmailAddress

```go
func (i *Inbox) EmailAddress() string
```

Returns the email address for this inbox. Use this address to send test emails.

#### Example

```go
inbox, err := client.CreateInbox(ctx)
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Send email to: %s\n", inbox.EmailAddress())

// Use in your application
err = sendWelcomeEmail(inbox.EmailAddress())
```

---

### InboxHash

```go
func (i *Inbox) InboxHash() string
```

Returns the unique identifier (SHA-256 hash of the public key) for this inbox. Used internally for API operations.

#### Example

```go
fmt.Printf("Inbox ID: %s\n", inbox.InboxHash())
```

---

### ExpiresAt

```go
func (i *Inbox) ExpiresAt() time.Time
```

Returns the time when this inbox will expire and be automatically deleted.

#### Example

```go
inbox, err := client.CreateInbox(ctx)
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Inbox expires at: %s\n", inbox.ExpiresAt().Format(time.RFC3339))

timeUntilExpiry := time.Until(inbox.ExpiresAt())
fmt.Printf("Time remaining: %v\n", timeUntilExpiry.Round(time.Second))
```

---

### IsExpired

```go
func (i *Inbox) IsExpired() bool
```

Returns whether the inbox has expired.

#### Example

```go
if inbox.IsExpired() {
    fmt.Println("Inbox has expired")
}
```

---

### EmailAuth

```go
func (i *Inbox) EmailAuth() bool
```

Returns whether email authentication (SPF, DKIM, DMARC, PTR) is enabled for this inbox.

When `true`, incoming emails are validated and results are available in `AuthResults`.
When `false`, authentication checks are skipped and all auth results have status `"skipped"`.

#### Example

```go
inbox, err := client.CreateInbox(ctx, vaultsandbox.WithEmailAuth(false))
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Email auth enabled: %v\n", inbox.EmailAuth())
// Output: Email auth enabled: false
```

---

### Encrypted

```go
func (i *Inbox) Encrypted() bool
```

Returns whether the inbox uses end-to-end encryption.

When `true`, emails are encrypted with ML-KEM-768 and require decryption (handled automatically by the SDK).
When `false`, emails are stored as plain text on the server.

#### Example

```go
inbox, err := client.CreateInbox(ctx)
if err != nil {
    log.Fatal(err)
}

if inbox.Encrypted() {
    fmt.Println("Inbox uses end-to-end encryption")
} else {
    fmt.Println("Inbox uses plain text storage")
}
```

## Methods

### GetEmails

Lists all emails in the inbox with full content. Emails are automatically decrypted.

```go
func (i *Inbox) GetEmails(ctx context.Context) ([]*Email, error)
```

#### Returns

`[]*Email` - Slice of decrypted email objects with full content, sorted by received time (newest first)

#### Example

```go
emails, err := inbox.GetEmails(ctx)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Inbox has %d emails\n", len(emails))

for _, email := range emails {
    fmt.Printf("- %s from %s\n", email.Subject, email.From)
}
```

---

### GetEmailsMetadataOnly

Lists all emails in the inbox with metadata only (no body or attachments). This is more efficient when you only need to display email summaries.

```go
func (i *Inbox) GetEmailsMetadataOnly(ctx context.Context) ([]*EmailMetadata, error)
```

#### Returns

`[]*EmailMetadata` - Slice of email metadata objects, sorted by received time (newest first)

```go
type EmailMetadata struct {
    ID         string
    From       string
    Subject    string
    ReceivedAt time.Time
    IsRead     bool
}
```

#### Example

```go
// Efficient listing for UI display
emails, err := inbox.GetEmailsMetadataOnly(ctx)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Inbox has %d emails\n", len(emails))

for _, email := range emails {
    status := " "
    if email.IsRead {
        status = "✓"
    }
    fmt.Printf("[%s] %s - %s (%s)\n",
        status,
        email.From,
        email.Subject,
        email.ReceivedAt.Format(time.RFC822))
}

// Fetch full content only when needed
if len(emails) > 0 {
    fullEmail, err := inbox.GetEmail(ctx, emails[0].ID)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Body: %s\n", fullEmail.Text)
}
```

#### When to Use

Use `GetEmailsMetadataOnly` instead of `GetEmails` when:

- Displaying email lists in a UI
- Checking email counts or subjects without reading content
- Implementing pagination or lazy loading
- Reducing bandwidth and processing time

---

### GetEmail

Retrieves a specific email by ID.

```go
func (i *Inbox) GetEmail(ctx context.Context, emailID string) (*Email, error)
```

#### Parameters

- `emailID`: The unique identifier for the email

#### Returns

`*Email` - The decrypted email object

#### Example

```go
emails, err := inbox.GetEmails(ctx)
if err != nil {
    log.Fatal(err)
}

firstEmail, err := inbox.GetEmail(ctx, emails[0].ID)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Subject: %s\n", firstEmail.Subject)
fmt.Printf("Body: %s\n", firstEmail.Text)
```

#### Errors

- `ErrEmailNotFound` - Email does not exist

---

### WaitForEmail

Waits for an email matching specified criteria. This is the recommended way to handle email arrival in tests.

```go
func (i *Inbox) WaitForEmail(ctx context.Context, opts ...WaitOption) (*Email, error)
```

#### Options

| Option                                | Description                         |
| ------------------------------------- | ----------------------------------- |
| `WithWaitTimeout(d time.Duration)`    | Maximum time to wait (default: 60s) |
| `WithSubject(s string)`               | Filter by exact subject match       |
| `WithSubjectRegex(r *regexp.Regexp)`  | Filter by subject pattern           |
| `WithFrom(s string)`                  | Filter by exact sender address      |
| `WithFromRegex(r *regexp.Regexp)`     | Filter by sender pattern            |
| `WithPredicate(fn func(*Email) bool)` | Custom filter function              |

#### Returns

`*Email` - The first email matching the criteria

#### Examples

```go
// Wait for any email
email, err := inbox.WaitForEmail(ctx,
    vaultsandbox.WithWaitTimeout(10*time.Second),
)

// Wait for email with specific subject
email, err := inbox.WaitForEmail(ctx,
    vaultsandbox.WithWaitTimeout(10*time.Second),
    vaultsandbox.WithSubjectRegex(regexp.MustCompile(`Password Reset`)),
)

// Wait for email from specific sender
email, err := inbox.WaitForEmail(ctx,
    vaultsandbox.WithWaitTimeout(10*time.Second),
    vaultsandbox.WithFrom("noreply@example.com"),
)

// Wait with custom predicate
email, err := inbox.WaitForEmail(ctx,
    vaultsandbox.WithWaitTimeout(15*time.Second),
    vaultsandbox.WithPredicate(func(e *vaultsandbox.Email) bool {
        for _, to := range e.To {
            if to == "user@example.com" {
                return true
            }
        }
        return false
    }),
)

// Combine multiple filters
email, err := inbox.WaitForEmail(ctx,
    vaultsandbox.WithWaitTimeout(10*time.Second),
    vaultsandbox.WithSubjectRegex(regexp.MustCompile(`Welcome`)),
    vaultsandbox.WithFromRegex(regexp.MustCompile(`noreply@`)),
    vaultsandbox.WithPredicate(func(e *vaultsandbox.Email) bool {
        return len(e.Links) > 0
    }),
)
```

#### Errors

- `context.DeadlineExceeded` - No matching email received within timeout period

---

### WaitForEmailCount

Waits until the inbox has at least the specified number of emails. More efficient than using arbitrary sleeps when testing multiple emails.

```go
func (i *Inbox) WaitForEmailCount(ctx context.Context, count int, opts ...WaitOption) ([]*Email, error)
```

#### Parameters

- `count`: Minimum number of emails to wait for

#### Options

| Option                                | Description                         |
| ------------------------------------- | ----------------------------------- |
| `WithWaitTimeout(d time.Duration)`    | Maximum time to wait (default: 60s) |
| `WithSubject(s string)`               | Filter by exact subject match       |
| `WithSubjectRegex(r *regexp.Regexp)`  | Filter by subject pattern           |
| `WithFrom(s string)`                  | Filter by exact sender address      |
| `WithFromRegex(r *regexp.Regexp)`     | Filter by sender pattern            |
| `WithPredicate(fn func(*Email) bool)` | Custom filter function              |

#### Returns

`[]*Email` - All matching emails in the inbox once count is reached

#### Example

```go
// Trigger multiple emails
err := sendMultipleNotifications(inbox.EmailAddress(), 3)
if err != nil {
    log.Fatal(err)
}

// Wait for all 3 to arrive
emails, err := inbox.WaitForEmailCount(ctx, 3,
    vaultsandbox.WithWaitTimeout(30*time.Second),
)
if err != nil {
    log.Fatal(err)
}

// Now process all emails
if len(emails) != 3 {
    log.Fatalf("expected 3 emails, got %d", len(emails))
}
```

#### Errors

- `context.DeadlineExceeded` - Required count not reached within timeout

---

### Watch

Returns a channel that receives emails as they arrive. The channel closes when the context is cancelled.

```go
func (i *Inbox) Watch(ctx context.Context) <-chan *Email
```

#### Parameters

- `ctx`: Context for cancellation - when cancelled, the channel closes

#### Returns

- `<-chan *Email` - Receive-only channel of emails

#### Example

```go
inbox, err := client.CreateInbox(ctx)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Watching: %s\n", inbox.EmailAddress())

watchCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
defer cancel()

for email := range inbox.Watch(watchCtx) {
    fmt.Printf("New email: %q\n", email.Subject)
    fmt.Printf("From: %s\n", email.From)
}
```

#### Behavior

- Channel has buffer size of 16
- Non-blocking sends: if buffer is full, events may be dropped
- Channel closes automatically when context is cancelled
- Watcher is automatically unregistered on context cancellation

#### Best Practice

Use context for lifecycle management:

```go
func TestEmailFlow(t *testing.T) {
    inbox, err := client.CreateInbox(ctx)
    if err != nil {
        t.Fatal(err)
    }
    defer inbox.Delete(ctx)

    watchCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
    defer cancel()

    for email := range inbox.Watch(watchCtx) {
        // Process email
        if foundDesiredEmail(email) {
            cancel() // Stop watching early
            break
        }
    }
}
```

---

### WatchFunc

Calls a callback function for each email as they arrive until the context is cancelled. This is a convenience wrapper around `Watch` for simpler use cases where you don't need channel semantics.

```go
func (i *Inbox) WatchFunc(ctx context.Context, fn func(*Email))
```

#### Parameters

- `ctx`: Context for cancellation - when cancelled, watching stops
- `fn`: Callback function called for each new email

#### Example

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
defer cancel()

inbox.WatchFunc(ctx, func(email *vaultsandbox.Email) {
    fmt.Printf("New email: %s\n", email.Subject)
    fmt.Printf("From: %s\n", email.From)

    // Process the email
    if strings.Contains(email.Subject, "Password Reset") {
        processPasswordReset(email)
    }
})
```

#### Behavior

- Blocks until context is cancelled
- Each email is passed to the callback function
- Uses `Watch` internally with proper context handling

#### When to Use

Use `WatchFunc` instead of `Watch` when:

- You prefer callback-style processing over channel iteration
- You want simpler code without channel select statements
- You're processing emails in a blocking manner

---

### GetSyncStatus

Gets the current synchronization status of the inbox with the server.

```go
func (i *Inbox) GetSyncStatus(ctx context.Context) (*SyncStatus, error)
```

#### Returns

`*SyncStatus` - Sync status information

```go
type SyncStatus struct {
    EmailCount int    // Number of emails in the inbox
    EmailsHash string // Hash of the email list for change detection
}
```

#### Example

```go
status, err := inbox.GetSyncStatus(ctx)
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Email count: %d\n", status.EmailCount)
fmt.Printf("Emails hash: %s\n", status.EmailsHash)
```

---

### Delete

Deletes this inbox and all its emails.

```go
func (i *Inbox) Delete(ctx context.Context) error
```

#### Example

```go
inbox, err := client.CreateInbox(ctx)
if err != nil {
    log.Fatal(err)
}

// Use inbox...

// Clean up
err = inbox.Delete(ctx)
if err != nil {
    log.Fatal(err)
}
fmt.Println("Inbox deleted")
```

#### Best Practice

Always delete inboxes after tests using `t.Cleanup`:

```go
func TestEmailFlow(t *testing.T) {
    inbox, err := client.CreateInbox(ctx)
    if err != nil {
        t.Fatal(err)
    }

    t.Cleanup(func() {
        inbox.Delete(context.Background())
    })

    // Test logic...
}
```

---

### Export

Exports inbox data and encryption keys for backup or sharing.

```go
func (i *Inbox) Export() *ExportedInbox
```

#### Returns

`*ExportedInbox` - Serializable inbox data including sensitive keys

```go
type ExportedInbox struct {
    Version      int       `json:"version"`
    EmailAddress string    `json:"emailAddress"`
    ExpiresAt    time.Time `json:"expiresAt"`
    InboxHash    string    `json:"inboxHash"`
    ServerSigPk  string    `json:"serverSigPk,omitempty"`  // Only for encrypted inboxes
    SecretKey    string    `json:"secretKey,omitempty"`    // Only for encrypted inboxes
    ExportedAt   time.Time `json:"exportedAt"`
    EmailAuth    bool      `json:"emailAuth"`
    Encrypted    bool      `json:"encrypted"`
}
```

#### Validate

Validates that the exported data is valid before import.

```go
func (e *ExportedInbox) Validate() error
```

Returns `ErrInvalidImportData` if the email address is empty or the secret key is missing/invalid.

#### Example

```go
inbox, err := client.CreateInbox(ctx)
if err != nil {
    log.Fatal(err)
}
data := inbox.Export()

// Save for later
jsonData, err := json.MarshalIndent(data, "", "  ")
if err != nil {
    log.Fatal(err)
}
err = os.WriteFile("inbox-backup.json", jsonData, 0600)
if err != nil {
    log.Fatal(err)
}
```

#### Security Warning

Exported data contains private encryption keys. Store securely with restrictive file permissions (0600)!

## Webhook Methods

The Inbox type provides methods for managing webhooks that receive HTTP callbacks when events occur. For a complete guide, see [Webhooks Guide](/client-go/guides/webhooks/).

### CreateWebhook

Creates a new webhook for this inbox.

```go
func (i *Inbox) CreateWebhook(ctx context.Context, url string, opts ...WebhookCreateOption) (*Webhook, error)
```

#### Parameters

- `url`: The endpoint that receives webhook notifications
- `opts`: Optional configuration options

#### Options

| Option | Description |
| ------ | ----------- |
| `WithWebhookEvents(events...)` | Events that trigger the webhook |
| `WithWebhookTemplate(name)` | Built-in template (slack, discord, teams, etc.) |
| `WithWebhookCustomTemplate(body, contentType)` | Custom payload template |
| `WithWebhookFilter(filter)` | Filter which emails trigger the webhook |
| `WithWebhookDescription(desc)` | Human-readable description |

#### Returns

`*Webhook` - The created webhook including the secret for signature verification

#### Example

```go
webhook, err := inbox.CreateWebhook(ctx, "https://your-app.com/webhook/emails",
    vaultsandbox.WithWebhookEvents(vaultsandbox.WebhookEventEmailReceived),
    vaultsandbox.WithWebhookDescription("Production email notifications"),
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Webhook ID: %s\n", webhook.ID)
fmt.Printf("Secret: %s\n", webhook.Secret) // Save this!
```

---

### ListWebhooks

Lists all webhooks for this inbox.

```go
func (i *Inbox) ListWebhooks(ctx context.Context) (*WebhookListResponse, error)
```

#### Returns

`*WebhookListResponse` - List of webhooks and total count

```go
type WebhookListResponse struct {
    Webhooks []*Webhook
    Total    int
}
```

#### Example

```go
response, err := inbox.ListWebhooks(ctx)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Total webhooks: %d\n", response.Total)
for _, wh := range response.Webhooks {
    fmt.Printf("- %s: %s\n", wh.ID, wh.URL)
}
```

---

### GetWebhook

Retrieves a specific webhook by ID.

```go
func (i *Inbox) GetWebhook(ctx context.Context, webhookID string) (*Webhook, error)
```

#### Parameters

- `webhookID`: The unique identifier for the webhook

#### Returns

`*Webhook` - The webhook data

```go
type Webhook struct {
    ID             string
    URL            string
    Events         []WebhookEventType
    Scope          WebhookScope
    InboxEmail     string
    Secret         string
    Template       string
    CustomTemplate *CustomTemplate
    Filter         *FilterConfig
    Description    string
    Enabled        bool
    Stats          *WebhookStats
    CreatedAt      time.Time
    UpdatedAt      time.Time
}
```

#### Example

```go
webhook, err := inbox.GetWebhook(ctx, "webhook-id")
if err != nil {
    log.Fatal(err)
}

fmt.Printf("URL: %s\n", webhook.URL)
fmt.Printf("Enabled: %v\n", webhook.Enabled)
```

#### Errors

- `ErrWebhookNotFound` - Webhook does not exist

---

### UpdateWebhook

Updates a specific webhook.

```go
func (i *Inbox) UpdateWebhook(ctx context.Context, webhookID string, opts ...WebhookUpdateOption) (*Webhook, error)
```

#### Parameters

- `webhookID`: The unique identifier for the webhook
- `opts`: Update options

#### Options

| Option | Description |
| ------ | ----------- |
| `WithUpdateURL(url)` | Update the webhook URL |
| `WithUpdateEvents(events...)` | Update event types |
| `WithUpdateTemplate(name)` | Update built-in template |
| `WithUpdateCustomTemplate(body, contentType)` | Update custom template |
| `WithUpdateFilter(filter)` | Update filter configuration |
| `WithClearFilter()` | Remove the filter |
| `WithUpdateDescription(desc)` | Update description |
| `WithUpdateEnabled(bool)` | Enable or disable the webhook |

#### Returns

`*Webhook` - The updated webhook data

#### Example

```go
updated, err := inbox.UpdateWebhook(ctx, "webhook-id",
    vaultsandbox.WithUpdateURL("https://your-app.com/webhook/v2/emails"),
    vaultsandbox.WithUpdateEnabled(false),
)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Updated URL: %s\n", updated.URL)
```

#### Errors

- `ErrWebhookNotFound` - Webhook does not exist

---

### DeleteWebhook

Deletes a specific webhook.

```go
func (i *Inbox) DeleteWebhook(ctx context.Context, webhookID string) error
```

#### Parameters

- `webhookID`: The unique identifier for the webhook

#### Example

```go
err := inbox.DeleteWebhook(ctx, "webhook-id")
if err != nil {
    log.Fatal(err)
}
fmt.Println("Webhook deleted")
```

#### Errors

- `ErrWebhookNotFound` - Webhook does not exist

---

### TestWebhook

Tests a webhook by sending a test payload.

```go
func (i *Inbox) TestWebhook(ctx context.Context, webhookID string) (*TestWebhookResponse, error)
```

#### Parameters

- `webhookID`: The unique identifier for the webhook

#### Returns

`*TestWebhookResponse` - The test result

```go
type TestWebhookResponse struct {
    Success      bool
    StatusCode   int
    ResponseTime int    // milliseconds
    Error        string
    RequestID    string
}
```

#### Example

```go
result, err := inbox.TestWebhook(ctx, "webhook-id")
if err != nil {
    log.Fatal(err)
}

if result.Success {
    fmt.Printf("Test passed! Status: %d\n", result.StatusCode)
    fmt.Printf("Response time: %dms\n", result.ResponseTime)
} else {
    fmt.Printf("Test failed: %s\n", result.Error)
}
```

#### Errors

- `ErrWebhookNotFound` - Webhook does not exist

---

### RotateWebhookSecret

Rotates the secret for a webhook. The old secret remains valid for a grace period.

```go
func (i *Inbox) RotateWebhookSecret(ctx context.Context, webhookID string) (*RotateSecretResponse, error)
```

#### Parameters

- `webhookID`: The unique identifier for the webhook

#### Returns

`*RotateSecretResponse` - The new secret and grace period

```go
type RotateSecretResponse struct {
    ID                       string
    Secret                   string
    PreviousSecretValidUntil *time.Time
}
```

#### Example

```go
result, err := inbox.RotateWebhookSecret(ctx, "webhook-id")
if err != nil {
    log.Fatal(err)
}

fmt.Printf("New secret: %s\n", result.Secret)
if result.PreviousSecretValidUntil != nil {
    fmt.Printf("Old secret valid until: %s\n", result.PreviousSecretValidUntil.Format(time.RFC3339))
}
```

#### Errors

- `ErrWebhookNotFound` - Webhook does not exist

---

## Complete Inbox Example

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "os"
    "regexp"
    "time"

    "github.com/vaultsandbox/client-go"
)

func completeInboxExample() error {
    ctx := context.Background()

    client, err := vaultsandbox.New(
        os.Getenv("VAULTSANDBOX_API_KEY"),
        vaultsandbox.WithBaseURL(os.Getenv("VAULTSANDBOX_URL")),
    )
    if err != nil {
        return err
    }
    defer client.Close()

    // Create inbox
    inbox, err := client.CreateInbox(ctx)
    if err != nil {
        return err
    }
    fmt.Printf("Created: %s\n", inbox.EmailAddress())
    fmt.Printf("Expires: %s\n", inbox.ExpiresAt().Format(time.RFC3339))

    // Set up watching in a goroutine
    watchCtx, cancelWatch := context.WithCancel(ctx)
    go func() {
        for email := range inbox.Watch(watchCtx) {
            fmt.Printf("Received via watch: %s\n", email.Subject)
        }
    }()

    // Trigger test email
    err = sendTestEmail(inbox.EmailAddress())
    if err != nil {
        return err
    }

    // Wait for specific email
    email, err := inbox.WaitForEmail(ctx,
        vaultsandbox.WithWaitTimeout(10*time.Second),
        vaultsandbox.WithSubjectRegex(regexp.MustCompile(`Test`)),
    )
    if err != nil {
        return err
    }

    fmt.Printf("Found email: %s\n", email.Subject)
    fmt.Printf("Body: %s\n", email.Text)

    // Mark as read
    err = inbox.MarkEmailAsRead(ctx, email.ID)
    if err != nil {
        return err
    }

    // Get all emails
    allEmails, err := inbox.GetEmails(ctx)
    if err != nil {
        return err
    }
    fmt.Printf("Total emails: %d\n", len(allEmails))

    // Export inbox
    exportData := inbox.Export()
    jsonData, err := json.Marshal(exportData)
    if err != nil {
        return err
    }
    err = os.WriteFile("inbox.json", jsonData, 0600)
    if err != nil {
        return err
    }

    // Clean up
    cancelWatch()
    err = inbox.Delete(ctx)
    if err != nil {
        return err
    }

    return nil
}

func main() {
    if err := completeInboxExample(); err != nil {
        log.Fatal(err)
    }
}
```

## Next Steps

- [Email API Reference](/client-go/api/email/) - Work with email objects
- [Client API Reference](/client-go/api/client/) - Learn about client methods
- [Webhooks Guide](/client-go/guides/webhooks/) - Set up webhook notifications
- [Waiting for Emails Guide](/client-go/guides/waiting-for-emails/) - Best practices
- [Real-time Monitoring Guide](/client-go/guides/real-time/) - Advanced monitoring patterns
