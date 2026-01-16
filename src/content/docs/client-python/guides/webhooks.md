---
title: Webhooks
description: Set up webhooks to receive real-time notifications when emails arrive
---

Webhooks provide a way to receive HTTP callbacks when events occur in your inbox. Instead of polling or maintaining SSE connections, your application receives push notifications automatically.

## Creating a Webhook

Create a webhook for an inbox to receive notifications when emails arrive:

```python
inbox = await client.create_inbox()

webhook = await inbox.create_webhook(
    url="https://your-app.com/webhook/emails",
    events=["email.received"],
)

print(f"Webhook ID: {webhook.id}")
print(f"Secret: {webhook.secret}")  # Save this for signature verification
```

### Webhook Options

```python
webhook = await inbox.create_webhook(
    url="https://your-app.com/webhook/emails",
    events=["email.received"],
    template="slack",  # Optional: payload format
    filter=FilterConfig(...),  # Optional: filter events
    description="Production email notifications",  # Optional
)
```

| Parameter     | Type                       | Required | Description                                    |
| ------------- | -------------------------- | -------- | ---------------------------------------------- |
| `url`         | `str`                      | Yes      | The URL to send webhook requests to            |
| `events`      | `list[str]`                | Yes      | Events that trigger the webhook                |
| `template`    | `str \| CustomTemplate`    | No       | Payload format template                        |
| `filter`      | `FilterConfig`             | No       | Filter which emails trigger the webhook        |
| `description` | `str`                      | No       | Human-readable description                     |

### Event Types

| Event            | Description                           |
| ---------------- | ------------------------------------- |
| `email.received` | Email received by the inbox           |
| `email.stored`   | Email successfully stored             |
| `email.deleted`  | Email deleted from the inbox          |

## Managing Webhooks

### List Webhooks

```python
webhooks = await inbox.list_webhooks()

print(f"Total webhooks: {len(webhooks)}")
for webhook in webhooks:
    status = "enabled" if webhook.enabled else "disabled"
    print(f"- {webhook.id}: {webhook.url} ({status})")
```

### Get Webhook Details

```python
webhook = await inbox.get_webhook("whk_abc123")

print(f"URL: {webhook.url}")
print(f"Events: {', '.join(webhook.events)}")
print(f"Created: {webhook.created_at}")
print(f"Last delivery: {webhook.last_delivery_at or 'Never'}")

if webhook.stats:
    print(f"Deliveries: {webhook.stats.successful_deliveries}/{webhook.stats.total_deliveries}")
```

### Update Webhook

```python
webhook = await inbox.get_webhook("whk_abc123")

await webhook.update(
    url="https://your-app.com/webhook/v2/emails",
    enabled=True,
    description="Updated webhook endpoint",
)
```

All available update parameters:

```python
await webhook.update(
    url="https://new-url.com/webhook",        # New target URL
    events=["email.received", "email.stored"], # New event subscriptions
    template="slack",                          # New template
    remove_template=True,                      # Remove template (set instead of template)
    filter=FilterConfig(...),                  # New filter config
    remove_filter=True,                        # Remove filter (set instead of filter)
    description="New description",             # New description
    enabled=True,                              # Enable/disable
)
```

### Enable/Disable Webhook

```python
webhook = await inbox.get_webhook("whk_abc123")

# Disable webhook temporarily
await webhook.disable()

# Re-enable webhook
await webhook.enable()
```

### Refresh Webhook Data

```python
webhook = await inbox.get_webhook("whk_abc123")

# Refresh webhook data from server
await webhook.refresh()
print(f"Latest stats: {webhook.stats.successful_deliveries} successful")
```

### Delete Webhook

```python
await inbox.delete_webhook("whk_abc123")
print("Webhook deleted")
```

## Filtering Webhooks

Use filters to control which emails trigger webhooks:

```python
from vaultsandbox import FilterConfig, FilterRule

webhook = await inbox.create_webhook(
    url="https://your-app.com/webhook/emails",
    events=["email.received"],
    filter=FilterConfig(
        rules=[
            FilterRule(field="from.address", operator="domain", value="example.com"),
            FilterRule(field="subject", operator="contains", value="Invoice"),
        ],
        mode="all",  # "all" = AND, "any" = OR
    ),
)
```

### Filterable Fields

| Field          | Description                     |
| -------------- | ------------------------------- |
| `subject`      | Email subject line              |
| `from.address` | Sender email address            |
| `from.name`    | Sender display name             |
| `to.address`   | Recipient email address         |
| `to.name`      | Recipient display name          |
| `body.text`    | Plain text body                 |
| `body.html`    | HTML body                       |
| `header.X-*`   | Custom email headers (see below)|

### Filter Operators

