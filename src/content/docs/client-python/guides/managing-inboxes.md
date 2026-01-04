---
title: Managing Inboxes
description: Common operations for creating, using, and deleting inboxes
---

This guide covers common inbox management operations with practical examples.

## Creating Inboxes

### Basic Creation

```python
import os
from vaultsandbox import VaultSandboxClient

async with VaultSandboxClient(
    base_url=os.environ["VAULTSANDBOX_URL"],
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
) as client:
    inbox = await client.create_inbox()
    print(f"Email address: {inbox.email_address}")
```

### With Custom TTL

```python
from vaultsandbox import CreateInboxOptions

# Expire after 1 hour (good for CI/CD)
inbox = await client.create_inbox(CreateInboxOptions(ttl=3600))

# Expire after 10 minutes (quick tests)
inbox = await client.create_inbox(CreateInboxOptions(ttl=600))

# Expire after 7 days (long-running tests)
inbox = await client.create_inbox(CreateInboxOptions(ttl=604800))
```

### Requesting Specific Address

```python
from vaultsandbox import CreateInboxOptions
from vaultsandbox.errors import InboxAlreadyExistsError

try:
    inbox = await client.create_inbox(
        CreateInboxOptions(email_address="test@mail.example.com")
    )
    print(f"Got requested address: {inbox.email_address}")
except InboxAlreadyExistsError:
    print("Address already in use, using random address")
    inbox = await client.create_inbox()
```

## Listing Emails

### List All Emails (Full Content)

```python
emails = await inbox.list_emails()

print(f"Inbox contains {len(emails)} emails")
for email in emails:
    print(f"- {email.from_address}: {email.subject}")
    print(f"  Body preview: {email.text[:100] if email.text else 'No text'}...")
```

### List Metadata Only (Efficient)

When you only need basic information like subject and sender, use `list_emails_metadata_only()` for better performance:

```python
from vaultsandbox import EmailMetadata

# Fetch only metadata - no email body content
metadata_list = await inbox.list_emails_metadata_only()

print(f"Inbox contains {len(metadata_list)} emails")
for meta in metadata_list:
    status = "✓" if meta.is_read else "•"
    print(f"{status} {meta.from_address}: {meta.subject}")

# Fetch full content only for specific emails
for meta in metadata_list:
    if "urgent" in meta.subject.lower():
        full_email = await inbox.get_email(meta.id)
        process_urgent_email(full_email)
```

### Filtering Emails

```python
import re
from datetime import datetime, timezone, timedelta

emails = await inbox.list_emails()

# Filter by sender
from_support = [e for e in emails if e.from_address == "support@example.com"]

# Filter by subject
password_resets = [e for e in emails if re.search(r"reset", e.subject, re.IGNORECASE)]

# Filter by date (last hour)
one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
recent_emails = [e for e in emails if e.received_at > one_hour_ago]
```

### Sorting Emails

```python
emails = await inbox.list_emails()

# Sort by date (newest first)
sorted_by_date = sorted(emails, key=lambda e: e.received_at, reverse=True)

# Sort by sender
sorted_by_sender = sorted(emails, key=lambda e: e.from_address)
```

## Getting Specific Emails

### By ID

```python
email_id = "email_abc123"
email = await inbox.get_email(email_id)

print(email.subject)
```

### With Error Handling

```python
from vaultsandbox.errors import EmailNotFoundError

try:
    email = await inbox.get_email(email_id)
    print(f"Found: {email.subject}")
except EmailNotFoundError:
    print("Email not found")
```

## Deleting Emails

### Delete Single Email

```python
# By ID
await inbox.delete_email("email_abc123")

# Via email object
email = await inbox.get_email("email_abc123")
await email.delete()
```

### Delete Multiple Emails

```python
import asyncio

emails = await inbox.list_emails()

# Delete all emails sequentially
for email in emails:
    await email.delete()

# Or in parallel
await asyncio.gather(*[email.delete() for email in emails])
```

### Delete by Criteria

```python
import asyncio
from datetime import datetime, timezone, timedelta

emails = await inbox.list_emails()

# Delete old emails (older than 24 hours)
one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)
old_emails = [e for e in emails if e.received_at < one_day_ago]

await asyncio.gather(*[email.delete() for email in old_emails])
```

## Deleting Inboxes

### Delete Single Inbox

```python
await inbox.delete()

# Inbox and all emails are now deleted
```

### Delete All Inboxes

```python
# Delete all inboxes for this API key
count = await client.delete_all_inboxes()
print(f"Deleted {count} inboxes")
```

### Safe Deletion with Context Manager

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def with_inbox(client):
    inbox = await client.create_inbox()
    try:
        yield inbox
    finally:
        await inbox.delete()

# Usage
async with with_inbox(client) as inbox:
    await send_test_email(inbox.email_address)
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    assert "Test" in email.subject
```

## Checking Inbox Status

### Check if Inbox Exists

```python
from vaultsandbox.errors import InboxNotFoundError

try:
    emails = await inbox.list_emails()
    print("Inbox exists")
except InboxNotFoundError:
    print("Inbox expired or deleted")
