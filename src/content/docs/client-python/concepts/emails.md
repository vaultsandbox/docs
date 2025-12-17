---
title: Email Objects
description: Understanding email objects and their properties in VaultSandbox
---

Email objects in VaultSandbox represent decrypted emails with all their content, headers, and metadata.

## Email Structure

```python
email = await inbox.wait_for_email(WaitForEmailOptions(timeout=30000))

print(email.id)           # "email_abc123"
print(email.from_address) # "sender@example.com"
print(email.to)           # ["recipient@mail.example.com"]
print(email.subject)      # "Welcome to our service"
print(email.text)         # Plain text content
print(email.html)         # HTML content
print(email.received_at)  # datetime object
print(email.is_read)      # False
print(email.links)        # ["https://example.com/verify"]
print(email.attachments)  # List of Attachment objects
print(email.auth_results) # SPF/DKIM/DMARC results
```

## Core Properties

### id

**Type**: `str`

Unique identifier for the email.

```python
email_id = email.id
# Later...
same_email = await inbox.get_email(email_id)
```

### from_address

**Type**: `str`

Sender's email address (from the `From` header).

```python
print(email.from_address)  # "noreply@example.com"

# Use in assertions
assert email.from_address == "support@example.com"
```

**Note**: This property is named `from_address` instead of `from` because `from` is a reserved keyword in Python.

### to

**Type**: `list[str]`

List of recipient email addresses.

```python
print(email.to)  # ["user@mail.example.com"]

# Multiple recipients
print(email.to)  # ["user1@mail.example.com", "user2@mail.example.com"]

# Check if sent to specific address
assert inbox.email_address in email.to
```

### subject

**Type**: `str`

Email subject line.

```python
print(email.subject)  # "Password Reset Request"

# Use in filtering
import re
email = await inbox.wait_for_email(
    WaitForEmailOptions(subject=re.compile(r"Password Reset"))
)
```

### text

**Type**: `str | None`

Plain text content of the email.

```python
print(email.text)
# "Hello,\n\nClick here to reset your password:\nhttps://..."

# May be None if email is HTML-only
if email.text:
    assert "reset your password" in email.text
```

### html

**Type**: `str | None`

HTML content of the email.

```python
print(email.html)
# "<html><body><p>Hello,</p><a href='https://...'>Reset Password</a></body></html>"

# May be None if email is plain text only
if email.html:
    assert "<a href" in email.html
```

### received_at

**Type**: `datetime`

When the email was received by the gateway.

```python
from datetime import datetime, timezone

print(email.received_at)  # datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)

# Check if email arrived recently
age_in_seconds = (datetime.now(timezone.utc) - email.received_at).total_seconds()
assert age_in_seconds < 60  # Received within last minute
```

### is_read

**Type**: `bool`

Whether the email has been marked as read.

```python
print(email.is_read)  # False

await email.mark_as_read()

print(email.is_read)  # True
```

### links

**Type**: `list[str]`

All URLs extracted from the email (text and HTML).

```python
print(email.links)
# [
#   "https://example.com/verify?token=abc123",
#   "https://example.com/unsubscribe",
#   "https://example.com/privacy"
# ]

# Find specific link
verify_link = next((url for url in email.links if "/verify" in url), None)
assert verify_link is not None

# Test link
import httpx
async with httpx.AsyncClient() as http:
    response = await http.get(verify_link)
    assert response.status_code == 200
```

### attachments

**Type**: `list[Attachment]`

List of email attachments.

```python
print(len(email.attachments))  # 2

for att in email.attachments:
    print(att.filename)      # "invoice.pdf"
    print(att.content_type)  # "application/pdf"
    print(att.size)          # 15234 bytes
    print(att.content)       # bytes
```

See [Working with Attachments](/client-python/guides/attachments/) for details.

### auth_results

**Type**: `AuthResults`

Email authentication results (SPF, DKIM, DMARC, reverse DNS).

```python
auth = email.auth_results

if auth.spf:
    print(auth.spf.status)      # SPFStatus.PASS
print(len(auth.dkim))           # 1
if auth.dmarc:
    print(auth.dmarc.status)    # DMARCStatus.PASS

# Validate all checks
validation = auth.validate()
if not validation.passed:
    print(f"Authentication failed: {validation.failures}")
```

See [Authentication Results](/client-python/concepts/auth-results/) for details.

### headers

**Type**: `dict[str, str]`

All email headers as a key-value dictionary.

```python
print(email.headers)
# {
#   "from": "noreply@example.com",
#   "to": "user@mail.example.com",
#   "subject": "Welcome",
#   "message-id": "<abc123@example.com>",
#   "date": "Mon, 15 Jan 2024 12:00:00 +0000",
#   "content-type": "text/html; charset=utf-8",
#   ...
# }

# Access specific headers
message_id = email.headers.get("message-id")
content_type = email.headers.get("content-type")
```

### metadata

**Type**: `dict[str, Any]`

Additional metadata associated with the email (from encryptedMetadata).

```python
print(email.metadata)
# {
#   "emailSizeBytes": 5432,
#   "encryptedAt": "2024-01-15T12:00:00.000Z",
#   ...
# }
```

### parsed_metadata

**Type**: `dict[str, Any]`

Additional metadata from parsed content (from encryptedParsed).

```python
print(email.parsed_metadata)
```

## Email Methods

### mark_as_read()

Mark the email as read.

```python
await email.mark_as_read()

print(email.is_read)  # True
```

### delete()

Delete the email from the inbox.

```python
await email.delete()

# Email is now deleted
from vaultsandbox.errors import EmailNotFoundError
try:
    await inbox.get_email(email.id)
except EmailNotFoundError:
    print("Email deleted")
```

### get_raw()

