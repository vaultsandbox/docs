---
title: Export & Import
description: Back up and restore inboxes with encryption keys
---

Export and import commands let you save inboxes with their encryption keys for backup, sharing, or migrating between machines.

## vsb export

Export an inbox with its encryption keys to a JSON file.

```bash
vsb export [email-address] [flags]
```

### Arguments

| Argument        | Description                                    |
| --------------- | ---------------------------------------------- |
| `email-address` | Inbox to export (uses active inbox if omitted) |

### Flags

| Flag    | Description                                |
| ------- | ------------------------------------------ |
| `--out` | Output file path (default: `<email>.json`) |

### Examples

```bash
# Export active inbox
vsb export

# Export specific inbox
vsb export test@abc123.vsx.email

# Export to specific file
vsb export test@abc123.vsx.email --out backup.json
```

### Output

```
✓ Export complete
```

A security warning is displayed reminding you that the file contains private keys.

### File Format

The export file is a JSON document containing:

```json
{
	"version": 1,
	"emailAddress": "test@abc123.vsx.email",
	"inboxHash": "abc123",
	"expiresAt": "2024-01-16T14:30:00Z",
	"exportedAt": "2024-01-15T14:30:00Z",
	"keys": {
		"kemPrivate": "...",
		"kemPublic": "...",
		"serverSigPk": "..."
	}
}
```

:::caution
Export files contain private encryption keys. Handle them as sensitive data:

- Do not commit to version control
- Do not share over insecure channels
- Delete after use if no longer needed
  :::

---

## vsb import

Import an inbox from an export file.

```bash
vsb import <file> [flags]
```

### Arguments

| Argument | Description         |
| -------- | ------------------- |
| `file`   | Path to export file |

### Flags

| Flag          | Description                       |
| ------------- | --------------------------------- |
| `-l, --local` | Skip server verification          |
| `-f, --force` | Overwrite if inbox already exists |

### Examples

```bash
# Import inbox
vsb import backup.json

# Import and overwrite existing
vsb import backup.json -f

# Skip server verification
vsb import backup.json -l
```

### Output

```
✓ Inbox verified: 5 emails

Import Complete

Address:  test@abc123.vsx.email
Expires:  720h0m0s

This inbox is now your active inbox.
Run 'vsb' to see emails.
```

## Use Cases

### Backup Before Deletion

```bash
# Export before deleting
vsb export test@abc123.vsx.email --out backup.json
vsb inbox delete test@abc123.vsx.email --force

# Later, restore if needed
vsb import backup.json
```

### Share Between Machines

```bash
# On machine A: Export
vsb export test@abc123.vsx.email --out shared-inbox.json

# Transfer file securely (scp, encrypted email, etc.)
scp shared-inbox.json user@machine-b:~/

# On machine B: Import
vsb import ~/shared-inbox.json
```

### CI/CD Persistent Inboxes

Instead of creating new inboxes for each CI run, you can use a persistent inbox:

```yaml
# .github/workflows/test.yml
jobs:
  test:
    steps:
      - name: Import test inbox
        run: |
          echo '${{ secrets.TEST_INBOX_EXPORT }}' > inbox.json
          vsb import inbox.json -f

      - name: Run tests
        run: ./run-email-tests.sh
```

:::tip
For CI/CD, consider creating a long-lived inbox and storing its export as a secret. This avoids rate limits from creating many short-lived inboxes.
:::

### Team Testing

Share a test inbox with your team:

```bash
# Create and export a shared inbox
vsb inbox create --ttl 30d
vsb export --out team-test-inbox.json

# Store in secure location (password manager, encrypted vault)
# Team members import on their machines
```

## Next Steps

- [Inbox Commands](/cli/commands/inbox/) - Manage inboxes
- [Wait Command](/cli/commands/wait/) - CI/CD integration
- [Configuration](/cli/configuration/) - Keystore and data storage
