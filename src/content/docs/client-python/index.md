---
title: Python Client
description: Overview of the VaultSandbox Python SDK for email testing
---

The official Python SDK for VaultSandbox Gateway. It handles quantum-safe encryption automatically, letting you focus on testing email workflows.

## Key Capabilities

- **Automatic Encryption**: ML-KEM-768 key encapsulation + AES-256-GCM encryption handled transparently
- **Real-Time Delivery**: SSE-based email delivery with smart polling fallback
- **Email Authentication**: Built-in SPF/DKIM/DMARC validation helpers
- **Full Email Access**: Decrypted content, headers, links, and attachments
- **Type Hints**: Full type annotations with `py.typed` marker for IDE support

## Requirements

- Python 3.10+
- VaultSandbox Gateway server
- Valid API key

## Gateway Server

The SDK connects to a VaultSandbox Gateway - a receive-only SMTP server you self-host. It handles email reception, authentication validation, and encryption. You can run one with Docker in minutes.

See [Gateway Overview](/gateway/) or jump to [Quick Start](/getting-started/quickstart/) to deploy one.

## Quick Example

```python
import asyncio
from vaultsandbox import VaultSandboxClient

async def main():
    async with VaultSandboxClient(
        base_url="https://gateway.example.com",
        api_key="your-api-key",
    ) as client:
        # Create inbox (keypair generated automatically)
        inbox = await client.create_inbox()

        # Send email to inbox.email_address from your application...

        # Wait for email
        email = await inbox.wait_for_email()

        print(f"Subject: {email.subject}")
        print(f"Text: {email.text}")

        # Cleanup
        await inbox.delete()

asyncio.run(main())
```

## Links

- [GitHub Repository](https://github.com/vaultsandbox/client-python)
- [PyPI Package](https://pypi.org/project/vaultsandbox/)

## Next Steps

- [Installation](/client-python/installation/) - Install the SDK
- [Configuration](/client-python/configuration/) - Client options and setup
- [Core Concepts](/client-python/concepts/inboxes/) - Inboxes, emails, and authentication
- [API Reference](/client-python/api/client/) - Full API documentation