Get the raw email source (decrypted MIME).

```python
raw = await email.get_raw()

print(raw)
# "From: sender@example.com\r\nTo: recipient@example.com\r\n..."
```

## Common Patterns

### Content Validation

```python
import re

email = await inbox.wait_for_email(
    WaitForEmailOptions(
        subject=re.compile(r"Welcome"),
        timeout=10000,
    )
)

# Validate sender
assert email.from_address == "noreply@example.com"

# Validate content
assert email.text and "Thank you for signing up" in email.text
assert email.html and "<h1>Welcome</h1>" in email.html

# Validate links
verify_link = next((url for url in email.links if "/verify" in url), None)
assert verify_link is not None
assert verify_link.startswith("https://")
```

### Link Extraction and Testing

```python
import re
from urllib.parse import urlparse, parse_qs

email = await inbox.wait_for_email(
    WaitForEmailOptions(subject=re.compile(r"Reset"))
)

# Extract reset link
reset_link = next(
    (url for url in email.links if "reset-password" in url or "token=" in url),
    None
)
assert reset_link is not None

# Extract token from link
parsed = urlparse(reset_link)
token = parse_qs(parsed.query).get("token", [None])[0]

assert token is not None
assert len(token) > 20

# Test the link
import httpx
async with httpx.AsyncClient() as http:
    response = await http.get(reset_link)
    assert response.status_code == 200
```

### Multi-Part Emails

```python
# Email with both text and HTML
if email.text and email.html:
    # Validate both versions have key content
    assert "Welcome" in email.text
    assert "<h1>Welcome</h1>" in email.html

# HTML-only email
if email.html and not email.text:
    print("HTML-only email")
    assert "<!DOCTYPE html>" in email.html

# Plain text only
if email.text and not email.html:
    print("Plain text email")
```

### Time-Based Assertions

```python
from datetime import datetime, timezone

start_time = datetime.now(timezone.utc)

# Trigger email
await send_welcome_email(inbox.email_address)

# Wait and receive
email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

# Verify it arrived quickly
delivery_time = (email.received_at - start_time).total_seconds()
assert delivery_time < 5  # Within 5 seconds
```

### Email Metadata Analysis

```python
print("Email details:")
print(f"- From: {email.from_address}")
print(f"- Subject: {email.subject}")
print(f"- Received: {email.received_at.isoformat()}")
print(f"- Size: {len(email.text) if email.text else 0} chars")
print(f"- Links: {len(email.links)}")
print(f"- Attachments: {len(email.attachments)}")

# Check email authentication
auth = email.auth_results.validate()
print(f"- Auth passed: {auth.passed}")
if not auth.passed:
    print(f"- Auth failures: {auth.failures}")
```

## Testing Examples

### pytest Example

```python
import pytest
import re
from vaultsandbox import WaitForEmailOptions

@pytest.fixture
async def inbox(client):
    inbox = await client.create_inbox()
    yield inbox
    await inbox.delete()

@pytest.mark.asyncio
async def test_welcome_email_on_signup(inbox):
    await register_user(inbox.email_address)

    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            subject=re.compile(r"Welcome"),
            timeout=10000,
        )
    )

    assert email.from_address == "noreply@example.com"
    assert "Welcome" in email.subject
    assert email.text and "Thank you for signing up" in email.text

    verify_link = next((url for url in email.links if "/verify" in url), None)
    assert verify_link is not None

@pytest.mark.asyncio
async def test_includes_unsubscribe_link(inbox):
    await register_user(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    unsub_link = next(
        (url for url in email.links if "/unsubscribe" in url or "list-unsubscribe" in url),
        None
    )
    assert unsub_link is not None
```

### Password Reset Flow Test

```python
import pytest
import re
from urllib.parse import urlparse, parse_qs
from vaultsandbox import WaitForEmailOptions

@pytest.fixture
async def inbox(client):
    inbox = await client.create_inbox()
    yield inbox
    await inbox.delete()

@pytest.mark.asyncio
async def test_password_reset_with_valid_token(inbox):
    await request_password_reset(inbox.email_address)

    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            subject=re.compile(r"reset", re.IGNORECASE),
            timeout=10000,
        )
    )

    assert email.from_address == "security@example.com"

    reset_link = email.links[0] if email.links else None
    assert reset_link is not None
    assert reset_link.startswith("https://")
    assert "token=" in reset_link

    # Verify token format
    parsed = urlparse(reset_link)
    token = parse_qs(parsed.query).get("token", [None])[0]
    assert token is not None
    assert len(token) == 64
```

## Troubleshooting

### Email Content is None

```python
if not email.text and not email.html:
    print("Email has no content")
    print(f"Headers: {email.headers}")
    raw = await email.get_raw()
    print(f"Raw: {raw}")
```

### Links Not Extracted

```python
import re

if not email.links:
    print("No links found")
    print(f"Text: {email.text}")
    print(f"HTML: {email.html}")

    # Manually extract
    url_regex = re.compile(r"https?://[^\s]+")
    text_links = url_regex.findall(email.text or "")
    print(f"Manual extraction: {text_links}")
```

### Decryption Errors

```python
from vaultsandbox.errors import DecryptionError

try:
    email = await inbox.get_email(email_id)
except DecryptionError:
    print("Failed to decrypt email")
    print("This may indicate:")
    print("- Wrong private key")
    print("- Corrupted data")
    print("- Server issue")
```

## Next Steps

- **[Authentication Results](/client-python/concepts/auth-results/)** - Email authentication details
- **[Working with Attachments](/client-python/guides/attachments/)** - Handle email attachments
- **[Email Authentication](/client-python/guides/authentication/)** - Test SPF/DKIM/DMARC
- **[API Reference: Email](/client-python/api/email/)** - Complete API documentation
