---
title: Client Installation
description: Install and set up the VaultSandbox Python client SDK
---

The `vaultsandbox` SDK provides a developer-friendly interface for integrating email testing into your Python applications and test suites.

## Requirements

- **Python**: 3.10 or higher (tested on 3.10, 3.11, 3.12)
- **VaultSandbox Gateway**: Running instance with API access

## Installation

### pip

```bash
pip install vaultsandbox
```

### poetry

```bash
poetry add vaultsandbox
```

### uv

```bash
uv add vaultsandbox
```

## Quick Start

### Basic Usage

```python
import asyncio
from vaultsandbox import VaultSandboxClient

async def main():
    async with VaultSandboxClient(
        base_url="https://mail.example.com",
        api_key="your-api-key",
    ) as client:
        inbox = await client.create_inbox()
        print(f"Send email to: {inbox.email_address}")

        email = await inbox.wait_for_email()
        print(f"Received: {email.subject}")

        await inbox.delete()

asyncio.run(main())
```

## Verifying Installation

Create a test file `test_vaultsandbox.py`:

```python
import asyncio
import os
from vaultsandbox import VaultSandboxClient

async def test():
    async with VaultSandboxClient(
        base_url=os.environ["VAULTSANDBOX_URL"],
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        try:
            server_info = await client.get_server_info()
            print("Connected to VaultSandbox")
            print(f"Allowed domains: {server_info.allowed_domains}")

            inbox = await client.create_inbox()
            print(f"Created inbox: {inbox.email_address}")

            await inbox.delete()
            print("Cleanup successful")

            print("\nInstallation verified!")
        except Exception as e:
            print(f"Error: {e}")
            raise SystemExit(1)

asyncio.run(test())
```

Run it:

```bash
export VAULTSANDBOX_URL=https://mail.example.com
export VAULTSANDBOX_API_KEY=your-api-key
python test_vaultsandbox.py
```

## Type Hints Support

The SDK includes full type annotations and ships with a `py.typed` marker, providing IDE support out of the box.

### IDE Integration

Most modern IDEs (VS Code with Pylance, PyCharm, etc.) will automatically pick up the type hints:

```python
from vaultsandbox import VaultSandboxClient, Email, Inbox

async def example():
    async with VaultSandboxClient(
        base_url="https://mail.example.com",
        api_key="your-api-key",
    ) as client:
        inbox: Inbox = await client.create_inbox()
        email: Email = await inbox.wait_for_email()

        print(email.subject)  # IDE knows this is a string
```

### Type Checking with mypy

For static type checking, add `vaultsandbox` to your `mypy.ini` or `pyproject.toml`:

```toml
[tool.mypy]
plugins = []
strict = true
```

## Virtual Environment Best Practices

Always use a virtual environment for your projects:

### Using venv

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# or
.venv\Scripts\activate     # Windows

pip install vaultsandbox
```

### Using poetry

```bash
poetry new my-project
cd my-project
poetry add vaultsandbox
poetry shell
```

### Using uv

```bash
uv init my-project
cd my-project
uv add vaultsandbox
```

## Dependencies

The SDK installs these dependencies automatically:

- `httpx` - Async HTTP client
- `httpx-sse` - Server-Sent Events support
- `pqcrypto` - Post-quantum cryptography (ML-KEM-768, ML-DSA-65)
- `cryptography` - AES-256-GCM and HKDF

## Next Steps

- **[Configuration](/client-python/configuration/)** - Configure the client for your environment
- **[Core Concepts](/client-python/concepts/inboxes/)** - Understand inboxes, emails, and authentication
- **[Guides](/client-python/guides/managing-inboxes/)** - Learn common usage patterns
- **[Testing Patterns](/client-python/testing/password-reset/)** - Integrate with your test suite
