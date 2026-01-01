---
title: Email API
description: Complete API reference for the Email class and related types
---

The `Email` class represents a decrypted email message in VaultSandbox. All emails are automatically decrypted when retrieved, so you can access content, headers, links, and attachments directly.

## Properties

### id

```python
id: str
```

Unique identifier for this email. Use this to reference the email in API calls.

#### Example

```python
emails = await inbox.list_emails()
print(f"Email ID: {emails[0].id}")

# Get specific email
email = await inbox.get_email(emails[0].id)
```

---

### from_address

```python
from_address: str
```

The sender's email address.

> **Note:** This property is named `from_address` instead of `from` because `from` is a reserved word in Python.

#### Example

```python
email = await inbox.wait_for_email()
print(f"From: {email.from_address}")

assert email.from_address == "noreply@example.com"
```

---

### to

```python
to: list[str]
```

List of recipient email addresses.

#### Example

```python
email = await inbox.wait_for_email()
print(f"To: {', '.join(email.to)}")

# Check if specific recipient is included
assert inbox.email_address in email.to
```

---

### subject

```python
subject: str
```

The email subject line.

#### Example

```python
import re
from vaultsandbox import WaitForEmailOptions

email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        subject=re.compile(r"Welcome"),
    )
)

print(f"Subject: {email.subject}")
assert "Welcome" in email.subject
```

---

### text

```python
text: str | None
```

Plain text content of the email. May be `None` if the email only has HTML content.

#### Example

```python
email = await inbox.wait_for_email()

if email.text:
    print("Plain text version:")
    print(email.text)

    # Validate content
    assert "Thank you for signing up" in email.text
```

---

### html

```python
html: str | None
```

HTML content of the email. May be `None` if the email only has plain text.

#### Example

```python
email = await inbox.wait_for_email()

if email.html:
    print("HTML version present")

    # Validate HTML structure
    assert "<a href=" in email.html
    assert "</html>" in email.html

    # Check for specific elements
    import re
    assert re.search(r'<img[^>]+src="', email.html)
```

---

### received_at

```python
received_at: datetime
```

The date and time when the email was received by VaultSandbox.

#### Example

```python
from datetime import datetime, timezone

email = await inbox.wait_for_email()
print(f"Received at: {email.received_at.isoformat()}")

# Check if email was received recently
now = datetime.now(timezone.utc)
age_in_seconds = (now - email.received_at).total_seconds()

assert age_in_seconds < 60  # Within last minute
```

---

### is_read

```python
is_read: bool
```

Whether this email has been marked as read.

#### Example

```python
email = await inbox.wait_for_email()
print(f"Read status: {email.is_read}")

# Mark as read
await email.mark_as_read()

# Verify status changed
updated = await inbox.get_email(email.id)
assert updated.is_read is True
```

---

### links

```python
links: list[str]
```

All URLs automatically extracted from the email content (both text and HTML).

#### Example

```python
import re
from urllib.parse import urlparse, parse_qs
from vaultsandbox import WaitForEmailOptions

email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        subject=re.compile(r"Password Reset"),
    )
)

print(f"Found {len(email.links)} links:")
for url in email.links:
    print(f"  - {url}")

# Find specific link
reset_link = next(
    (url for url in email.links if "/reset-password" in url),
    None
)
assert reset_link is not None
assert reset_link.startswith("https://")

# Extract query parameters
parsed = urlparse(reset_link)
params = parse_qs(parsed.query)
token = params.get("token", [None])[0]
assert token is not None
```

---

### headers

```python
headers: dict[str, str]
```

All email headers as a key-value dictionary.

#### Example

```python
email = await inbox.wait_for_email()

print("Headers:")
print(f"  Content-Type: {email.headers.get('content-type')}")
print(f"  Message-ID: {email.headers.get('message-id')}")

# Check for custom headers
if "x-custom-header" in email.headers:
    print(f"Custom header: {email.headers['x-custom-header']}")
```

---

### attachments

```python
attachments: list[Attachment]
```

List of email attachments, automatically decrypted and ready to use.

```python
@dataclass
class Attachment:
    filename: str
    content_type: str
    size: int
    content: bytes
    content_id: str | None = None
    content_disposition: str | None = None
    checksum: str | None = None
```

| Property             | Type          | Description                                  |
| -------------------- | ------------- | -------------------------------------------- |
| `filename`           | `str`         | Attachment filename                          |
| `content_type`       | `str`         | MIME content type                            |
| `size`               | `int`         | Attachment size in bytes                     |
| `content`            | `bytes`       | Attachment content as bytes                  |
| `content_id`         | `str \| None` | Content ID for inline attachments            |
| `content_disposition`| `str \| None` | Content disposition (attachment/inline)      |
| `checksum`           | `str \| None` | SHA-256 hash of the attachment content       |

