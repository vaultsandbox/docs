---
title: Inbox Commands
description: Create, list, and manage VaultSandbox inboxes from the CLI, including chaos engineering
---

Inbox commands let you create temporary email addresses, list existing inboxes, and manage their lifecycle.

## Global Flags

All inbox commands support these global flags:

| Flag           | Description                                              |
| -------------- | -------------------------------------------------------- |
| `--config`     | Config file (default is `$HOME/.config/vsb/config.yaml`) |
| `-o, --output` | Output format: `pretty`, `json`                          |

---

## vsb inbox create

Create a new temporary inbox with an auto-generated email address.

```bash
vsb inbox create [flags]
```

### Flags

| Flag              | Description                                                                 | Default        |
| ----------------- | --------------------------------------------------------------------------- | -------------- |
| `--ttl`           | Time-to-live duration (e.g., `1h`, `24h`, `7d`)                             | `24h`          |
| `--email-auth`    | Enable/disable SPF/DKIM/DMARC/PTR authentication checks (`true` or `false`) | Server default |
| `--encryption`    | Request encryption mode (`encrypted` or `plain`)                            | Server default |
| `--persistence`   | Persistence mode (`persistent` or `ephemeral`)                              | Server default |
| `--spam-analysis` | Enable/disable spam analysis for this inbox (`true` or `false`)             | Server default |

:::note
Persistence applies to inbox metadata and webhook configurations only. Emails are always fetched from the server and are not persisted locally regardless of this setting.
:::

### Examples

```bash
# Create inbox with default 24h TTL
vsb inbox create

# Create inbox with custom TTL
vsb inbox create --ttl 1h
vsb inbox create --ttl 7d

# Create inbox without email authentication checks
vsb inbox create --email-auth=false

# Create unencrypted inbox (if server policy allows)
vsb inbox create --encryption=plain

# Create persistent inbox (survives server restarts)
vsb inbox create --persistence=persistent

# Create ephemeral inbox
vsb inbox create --persistence=ephemeral

# Create inbox with spam analysis enabled
vsb inbox create --spam-analysis=true

# Combine options
vsb inbox create --ttl 7d --email-auth=true --encryption=encrypted --persistence=persistent --spam-analysis=true

# Create inbox and output JSON (useful for scripting)
vsb inbox create -o json
```

### Output

```
Inbox Ready!

  Address:     abc123@abc123.vsx.email
  Expires:     24h
  Encrypted:   Yes
  Persistent:  No

Run 'vsb' to see emails arrive live.
```

JSON output:

```json
{
	"email": "abc123@abc123.vsx.email",
	"expiresAt": "2024-01-16T14:30:00Z",
	"createdAt": "2024-01-15T14:30:00Z",
	"encrypted": true,
	"emailAuth": true,
	"persistent": false
}
```

---

## vsb inbox list

List all stored inboxes.

```bash
vsb inbox list [flags]
vsb inbox ls [flags]
```

### Flags

| Flag        | Description             |
| ----------- | ----------------------- |
| `-a, --all` | Include expired inboxes |

### Examples

```bash
# List active inboxes
vsb inbox list
vsb inbox ls

# Include expired inboxes
vsb inbox list -a

# Output as JSON
vsb inbox list -o json
```

### Output

```
   EMAIL                           EXPIRES
 > abc123@abc123.vsx.email         14h
   xyz789@abc123.vsx.email         expired
```

The `>` marker indicates the active inbox. Expired inboxes are shown with dimmed styling.

JSON output:

```json
[
	{
		"email": "abc123@abc123.vsx.email",
		"expiresAt": "2024-01-16T14:30:00Z",
		"isActive": true,
		"isExpired": false,
		"encrypted": true,
		"emailAuth": true,
		"persistent": false
	}
]
```

---

## vsb inbox info

Show detailed information about an inbox.

```bash
vsb inbox info [email]
```

If no email is specified, shows info for the active inbox.

### Arguments

| Argument | Description                                            |
| -------- | ------------------------------------------------------ |
| `email`  | Email address (optional, uses active inbox if omitted) |