| Operator      | Description                            | Example                                              |
| ------------- | -------------------------------------- | ---------------------------------------------------- |
| `equals`      | Exact match                            | `FilterRule(field="from.address", operator="equals", value="noreply@example.com")` |
| `contains`    | Contains substring                     | `FilterRule(field="subject", operator="contains", value="Reset")` |
| `starts_with` | Starts with string                     | `FilterRule(field="subject", operator="starts_with", value="RE:")` |
| `ends_with`   | Ends with string                       | `FilterRule(field="from.address", operator="ends_with", value="@company.com")` |
| `domain`      | Email domain match                     | `FilterRule(field="from.address", operator="domain", value="example.com")` |
| `regex`       | Regular expression match               | `FilterRule(field="subject", operator="regex", value=r"Order #\d+")` |
| `exists`      | Field exists and is non-empty          | `FilterRule(field="attachments", operator="exists", value="true")` |

### Custom Header Filters

Filter on custom email headers using the `header.X-*` format:

```python
webhook = await inbox.create_webhook(
    url="https://your-app.com/webhook/emails",
    events=["email.received"],
    filter=FilterConfig(
        rules=[
            # Filter by custom header
            FilterRule(
                field="header.X-Priority",
                operator="equals",
                value="1",
            ),
            # Filter by mailing list header
            FilterRule(
                field="header.List-Unsubscribe",
                operator="exists",
                value="true",
            ),
        ],
        mode="any",
    ),
)
```

### Case Sensitivity

```python
webhook = await inbox.create_webhook(
    url="https://your-app.com/webhook/emails",
    events=["email.received"],
    filter=FilterConfig(
        rules=[
            FilterRule(
                field="subject",
                operator="contains",
                value="urgent",
                case_sensitive=False,  # Case-insensitive match
            ),
        ],
        mode="all",
    ),
)
```

### Require Authentication

Only trigger webhooks for authenticated emails:

```python
webhook = await inbox.create_webhook(
    url="https://your-app.com/webhook/verified-emails",
    events=["email.received"],
    filter=FilterConfig(
        rules=[],
        mode="all",
        require_auth=True,  # Only emails passing SPF/DKIM/DMARC
    ),
)
```

## Templates

Templates control the webhook payload format:

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

```python
# Slack-formatted payload
slack_webhook = await inbox.create_webhook(
    url="https://hooks.slack.com/services/...",
    events=["email.received"],
    template="slack",
)

# Discord-formatted payload
discord_webhook = await inbox.create_webhook(
    url="https://discord.com/api/webhooks/...",
    events=["email.received"],
    template="discord",
)

# Microsoft Teams
teams_webhook = await inbox.create_webhook(
    url="https://outlook.office.com/webhook/...",
    events=["email.received"],
    template="teams",
)

# Simple payload for lightweight integrations
simple_webhook = await inbox.create_webhook(
    url="https://your-app.com/webhook/emails",
    events=["email.received"],
    template="simple",
)

# Zapier integration
zapier_webhook = await inbox.create_webhook(
    url="https://hooks.zapier.com/...",
    events=["email.received"],
    template="zapier",
)
```

### Custom Templates

```python
from vaultsandbox import CustomTemplate
import json

webhook = await inbox.create_webhook(
    url="https://your-app.com/webhook/emails",
    events=["email.received"],
    template=CustomTemplate(
        body=json.dumps({
            "email_id": "{{email.id}}",
            "sender": "{{email.from}}",
            "subject_line": "{{email.subject}}",
            "received_timestamp": "{{email.receivedAt}}",
        }),
        content_type="application/json",
    ),
)
```

## Testing Webhooks

### Send Test Request

```python
webhook = await inbox.get_webhook("whk_abc123")
result = await webhook.test()

if result.success:
    print(f"Test successful!")
    print(f"Status: {result.status_code}")
    print(f"Response time: {result.response_time}ms")
else:
    print(f"Test failed: {result.error}")
```

### Test Response

```python
@dataclass
class TestWebhookResult:
    success: bool
    status_code: int | None = None
    response_time: int | None = None
    response_body: str | None = None
    error: str | None = None
    payload_sent: Any | None = None
```

## Rotating Secrets

Rotate webhook secrets periodically for security:

```python
webhook = await inbox.get_webhook("whk_abc123")
result = await webhook.rotate_secret()

print(f"New secret: {result.secret}")
print(f"Old secret valid until: {result.previous_secret_valid_until}")

# Update your application with the new secret
# The old secret remains valid during the grace period
```

## Verifying Webhook Signatures

Always verify webhook signatures in your endpoint. Webhooks include the following headers:

| Header              | Description                                      |
| ------------------- | ------------------------------------------------ |
| `X-Vault-Signature` | HMAC-SHA256 signature (format: `sha256=<hex>`)   |
| `X-Vault-Timestamp` | Unix timestamp                                   |
| `X-Vault-Event`     | Event type                                       |
| `X-Vault-Delivery`  | Unique delivery ID                               |

The signature is computed over `{timestamp}.{raw_request_body}` and sent with a `sha256=` prefix:

```python
from vaultsandbox import verify_webhook_signature, WebhookSignatureVerificationError

WEBHOOK_SECRET = "whsec_..."

# Flask example
@app.route("/webhook/emails", methods=["POST"])
def handle_webhook():
    raw_body = request.get_data(as_text=True)
    signature = request.headers.get("X-Vault-Signature")
    timestamp = request.headers.get("X-Vault-Timestamp")

    try:
        verify_webhook_signature(raw_body, signature, timestamp, WEBHOOK_SECRET)
    except WebhookSignatureVerificationError:
        return "Invalid signature", 401

    # Process the webhook
    event = request.get_json()
    print(f"Email received: {event}")
    return "OK", 200
```

