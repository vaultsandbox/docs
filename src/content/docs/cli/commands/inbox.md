---
title: Inbox Commands
description: Create, list, and manage VaultSandbox inboxes from the CLI
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

| Flag           | Description                                                                 | Default        |
| -------------- | --------------------------------------------------------------------------- | -------------- |
| `--ttl`        | Time-to-live duration (e.g., `1h`, `24h`, `7d`)                             | `24h`          |
| `--email-auth` | Enable/disable SPF/DKIM/DMARC/PTR authentication checks (`true` or `false`) | Server default |
| `--encryption` | Request encryption mode (`encrypted` or `plain`)                            | Server default |

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

# Combine options
vsb inbox create --ttl 7d --email-auth=true --encryption=encrypted

# Create inbox and output JSON (useful for scripting)
vsb inbox create -o json
```

### Output

```
Inbox Ready!

  Address:  abc123@abc123.vsx.email
  Expires:  24h

Run 'vsb' to see emails arrive live.
```

JSON output:

```json
{
	"email": "abc123@abc123.vsx.email",
	"expiresAt": "2024-01-16T14:30:00Z",
	"createdAt": "2024-01-15T14:30:00Z"
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
		"isExpired": false
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

## Next Steps

- [Email Commands](/cli/commands/email/) - Work with emails in your inboxes
- [Webhook Commands](/cli/commands/webhook/) - Global webhooks for all inboxes
- [Wait Command](/cli/commands/wait/) - Script email verification
- [Export/Import](/cli/commands/data/) - Back up and restore inboxes
