---
title: Configuration
description: Configure the VaultSandbox CLI with API keys, server URLs, and options
---

The CLI uses a layered configuration system with multiple sources. Higher priority sources override lower ones.

## Configuration Priority

1. **Environment variables** (highest) - `VSB_API_KEY`, `VSB_BASE_URL`
2. **Config file** (lowest) - `~/.config/vsb/config.yaml`

## Interactive Setup

Run the configuration wizard to set up credentials interactively:

```bash
vsb config
```

This prompts for your API key and gateway URL, then saves them to the config file.

## Manual Configuration

### Set Individual Values

```bash
# Set API key
vsb config set api-key "your-api-key"

# Set gateway URL
vsb config set base-url "https://your-gateway.vsx.email"
```

### View Current Configuration

```bash
vsb config show
```

The API key is masked in the output for security.

## Config File

The config file is stored at `~/.config/vsb/config.yaml`:

```yaml
api_key: your-api-key
base_url: https://your-gateway.vsx.email
default_output: pretty
```

### Config File Options

| Key | Description | Default |
|-----|-------------|---------|
| `api_key` | Your VaultSandbox API key | - |
| `base_url` | Gateway server URL | - |
| `default_output` | Output format (`pretty` or `json`) | `pretty` |

Note: `default_output` can only be set by editing the config file directly. The `vsb config set` command only supports `api-key` and `base-url`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VSB_API_KEY` | Your VaultSandbox API key |
| `VSB_BASE_URL` | Gateway URL |
| `VSB_CONFIG_DIR` | Override config directory |
| `VSB_OUTPUT` | Default output format |

Example:

```bash
export VSB_API_KEY="your-api-key"
export VSB_BASE_URL="https://your-gateway.vsx.email"
vsb inbox create
```

## Global Flags

These flags work with any command:

| Flag | Description |
|------|-------------|
| `--config` | Specify config file path |
| `-o, --output` | Output format: `pretty` or `json` |

Example:

```bash
vsb inbox list --output json
```

## Data Storage

The CLI stores data in `~/.config/vsb/`:

| File | Description |
|------|-------------|
| `config.yaml` | Configuration settings |
| `keystore.json` | Inbox private keys (base64-encoded) |

:::caution
The `keystore.json` file contains private keys for decrypting emails. Treat it as sensitive data - do not share or commit it to version control.
:::

## Next Steps

- [TUI Dashboard](/cli/tui/) - Launch the interactive dashboard
- [Inbox Commands](/cli/commands/inbox/) - Create and manage inboxes
