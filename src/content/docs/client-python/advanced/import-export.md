---
title: Inbox Import/Export
description: Learn how to export and import inboxes for test reproducibility and cross-environment sharing
---

VaultSandbox allows you to export and import inboxes, including their encryption keys and metadata. This enables advanced workflows like test reproducibility, manual testing, cross-environment sharing, and debugging.

## Overview

When you export an inbox, you get a data structure containing:

- **Version** (export format version, always 1)
- Email address
- Inbox identifier
- Expiration time
- **Secret encryption key** (base64url-encoded, sensitive!)
- **Server public signing key** (base64url-encoded)
- Export timestamp

Note: The public key is derived from the secret key during import, so it is not stored in the export.

This exported data can be imported into another client instance, allowing you to access the same inbox from different environments or at different times.

## Security Warning

**Exported inbox data contains private encryption keys.** Anyone with this data can:

- Read all emails in the inbox
- Impersonate the inbox to receive new emails
- Decrypt all future emails sent to the inbox

**Never:**

- Commit exported data to version control
- Share exported data over insecure channels
- Store exported data in plaintext in production

**Always:**

- Treat exported data as sensitive credentials
- Encrypt exported files at rest
- Use secure channels for sharing
- Rotate/delete inboxes after use

## Use Cases

### 1. Test Reproducibility

Export an inbox at the end of a test run to reproduce issues later:

```python
import pytest
from pathlib import Path
from vaultsandbox import VaultSandboxClient

@pytest.fixture
async def client():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
    ) as client:
        yield client

@pytest.fixture
async def inbox(client, request):
    inbox = await client.create_inbox()
    yield inbox

    # Export on test failure
    if request.node.rep_call.failed:
        debug_dir = Path("./debug")
        debug_dir.mkdir(exist_ok=True)
        filename = debug_dir / f"inbox-{inbox.inbox_hash[:8]}.json"
        await client.export_inbox_to_file(inbox, filename)
        print(f"Inbox exported to {filename}")

    await inbox.delete()

@pytest.mark.asyncio
async def test_welcome_email(inbox, send_welcome_email):
    await send_welcome_email(inbox.email_address)

    email = await inbox.wait_for_email(
        timeout=10000,
        subject="Welcome",
    )

    assert "Welcome" in email.subject
```

### 2. Manual Testing

Export an inbox from automated tests for manual verification:

```python
import asyncio
from vaultsandbox import VaultSandboxClient

async def create_test_inbox():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
    ) as client:
        inbox = await client.create_inbox()

        # Export for manual testing
        await client.export_inbox_to_file(inbox, "./manual-test-inbox.json")

        print(f"Manual test inbox: {inbox.email_address}")
        print("Exported to: ./manual-test-inbox.json")

        # Continue with automated tests...

asyncio.run(create_test_inbox())
```

Then manually inspect:

```bash
# Use the exported inbox in a manual test script
python scripts/check-inbox.py ./manual-test-inbox.json
```

### 3. Cross-Environment Sharing

Export an inbox from one environment and import it in another:

```python
import asyncio
import json
import os
from pathlib import Path
from vaultsandbox import VaultSandboxClient

async def export_from_dev():
    # Development environment
    async with VaultSandboxClient(
        api_key=os.environ["DEV_API_KEY"],
        base_url="https://dev.vaultsandbox.com",
    ) as client:
        inbox = await client.create_inbox()
        exported = inbox.export()

        # Save to shared location
        Path("./shared/staging-inbox.json").write_text(
            json.dumps({
                "version": exported.version,
                "emailAddress": exported.email_address,
                "expiresAt": exported.expires_at,
                "inboxHash": exported.inbox_hash,
                "serverSigPk": exported.server_sig_pk,
                "secretKey": exported.secret_key,
                "exportedAt": exported.exported_at,
            }, indent=2)
        )

        print(f"Created inbox: {inbox.email_address}")
        print("Exported to: ./shared/staging-inbox.json")

async def import_to_staging():
    # Staging environment (must use same server!)
    async with VaultSandboxClient(
        api_key=os.environ["STAGING_API_KEY"],
        base_url="https://dev.vaultsandbox.com",  # Same server
    ) as client:
        inbox = await client.import_inbox_from_file("./shared/staging-inbox.json")
        print(f"Imported inbox: {inbox.email_address}")

asyncio.run(export_from_dev())
# ... later, in staging environment ...
asyncio.run(import_to_staging())
```