#### Example

```python
import re
from vaultsandbox import WaitForEmailOptions

email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        subject=re.compile(r"Invoice"),
    )
)

print(f"Attachments: {len(email.attachments)}")

for attachment in email.attachments:
    print(f"  - {attachment.filename} ({attachment.size} bytes)")
    print(f"    Type: {attachment.content_type}")

# Find PDF attachment
pdf = next(
    (att for att in email.attachments if att.content_type == "application/pdf"),
    None
)
if pdf:
    with open(f"./downloads/{pdf.filename}", "wb") as f:
        f.write(pdf.content)
    print(f"Saved {pdf.filename}")

# Process text attachment
text_file = next(
    (att for att in email.attachments if "text" in att.content_type),
    None
)
if text_file:
    text = text_file.content.decode("utf-8")
    print("Text content:", text)

# Parse JSON attachment
json_file = next(
    (att for att in email.attachments if "json" in att.content_type),
    None
)
if json_file:
    import json
    data = json.loads(json_file.content.decode("utf-8"))
    print("JSON data:", data)
```

See the [Attachments Guide](/client-python/guides/attachments/) for more examples.

---

### auth_results

```python
auth_results: AuthResults
```

Email authentication results including SPF, DKIM, DMARC, and Reverse DNS validation.

```python
@dataclass
class AuthResults:
    spf: SPFResult | None = None
    dkim: list[DKIMResult] = field(default_factory=list)
    dmarc: DMARCResult | None = None
    reverse_dns: ReverseDNSResult | None = None

    def validate(self) -> AuthResultsValidation: ...
```

#### Example

```python
email = await inbox.wait_for_email()

# Validate all authentication
validation = email.auth_results.validate()
print(f"Authentication passed: {validation.passed}")

if not validation.passed:
    print("Failures:")
    for failure in validation.failures:
        print(f"  - {failure}")

# Check individual results
if email.auth_results.spf:
    print(f"SPF Result: {email.auth_results.spf.result.value}")

if email.auth_results.dkim:
    print(f"DKIM Result: {email.auth_results.dkim[0].result.value}")

if email.auth_results.dmarc:
    print(f"DMARC Result: {email.auth_results.dmarc.result.value}")
```

See the [Authentication Guide](/client-python/guides/authentication/) for more details.

---

### metadata

```python
metadata: dict[str, Any]
```

Raw decrypted metadata from `encryptedMetadata`.

#### Example

```python
email = await inbox.wait_for_email()

if email.metadata:
    print("Metadata:", email.metadata)
```

---

### parsed_metadata

```python
parsed_metadata: dict[str, Any]
```

Additional metadata from parsed content (from `encryptedParsed`).

#### Example

```python
email = await inbox.wait_for_email()

if email.parsed_metadata:
    print("Parsed metadata:", email.parsed_metadata)
```

## Methods

### mark_as_read()

Marks this email as read.

```python
async def mark_as_read(self) -> None
```

#### Example

```python
email = await inbox.wait_for_email()

print(f"Read status: {email.is_read}")  # False

await email.mark_as_read()
print("Marked as read")

# Verify status changed
updated = await inbox.get_email(email.id)
assert updated.is_read is True
```

---

### delete()

Deletes this email from the inbox.

```python
async def delete(self) -> None
```

#### Example

```python
email = await inbox.wait_for_email()

# Delete the email
await email.delete()
print("Email deleted")

# Verify deletion
emails = await inbox.list_emails()
assert not any(e.id == email.id for e in emails)
```

---

### get_raw()

Gets the raw MIME source of this email (decrypted).

```python
async def get_raw(self) -> RawEmail
```

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
email = await inbox.wait_for_email()
raw_email = await email.get_raw()

print(f"Email ID: {raw_email.id}")
print("Raw MIME source:")
print(raw_email.raw)

# Save to .eml file
with open(f"email-{raw_email.id}.eml", "w") as f:
    f.write(raw_email.raw)
```

## AuthResults

The `AuthResults` object provides email authentication validation.

### Properties

#### spf

```python
spf: SPFResult | None
```

SPF (Sender Policy Framework) validation result.

```python
@dataclass
class SPFResult:
    result: SPFStatus
    domain: str | None = None
    ip: str | None = None
    details: str | None = None

class SPFStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    SOFTFAIL = "softfail"
    NEUTRAL = "neutral"
    NONE = "none"
    TEMPERROR = "temperror"
    PERMERROR = "permerror"
```

#### dkim

```python
dkim: list[DKIMResult]
```

DKIM (DomainKeys Identified Mail) validation results. May have multiple signatures.

```python
@dataclass
class DKIMResult:
    result: DKIMStatus
    domain: str | None = None
    selector: str | None = None
    signature: str | None = None

class DKIMStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    NONE = "none"
```

#### dmarc

```python
dmarc: DMARCResult | None
```

DMARC (Domain-based Message Authentication) validation result.

```python
@dataclass
class DMARCResult:
    result: DMARCStatus
    policy: DMARCPolicy | None = None
    aligned: bool | None = None
    domain: str | None = None

class DMARCStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    NONE = "none"

class DMARCPolicy(str, Enum):
    NONE = "none"
    QUARANTINE = "quarantine"
    REJECT = "reject"
```

#### reverse_dns

```python
reverse_dns: ReverseDNSResult | None
```

Reverse DNS lookup result.

```python
@dataclass
class ReverseDNSResult:
    verified: bool
    ip: str | None = None
    hostname: str | None = None
```

### Methods

#### validate()

Validates all authentication results and returns a summary.

```python
def validate(self) -> AuthResultsValidation
```

##### Returns

```python
@dataclass
class AuthResultsValidation:
    passed: bool              # True if SPF, DKIM, and DMARC all passed
    spf_passed: bool          # Whether SPF check passed
    dkim_passed: bool         # Whether at least one DKIM signature passed
    dmarc_passed: bool        # Whether DMARC check passed
    reverse_dns_passed: bool  # Whether reverse DNS check passed
    failures: list[str] = field(default_factory=list)
```

> **Note:** The `passed` field reflects whether SPF, DKIM, and DMARC all passed. Reverse DNS is tracked separately but does not affect `passed`.

##### Example

```python
email = await inbox.wait_for_email()
validation = email.auth_results.validate()

print(f"Overall: {'PASS' if validation.passed else 'FAIL'}")

if not validation.passed:
    print("\nFailures:")
    for failure in validation.failures:
        print(f"  - {failure}")
```

## Complete Example

```python
import asyncio
import os
import re
from vaultsandbox import VaultSandboxClient, WaitForEmailOptions

async def complete_email_example():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        inbox = await client.create_inbox()
        print(f"Created inbox: {inbox.email_address}")

        # Trigger test email
        await send_test_email(inbox.email_address)

        # Wait for email
        email = await inbox.wait_for_email(
            WaitForEmailOptions(
                timeout=10000,
                subject=re.compile(r"Test"),
            )
        )

        # Basic info
        print("\n=== Email Details ===")
        print(f"ID: {email.id}")
        print(f"From: {email.from_address}")
        print(f"To: {', '.join(email.to)}")
        print(f"Subject: {email.subject}")
        print(f"Received: {email.received_at.isoformat()}")
        print(f"Read: {email.is_read}")

        # Content
        print("\n=== Content ===")
        if email.text:
            print("Plain text:")
            print(email.text[:200] + "...")
        if email.html:
            print("HTML version present")

        # Links
        print("\n=== Links ===")
        print(f"Found {len(email.links)} links:")
        for link in email.links:
            print(f"  - {link}")

        # Attachments
        print("\n=== Attachments ===")
        print(f"Found {len(email.attachments)} attachments:")
        for att in email.attachments:
            print(f"  - {att.filename} ({att.content_type}, {att.size} bytes)")

            # Save attachment
            with open(f"./downloads/{att.filename}", "wb") as f:
                f.write(att.content)
            print(f"    Saved to ./downloads/{att.filename}")

        # Authentication
        print("\n=== Authentication ===")
        validation = email.auth_results.validate()
        print(f"Overall: {'PASS' if validation.passed else 'FAIL'}")

        if email.auth_results.spf:
            print(f"SPF: {email.auth_results.spf.result.value}")
        if email.auth_results.dkim:
            print(f"DKIM: {email.auth_results.dkim[0].result.value}")
        if email.auth_results.dmarc:
            print(f"DMARC: {email.auth_results.dmarc.result.value}")

        if not validation.passed:
            print("Failures:", validation.failures)

        # Mark as read
        await email.mark_as_read()
        print("\nMarked as read")

        # Get raw source
        raw_email = await email.get_raw()
        with open(f"email-{raw_email.id}.eml", "w") as f:
            f.write(raw_email.raw)
        print(f"Saved raw source to email-{raw_email.id}.eml")

        # Clean up
        await inbox.delete()

asyncio.run(complete_email_example())
```

## Next Steps

- [Inbox API Reference](/client-python/api/inbox/) - Learn about inbox methods
- [Attachments Guide](/client-python/guides/attachments/) - Working with attachments
- [Authentication Guide](/client-python/guides/authentication/) - Email authentication testing
- [Waiting for Emails](/client-python/guides/waiting-for-emails/) - Best practices for email waiting
