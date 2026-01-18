---
title: Webhook Commands
description: Create, manage, and monitor webhooks for real-time email notifications
---

Webhook commands let you set up real-time notifications when emails are received, stored, or deleted. Webhooks can be configured globally (for all inboxes) or scoped to specific inboxes.

## Global Flags

All webhook commands support these global flags:

| Flag           | Description                                              |
| -------------- | -------------------------------------------------------- |
| `--config`     | Config file (default is `$HOME/.config/vsb/config.yaml`) |
| `-o, --output` | Output format: `pretty`, `json`                          |

---

## vsb webhook create

Create a new global webhook that receives notifications for all inboxes.

```bash
vsb webhook create <url> [flags]
```

### Arguments

| Argument | Description              |
| -------- | ------------------------ |
| `url`    | The webhook endpoint URL |

### Flags

| Flag                        | Description                                                    | Required |
| --------------------------- | -------------------------------------------------------------- | -------- |
| `--event`                   | Event type to subscribe to (repeatable)                        | Yes      |
| `--template`                | Built-in template: `slack`, `discord`, `teams`, `generic`      | No       |
| `--custom-template`         | Path to custom Go template file                                | No       |
| `--content-type`            | Content-Type for custom template (default: `application/json`) | No       |
| `--description`             | Optional description                                           | No       |
| `--filter-from`             | Filter by sender email/pattern                                 | No       |
| `--filter-to`               | Filter by recipient email/pattern                              | No       |
| `--filter-subject`          | Exact subject match                                            | No       |
| `--filter-subject-contains` | Subject contains text                                          | No       |
| `--filter-subject-regex`    | Subject regex pattern                                          | No       |
| `--filter-domain`           | Filter by sender domain                                        | No       |
| `--filter-mode`             | Filter logic: `all` (AND) or `any` (OR)                        | No       |
| `--require-auth`            | Require email passes SPF/DKIM/DMARC                            | No       |

### Event Types

| Event            | Description                      |
| ---------------- | -------------------------------- |
| `email.received` | Triggered when email is received |
| `email.stored`   | Triggered when email is stored   |
| `email.deleted`  | Triggered when email is deleted  |

### Examples

```bash
# Create basic webhook
vsb webhook create https://example.com/webhook --event email.received

# Create webhook for multiple events
vsb webhook create https://example.com/webhook \
  --event email.received \
  --event email.deleted

# Create Slack webhook with filters
vsb webhook create https://hooks.slack.com/services/xxx \
  --event email.received \
  --template slack \
  --filter-subject-contains "alert" \
  --filter-domain example.com \
  --filter-mode all \
  --description "Alert notifications"

# Create webhook with authentication requirement
vsb webhook create https://example.com/webhook \
  --event email.received \
  --require-auth

# Create webhook with custom template
vsb webhook create https://example.com/webhook \
  --event email.received \
  --custom-template ./my-template.tmpl \
  --content-type "application/json"
```

### Output

```
Webhook Created!

  ID:     wh_abc123
  URL:    https://example.com/webhook
  Events: email.received
  Secret: whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Save this secret - you won't be able to see it again.
Use it to verify webhook signatures.
```

:::caution
The signing secret is only shown once at creation time. Save it securely for HMAC signature verification.
:::

---

## vsb webhook list

List all global webhooks.

```bash
vsb webhook list [flags]
vsb webhook ls [flags]
```

### Examples

```bash
# List all webhooks
vsb webhook list
vsb webhook ls

# Output as JSON
vsb webhook list -o json
```

### Output

```
ID           URL                              EVENTS           ENABLED   DELIVERIES
wh_abc123    https://example.com/webhook      email.received   Yes       152 (99%)
wh_def456    https://hooks.slack.com/xxx      email.received   No        50 (90%)

Total: 2 webhook(s)
```

---

## vsb webhook get

Get detailed information about a specific webhook.

```bash
vsb webhook get <webhook-id>
```

### Arguments

