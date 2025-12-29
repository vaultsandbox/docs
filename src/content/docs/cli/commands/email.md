---
title: Email Commands
description: List, view, and analyze emails from the CLI
---

Email commands let you work with messages in your inboxes without launching the TUI dashboard.

## vsb email list

List emails in an inbox.

```bash
vsb email list [flags]
vsb email ls [flags]
```

### Flags

| Flag | Description |
|------|-------------|
| `--inbox` | Specify inbox (uses active inbox if omitted) |
| `-o json` | Output in JSON format |

### Examples

```bash
# List emails in active inbox
vsb email list
vsb email ls

# List emails in specific inbox
vsb email list --inbox test@abc123.vsx.email

# Output as JSON
vsb email list -o json
```

### Output

```
ID        SUBJECT                  FROM                    RECEIVED
e1a2b3    Welcome to MyApp         noreply@myapp.com       2 min ago
e4d5f6    Password Reset           support@myapp.com       5 min ago

  2 email(s)
```

---

## vsb email view

View email content.

```bash
vsb email view [email-id] [flags]
```

If no email ID is specified, views the most recent email.

**Default behavior:** Opens the HTML version in your browser. Use flags for other formats.

### Arguments

| Argument | Description |
|----------|-------------|
| `email-id` | Email ID (optional, uses most recent if omitted) |

### Flags

| Flag | Description |
|------|-------------|
| `-t, --text` | Show plain text only (prints to terminal) |
| `-r, --raw` | Show raw email source (RFC 5322) |
| `--inbox` | Specify inbox |
| `-o json` | Output in JSON format |

### Examples

```bash
# View most recent email (opens HTML in browser)
vsb email view

# View specific email in browser
vsb email view e1a2b3

# View as plain text in terminal
vsb email view e1a2b3 -t

# View raw email source
vsb email view e1a2b3 -r

# Output as JSON
vsb email view e1a2b3 -o json
```

### Output (with -t flag)

```
Subject: Welcome to MyApp
From: noreply@myapp.com
Date: 2024-01-15 14:35:00 UTC

Hello!

Welcome to MyApp. Click the link below to verify your email:
https://myapp.com/verify?token=abc123

Thanks,
The MyApp Team
```

---

## vsb email audit

Perform a deep security analysis of an email.

```bash
vsb email audit [email-id] [flags]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `email-id` | Email ID (optional, uses most recent if omitted) |

### Flags

| Flag | Description |
|------|-------------|
| `--inbox` | Specify inbox |
| `-o json` | Output in JSON format |

### Examples

```bash
# Audit most recent email
vsb email audit

# Audit specific email
vsb email audit e1a2b3

# Output as JSON
vsb email audit e1a2b3 -o json
```

### Output

```
 EMAIL AUDIT REPORT

BASIC INFO
Subject: Welcome to MyApp
From: noreply@myapp.com
To: test@abc123.vsx.email
Received: 2024-01-15 14:35:00 UTC

AUTHENTICATION
SPF:   PASS (domain: myapp.com)
DKIM:  PASS (selector: default, domain: myapp.com)
DMARC: PASS (policy: reject)

TRANSPORT SECURITY
TLS Version: TLS 1.3
Cipher Suite: TLS_AES_256_GCM_SHA384

MIME STRUCTURE
message/rfc822
├── headers
│   ├── From
│   ├── To
│   ├── Subject
│   ├── Date
│   └── Message-ID
├── body
│   ├── text/plain
│   └── text/html

Security Score: 100/100
```

---

## vsb email url

Extract and list URLs from an email.

```bash
vsb email url [email-id] [flags]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `email-id` | Email ID (optional, uses most recent if omitted) |

### Flags

| Flag | Description |
|------|-------------|
| `-O, --open N` | Open the Nth URL in browser (1=first) |
| `--inbox` | Specify inbox |
| `-o json` | Output in JSON format |

### Examples

```bash
# List URLs in most recent email
vsb email url

# List URLs in specific email
vsb email url e1a2b3

# Open the first URL in browser
vsb email url e1a2b3 -O 1
vsb email url e1a2b3 --open 1

# Output as JSON
vsb email url -o json
```

### Output

```
1. https://myapp.com/verify?token=abc123
2. https://myapp.com/unsubscribe
3. https://myapp.com/privacy
```

---

## vsb email attachment

List and download email attachments.

```bash
vsb email attachment [email-id] [flags]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `email-id` | Email ID (optional, uses most recent if omitted) |

### Flags

| Flag | Description |
|------|-------------|
| `-s, --save N` | Download the Nth attachment (1=first) |
| `-a, --all` | Download all attachments |
| `-d, --dir` | Directory to save attachments (default: current directory) |
| `--inbox` | Specify inbox |
| `-o json` | Output in JSON format |

### Examples

```bash
# List attachments from latest email
vsb email attachment

# List attachments from specific email
vsb email attachment e1a2b3

# Download first attachment
vsb email attachment --save 1

# Download all attachments
vsb email attachment --all

# Download all attachments to specific directory
vsb email attachment --all -d ./downloads

# Output as JSON
vsb email attachment -o json
```

### Output

```
Attachments (2):

  1. invoice.pdf
     Type: application/pdf
     Size: 145 KB

  2. receipt.png
     Type: image/png
     Size: 23 KB

Use --save N to download an attachment, or --all to download all
```

---

## vsb email delete

Delete an email.

```bash
vsb email delete <email-id> [flags]
vsb email rm <email-id> [flags]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `email-id` | Email ID to delete (required) |

### Flags

| Flag | Description |
|------|-------------|
| `--inbox` | Specify inbox |

### Examples

```bash
# Delete email
vsb email delete e1a2b3
vsb email rm e1a2b3

# Delete email from specific inbox
vsb email delete e1a2b3 --inbox test@abc123.vsx.email
```

---

## vsb email wait

Wait for an email matching criteria. Designed for CI/CD pipelines and automated testing.

```bash
vsb email wait [flags]
```

Returns exit code 0 when a matching email is found, 1 on timeout.

### Flags

| Flag | Description |
|------|-------------|
| `--subject` | Exact subject match |
| `--subject-regex` | Subject regex pattern |
| `--from` | Exact sender match |
| `--from-regex` | Sender regex pattern |
| `--timeout` | Maximum time to wait (default: 60s) |
| `--count` | Number of matching emails to wait for (default: 1) |
| `-q, --quiet` | No output, exit code only |
| `--extract-link` | Output first link from email |
| `--inbox` | Specify inbox |
| `-o json` | Output in JSON format |

### Examples

```bash
# Wait for any email
vsb email wait

# Wait for password reset email
vsb email wait --subject-regex "password reset" --timeout 30s

# Wait for email from specific sender
vsb email wait --from "noreply@example.com"

# Extract verification link for CI/CD
LINK=$(vsb email wait --subject "Verify" --extract-link)

# Wait for multiple emails
vsb email wait --count 3 --timeout 120s

# Quiet mode for scripts (exit code only)
vsb email wait --subject "Welcome" --quiet

# JSON output for parsing
vsb email wait --from "noreply@example.com" -o json | jq .subject
```

### Output

```
Waiting for email on test@abc123.vsx.email (timeout: 60s)...
Subject: Welcome to MyApp
From: noreply@myapp.com
Received: 2024-01-15T14:35:00Z
Links: 3 found
```

---

## Next Steps

- [Inbox Commands](/cli/commands/inbox/) - Manage inboxes
- [TUI Dashboard](/cli/tui/) - Interactive email monitoring
