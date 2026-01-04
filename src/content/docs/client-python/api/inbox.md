---
title: Inbox API
description: Complete API reference for the Inbox class
---

The `Inbox` class represents a single email inbox in VaultSandbox. It provides methods for managing emails, waiting for new messages, and monitoring in real-time.

## Properties

### email_address

```python
email_address: str
```

The email address for this inbox. Use this address to send test emails.

#### Example

```python
inbox = await client.create_inbox()
print(f"Send email to: {inbox.email_address}")

# Use in your application
await send_welcome_email(inbox.email_address)
```

---

### inbox_hash

```python
inbox_hash: str
```

Unique identifier for this inbox (SHA-256 hash of the client KEM public key). Used internally for API operations.

#### Example

```python
print(f"Inbox ID: {inbox.inbox_hash}")
```

---

### expires_at

```python
expires_at: datetime
```

The date and time when this inbox will expire and be automatically deleted.

#### Example

```python
from datetime import datetime, timezone

inbox = await client.create_inbox()
print(f"Inbox expires at: {inbox.expires_at.isoformat()}")

time_until_expiry = inbox.expires_at - datetime.now(timezone.utc)
print(f"Time remaining: {int(time_until_expiry.total_seconds())}s")
```

---

### server_sig_pk

```python
server_sig_pk: str
```

Base64-encoded server signing public key for ML-DSA-65 signature verification.

## Methods

### list_emails()

Lists all emails in the inbox with full content. Emails are automatically decrypted.

```python
async def list_emails(self) -> list[Email]
```

#### Returns

`list[Email]` - List of decrypted email objects with full content

#### Example

```python
emails = await inbox.list_emails()

print(f"Inbox has {len(emails)} emails")

for email in emails:
    print(f"- {email.subject} from {email.from_address}")
    print(f"  Body: {email.text[:100]}...")
```

---

### list_emails_metadata_only()

Lists all emails in the inbox with metadata only (no full content). This is more efficient than `list_emails()` when you only need basic information like subject and sender.

```python
async def list_emails_metadata_only(self) -> list[EmailMetadata]
```

#### Returns

`list[EmailMetadata]` - List of email metadata objects

```python
@dataclass
class EmailMetadata:
    id: str              # Unique email identifier
    from_address: str    # Sender email address
    subject: str         # Email subject
    received_at: datetime  # When the email was received
    is_read: bool        # Whether the email has been read
```

#### Example

```python
from vaultsandbox import EmailMetadata

# Get just metadata - faster than fetching full content
metadata_list = await inbox.list_emails_metadata_only()

print(f"Inbox has {len(metadata_list)} emails")

for meta in metadata_list:
    status = "read" if meta.is_read else "unread"
    print(f"- [{status}] {meta.subject} from {meta.from_address}")

# Fetch full content only for emails you need
for meta in metadata_list:
    if "important" in meta.subject.lower():
        full_email = await inbox.get_email(meta.id)
        print(f"Important email body: {full_email.text}")
```

#### When to Use

Use `list_emails_metadata_only()` when:

- You need to display a list of emails without their content
- You want to filter emails before fetching full content
- Performance is critical and you're dealing with many emails

Use `list_emails()` when:

- You need access to email body, attachments, or links
- You're processing all emails and need their full content

---

### get_email()

Retrieves a specific email by ID.

```python
async def get_email(self, email_id: str) -> Email
```

#### Parameters

- `email_id`: The unique identifier for the email

#### Returns

`Email` - The decrypted email object

#### Example

```python
emails = await inbox.list_emails()
first_email = await inbox.get_email(emails[0].id)

print(f"Subject: {first_email.subject}")
print(f"Body: {first_email.text}")
```

#### Errors

- `EmailNotFoundError` - Email does not exist

---

### wait_for_email()

Waits for an email matching specified criteria. This is the recommended way to handle email arrival in tests.

```python
async def wait_for_email(
    self,
    options: WaitForEmailOptions | None = None,
) -> Email
```

#### Parameters

```python
@dataclass
class WaitForEmailOptions:
    subject: str | Pattern[str] | None = None
    from_address: str | Pattern[str] | None = None
    predicate: Callable[..., bool] | None = None
    timeout: int = 30000
    poll_interval: int = 2000
```