| Argument     | Description |
| ------------ | ----------- |
| `webhook-id` | Webhook ID  |

### Examples

```bash
vsb webhook get wh_abc123

# Output as JSON
vsb webhook get wh_abc123 -o json
```

### Output

```
Webhook: wh_abc123

CONFIGURATION
URL:         https://example.com/webhook
Events:      email.received, email.deleted
Scope:       global
Enabled:     Yes
Template:    slack
Description: Alert notifications

FILTERS
Mode: all (AND)
  - subject contains "alert"
  - domain = example.com
  - require-auth: yes

DELIVERY STATS
Total:        152
Successful:   150
Failed:       2
Success Rate: 98.7%
Last Delivery: 2024-01-15 14:30:00
Last Success:  2024-01-15 14:30:00
```

---

## vsb webhook update

Update an existing webhook.

```bash
vsb webhook update <webhook-id> [flags]
```

### Arguments

| Argument     | Description |
| ------------ | ----------- |
| `webhook-id` | Webhook ID  |

### Flags

| Flag                        | Description                             |
| --------------------------- | --------------------------------------- |
| `--url`                     | Change webhook endpoint URL             |
| `--event`                   | Replace events (repeatable)             |
| `--template`                | Change to built-in template             |
| `--custom-template`         | Change to custom template               |
| `--content-type`            | Content-Type for custom template        |
| `--description`             | Update description                      |
| `--enable`                  | Enable webhook                          |
| `--disable`                 | Disable webhook                         |
| `--clear-filters`           | Remove all filters                      |
| `--filter-from`             | Filter by sender email/pattern          |
| `--filter-to`               | Filter by recipient email/pattern       |
| `--filter-subject`          | Exact subject match                     |
| `--filter-subject-contains` | Subject contains text                   |
| `--filter-subject-regex`    | Subject regex pattern                   |
| `--filter-domain`           | Filter by sender domain                 |
| `--filter-mode`             | Filter logic: `all` (AND) or `any` (OR) |
| `--require-auth`            | Require email passes SPF/DKIM/DMARC     |

### Examples

```bash
# Disable webhook
vsb webhook update wh_abc123 --disable

# Enable webhook
vsb webhook update wh_abc123 --enable

# Change URL
vsb webhook update wh_abc123 --url https://new-endpoint.com/webhook

# Update events
vsb webhook update wh_abc123 --event email.received --event email.stored

# Add filters
vsb webhook update wh_abc123 \
  --filter-domain example.com \
  --filter-subject-contains "important"

# Clear all filters
vsb webhook update wh_abc123 --clear-filters

# Switch to Discord template
vsb webhook update wh_abc123 --template discord
```

---

## vsb webhook delete

Delete a webhook.

```bash
vsb webhook delete <webhook-id> [flags]
vsb webhook rm <webhook-id> [flags]
```

### Arguments

| Argument     | Description |
| ------------ | ----------- |
| `webhook-id` | Webhook ID  |

### Flags

| Flag          | Description              |
| ------------- | ------------------------ |
| `-f, --force` | Skip confirmation prompt |

### Examples

```bash
# Delete with confirmation
vsb webhook delete wh_abc123

# Delete without confirmation
vsb webhook delete wh_abc123 -f
vsb webhook rm wh_abc123 --force
```

---

## vsb webhook rotate

Rotate the signing secret for a webhook.

```bash
vsb webhook rotate <webhook-id> [flags]
```

### Arguments

| Argument     | Description |
| ------------ | ----------- |
| `webhook-id` | Webhook ID  |

### Flags

| Flag          | Description              |
| ------------- | ------------------------ |
| `-f, --force` | Skip confirmation prompt |

### Examples

```bash
# Rotate secret with confirmation
vsb webhook rotate wh_abc123

# Rotate without confirmation
vsb webhook rotate wh_abc123 -f
```

### Output

