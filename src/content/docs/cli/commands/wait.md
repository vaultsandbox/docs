---
title: Wait Command
description: Block until a matching email arrives - perfect for CI/CD pipelines
---

The `wait` command blocks until an email matching your criteria arrives. It's designed for CI/CD pipelines and automated testing scenarios where you need to verify email delivery.

## vsb email wait

Wait for an email matching specified criteria.

```bash
vsb email wait [flags]
```

### Flags

| Flag              | Description                                   | Default  |
| ----------------- | --------------------------------------------- | -------- |
| `--inbox`         | Inbox to watch (uses active inbox if omitted) | -        |
| `--timeout`       | Maximum time to wait                          | `60s`    |
| `--subject`       | Match exact subject                           | -        |
| `--subject-regex` | Match subject with regex                      | -        |
| `--from`          | Match exact sender                            | -        |
| `--from-regex`    | Match sender with regex                       | -        |
| `--count`         | Number of emails to wait for                  | `1`      |
| `-q, --quiet`     | Suppress output, only set exit code           | -        |
| `--extract-link`  | Output matching link from email               | -        |
| `-o, --output`    | Output format: `pretty` or `json`             | `pretty` |

### Exit Codes

| Code | Meaning                                   |
| ---- | ----------------------------------------- |
| `0`  | Email(s) found successfully               |
| `1`  | Timeout or error (connection, auth, etc.) |

## Examples

### Basic Usage

```bash
# Wait for any email (60s timeout)
vsb email wait

# Wait with longer timeout
vsb email wait --timeout 120s

# Wait for specific subject
vsb email wait --subject "Password Reset"

# Wait for subject matching pattern
vsb email wait --subject-regex "Reset|Verify"
```

### Filtering by Sender

```bash
# Exact sender match
vsb email wait --from "noreply@myapp.com"

# Sender pattern match
vsb email wait --from-regex "@myapp\\.com$"
```

### Multiple Conditions

```bash
# Combine subject and sender filters
vsb email wait --subject-regex "Password" --from "noreply@myapp.com"

# Wait for multiple emails
vsb email wait --count 2 --subject "Order Confirmation"
```

### JSON Output

```bash
# Get email details as JSON
vsb email wait --subject "Verify" -o json
```

Output:

```json
{
	"id": "e1a2b3",
	"subject": "Verify your email",
	"from": "noreply@myapp.com",
	"to": ["user@example.com"],
	"text": "Click here to verify...",
	"html": "<html>...",
	"links": ["https://myapp.com/verify?token=abc123"],
	"headers": {
		"Content-Type": "text/html; charset=utf-8",
		"X-Mailer": "MyApp/1.0"
	},
	"receivedAt": "2024-01-15T14:35:00Z"
}
```

### Extract Links

```bash
# Extract first link from matching email
LINK=$(vsb email wait --subject-regex "Reset" --extract-link)
echo "Reset link: $LINK"
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Email Tests
on: [push]

jobs:
  test-password-reset:
    runs-on: ubuntu-latest
    steps:
      - name: Install vsb-cli
        run: |
          curl -LO https://github.com/vaultsandbox/vsb-cli/releases/latest/download/vsb_linux_amd64.tar.gz
          tar -xzf vsb_linux_amd64.tar.gz
          sudo mv vsb /usr/local/bin/

      - name: Configure CLI
        run: |
          vsb config set api_key "${{ secrets.VSB_API_KEY }}"
          vsb config set url "${{ secrets.VSB_URL }}"

      - name: Test password reset flow
        run: |
          # Create inbox and capture email address
          EMAIL=$(vsb inbox create --json | jq -r '.email')

          # Trigger password reset in your app
          curl -X POST https://myapp.com/api/reset-password \
            -H "Content-Type: application/json" \
            -d "{\"email\": \"$EMAIL\"}"

          # Wait for reset email and extract link
          RESET_LINK=$(vsb email wait \
            --subject-regex "Reset" \
            --timeout 30s \
            -o json | jq -r '.links[0]')

          # Verify the link works
          curl -I "$RESET_LINK" | grep "200 OK"
```

### GitLab CI

```yaml
test-email-verification:
  image: golang:1.24
  script:
    - go install github.com/vaultsandbox/vsb-cli/cmd/vsb@latest
    - vsb config set api_key "$VSB_API_KEY"
    - vsb config set url "$VSB_URL"
    - |
      EMAIL=$(vsb inbox create --json | jq -r '.email')
      # Trigger your application to send verification email
      ./run-signup-flow.sh "$EMAIL"
      # Wait and verify
      vsb email wait --subject "Verify" --timeout 60s
      echo "Verification email received!"
```

### Shell Script

```bash
#!/bin/bash
set -e

# Create test inbox
INBOX=$(vsb inbox create --json)
EMAIL=$(echo "$INBOX" | jq -r '.email')

echo "Testing with inbox: $EMAIL"

# Trigger your application
curl -X POST "https://myapp.com/api/invite" \
  -d "email=$EMAIL"

# Wait for invitation email
if vsb email wait --subject "Invitation" --timeout 30s --quiet; then
  echo "✓ Invitation email received"
else
  echo "✗ Invitation email not received"
  exit 1
fi

# Get the invitation link
INVITE_LINK=$(vsb email url --json | jq -r '.[0]')
echo "Invitation link: $INVITE_LINK"

# Cleanup
vsb inbox delete "$EMAIL" --force
```

## Tips

- Use `--quiet` in scripts when you only care about the exit code
- Use `--json` output with `jq` to extract specific fields
- Set reasonable timeouts based on your email delivery expectations
- Use regex patterns for flexible matching when subject lines vary
- Combine `wait` with `email url --open` to manually verify links

## Next Steps

- [Export/Import](/cli/commands/data/) - Save and restore inboxes
- [Email Commands](/cli/commands/email/) - Inspect emails after they arrive
- [Inbox Commands](/cli/commands/inbox/) - Manage test inboxes
