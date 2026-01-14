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

## Next Steps

- [Email Commands](/cli/commands/email/) - Work with emails in your inboxes
- [Wait Command](/cli/commands/wait/) - Script email verification
- [Export/Import](/cli/commands/data/) - Back up and restore inboxes