### 4. Debugging Production Issues

Export a problematic inbox from production for local debugging:

```python
import asyncio
import os
from vaultsandbox import VaultSandboxClient

async def debug_inbox():
    async with VaultSandboxClient(
        api_key=os.environ["LOCAL_API_KEY"],
        base_url="https://smtp.vaultsandbox.com",  # Same server as production
    ) as client:
        inbox = await client.import_inbox_from_file("./production-issue-123.json")

        # Check emails
        emails = await inbox.list_emails()
        print(f"Found {len(emails)} emails")

        for email in emails:
            print(f"\n---")
            print(f"Subject: {email.subject}")
            print(f"From: {email.from_address}")
            print(f"Received: {email.received_at.isoformat()}")
            print(f"Links: {len(email.links)}")
            print(f"Attachments: {len(email.attachments)}")

asyncio.run(debug_inbox())
```

## Export Methods

### Export to Object

```python
def export(self) -> ExportedInbox
```

Returns an `ExportedInbox` dataclass with the inbox data:

```python
inbox = await client.create_inbox()
exported = inbox.export()

print(exported.version)          # 1
print(exported.email_address)    # test123@inbox.vaultsandbox.com
print(exported.inbox_hash)       # abc123...
print(exported.expires_at)       # 2024-12-01T12:00:00.000Z
print(exported.server_sig_pk)    # base64url-encoded-server-signing-key
print(exported.secret_key)       # base64url-encoded-secret-key
print(exported.exported_at)      # 2024-11-30T08:00:00.000Z
```

To save to a file manually:

```python
import json
from pathlib import Path

data = {
    "version": exported.version,
    "emailAddress": exported.email_address,
    "expiresAt": exported.expires_at,
    "inboxHash": exported.inbox_hash,
    "serverSigPk": exported.server_sig_pk,
    "secretKey": exported.secret_key,
    "exportedAt": exported.exported_at,
}
Path("inbox.json").write_text(json.dumps(data, indent=2))
```

### Export to File

```python
async def export_inbox_to_file(
    self,
    inbox_or_email: Inbox | str,
    file_path: str | Path
) -> None
```

Directly writes the inbox data to a JSON file:

```python
inbox = await client.create_inbox()

# Export by inbox instance
await client.export_inbox_to_file(inbox, "./backups/inbox.json")

# Export by email address
await client.export_inbox_to_file(inbox.email_address, "./backups/inbox.json")
```

### Using VaultSandboxClient

Both export methods are available on the client:

```python
# From inbox instance
exported = inbox.export()

# From client (any inbox managed by this client)
exported = client.export_inbox(inbox)
exported = client.export_inbox(inbox.email_address)
```

## Import Methods

### Import from Object

```python
async def import_inbox(self, data: ExportedInbox) -> Inbox
```

Imports inbox data from an `ExportedInbox` object:

```python
from vaultsandbox import ExportedInbox
import json
from pathlib import Path

# Load from file
data = json.loads(Path("./backup.json").read_text())

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
print(f"Imported: {inbox.email_address}")

# Use inbox normally
emails = await inbox.list_emails()
```

### Import from File

```python
async def import_inbox_from_file(self, file_path: str | Path) -> Inbox
```

Directly imports an inbox from a JSON file:

```python
inbox = await client.import_inbox_from_file("./backups/inbox.json")
print(f"Imported: {inbox.email_address}")

# Monitor for new emails
async def handle_email(email):
    print(f"New email: {email.subject}")

await inbox.on_new_email(handle_email)
```

## Import Validation

The SDK validates imported data and raises errors for invalid imports:

