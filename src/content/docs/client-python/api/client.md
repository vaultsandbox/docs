---
title: VaultSandboxClient API
description: Complete API reference for the VaultSandboxClient class
---

The `VaultSandboxClient` is the main entry point for interacting with the VaultSandbox Gateway. It handles authentication, inbox creation, and provides utility methods for managing inboxes.

## Constructor

```python
VaultSandboxClient(
    api_key: str,
    *,
    base_url: str = "https://smtp.vaultsandbox.com",
    timeout: int = 30000,
    max_retries: int = 3,
    retry_delay: int = 1000,
    retry_on_status_codes: tuple[int, ...] | None = None,
    strategy: DeliveryStrategyType = DeliveryStrategyType.SSE,
    polling_interval: int = 2000,
    polling_max_backoff: int = 30000,
    sse_reconnect_interval: int = 5000,
    sse_max_reconnect_attempts: int = 10,
)
```

Creates a new VaultSandbox client instance.

### Parameters

| Parameter                    | Type                   | Required | Default                          | Description                                |
| ---------------------------- | ---------------------- | -------- | -------------------------------- | ------------------------------------------ |
| `api_key`                    | `str`                  | Yes      | -                                | Your API authentication key                |
| `base_url`                   | `str`                  | No       | `https://smtp.vaultsandbox.com`  | Gateway URL                                |
| `timeout`                    | `int`                  | No       | `30000`                          | HTTP request timeout in milliseconds       |
| `max_retries`                | `int`                  | No       | `3`                              | Maximum retry attempts for HTTP requests   |
| `retry_delay`                | `int`                  | No       | `1000`                           | Base delay in milliseconds between retries |
| `retry_on_status_codes`      | `tuple[int, ...]`      | No       | `(408, 429, 500, 502, 503, 504)` | HTTP status codes that trigger a retry     |
| `strategy`                   | `DeliveryStrategyType` | No       | `SSE`                            | Email delivery strategy                    |
| `polling_interval`           | `int`                  | No       | `2000`                           | Polling interval in milliseconds           |
| `polling_max_backoff`        | `int`                  | No       | `30000`                          | Maximum backoff delay in milliseconds      |
| `sse_reconnect_interval`     | `int`                  | No       | `5000`                           | Initial delay before SSE reconnection (ms) |
| `sse_max_reconnect_attempts` | `int`                  | No       | `10`                             | Maximum SSE reconnection attempts          |

### Example

```python
import os
from vaultsandbox import VaultSandboxClient

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url="https://smtp.vaultsandbox.com",
    max_retries=5,
    retry_delay=2000,
) as client:
    inbox = await client.create_inbox()
```

## Context Manager

The recommended way to use the client is with Python's `async with` context manager, which ensures proper cleanup of resources:

```python
async with VaultSandboxClient(api_key="your-api-key") as client:
    inbox = await client.create_inbox()
    email = await inbox.wait_for_email()
    print(f"Received: {email.subject}")
```

## Methods

### create_inbox()

Creates a new email inbox with automatic key generation and encryption setup.

```python
async def create_inbox(
    self,
    options: CreateInboxOptions | None = None,
) -> Inbox
```

#### Parameters

- `options` (optional): Configuration for the inbox

```python
@dataclass
class CreateInboxOptions:
    ttl: int | None = None
    email_address: str | None = None
    email_auth: bool | None = None
    encryption: str | None = None
```