| Property        | Type                              | Default | Description                          |
| --------------- | --------------------------------- | ------- | ------------------------------------ |
| `timeout`       | `int`                             | `30000` | Maximum time to wait in milliseconds |
| `poll_interval` | `int`                             | `2000`  | Polling interval in milliseconds     |
| `subject`       | `str \| Pattern[str] \| None`     | `None`  | Filter by email subject              |
| `from_address`  | `str \| Pattern[str] \| None`     | `None`  | Filter by sender address             |
| `predicate`     | `Callable[[Email], bool] \| None` | `None`  | Custom filter function               |

#### Returns

`Email` - The first email matching the criteria

#### Examples

```python
import re
from vaultsandbox import WaitForEmailOptions

# Wait for any email
email = await inbox.wait_for_email(
    WaitForEmailOptions(timeout=10000)
)

# Wait for email with specific subject
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        subject=re.compile(r"Password Reset"),
    )
)

# Wait for email from specific sender
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        from_address="noreply@example.com",
    )
)

# Wait with custom predicate
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=15000,
        predicate=lambda email: "user@example.com" in email.to,
    )
)

# Combine multiple filters
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        subject=re.compile(r"Welcome"),
        from_address=re.compile(r"noreply@"),
        predicate=lambda email: len(email.links) > 0,
    )
)
```

#### Errors

- `TimeoutError` - No matching email received within timeout period

---

### wait_for_email_count()

Waits until the inbox has at least the specified number of emails. More efficient than using arbitrary timeouts when testing multiple emails.

```python
async def wait_for_email_count(
    self,
    count: int,
    options: WaitForCountOptions | None = None,
) -> None
```

#### Parameters

- `count`: Minimum number of emails to wait for
- `options`: Optional configuration for waiting

```python
@dataclass
class WaitForCountOptions:
    timeout: int = 30000  # Maximum wait time in milliseconds
```

#### Returns

`list[Email]` - List of all emails in the inbox once the count is reached

#### Example

```python
from vaultsandbox import WaitForCountOptions

# Trigger multiple emails
await send_multiple_notifications(inbox.email_address, 3)

# Wait for all 3 to arrive (with default timeout)
emails = await inbox.wait_for_email_count(3)
assert len(emails) >= 3

# Wait with custom timeout
emails = await inbox.wait_for_email_count(3, WaitForCountOptions(timeout=60000))

# Process the returned emails directly
for email in emails:
    print(f"Subject: {email.subject}")
```

#### Errors

- `TimeoutError` - Required count not reached within timeout

---

### on_new_email()

Subscribes to new emails in real-time. Receives a callback for each new email that arrives.

```python
async def on_new_email(
    self,
    callback: Callable[[Email], Any],
    *,
    mark_existing_seen: bool = True,
) -> Subscription
```

#### Parameters

- `callback`: Function called when a new email arrives. Can be sync or async.
- `mark_existing_seen`: If `True` (default), existing emails won't trigger the callback. Set to `False` to receive callbacks for existing emails too.

#### Returns

`Subscription` - Subscription object for managing the subscription

```python
class Subscription:
    async def unsubscribe(self) -> None: ...
    def mark_seen(self, email_id: str) -> None: ...
```

#### Example

```python
inbox = await client.create_inbox()

print(f"Monitoring: {inbox.email_address}")

# Subscribe to new emails
async def handle_email(email: Email):
    print(f'New email: "{email.subject}"')
    print(f"From: {email.from_address}")
    # Process email...

subscription = await inbox.on_new_email(handle_email)

# Later, stop monitoring
await subscription.unsubscribe()
```

#### Best Practice

Always unsubscribe when done to avoid resource leaks:

```python
import pytest
from vaultsandbox import VaultSandboxClient

@pytest.fixture
async def inbox(client):
    inbox = await client.create_inbox()
    yield inbox
    await inbox.delete()

@pytest.mark.asyncio
async def test_email_notification(inbox):
    received_emails = []

    async def handle_email(email):
        received_emails.append(email)

    subscription = await inbox.on_new_email(handle_email)

    try:
        # Send email to inbox.email_address...
        await asyncio.sleep(5)  # Wait for email
    finally:
        await subscription.unsubscribe()
```

---

### get_sync_status()

Gets the current synchronization status of the inbox with the server.

```python
async def get_sync_status(self) -> SyncStatus
```

#### Returns

