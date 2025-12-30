---
title: Installation
description: Install the VaultSandbox CLI on Linux, macOS, or Windows
---

Install vsb-cli using pre-built binaries, Go install, or by building from source.

## Binary Download

Download the latest release for your platform from the [releases page](https://github.com/vaultsandbox/vsb-cli/releases).

### Linux

```bash
# amd64
tar -xzf vsb_*_linux_amd64.tar.gz
sudo mv vsb /usr/local/bin/

# arm64
tar -xzf vsb_*_linux_arm64.tar.gz
sudo mv vsb /usr/local/bin/
```

### macOS

```bash
# Apple Silicon
tar -xzf vsb_*_darwin_arm64.tar.gz
sudo mv vsb /usr/local/bin/

# Intel
tar -xzf vsb_*_darwin_amd64.tar.gz
sudo mv vsb /usr/local/bin/
```

### Windows

Extract `vsb_*_windows_amd64.zip` and add to your PATH.

## Go Install

If you have Go 1.24+ installed:

```bash
go install github.com/vaultsandbox/vsb-cli/cmd/vsb@latest
```

## Build from Source

Clone and build the repository:

```bash
git clone https://github.com/vaultsandbox/vsb-cli.git
cd vsb-cli
go build -o vsb ./cmd/vsb
sudo mv vsb /usr/local/bin/
```

## Verify Installation

Confirm the CLI is installed correctly:

```bash
vsb --version
```

## Next Steps

- [Configuration](/cli/configuration/) - Set up your API key and gateway URL
- [TUI Dashboard](/cli/tui/) - Start monitoring emails