```

### Check Expiration

```python
from datetime import datetime, timezone, timedelta

now = datetime.now(timezone.utc)
expires_in = inbox.expires_at - now

if expires_in < timedelta(minutes=5):
    print("Inbox expiring soon!")
    print(f"Time left: {expires_in.total_seconds() / 60:.0f} minutes")
```

### Get Sync Status

```python
sync_status = await inbox.get_sync_status()

print(f"Email count: {sync_status.email_count}")
print(f"Emails hash: {sync_status.emails_hash}")
```

## Bulk Operations

### Create Multiple Inboxes

```python
import asyncio

inboxes = await asyncio.gather(
    client.create_inbox(),
    client.create_inbox(),
    client.create_inbox(),
)

print(f"Created {len(inboxes)} inboxes")
for inbox in inboxes:
    print(f"- {inbox.email_address}")
```

### Clean Up Multiple Inboxes

```python
import asyncio

# Delete all
await asyncio.gather(*[inbox.delete() for inbox in inboxes])

# Or use convenience method
await client.delete_all_inboxes()
```

## Testing Patterns

### pytest Setup/Teardown

```python
import pytest
import os
from vaultsandbox import VaultSandboxClient

@pytest.fixture
async def client():
    async with VaultSandboxClient(
        base_url=os.environ["VAULTSANDBOX_URL"],
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        yield client

@pytest.fixture
async def inbox(client):
    inbox = await client.create_inbox()
    yield inbox
    await inbox.delete()

@pytest.mark.asyncio
async def test_receives_email(inbox):
    await send_email(inbox.email_address)
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    assert email is not None
```

### Shared Inbox Pattern

```python
import pytest
from vaultsandbox import CreateInboxOptions

@pytest.fixture(scope="module")
async def shared_inbox(client):
    inbox = await client.create_inbox(CreateInboxOptions(ttl=7200))  # 2 hours
    yield inbox
    await inbox.delete()

@pytest.mark.asyncio
async def test_one(shared_inbox):
    # Use shared inbox
    pass

@pytest.mark.asyncio
async def test_two(shared_inbox):
    # Use shared inbox
    pass
```

### Inbox Pool Pattern

```python
class InboxPool:
    def __init__(self, client, size=5):
        self.client = client
        self.size = size
        self.available = []
        self.in_use = set()

    async def initialize(self):
        import asyncio
        self.available = await asyncio.gather(
            *[self.client.create_inbox() for _ in range(self.size)]
        )

    def acquire(self):
        if not self.available:
            raise RuntimeError("No inboxes available")
        inbox = self.available.pop(0)
        self.in_use.add(inbox)
        return inbox

    def release(self, inbox):
        self.in_use.discard(inbox)
        self.available.append(inbox)

    async def cleanup(self):
        import asyncio
        all_inboxes = list(self.available) + list(self.in_use)
        await asyncio.gather(*[inbox.delete() for inbox in all_inboxes])

# Usage
pool = InboxPool(client, 5)
await pool.initialize()

inbox = pool.acquire()
# Use inbox
pool.release(inbox)

await pool.cleanup()
```

## Error Handling

### Handling Expired Inboxes

```python
from vaultsandbox.errors import InboxNotFoundError

try:
    emails = await inbox.list_emails()
except InboxNotFoundError:
    print("Inbox expired, creating new one")
    inbox = await client.create_inbox()
```

### Handling Creation Errors

```python
from vaultsandbox.errors import ApiError, NetworkError

try:
    inbox = await client.create_inbox()
except ApiError as e:
    print(f"API error: {e.status_code} {e.message}")
except NetworkError as e:
    print(f"Network error: {e.message}")
```

## Best Practices

### Always Clean Up

```python
# Good: Cleanup in finally block
inbox = await client.create_inbox()
try:
    # Use inbox
    pass
finally:
    await inbox.delete()

# Better: Use async context manager pattern
async with VaultSandboxClient(...) as client:
    inbox = await client.create_inbox()
    try:
        # Use inbox
        pass
    finally:
        await inbox.delete()
```

### Use Appropriate TTL

```python
# Good: Short TTL for CI/CD
inbox = await client.create_inbox(CreateInboxOptions(ttl=3600))  # 1 hour

# Avoid: Long TTL wastes resources
# inbox = await client.create_inbox(CreateInboxOptions(ttl=604800))  # 7 days for quick test
```

### Handle Cleanup Errors

```python
from vaultsandbox.errors import InboxNotFoundError

async def safe_delete(inbox):
    try:
        await inbox.delete()
    except InboxNotFoundError:
        # Inbox may have already expired
        pass
    except Exception as e:
        print(f"Error deleting inbox: {e}")
```

## Next Steps

- **[Waiting for Emails](/client-python/guides/waiting-for-emails/)** - Learn about email waiting strategies
- **[Real-time Monitoring](/client-python/guides/real-time/)** - Subscribe to new emails
- **[API Reference: Inbox](/client-python/api/inbox/)** - Complete inbox API documentation
- **[Core Concepts: Inboxes](/client-python/concepts/inboxes/)** - Deep dive into inbox concepts