```python
from vaultsandbox import (
    InvalidImportDataError,
    InboxAlreadyExistsError,
    UnsupportedVersionError,
)

try:
    inbox = await client.import_inbox(exported)
except UnsupportedVersionError as e:
    print(f"Unsupported export version: {e}")
    # The export file was created with an incompatible version
except InvalidImportDataError as e:
    print(f"Invalid import data: {e}")
    # Possible causes:
    # - Missing required fields (version, emailAddress, secretKey, etc.)
    # - Invalid encryption keys (wrong size or encoding)
    # - Server signing key mismatch
    # - Invalid email address format
    # - Corrupted JSON
except InboxAlreadyExistsError as e:
    print(f"Inbox already imported in this client: {e}")
    # The inbox is already available in this client instance
```

## ExportedInbox Structure

The `ExportedInbox` dataclass contains all data needed to reconstruct an inbox:

```python
@dataclass
class ExportedInbox:
    version: int            # Export format version (always 1)
    email_address: str      # The email address assigned to the inbox
    expires_at: str         # ISO 8601 timestamp when the inbox expires
    inbox_hash: str         # SHA-256 hash of the client KEM public key
    server_sig_pk: str      # Server signing public key (base64url-encoded)
    secret_key: str         # ML-KEM-768 secret key (base64url-encoded, SENSITIVE!)
    exported_at: str        # ISO 8601 timestamp when the inbox was exported
```

Note: The public key is not stored because it can be derived from the secret key during import.

## Complete Examples

### Manual Testing Workflow

```python
# scripts/export_test_inbox.py
import asyncio
import os
from vaultsandbox import VaultSandboxClient

async def create_test_inbox():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
    ) as client:
        inbox = await client.create_inbox()

        print(f"Created test inbox: {inbox.email_address}")
        print(f"Expires at: {inbox.expires_at.isoformat()}")

        # Export for manual use
        await client.export_inbox_to_file(inbox, "./tmp/test-inbox.json")
        print("Exported to: ./tmp/test-inbox.json")

        print("\nSend test emails to this address, then run:")
        print("  python scripts/check_test_inbox.py")

asyncio.run(create_test_inbox())
```

```python
# scripts/check_test_inbox.py
import asyncio
import os
from vaultsandbox import VaultSandboxClient

async def check_test_inbox():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
    ) as client:
        # Import the test inbox
        inbox = await client.import_inbox_from_file("./tmp/test-inbox.json")
        print(f"Monitoring: {inbox.email_address}\n")

        # Show existing emails
        emails = await inbox.list_emails()
        print(f"Found {len(emails)} existing emails:\n")

        for i, email in enumerate(emails, 1):
            print(f"{i}. \"{email.subject}\" from {email.from_address}")
            print(f"   Received: {email.received_at}")
            print(f"   Links: {len(email.links)}")
            print()

        # Monitor for new emails
        print("Waiting for new emails (Ctrl+C to exit)...\n")

        async def handle_email(email):
            print(f"New email received!")
            print(f"   Subject: {email.subject}")
            print(f"   From: {email.from_address}")
            print(f"   Received: {email.received_at}")
            print()

        await inbox.on_new_email(handle_email)

        # Keep running
        await asyncio.Event().wait()

asyncio.run(check_test_inbox())
```

### pytest Fixture for Debugging

```python
# conftest.py
import os
import pytest
from pathlib import Path
from vaultsandbox import VaultSandboxClient

@pytest.fixture
async def client():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
    ) as client:
        yield client

@pytest.fixture
async def inbox_with_export(client, request):
    """Fixture that exports inbox on test failure."""
    inbox = await client.create_inbox()
    yield inbox

    # Export on failure for debugging
    if hasattr(request.node, "rep_call") and request.node.rep_call.failed:
        debug_dir = Path("./debug")
        debug_dir.mkdir(exist_ok=True)
        test_name = request.node.name.replace(" ", "-")
        filename = debug_dir / f"inbox-{test_name}.json"
        await client.export_inbox_to_file(inbox, filename)
        print(f"\nExported failed test inbox to: {filename}")

    await inbox.delete()

# Hook to capture test results
@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)
```

## Best Practices

### 1. Secure Storage

Never store exported data in plaintext:

