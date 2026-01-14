---
title: Inboxes
description: Understanding VaultSandbox inboxes and how to work with them
---

Inboxes are the core concept in VaultSandbox. Each inbox is an isolated, encrypted email destination with its own unique address and encryption keys.

## What is an Inbox?

An inbox is a temporary, encrypted email destination that:

- Has a **unique email address** (e.g., `a1b2c3d4@mail.example.com`)
- Uses **client-side encryption** (ML-KEM-768 keypair)
- **Expires automatically** after a configurable time-to-live (TTL)
- Is **isolated** from other inboxes
- Stores emails **in memory** on the gateway

## Creating Inboxes

### Basic Creation

```python
from vaultsandbox import VaultSandboxClient

async with VaultSandboxClient(base_url=url, api_key=api_key) as client:
    inbox = await client.create_inbox()

    print(inbox.email_address)  # "a1b2c3d4@mail.example.com"
    print(inbox.inbox_hash)     # "a1b2c3d4"
    print(inbox.expires_at)     # datetime object
```

### With Options

```python
from vaultsandbox import VaultSandboxClient, CreateInboxOptions

async with VaultSandboxClient(base_url=url, api_key=api_key) as client:
    inbox = await client.create_inbox(
        CreateInboxOptions(
            ttl=3600,  # 1 hour (default: 24 hours)
            email_address="test@mail.example.com",  # Request specific address
            email_auth=False,  # Disable SPF/DKIM/DMARC checks
            encryption="plain",  # Request plain inbox (if policy allows)
        )
    )
```

**Note**: Requesting a specific email address may fail if it's already in use. The `encryption` option may be rejected based on the server's `encryption_policy`.

## Inbox Properties

### email_address

**Type**: `str`

The full email address for this inbox.

```python
print(inbox.email_address)
# "a1b2c3d4@mail.example.com"
```

Send emails to this address to have them appear in the inbox.

### inbox_hash

**Type**: `str`

A unique cryptographic hash identifier for the inbox. This is used internally for encryption and identification purposes.

```python
print(inbox.inbox_hash)
# "Rr02MLnP7F0pRVC6QdcpSIeyklqu3PDkYglvsfN7Oss"
```

**Note**: This is not the same as the local part of the email address. The email address local part (e.g., `a1b2c3d4` in `a1b2c3d4@mail.example.com`) is different from the `inbox_hash`.

### expires_at

**Type**: `datetime`

When the inbox will automatically expire and be deleted.

```python
from datetime import datetime, timezone

print(inbox.expires_at)
# datetime(2024, 1, 16, 12, 0, 0, tzinfo=timezone.utc)

# Check if inbox is expiring soon
hours_until_expiry = (inbox.expires_at - datetime.now(timezone.utc)).total_seconds() / 3600
print(f"Expires in {hours_until_expiry:.1f} hours")
```

### server_sig_pk

**Type**: `str | None`

The server's signing public key (ML-DSA-65) used to verify email signatures.

```python
print(inbox.server_sig_pk)
# Base64URL-encoded public key string
```

**Note**: This property is only present when the inbox is encrypted (`encrypted=True`). For plain inboxes, this will be `None`.

### encrypted

**Type**: `bool`

Indicates whether the inbox uses encryption.

```python
print(inbox.encrypted)  # True or False
```

- `True` - Emails are encrypted using ML-KEM-768 (end-to-end encrypted)
- `False` - Emails are stored in plain text (Base64-encoded JSON)

The encryption state is determined by:
1. Server's `encryption_policy` setting
2. The `encryption` option passed during inbox creation (when policy allows)

### email_auth

**Type**: `bool`

Indicates whether email authentication checks are enabled for this inbox.

```python
print(inbox.email_auth)  # True or False
```

- `True` - SPF, DKIM, DMARC, and Reverse DNS checks are performed
- `False` - All authentication checks are skipped (results show `skipped` status)

## Inbox Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                  Inbox Lifecycle                        │
└─────────────────────────────────────────────────────────┘

1. Creation
   client.create_inbox() → Inbox object
   ↓
   - Keypair generated client-side
   - Public key sent to server
   - Unique email address assigned
   - TTL timer starts

2. Active
   ↓
   - Receive emails
   - List/read emails
   - Wait for emails
   - Monitor for new emails

3. Expiration (TTL reached) or Manual Deletion
   ↓
   inbox.delete() or TTL expires
   - All emails deleted
   - Inbox address freed
   - Keypair destroyed
```

## Working with Inboxes

### Listing Emails

```python
# Get all emails with full content
emails = await inbox.list_emails()

print(f"{len(emails)} emails in inbox")
for email in emails:
    print(f"{email.from_address}: {email.subject}")
```

For better performance when you only need basic info, use metadata-only listing:

```python
# Get only metadata (more efficient)
metadata_list = await inbox.list_emails_metadata_only()

for meta in metadata_list:
    print(f"{meta.from_address}: {meta.subject}")
    # Fetch full content only if needed
    if "important" in meta.subject.lower():
        full_email = await inbox.get_email(meta.id)
```

### Getting a Specific Email

```python
email = await inbox.get_email("email-id-123")

print(email.subject)
print(email.text)
```

### Waiting for Emails

```python
from vaultsandbox import WaitForEmailOptions
import re

# Wait for any email
email = await inbox.wait_for_email(WaitForEmailOptions(timeout=30000))

# Wait for specific email
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=30000,
        subject=re.compile(r"Password Reset"),
        from_address="noreply@example.com",
    )
)
```

### Deleting Emails

```python
# Delete specific email via inbox
await inbox.delete_email("email-id-123")