### Examples

```bash
# Show info for active inbox
vsb inbox info

# Show info for specific inbox
vsb inbox info abc123@abc123.vsx.email

# Partial matching works
vsb inbox info abc123

# JSON output
vsb inbox info -o json
```

### Output

```
abc123@abc123.vsx.email  ACTIVE

ID:            abc123
Created:       2024-01-15 14:30
Expires:       2024-01-16 14:30 (14h)
Encrypted:     Yes
Email Auth:    Yes
Persistent:    No
Emails:        3
```

JSON output:

```json
{
	"email": "abc123@abc123.vsx.email",
	"expiresAt": "2024-01-16T14:30:00Z",
	"isActive": true,
	"isExpired": false,
	"id": "abc123",
	"createdAt": "2024-01-15T14:30:00Z",
	"encrypted": true,
	"emailAuth": true,
	"persistent": false,
	"emailCount": 3,
	"syncError": "error message"
}
```

Note: `syncError` is only included when the server sync fails.

---

## vsb inbox use

Set the active inbox for subsequent commands.

```bash
vsb inbox use <email>
```

### Arguments

| Argument | Description                    |
| -------- | ------------------------------ |
| `email`  | Email address or partial match |

### Examples

```bash
# Set active inbox by full address
vsb inbox use abc123@abc123.vsx.email

# Partial matching
vsb inbox use abc123
vsb inbox use abc

# Now commands use this inbox by default
vsb email list
```

---

## vsb inbox delete

Delete an inbox and all its emails.

```bash
vsb inbox delete <email> [flags]
vsb inbox rm <email> [flags]
```

### Arguments

| Argument | Description                    |
| -------- | ------------------------------ |
| `email`  | Email address or partial match |

### Flags