```python
import hashlib
from cryptography.fernet import Fernet
import json

def export_inbox_securely(inbox, password: str) -> bytes:
    """Export inbox with password encryption."""
    exported = inbox.export()
    data = json.dumps({
        "version": exported.version,
        "emailAddress": exported.email_address,
        "expiresAt": exported.expires_at,
        "inboxHash": exported.inbox_hash,
        "serverSigPk": exported.server_sig_pk,
        "secretKey": exported.secret_key,
        "exportedAt": exported.exported_at,
    })

    # Derive key from password
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode(),
        b'vaultsandbox-salt',
        100000,
        dklen=32
    )
    f = Fernet(base64.urlsafe_b64encode(key))

    return f.encrypt(data.encode())

def import_inbox_securely(encrypted: bytes, password: str) -> dict:
    """Decrypt and return inbox data."""
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode(),
        b'vaultsandbox-salt',
        100000,
        dklen=32
    )
    f = Fernet(base64.urlsafe_b64encode(key))

    return json.loads(f.decrypt(encrypted).decode())
```

### 2. Server URL Matching

Imported inboxes must be used with the same server:

```python
# Export from server A
async with VaultSandboxClient(
    api_key="key-a",
    base_url="https://server-a.vaultsandbox.com",
) as client_a:
    inbox = await client_a.create_inbox()
    exported = inbox.export()

# Import must use same server
async with VaultSandboxClient(
    api_key="key-b",  # Different API key is OK
    base_url="https://server-a.vaultsandbox.com",  # Same server
) as client_b:
    inbox = await client_b.import_inbox(exported)  # Works

# Wrong server will fail
async with VaultSandboxClient(
    api_key="key-c",
    base_url="https://server-c.vaultsandbox.com",  # Different server
) as client_c:
    inbox = await client_c.import_inbox(exported)  # Raises InvalidImportDataError
```

### 3. Clean Up Exported Inboxes

Delete inboxes when done to avoid quota issues:

```python
async def debug_with_imported_inbox(filepath: str):
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
    ) as client:
        inbox = await client.import_inbox_from_file(filepath)

        try:
            # Debug...
            emails = await inbox.list_emails()
            print(f"Found {len(emails)} emails")
        finally:
            # Clean up when done
            await inbox.delete()
```

### 4. Version Exported Data

Include metadata in exports for tracking:

```python
import getpass
import os
from datetime import datetime

def export_with_metadata(inbox) -> dict:
    """Export inbox with additional metadata."""
    exported = inbox.export()

    return {
        "wrapperVersion": "1.0",
        "exportedAt": datetime.utcnow().isoformat() + "Z",
        "exportedBy": getpass.getuser(),
        "environment": os.environ.get("ENV", "unknown"),
        "inbox": {
            "version": exported.version,
            "emailAddress": exported.email_address,
            "expiresAt": exported.expires_at,
            "inboxHash": exported.inbox_hash,
            "serverSigPk": exported.server_sig_pk,
            "secretKey": exported.secret_key,
            "exportedAt": exported.exported_at,
        },
    }

async def import_with_metadata(client, data: dict):
    """Import inbox from wrapped data."""
    print(f"Import from: {data['exportedBy']}")
    print(f"Exported at: {data['exportedAt']}")
    print(f"Environment: {data['environment']}")

    from vaultsandbox import ExportedInbox

    inbox_data = data["inbox"]
    exported = ExportedInbox(
        version=inbox_data["version"],
        email_address=inbox_data["emailAddress"],
        expires_at=inbox_data["expiresAt"],
        inbox_hash=inbox_data["inboxHash"],
        server_sig_pk=inbox_data["serverSigPk"],
        secret_key=inbox_data["secretKey"],
        exported_at=inbox_data.get("exportedAt", ""),
    )

    return await client.import_inbox(exported)
```

## Next Steps

- [Delivery Strategies](/client-python/advanced/strategies/) - SSE vs Polling
- [Error Handling](/client-python/api/errors/) - Handle import errors
- [VaultSandboxClient API](/client-python/api/client/) - Client import/export methods