| Property        | Type          | Description                                                                                |
| --------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `ttl`           | `int \| None` | Time-to-live for the inbox in seconds (min: 60, max: 604800, default: server's defaultTtl) |
| `email_address` | `str \| None` | Request a specific email address (max 254 chars, e.g., `test@inbox.vaultsandbox.com`)      |
| `email_auth`    | `bool \| None` | Enable/disable SPF/DKIM/DMARC/PTR checks (default: server setting)                        |
| `encryption`    | `str \| None` | Request encryption mode: `"encrypted"` or `"plain"` (default: server policy)              |

##### Email Authentication (`email_auth`)

- `True` - Enable SPF/DKIM/DMARC/PTR checks for incoming emails
- `False` - Skip all authentication checks (results will show `skipped` status)
- Omit - Use server default

##### Encryption Mode (`encryption`)

- `"encrypted"` - Request an encrypted inbox (emails encrypted with ML-KEM-768)
- `"plain"` - Request a plain inbox (emails stored as Base64-encoded JSON)
- Omit - Use server default based on `encryption_policy`

**Note**: The server may reject the encryption request based on its `encryption_policy`. Use `get_server_info()` to check the policy before creating inboxes.

#### Returns

`Inbox` - The created inbox instance

#### Example

```python
from vaultsandbox import CreateInboxOptions

# Create inbox with default settings
inbox = await client.create_inbox()
print(inbox.email_address)

# Create inbox with custom TTL (1 hour)
inbox = await client.create_inbox(CreateInboxOptions(ttl=3600))

# Request specific email address
inbox = await client.create_inbox(
    CreateInboxOptions(email_address="mytest@inbox.vaultsandbox.com")
)

# Create inbox with email authentication disabled
inbox = await client.create_inbox(CreateInboxOptions(email_auth=False))

# Create a plain (unencrypted) inbox (when server policy allows)
inbox = await client.create_inbox(CreateInboxOptions(encryption="plain"))

# Create with multiple options
inbox = await client.create_inbox(
    CreateInboxOptions(
        ttl=3600,
        email_auth=False,
        encryption="plain",
    )
)
```

#### Errors

- `ApiError` - API-level error (invalid request, permission denied, or status 409 if email address/KEM key already exists)
- `NetworkError` - Network connection failure

---

### delete_all_inboxes()

Deletes all inboxes associated with the current API key. Useful for cleanup in test environments.

```python
async def delete_all_inboxes(self) -> int
```

#### Returns

`int` - Number of inboxes deleted

#### Example

```python
deleted = await client.delete_all_inboxes()
print(f"Deleted {deleted} inboxes")
```

#### Best Practice

Use this in test cleanup to avoid orphaned inboxes:

```python
@pytest.fixture
async def client():
    async with VaultSandboxClient(api_key=api_key) as client:
        yield client
        # Clean up all inboxes after tests
        deleted = await client.delete_all_inboxes()
        if deleted > 0:
            print(f"Cleaned up {deleted} orphaned inboxes")
```

---

### get_server_info()

Retrieves information about the VaultSandbox Gateway server.

```python
async def get_server_info(self) -> ServerInfo
```

#### Returns

`ServerInfo` - Server information object

```python
@dataclass
class ServerInfo:
    server_sig_pk: str
    algs: dict[str, str]
    context: str
    max_ttl: int
    default_ttl: int
    sse_console: bool
    allowed_domains: list[str]
    encryption_policy: str
```

| Property            | Type             | Description                                               |
| ------------------- | ---------------- | --------------------------------------------------------- |
| `server_sig_pk`     | `str`            | Base64URL-encoded server signing public key for ML-DSA-65 |
| `algs`              | `dict[str, str]` | Cryptographic algorithms supported by the server          |
| `context`           | `str`            | Context string for the encryption scheme                  |
| `max_ttl`           | `int`            | Maximum time-to-live for inboxes in seconds               |
| `default_ttl`       | `int`            | Default time-to-live for inboxes in seconds               |
| `sse_console`       | `bool`           | Whether the server SSE console is enabled                 |
| `allowed_domains`   | `list[str]`      | List of domains allowed for inbox creation                |
| `encryption_policy` | `str`            | Server encryption policy (see below)                      |

#### Encryption Policy

The `encryption_policy` field indicates the server's encryption settings:

| Policy     | Default Encryption | Per-Inbox Override                  |
| ---------- | ------------------ | ----------------------------------- |
| `always`   | Encrypted          | No - all inboxes encrypted          |
| `enabled`  | Encrypted          | Yes - can request `plain`           |
| `disabled` | Plain              | Yes - can request `encrypted`       |
| `never`    | Plain              | No - all inboxes plain              |

#### Example

```python
info = await client.get_server_info()
print(f"Encryption: {info.algs['kem']}")
print(f"Max TTL: {info.max_ttl}s, Default TTL: {info.default_ttl}s")
print(f"Allowed domains: {', '.join(info.allowed_domains)}")

# Check encryption policy
print(f"Encryption policy: {info.encryption_policy}")
can_override = info.encryption_policy in ["enabled", "disabled"]
default_encrypted = info.encryption_policy in ["always", "enabled"]
print(f"Can override: {can_override}, Default encrypted: {default_encrypted}")
```

---

### check_key()

Validates the API key with the server.

```python
async def check_key(self) -> bool
```

#### Returns

`bool` - `True` if the API key is valid

#### Example

```python
is_valid = await client.check_key()
if not is_valid:
    raise ValueError("Invalid API key")
```

#### Usage

Useful for verifying configuration before running tests:

```python
import pytest
import os
from vaultsandbox import VaultSandboxClient

@pytest.fixture(scope="session")
async def validated_client():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"]
    ) as client:
        is_valid = await client.check_key()
        if not is_valid:
            pytest.fail("VaultSandbox API key is invalid")
        yield client
```

---

### monitor_inboxes()

Monitors multiple inboxes simultaneously and provides callbacks when new emails arrive.

```python
def monitor_inboxes(self, inboxes: list[Inbox]) -> InboxMonitor
```

#### Parameters

- `inboxes`: List of inbox instances to monitor

#### Returns

`InboxMonitor` - Monitor instance for inbox monitoring

#### Example

```python
inbox1 = await client.create_inbox()
inbox2 = await client.create_inbox()

monitor = client.monitor_inboxes([inbox1, inbox2])

@monitor.on_email
async def handle_email(inbox: Inbox, email: Email):
    print(f"New email in {inbox.email_address}: {email.subject}")

await monitor.start()

# Later, stop monitoring
await monitor.unsubscribe()
```

See [InboxMonitor API](#inboxmonitor) for more details.

---

### export_inbox()

Exports an inbox's data and encryption keys for backup or sharing. The exported data includes sensitive key material and should be treated as confidential.

```python
def export_inbox(self, inbox_or_email: Inbox | str) -> ExportedInbox
```

#### Parameters

- `inbox_or_email`: Inbox instance or email address string to export

#### Returns

`ExportedInbox` - Serializable inbox data including keys

```python
@dataclass
class ExportedInbox:
    version: int            # Export format version (always 1)
    email_address: str
    expires_at: str
    inbox_hash: str
    server_sig_pk: str      # Base64url-encoded
    secret_key: str         # Base64url-encoded (SENSITIVE!)
    exported_at: str
```

Note: The public key is derived from the secret key during import.

#### Example

```python
import json

inbox = await client.create_inbox()
exported_data = client.export_inbox(inbox)

# Save for later use (treat as sensitive!)
print(json.dumps(vars(exported_data), indent=2))
```

#### Security Warning

Exported data contains private encryption keys. Store securely and never commit to version control.

---

### import_inbox()

Imports a previously exported inbox, restoring all data and encryption keys.

```python
async def import_inbox(self, data: ExportedInbox) -> Inbox
```

#### Parameters

- `data`: Previously exported inbox data

#### Returns

`Inbox` - The imported inbox instance

#### Example

```python
import json
from vaultsandbox import ExportedInbox

# Load exported data
with open("inbox-backup.json") as f:
    data = json.load(f)

exported = ExportedInbox(
    version=data["version"],
    email_address=data["emailAddress"],
    expires_at=data["expiresAt"],
    inbox_hash=data["inboxHash"],
    server_sig_pk=data["serverSigPk"],
    secret_key=data["secretKey"],
    exported_at=data.get("exportedAt", ""),
)

inbox = await client.import_inbox(exported)
print(f"Imported inbox: {inbox.email_address}")

# Use inbox normally
emails = await inbox.list_emails()
```

#### Errors

- `UnsupportedVersionError` - Export version is not supported
- `InboxAlreadyExistsError` - Inbox is already imported in this client
- `InvalidImportDataError` - Import data is invalid or corrupted
- `ApiError` - Server rejected the import (inbox may not exist)

---

### export_inbox_to_file()

Exports an inbox to a JSON file on disk.

```python
async def export_inbox_to_file(
    self,
    inbox_or_email: Inbox | str,
    file_path: str | Path,
) -> None
```

#### Parameters

- `inbox_or_email`: Inbox instance or email address string to export
- `file_path`: Path where the JSON file will be written

#### Example

```python
inbox = await client.create_inbox()

# Export to file
await client.export_inbox_to_file(inbox, "./backup/inbox.json")

print("Inbox exported to ./backup/inbox.json")
```

---

### import_inbox_from_file()

Imports an inbox from a JSON file.

```python
async def import_inbox_from_file(self, file_path: str | Path) -> Inbox
```

#### Parameters

- `file_path`: Path to the exported inbox JSON file

#### Returns

`Inbox` - The imported inbox instance

#### Example

```python
# Import from file
inbox = await client.import_inbox_from_file("./backup/inbox.json")

print(f"Imported inbox: {inbox.email_address}")

# Monitor for new emails
subscription = await inbox.on_new_email(
    lambda email: print(f"New email: {email.subject}")
)
```

#### Use Cases

- Test reproducibility across runs
- Sharing inboxes between environments
- Manual testing workflows
- Debugging production issues

---

### close()

Closes the client, terminates any active SSE or polling connections, and cleans up resources.

```python
async def close(self) -> None
```

#### Example

```python
client = VaultSandboxClient(api_key=api_key)

try:
    inbox = await client.create_inbox()
    # Use inbox...
finally:
    await client.close()
```

#### Best Practice

Always close the client when done, especially in long-running processes. The recommended approach is to use the context manager:

```python
async with VaultSandboxClient(api_key=api_key) as client:
    inbox = await client.create_inbox()
    # Use inbox...
# Client automatically closed
```

Or with pytest fixtures:

```python
import pytest
from vaultsandbox import VaultSandboxClient

@pytest.fixture
async def client():
    async with VaultSandboxClient(api_key=api_key) as client:
        yield client
```

## InboxMonitor

The `InboxMonitor` class allows you to monitor multiple inboxes simultaneously.

### Creating a Monitor

```python
inbox1 = await client.create_inbox()
inbox2 = await client.create_inbox()

monitor = client.monitor_inboxes([inbox1, inbox2])
```

### Methods

#### on_email()

Register a callback for new emails. Can be used as a decorator.

```python
def on_email(self, callback: Callable[[Inbox, Email], Any]) -> InboxMonitor
```

##### Parameters

- `callback`: Function to call when new emails arrive. Receives `(inbox, email)` as arguments.

##### Returns

`InboxMonitor` - Self for method chaining

##### Example

```python
# Using as a decorator
@monitor.on_email
async def handle_email(inbox: Inbox, email: Email):
    print(f"Email received in {inbox.email_address}")
    print(f"Subject: {email.subject}")

# Or using method chaining
monitor.on_email(handle_email).on_email(another_handler)
```

#### start()

Start monitoring inboxes.

```python
async def start(self) -> InboxMonitor
```

##### Returns

`InboxMonitor` - Self for method chaining

##### Example

```python
await monitor.start()
```

#### unsubscribe()

Stops monitoring all inboxes and cleans up resources.

```python
async def unsubscribe(self) -> None
```

##### Example

```python
monitor = client.monitor_inboxes([inbox1, inbox2])

# Use monitor...

# Stop monitoring
await monitor.unsubscribe()
```

### Complete Example

```python
import asyncio
from vaultsandbox import VaultSandboxClient, Inbox, Email

async def monitor_multiple_inboxes():
    async with VaultSandboxClient(api_key=api_key) as client:
        # Create multiple inboxes
        inbox1 = await client.create_inbox()
        inbox2 = await client.create_inbox()

        print(f"Inbox 1: {inbox1.email_address}")
        print(f"Inbox 2: {inbox2.email_address}")

        # Monitor both inboxes
        monitor = client.monitor_inboxes([inbox1, inbox2])

        @monitor.on_email
        async def handle_email(inbox: Inbox, email: Email):
            print(f"\nNew email in {inbox.email_address}:")
            print(f"  Subject: {email.subject}")
            print(f"  From: {email.from_address}")

        await monitor.start()

        # Wait for emails to arrive...
        await asyncio.sleep(60)

        # Clean up
        await monitor.unsubscribe()
        await inbox1.delete()
        await inbox2.delete()

asyncio.run(monitor_multiple_inboxes())
```

## Complete Example

Here's a complete example showing typical client usage:

```python
import asyncio
import os
from vaultsandbox import VaultSandboxClient, WaitForEmailOptions
import re

async def main():
    # Create client
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        max_retries=5,
    ) as client:
        # Verify API key
        is_valid = await client.check_key()
        if not is_valid:
            raise ValueError("Invalid API key")

        # Get server info
        info = await client.get_server_info()
        print(f"Connected to VaultSandbox (default TTL: {info.default_ttl}s)")

        # Create inbox
        inbox = await client.create_inbox()
        print(f"Created inbox: {inbox.email_address}")

        # Export for later use
        await client.export_inbox_to_file(inbox, "./inbox-backup.json")

        # Wait for email
        email = await inbox.wait_for_email(
            WaitForEmailOptions(
                timeout=30000,
                subject=re.compile(r"Test"),
            )
        )

        print(f"Received: {email.subject}")

        # Clean up
        await inbox.delete()

        # Delete any other orphaned inboxes
        deleted = await client.delete_all_inboxes()
        print(f"Cleaned up {deleted} total inboxes")

asyncio.run(main())
```

## Next Steps

- [Inbox API Reference](/client-python/api/inbox/) - Learn about inbox methods
- [Email API Reference](/client-python/api/email/) - Work with email objects
- [Error Handling](/client-python/api/errors/) - Handle errors gracefully
- [Import/Export Guide](/client-python/advanced/import-export/) - Advanced import/export usage