# Or via email object
await email.delete()
```

### Deleting Inbox

```python
# Delete inbox and all its emails
await inbox.delete()
```

## Inbox Isolation

Each inbox is completely isolated:

```python
inbox1 = await client.create_inbox()
inbox2 = await client.create_inbox()

# inbox1 cannot access inbox2's emails
# inbox2 cannot access inbox1's emails

# Each has its own:
# - Email address
# - Encryption keys
# - Email storage
# - Expiration time
```

## Time-to-Live (TTL)

Inboxes automatically expire after their TTL:

### Default TTL

```python
# Uses server's DEFAULT_INBOX_TTL (typically 24 hours)
inbox = await client.create_inbox()
```

### Custom TTL

```python
from vaultsandbox import CreateInboxOptions

# Expire after 1 hour
inbox = await client.create_inbox(CreateInboxOptions(ttl=3600))

# Expire after 10 minutes (useful for quick tests)
inbox = await client.create_inbox(CreateInboxOptions(ttl=600))

# Expire after 7 days
inbox = await client.create_inbox(CreateInboxOptions(ttl=604800))
```

### Checking Expiration

```python
from datetime import datetime, timezone

minutes_left = (inbox.expires_at - datetime.now(timezone.utc)).total_seconds() / 60

if minutes_left < 5:
    print("Inbox expiring soon!")
```

## Import and Export

Inboxes can be exported and imported for:

- Test reproducibility
- Sharing between environments
- Backup and restore

### Export

```python
import json

export_data = inbox.export()

# Save to file
with open("inbox.json", "w") as f:
    json.dump(export_data.__dict__, f)
```

### Import

```python
import json

with open("inbox.json") as f:
    export_data = json.load(f)

inbox = await client.import_inbox(export_data)

# Inbox restored with all encryption keys
```

**Security Warning**: Exported data contains private keys. Treat as sensitive.

## Best Practices

### CI/CD Pipelines

**Short TTL for fast cleanup**:

```python
inbox = await client.create_inbox(CreateInboxOptions(ttl=3600))  # 1 hour
```

**Always clean up**:

```python
inbox = await client.create_inbox()
try:
    # Run tests
    pass
finally:
    await inbox.delete()
```

### Manual Testing

**Longer TTL for convenience**:

```python
inbox = await client.create_inbox(CreateInboxOptions(ttl=86400))  # 24 hours
```

**Export for reuse**:

```python
# Export after creating
export_data = inbox.export()
with open("test-inbox.json", "w") as f:
    json.dump(export_data.__dict__, f)

# Reuse in later sessions
inbox = await client.import_inbox_from_file("test-inbox.json")
```

### Production Monitoring

**Monitor expiration**:

```python
import asyncio
from datetime import datetime, timezone

async def monitor_expiration(inbox):
    while True:
        minutes_left = (inbox.expires_at - datetime.now(timezone.utc)).total_seconds() / 60
        if minutes_left < 10:
            print(f"Inbox {inbox.email_address} expiring in {minutes_left:.1f} minutes")
        await asyncio.sleep(60)  # Check every minute
```

## Common Patterns

### Dedicated Test Inbox (pytest)

```python
import pytest
from vaultsandbox import VaultSandboxClient, CreateInboxOptions

@pytest.fixture
async def test_inbox(client):
    inbox = await client.create_inbox(CreateInboxOptions(ttl=7200))  # 2 hours
    yield inbox
    await inbox.delete()

@pytest.mark.asyncio
async def test_password_reset(test_inbox):
    await trigger_password_reset(test_inbox.email_address)
    email = await test_inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    # ...
```

### Multiple Inboxes

```python
user1_inbox = await client.create_inbox()
user2_inbox = await client.create_inbox()
admin_inbox = await client.create_inbox()

# Each inbox receives emails independently
await send_welcome_email(user1_inbox.email_address)
await send_welcome_email(user2_inbox.email_address)
await send_admin_report(admin_inbox.email_address)
```

### Inbox Pool

```python
class InboxPool:
    def __init__(self, client, size=5):
        self.client = client
        self.pool = []
        self.size = size

    async def initialize(self):
        for _ in range(self.size):
            inbox = await self.client.create_inbox()
            self.pool.append(inbox)

    def get(self):
        return self.pool.pop(0) if self.pool else None

    async def cleanup(self):
        await asyncio.gather(*[inbox.delete() for inbox in self.pool])
```

## Troubleshooting

### Inbox Not Receiving Emails

**Check**:

1. Email is sent to correct address
2. Inbox hasn't expired
3. DNS/MX records configured correctly
4. SMTP connection successful

```python
# Verify inbox still exists
try:
    emails = await inbox.list_emails()  # Will error if inbox expired
except InboxNotFoundError:
    print("Inbox has expired or been deleted")
```

### Inbox Already Exists Error

When requesting a specific email address:

```python
from vaultsandbox.errors import InboxAlreadyExistsError

try:
    inbox = await client.create_inbox(
        CreateInboxOptions(email_address="test@mail.example.com")
    )
except InboxAlreadyExistsError:
    # Address already in use, generate random instead
    inbox = await client.create_inbox()
```

### Inbox Expired

```python
from vaultsandbox.errors import InboxNotFoundError

try:
    emails = await inbox.list_emails()
except InboxNotFoundError:
    print("Inbox has expired")
    # Create new inbox
    new_inbox = await client.create_inbox()
```

## Next Steps

- **[Email Objects](/client-python/concepts/emails/)** - Learn about email structure
- **[Managing Inboxes](/client-python/guides/managing-inboxes/)** - Common inbox operations
- **[Import/Export](/client-python/advanced/import-export/)** - Advanced inbox persistence
- **[API Reference: Inbox](/client-python/api/inbox/)** - Complete API documentation