### FastAPI Example

```python
from fastapi import FastAPI, Request, HTTPException
from vaultsandbox import verify_webhook_signature, WebhookSignatureVerificationError

app = FastAPI()
WEBHOOK_SECRET = "whsec_..."

@app.post("/webhook/emails")
async def handle_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("X-Vault-Signature")
    timestamp = request.headers.get("X-Vault-Timestamp")

    try:
        verify_webhook_signature(raw_body, signature, timestamp, WEBHOOK_SECRET)
    except WebhookSignatureVerificationError:
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Process the webhook
    event = await request.json()
    print(f"Email received: {event}")
    return {"status": "ok"}
```

### Django Example

```python
import json
from django.http import HttpResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from vaultsandbox import verify_webhook_signature, WebhookSignatureVerificationError

WEBHOOK_SECRET = "whsec_..."

@csrf_exempt
def handle_webhook(request):
    raw_body = request.body.decode("utf-8")
    signature = request.headers.get("X-Vault-Signature")
    timestamp = request.headers.get("X-Vault-Timestamp")

    try:
        verify_webhook_signature(raw_body, signature, timestamp, WEBHOOK_SECRET)
    except WebhookSignatureVerificationError:
        return HttpResponseForbidden("Invalid signature")

    # Process the webhook
    event = json.loads(raw_body)
    print(f"Email received: {event}")
    return HttpResponse("OK")
```

### Signature Verification Options

The `verify_webhook_signature` function accepts an optional `tolerance_seconds` parameter:

```python
verify_webhook_signature(
    raw_body,
    signature,
    timestamp,
    WEBHOOK_SECRET,
    tolerance_seconds=300,  # Default: 5 minutes
)
```

Set `tolerance_seconds=0` to disable timestamp validation (not recommended for production).

## Utility Functions

### Validate Timestamp

Check if a webhook timestamp is within the tolerance window without verifying the full signature:

```python
from vaultsandbox import is_timestamp_valid

timestamp = request.headers.get("X-Vault-Timestamp")

if not is_timestamp_valid(timestamp):
    return "Timestamp expired", 401

if not is_timestamp_valid(timestamp, tolerance_seconds=60):
    return "Timestamp outside 60-second window", 401
```

### Parse Webhook Event

Parse and validate the webhook payload structure:

```python
import json
from vaultsandbox import verify_webhook_signature, construct_webhook_event

# After verifying signature
verify_webhook_signature(raw_body, signature, timestamp, WEBHOOK_SECRET)

# Parse and validate payload structure
event = construct_webhook_event(json.loads(raw_body))

# Event structure:
# {
#     "id": "evt_...",
#     "object": "event",
#     "createdAt": 1705420800,
#     "type": "email.received",
#     "data": { ... }
# }

if event["type"] == "email.received":
    email_data = event["data"]
    print(f"New email from {email_data['from']['address']}")
```

## Error Handling

```python
from vaultsandbox import (
    WebhookNotFoundError,
    WebhookLimitReachedError,
    InboxNotFoundError,
    ApiError,
)

try:
    webhook = await inbox.get_webhook("whk_abc123")
except WebhookNotFoundError:
    print("Webhook not found")
except InboxNotFoundError:
    print("Inbox not found")
except ApiError as e:
    print(f"API error ({e.status_code}): {e.message}")
```

## Complete Example

```python
import asyncio
import os
from vaultsandbox import (
    VaultSandboxClient,
    FilterConfig,
    FilterRule,
    WebhookNotFoundError,
)

async def setup_webhooks():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        # Create inbox
        inbox = await client.create_inbox()
        print(f"Inbox: {inbox.email_address}")

        # Create webhook with filter
        webhook = await inbox.create_webhook(
            url="https://your-app.com/webhook/emails",
            events=["email.received", "email.stored"],
            description="Production email webhook",
            filter=FilterConfig(
                rules=[
                    FilterRule(
                        field="from.address",
                        operator="domain",
                        value="example.com",
                    ),
                ],
                mode="all",
            ),
        )

        print(f"Webhook created: {webhook.id}")
        print(f"Secret: {webhook.secret}")

        # Test the webhook
        result = await webhook.test()
        if result.success:
            print("Webhook test successful!")
        else:
            print(f"Webhook test failed: {result.error}")

        # List all webhooks
        webhooks = await inbox.list_webhooks()
        print(f"Total webhooks: {len(webhooks)}")

        # Update webhook
        await webhook.update(description="Updated description")

        # Rotate secret after some time
        # new_secret = await webhook.rotate_secret()

        # Cleanup
        # await webhook.delete()
        # await inbox.delete()

asyncio.run(setup_webhooks())
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

- [Real-time Monitoring](/client-python/guides/real-time/) - SSE-based monitoring
- [Inbox API Reference](/client-python/api/inbox/) - Complete inbox methods
- [Error Handling](/client-python/api/errors/) - Handle webhook errors