| Flag          | Description                                              |
| ------------- | -------------------------------------------------------- |
| `-l, --local` | Only remove from local keystore (don't delete on server) |

### Examples

```bash
# Delete inbox
vsb inbox delete abc123@abc123.vsx.email
vsb inbox rm abc123

# Remove from local keystore only
vsb inbox delete abc123 --local
vsb inbox delete abc123 -l
```

:::caution
Deleting an inbox removes all associated emails and encryption keys. This action cannot be undone unless you have an export.
:::

---

## vsb inbox prune

Remove inboxes from the local keystore that no longer exist on the server.

This is useful when inboxes have been deleted server-side but still exist locally, causing errors like "API error 404: Not Found" when starting the dashboard.

```bash
vsb inbox prune [flags]
```

### Flags

| Flag        | Description                                      |
| ----------- | ------------------------------------------------ |
| `--dry-run` | Show what would be pruned without removing anything |

### Examples

```bash
# Preview what would be pruned
vsb inbox prune --dry-run

# Prune invalid inboxes
vsb inbox prune
```

### Output

```
✓ Pruned: old123@old123.vsx.email
✓ Pruned: deleted456@deleted456.vsx.email

2 inbox(es) pruned
```

When all inboxes are valid:

```
✓ All inboxes are valid
```

---

## Inbox Webhooks

Inbox webhooks receive notifications only for emails sent to a specific inbox. They work the same as [global webhooks](/cli/commands/webhook/) but are scoped to one inbox.

### vsb inbox webhook create

Create a webhook for a specific inbox.

```bash
vsb inbox webhook create <url> [flags]
```

#### Arguments

| Argument | Description              |
| -------- | ------------------------ |
| `url`    | The webhook endpoint URL |

#### Flags

| Flag                        | Description                                               | Required |
| --------------------------- | --------------------------------------------------------- | -------- |
| `--event`                   | Event type to subscribe to (repeatable)                   | Yes      |
| `--inbox`                   | Inbox to attach webhook to (uses active if omitted)       | No       |
| `--template`                | Built-in template: `slack`, `discord`, `teams`, `generic` | No       |
| `--custom-template`         | Path to custom Go template file                           | No       |
| `--content-type`            | Content-Type for custom template                          | No       |
| `--description`             | Optional description                                      | No       |
| `--filter-from`             | Filter by sender email/pattern                            | No       |
| `--filter-to`               | Filter by recipient email/pattern                         | No       |
| `--filter-subject`          | Exact subject match                                       | No       |
| `--filter-subject-contains` | Subject contains text                                     | No       |
| `--filter-subject-regex`    | Subject regex pattern                                     | No       |
| `--filter-domain`           | Filter by sender domain                                   | No       |
| `--filter-mode`             | Filter logic: `all` (AND) or `any` (OR)                   | No       |
| `--require-auth`            | Require email passes SPF/DKIM/DMARC                       | No       |

#### Examples

```bash
# Create webhook for active inbox
vsb inbox webhook create https://example.com/webhook --event email.received

# Create webhook for specific inbox
vsb inbox webhook create https://example.com/webhook \
  --event email.received \
  --inbox test@abc123.vsx.email

# Create Slack webhook with filters
vsb inbox webhook create https://hooks.slack.com/services/xxx \
  --event email.received \
  --template slack \
  --filter-subject-contains "verify"
```

---

### vsb inbox webhook list

List webhooks for an inbox.

```bash
vsb inbox webhook list [flags]
vsb inbox webhook ls [flags]
```

#### Flags

| Flag      | Description                                  |
| --------- | -------------------------------------------- |
| `--inbox` | Specify inbox (uses active inbox if omitted) |

#### Examples

```bash
# List webhooks for active inbox
vsb inbox webhook list

# List webhooks for specific inbox
vsb inbox webhook list --inbox test@abc123.vsx.email

# Output as JSON
vsb inbox webhook list -o json
```

---

### vsb inbox webhook get

Get detailed information about an inbox webhook.

```bash
vsb inbox webhook get <webhook-id> [flags]
```

#### Arguments

| Argument     | Description |
| ------------ | ----------- |
| `webhook-id` | Webhook ID  |

#### Flags

| Flag      | Description                                  |
| --------- | -------------------------------------------- |
| `--inbox` | Specify inbox (uses active inbox if omitted) |

#### Examples

```bash
vsb inbox webhook get wh_abc123
vsb inbox webhook get wh_abc123 -o json
```

---

### vsb inbox webhook update

Update an inbox webhook.

```bash
vsb inbox webhook update <webhook-id> [flags]
```

#### Arguments

| Argument     | Description |
| ------------ | ----------- |
| `webhook-id` | Webhook ID  |

#### Flags

| Flag                        | Description                                  |
| --------------------------- | -------------------------------------------- |
| `--inbox`                   | Specify inbox (uses active inbox if omitted) |
| `--url`                     | Change webhook endpoint URL                  |
| `--event`                   | Replace events (repeatable)                  |
| `--template`                | Change to built-in template                  |
| `--custom-template`         | Change to custom template                    |
| `--content-type`            | Content-Type for custom template             |
| `--description`             | Update description                           |
| `--enable`                  | Enable webhook                               |
| `--disable`                 | Disable webhook                              |
| `--clear-filters`           | Remove all filters                           |
| `--filter-from`             | Filter by sender email/pattern               |
| `--filter-to`               | Filter by recipient email/pattern            |
| `--filter-subject`          | Exact subject match                          |
| `--filter-subject-contains` | Subject contains text                        |
| `--filter-subject-regex`    | Subject regex pattern                        |
| `--filter-domain`           | Filter by sender domain                      |
| `--filter-mode`             | Filter logic: `all` (AND) or `any` (OR)      |
| `--require-auth`            | Require email passes SPF/DKIM/DMARC          |

#### Examples

```bash
# Disable webhook
vsb inbox webhook update wh_abc123 --disable

# Change URL and add filter
vsb inbox webhook update wh_abc123 \
  --url https://new-endpoint.com \
  --filter-subject-contains "important"
```

---

### vsb inbox webhook delete

Delete an inbox webhook.

```bash
vsb inbox webhook delete <webhook-id> [flags]
vsb inbox webhook rm <webhook-id> [flags]
```

#### Arguments

| Argument     | Description |
| ------------ | ----------- |
| `webhook-id` | Webhook ID  |

#### Flags

| Flag          | Description                                  |
| ------------- | -------------------------------------------- |
| `--inbox`     | Specify inbox (uses active inbox if omitted) |
| `-f, --force` | Skip confirmation prompt                     |

#### Examples

```bash
vsb inbox webhook delete wh_abc123
vsb inbox webhook rm wh_abc123 -f
```

---

### vsb inbox webhook rotate

Rotate the signing secret for an inbox webhook.

```bash
vsb inbox webhook rotate <webhook-id> [flags]
```

#### Arguments

| Argument     | Description |
| ------------ | ----------- |
| `webhook-id` | Webhook ID  |

#### Flags

| Flag          | Description                                  |
| ------------- | -------------------------------------------- |
| `--inbox`     | Specify inbox (uses active inbox if omitted) |
| `-f, --force` | Skip confirmation prompt                     |

#### Examples

```bash
vsb inbox webhook rotate wh_abc123
vsb inbox webhook rotate wh_abc123 -f
```

:::note
The previous secret remains valid for 24 hours after rotation.
:::

---

### vsb inbox webhook test

Test an inbox webhook endpoint.

```bash
vsb inbox webhook test <webhook-id> [flags]
```

#### Arguments

| Argument     | Description |
| ------------ | ----------- |
| `webhook-id` | Webhook ID  |

#### Flags

| Flag      | Description                                  |
| --------- | -------------------------------------------- |
| `--inbox` | Specify inbox (uses active inbox if omitted) |

#### Examples

```bash
vsb inbox webhook test wh_abc123
vsb inbox webhook test wh_abc123 -o json
```

---

## Chaos Engineering

Chaos engineering commands let you inject various failure scenarios for testing email delivery resilience. Use these to simulate real-world issues like network latency, connection drops, and error responses.

:::note
Chaos engineering must be enabled server-side for these commands to work.
:::

### vsb inbox chaos set

Enable and configure chaos engineering scenarios for an inbox.

```bash
vsb inbox chaos set [flags]
```

#### Global Chaos Flags

| Flag        | Description                                              | Default |
| ----------- | -------------------------------------------------------- | ------- |
| `--inbox`   | Specify inbox (uses active inbox if omitted)             |         |
| `--expires` | Auto-disable after duration (e.g., `1h`, `30m`) or timestamp |     |

#### Latency Injection

Simulate network latency by adding delays to email processing.

| Flag            | Description                                    | Default |
| --------------- | ---------------------------------------------- | ------- |
| `--latency`     | Enable latency injection                       | `false` |
| `--min-delay`   | Minimum delay in milliseconds                  | `500`   |
| `--max-delay`   | Maximum delay in milliseconds                  | `10000` |
| `--no-jitter`   | Use fixed delay (max-delay) instead of random  | `false` |
| `--probability` | Probability of applying latency (0.0-1.0)      | `1.0`   |

#### Connection Drops

Simulate network connection failures.

| Flag                 | Description                                    | Default |
| -------------------- | ---------------------------------------------- | ------- |
| `--connection-drop`  | Enable connection dropping                     | `false` |
| `--drop-probability` | Probability of dropping a connection (0.0-1.0) | `1.0`   |
| `--abrupt`           | Use abrupt close (RST) instead of graceful (FIN) | `false` |

#### Random Errors

Generate random error responses.

| Flag            | Description                                       | Default       |
| --------------- | ------------------------------------------------- | ------------- |
| `--random-error`| Enable random error generation                    | `false`       |
| `--error-rate`  | Probability of returning error (0.0-1.0)          | `0.1`         |
| `--error-types` | Error types to inject: `temporary`, `permanent`   | `temporary`   |

#### Greylisting

Simulate email greylisting behavior.

| Flag             | Description                                      | Default     |
| ---------------- | ------------------------------------------------ | ----------- |
| `--greylist`     | Enable greylisting simulation                    | `false`     |
| `--retry-window` | Retry window in milliseconds                     | `300000`    |
| `--max-attempts` | Number of attempts before accepting              | `2`         |
| `--track-by`     | Track greylisting by: `ip`, `sender`, `ip_sender`| `ip_sender` |

#### Blackhole Mode

Silently drop emails without response.

| Flag                 | Description                              | Default |
| -------------------- | ---------------------------------------- | ------- |
| `--blackhole`        | Enable blackhole mode                    | `false` |
| `--trigger-webhooks` | Still trigger webhooks in blackhole mode | `false` |

#### Examples

```bash
# Enable latency injection (500-5000ms delay)
vsb inbox chaos set --latency --min-delay 500 --max-delay 5000

# Enable latency with 50% probability
vsb inbox chaos set --latency --min-delay 1000 --max-delay 5000 --probability 0.5

# Enable connection drops (30% of connections)
vsb inbox chaos set --connection-drop --drop-probability 0.3

# Enable abrupt connection drops
vsb inbox chaos set --connection-drop --drop-probability 0.5 --abrupt

# Enable random errors (20% temporary errors)
vsb inbox chaos set --random-error --error-rate 0.2 --error-types temporary

# Enable greylisting
vsb inbox chaos set --greylist --max-attempts 3 --retry-window 600000

# Enable blackhole mode (drop all emails)
vsb inbox chaos set --blackhole

# Blackhole with webhooks still firing
vsb inbox chaos set --blackhole --trigger-webhooks

# Set chaos with auto-expiration
vsb inbox chaos set --latency --min-delay 500 --expires 1h

# Set chaos on specific inbox
vsb inbox chaos set --inbox user@example.vsx.email --latency --min-delay 1000

# Combine multiple chaos types
vsb inbox chaos set \
  --latency --min-delay 500 --max-delay 2000 --probability 0.3 \
  --connection-drop --drop-probability 0.1 \
  --random-error --error-rate 0.05
```

---

### vsb inbox chaos get

Display the current chaos configuration for an inbox.

```bash
vsb inbox chaos get [flags]
```

#### Flags

| Flag       | Description                                  |
| ---------- | -------------------------------------------- |
| `--inbox`  | Specify inbox (uses active inbox if omitted) |
| `--output` | Output format: `json` or pretty-print        |

#### Examples

```bash
# Get chaos config for active inbox
vsb inbox chaos get

# Get chaos config for specific inbox
vsb inbox chaos get --inbox user@example.vsx.email

# Output as JSON
vsb inbox chaos get -o json
```

#### Output

```
Chaos Configuration

  Status:   enabled
  Expires:  2024-01-15 16:30 (1h)

  Latency:
    Delay:       500-2000ms (jitter enabled)
    Probability: 0.3

  Connection Drop:
    Probability: 0.1
```

JSON output:

```json
{
  "enabled": true,
  "expiresAt": "2024-01-15T16:30:00Z",
  "latency": {
    "enabled": true,
    "minDelayMs": 500,
    "maxDelayMs": 2000,
    "jitter": true,
    "probability": 0.3
  },
  "connectionDrop": {
    "enabled": true,
    "probability": 0.1,
    "graceful": true
  }
}
```

---

### vsb inbox chaos disable

Disable all chaos engineering scenarios for an inbox.

```bash
vsb inbox chaos disable [flags]
```

#### Flags

| Flag          | Description                                  |
| ------------- | -------------------------------------------- |
| `--inbox`     | Specify inbox (uses active inbox if omitted) |
| `-f, --force` | Skip confirmation prompt                     |
| `--output`    | Output format: `json` or pretty-print        |

#### Examples

```bash
# Disable chaos for active inbox (prompts for confirmation)
vsb inbox chaos disable

# Force disable without confirmation
vsb inbox chaos disable -f
vsb inbox chaos disable --force

# Disable for specific inbox
vsb inbox chaos disable --inbox user@example.vsx.email
```

---

## Next Steps

- [Email Commands](/cli/commands/email/) - Work with emails in your inboxes
- [Webhook Commands](/cli/commands/webhook/) - Global webhooks for all inboxes
- [Wait Command](/cli/commands/wait/) - Script email verification
- [Export/Import](/cli/commands/data/) - Back up and restore inboxes