`SyncStatus` - Sync status information

```python
@dataclass
class SyncStatus:
    email_count: int
    emails_hash: str
```

#### Example

```python
status = await inbox.get_sync_status()
print(f"Email count: {status.email_count}")
print(f"Emails hash: {status.emails_hash}")
```

---

### get_raw_email()

Gets the raw, decrypted source of a specific email (original MIME format).

```python
async def get_raw_email(self, email_id: str) -> RawEmail
```

#### Parameters

- `email_id`: The unique identifier for the email

#### Returns

`RawEmail` - Object containing the email ID and raw MIME content

```python
@dataclass
class RawEmail:
    id: str   # The email ID
    raw: str  # The raw MIME email content
```

#### Example

```python
emails = await inbox.list_emails()
raw_email = await inbox.get_raw_email(emails[0].id)

print(f"Email ID: {raw_email.id}")
print("Raw MIME source:")
print(raw_email.raw)

# Save to file for debugging
with open("email.eml", "w") as f:
    f.write(raw_email.raw)
```

---

### mark_email_as_read()

Marks a specific email as read.

```python
async def mark_email_as_read(self, email_id: str) -> None
```

#### Parameters

- `email_id`: The unique identifier for the email

#### Example

```python
emails = await inbox.list_emails()
await inbox.mark_email_as_read(emails[0].id)

print("Email marked as read")
```

---

### delete_email()

Deletes a specific email from the inbox.

```python
async def delete_email(self, email_id: str) -> None
```

#### Parameters

- `email_id`: The unique identifier for the email

#### Example

```python
emails = await inbox.list_emails()

# Delete first email
await inbox.delete_email(emails[0].id)

print("Email deleted")

# Verify deletion
updated = await inbox.list_emails()
assert len(updated) == len(emails) - 1
```

---

### delete()

Deletes this inbox and all its emails.

```python
async def delete(self) -> None
```

#### Example

```python
inbox = await client.create_inbox()

# Use inbox...

# Clean up
await inbox.delete()
print("Inbox deleted")
```

#### Best Practice

Always delete inboxes after tests:

```python
import pytest

@pytest.fixture
async def inbox(client):
    inbox = await client.create_inbox()
    yield inbox
    await inbox.delete()
```

---

### export()

Exports inbox data and encryption keys for backup or sharing.

```python
def export(self) -> ExportedInbox
```

#### Returns

`ExportedInbox` - Serializable inbox data including sensitive keys

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
data = inbox.export()

# Save for later
with open("inbox-backup.json", "w") as f:
    json.dump(vars(data), f, indent=2)
```

#### Security Warning

Exported data contains private encryption keys. Store securely!

## Complete Inbox Example

```python
import asyncio
import os
import re
from vaultsandbox import VaultSandboxClient, WaitForEmailOptions

async def complete_inbox_example():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        # Create inbox
        inbox = await client.create_inbox()
        print(f"Created: {inbox.email_address}")
        print(f"Expires: {inbox.expires_at.isoformat()}")

        # Subscribe to new emails
        async def handle_email(email):
            print(f"Received: {email.subject}")

        subscription = await inbox.on_new_email(handle_email)

        try:
            # Trigger test email
            await send_test_email(inbox.email_address)

            # Wait for specific email
            email = await inbox.wait_for_email(
                WaitForEmailOptions(
                    timeout=10000,
                    subject=re.compile(r"Test"),
                )
            )

            print(f"Found email: {email.subject}")
            print(f"Body: {email.text}")

            # Mark as read
            await inbox.mark_email_as_read(email.id)

            # Get all emails
            all_emails = await inbox.list_emails()
            print(f"Total emails: {len(all_emails)}")

            # Export inbox
            export_data = inbox.export()
            with open("inbox.json", "w") as f:
                import json
                json.dump(vars(export_data), f, indent=2)

        finally:
            # Clean up
            await subscription.unsubscribe()
            await inbox.delete()

asyncio.run(complete_inbox_example())
```

## Next Steps

- [Email API Reference](/client-python/api/email/) - Work with email objects
- [VaultSandboxClient API](/client-python/api/client/) - Learn about client methods
- [Waiting for Emails Guide](/client-python/guides/waiting-for-emails/) - Best practices
- [Real-time Monitoring Guide](/client-python/guides/real-time/) - Advanced monitoring patterns