```
Secret Rotated!

  ID:         wh_abc123
  New Secret: whsec_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
  Grace Period Expires: 2024-01-16 14:30:00 (24h)

The previous secret will remain valid for 24 hours.
Update your endpoint to use the new secret before then.
```

:::note
The previous secret remains valid for 24 hours, allowing you to update your endpoint without downtime.
:::

---

## vsb webhook test

Send a test request to verify a webhook endpoint is reachable.

```bash
vsb webhook test <webhook-id>
```

### Arguments

| Argument     | Description |
| ------------ | ----------- |
| `webhook-id` | Webhook ID  |

### Examples

```bash
vsb webhook test wh_abc123

# Output as JSON
vsb webhook test wh_abc123 -o json
```

### Output

Success:

```
Test Successful!

  Status:        200 OK
  Response Time: 145ms
  Request ID:    req_xyz789
```

Failure:

```
Test Failed!

  Status:        Connection refused
  Response Time: 5023ms
  Request ID:    req_xyz789
  Error:         dial tcp: connection refused
```

---

## vsb webhook templates

List available built-in webhook templates.

```bash
vsb webhook templates
```

### Examples

```bash
vsb webhook templates

# Output as JSON
vsb webhook templates -o json
```

### Output

```
TEMPLATE    DESCRIPTION
slack       Slack incoming webhook format
discord     Discord webhook format
teams       Microsoft Teams webhook format
generic     Generic JSON payload
```

### Template Formats

**Slack** - Formats the webhook payload for Slack incoming webhooks with message blocks.

**Discord** - Formats the webhook payload for Discord webhooks with embeds.

**Teams** - Formats the webhook payload for Microsoft Teams connectors with adaptive cards.

**Generic** - Sends a plain JSON payload with all email metadata.

---

## vsb webhook metrics

Show global webhook delivery metrics.

```bash
vsb webhook metrics
```

### Examples

```bash
vsb webhook metrics

# Output as JSON
vsb webhook metrics -o json
```

### Output

```
WEBHOOK METRICS

OVERVIEW
Total Webhooks:  5
Active Webhooks: 4

DELIVERY STATS
Total Deliveries:      1,523
Successful:            1,498
Failed:                25
Success Rate:          98.4%

BY SCOPE
global:                850 deliveries
inbox-scoped:          673 deliveries

BY EVENT
email.received:        1,200 deliveries
email.stored:          300 deliveries
email.deleted:         23 deliveries
```

---

## Filter Patterns

Webhook filters support pattern matching for flexible notification rules.

### Pattern Operators

| Pattern Example   | Operator | Description                   |
| ----------------- | -------- | ----------------------------- |
| `^alert.*`        | regex    | Starts with `^` - regex match |
| `.*important$`    | regex    | Ends with `$` - regex match   |
| `*newsletter*`    | contains | Contains `*` - contains match |
| `exact@email.com` | contains | Default - contains match      |

### Filter Mode

- `--filter-mode all` (default): All filter rules must match (AND logic)
- `--filter-mode any`: Any filter rule can match (OR logic)

### Examples

```bash
# Match emails from any @company.com address
vsb webhook create https://example.com/webhook \
  --event email.received \
  --filter-domain company.com

# Match subjects starting with "URGENT" or "ALERT"
vsb webhook create https://example.com/webhook \
  --event email.received \
  --filter-subject-regex "^(URGENT|ALERT)"

# Match only authenticated emails from a specific sender
vsb webhook create https://example.com/webhook \
  --event email.received \
  --filter-from noreply@trusted.com \
  --require-auth
```

---

## Signature Verification

All webhook requests include an HMAC signature for verification. The signature is computed using the webhook secret and included in the `X-VSB-Signature` header.

### Verifying Signatures

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
	const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

	return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

---

## Next Steps

- [Inbox Webhooks](/cli/commands/inbox/#inbox-webhooks) - Webhooks scoped to specific inboxes
- [Wait Command](/cli/commands/wait/) - Script email verification
- [TUI Dashboard](/cli/tui/) - Interactive email monitoring
