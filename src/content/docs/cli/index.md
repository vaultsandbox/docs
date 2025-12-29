---
title: CLI
description: Command-line interface for VaultSandbox with real-time TUI dashboard
---

The official command-line interface for VaultSandbox. Monitor incoming emails in real-time with an interactive terminal dashboard, manage inboxes, and integrate email testing into CI/CD pipelines.

![TUI](/images/cli/demo-tui.gif)

## Key Capabilities

- **Real-Time TUI Dashboard**: Interactive terminal interface for monitoring emails across multiple inboxes
- **Multi-Inbox Watching**: Monitor all your inboxes simultaneously via SSE streaming
- **Email Authentication**: View SPF, DKIM, and DMARC verification results
- **Link & Attachment Inspection**: Extract URLs and preview attachments directly from the terminal
- **CI/CD Ready**: Script email verification with the `wait` command for automated testing
- **Portable Inboxes**: Export and import inboxes with encryption keys for sharing or backup
- **Local Decryption**: Private keys never leave your machine - emails are decrypted locally

## Requirements

- VaultSandbox Gateway server
- Valid API key

## Gateway Server

The CLI connects to a VaultSandbox Gateway - a receive-only SMTP server you self-host. It handles email reception, authentication validation, and encryption. You can run one with Docker in minutes.

See [Gateway Overview](/gateway/) or jump to [Quick Start](/getting-started/quickstart/) to deploy one.

## Quick Example

```bash
# Configure credentials
vsb config set api-key "your-api-key"
vsb config set base-url "https://your-gateway.vsx.email"

# Create an inbox
vsb inbox create

# Launch the TUI dashboard
vsb
```

## Links

- [GitHub Repository](https://github.com/vaultsandbox/vsb-cli)

## Next Steps

- [Installation](/cli/installation/) - Install the CLI
- [Configuration](/cli/configuration/) - Configure credentials and options
- [TUI Dashboard](/cli/tui/) - Learn the interactive dashboard
- [Commands Reference](/cli/commands/inbox/) - Full command documentation
