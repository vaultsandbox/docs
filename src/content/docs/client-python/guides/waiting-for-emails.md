---
title: Waiting for Emails
description: Efficiently wait for and filter emails in your tests
---

VaultSandbox provides powerful methods for waiting for emails with filtering and timeout support.

## Basic Waiting

### Wait for Any Email

```python
from vaultsandbox import WaitForEmailOptions

email = await inbox.wait_for_email(
    WaitForEmailOptions(timeout=30000)  # 30 seconds
)

print(f"Received: {email.subject}")
```

### With Default Timeout

```python
# Uses default 30 second timeout
email = await inbox.wait_for_email()
```

## Filtering Options

### Filter by Subject

```python
import re
from vaultsandbox import WaitForEmailOptions

# Exact match
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        subject="Password Reset",
    )
)

# Regex match
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        subject=re.compile(r"reset", re.IGNORECASE),  # Case-insensitive
    )
)
```

### Filter by Sender

```python
import re
from vaultsandbox import WaitForEmailOptions

# Exact match
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        from_address="noreply@example.com",
    )
)

# Regex match
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        from_address=re.compile(r"@example\.com$"),  # Any @example.com address
    )
)
```

### Multiple Filters

```python
import re
from vaultsandbox import WaitForEmailOptions

email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        subject=re.compile(r"welcome", re.IGNORECASE),
        from_address="support@example.com",
    )
)
```

### Custom Predicate

```python
from vaultsandbox import WaitForEmailOptions

email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        predicate=lambda email: (
            "specific@example.com" in email.to
            and len(email.links) > 0
            and "Verify" in email.subject
        ),
    )
)
```

## Waiting for Multiple Emails

### Wait for Specific Count

```python
from vaultsandbox import WaitForCountOptions

# Trigger multiple emails
await send_notifications(inbox.email_address, 3)

# Wait for all 3 to arrive (with default 30 second timeout)
await inbox.wait_for_email_count(3)

# Or with custom timeout
await inbox.wait_for_email_count(3, WaitForCountOptions(timeout=60000))

# Now list all emails
emails = await inbox.list_emails()
assert len(emails) == 3
```

### Process as They Arrive

```python
from vaultsandbox import WaitForEmailOptions

async def wait_for_emails(inbox, count):
    emails = []

    for i in range(count):
        email = await inbox.wait_for_email(WaitForEmailOptions(timeout=30000))
        emails.append(email)
        print(f"Received {i + 1}/{count}: {email.subject}")

    return emails

# Usage
emails = await wait_for_emails(inbox, 3)
```

## Timeout Handling

### With Error Handling

```python
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.errors import TimeoutError

try:
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=5000))
    print(f"Email received: {email.subject}")
except TimeoutError:
    print("No email received within 5 seconds")
```

### With Fallback

```python
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.errors import TimeoutError

async def wait_for_email_with_fallback(inbox, options):
    try:
        return await inbox.wait_for_email(options)
    except TimeoutError:
        print("Timeout, checking if email arrived anyway")
        emails = await inbox.list_emails()
        if emails:
            return emails[-1]  # Return latest
        raise

# Usage
email = await wait_for_email_with_fallback(
    inbox,
    WaitForEmailOptions(timeout=10000)
)
```

### Retry Pattern

```python
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.errors import TimeoutError

async def wait_with_retry(inbox, options, max_retries=3):
    for i in range(max_retries):
        try:
            return await inbox.wait_for_email(options)
        except TimeoutError:
            if i < max_retries - 1:
                print(f"Attempt {i + 1} failed, retrying...")
                continue
            raise

# Usage
email = await wait_with_retry(
    inbox,
    WaitForEmailOptions(timeout=5000, subject="Test"),
    max_retries=3
)
```

## Polling Configuration

### Custom Poll Interval

```python
from vaultsandbox import WaitForEmailOptions

# Poll every 500ms (more responsive)
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        poll_interval=500,
    )
)

# Poll every 5 seconds (less frequent)
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=60000,
        poll_interval=5000,
    )
)
```

### Efficient Polling

```python
from vaultsandbox import WaitForEmailOptions

# For quick tests - poll frequently
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=5000,
        poll_interval=200,  # Check 5 times per second
    )
)

# For slow email services - poll less frequently
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=120000,  # 2 minutes
        poll_interval=10000,  # Check every 10 seconds
    )
)
```

## Real-World Examples

### Password Reset Flow

```python
import pytest
import re
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_password_reset_email(inbox):
    # Trigger reset
    await app.request_password_reset(inbox.email_address)

    # Wait for reset email
    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject=re.compile(r"reset", re.IGNORECASE),
            from_address="security@example.com",
        )
    )

    # Validate content
    assert "Password Reset" in email.subject
    assert len(email.links) > 0

    # Extract and test link
    reset_link = next(
        (url for url in email.links if "/reset" in url),
        None
    )
    assert reset_link is not None
```

### Welcome Email with Verification

```python
import pytest
import re
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_welcome_email_with_verification_link(inbox):
    # Sign up
    await app.signup(
        email=inbox.email_address,
        name="Test User",
    )

    # Wait for welcome email
    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject=re.compile(r"welcome", re.IGNORECASE),
            predicate=lambda e: any("/verify" in link for link in e.links),
        )
    )

    # Extract verification link
    verify_link = next(
        (url for url in email.links if "/verify" in url),
        None
    )

    # Test verification
    import httpx
    async with httpx.AsyncClient() as http:
        response = await http.get(verify_link)
        assert response.is_success
```

### Multi-Step Email Flow

```python
import pytest
import re
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_order_confirmation_and_shipping_notification(inbox):
    # Place order
    order_id = await app.place_order(
        email=inbox.email_address,
        items=["widget"],
    )

    # Wait for confirmation
    confirmation = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject=re.compile(r"order.*confirmed", re.IGNORECASE),
        )
    )

    assert "Order Confirmed" in confirmation.subject
    assert "Order #" in confirmation.text

    # Simulate shipping
    await app.ship_order(order_id)

    # Wait for shipping notification
    shipping = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject=re.compile(r"shipped", re.IGNORECASE),
        )
    )

    assert "Shipped" in shipping.subject
    assert "tracking" in shipping.text.lower()
```

### Email with Attachments

```python
import pytest
import re
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_invoice_email_with_pdf_attachment(inbox):
    await app.send_invoice(inbox.email_address)

    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject=re.compile(r"invoice", re.IGNORECASE),
            predicate=lambda e: len(e.attachments) > 0,
        )
    )

    # Validate attachment
    pdf = next(
        (att for att in email.attachments if att.content_type == "application/pdf"),
        None
    )

    assert pdf is not None
    assert re.match(r"invoice.*\.pdf", pdf.filename, re.IGNORECASE)
    assert pdf.size > 0
```

## Advanced Patterns

### Wait for First Matching Email

```python
import asyncio
from vaultsandbox.errors import TimeoutError

async def wait_for_first_match(inbox, matchers, timeout=30000):
    start_time = asyncio.get_event_loop().time()

    while (asyncio.get_event_loop().time() - start_time) * 1000 < timeout:
        emails = await inbox.list_emails()

        for matcher in matchers:
            match = next((e for e in emails if matcher(e)), None)
            if match:
                return match

        await asyncio.sleep(1)

    raise TimeoutError("No matching email found")

# Usage
email = await wait_for_first_match(
    inbox,
    [
        lambda e: "Welcome" in e.subject,
        lambda e: "Verify" in e.subject,
        lambda e: e.from_address == "support@example.com",
    ],
    timeout=10000
)
```

### Wait with Progress Callback

```python
import asyncio
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.errors import TimeoutError

async def wait_with_progress(inbox, options, on_progress):
    start_time = asyncio.get_event_loop().time()
    attempts = 0

    while True:
        attempts += 1
        elapsed = int((asyncio.get_event_loop().time() - start_time) * 1000)

        if elapsed >= options.timeout:
            on_progress({"attempts": attempts, "elapsed": elapsed, "timed_out": True})
            raise TimeoutError("Timeout waiting for email")

        emails = await inbox.list_emails()
        for email in emails:
            if options.predicate and options.predicate(email):
                return email
            if not options.predicate:
                return email

        on_progress({"attempts": attempts, "elapsed": elapsed, "timed_out": False})
        await asyncio.sleep(options.poll_interval / 1000 if options.poll_interval else 1)

# Usage
def progress_callback(progress):
    print(f"Attempt {progress['attempts']}, {progress['elapsed']}ms elapsed")

email = await wait_with_progress(
    inbox,
    WaitForEmailOptions(timeout=10000, poll_interval=1000),
    progress_callback
)
```

### Conditional Waiting

```python
import re
from vaultsandbox import WaitForEmailOptions

async def wait_conditionally(inbox, options):
    # First check if email already exists
    existing = await inbox.list_emails()

    if options.subject:
        pattern = options.subject if isinstance(options.subject, re.Pattern) else re.compile(re.escape(options.subject))
        match = next((e for e in existing if pattern.search(e.subject)), None)
        if match:
            print("Email already present")
            return match

    # Wait for new email
    print("Waiting for email...")
    return await inbox.wait_for_email(options)
```

## Testing Patterns

### Flake-Free Tests

```python
import pytest
from vaultsandbox import WaitForEmailOptions

# Good: Use wait_for_email, not sleep
@pytest.mark.asyncio
async def test_receives_email(inbox):
    await send_email(inbox.email_address)
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    assert email is not None

# Bad: Arbitrary sleep causes flakiness
# @pytest.mark.asyncio
# async def test_receives_email_bad(inbox):
#     await send_email(inbox.email_address)
#     await asyncio.sleep(5)  # May not be enough, or wastes time
#     emails = await inbox.list_emails()
#     assert len(emails) == 1
```

### Fast Tests

```python
from vaultsandbox import WaitForEmailOptions

# Good: Short timeout for fast-sending systems
email = await inbox.wait_for_email(WaitForEmailOptions(timeout=2000))

# Avoid: Unnecessarily long timeout slows tests
# email = await inbox.wait_for_email(WaitForEmailOptions(timeout=60000))
```

### Parallel Email Tests

```python
import pytest
import asyncio
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_multiple_users_receive_emails(client):
    inbox1 = await client.create_inbox()
    inbox2 = await client.create_inbox()

    try:
        # Send emails
        await asyncio.gather(
            send_welcome(inbox1.email_address),
            send_welcome(inbox2.email_address),
        )

        # Wait in parallel
        email1, email2 = await asyncio.gather(
            inbox1.wait_for_email(WaitForEmailOptions(timeout=10000)),
            inbox2.wait_for_email(WaitForEmailOptions(timeout=10000)),
        )

        assert "Welcome" in email1.subject
        assert "Welcome" in email2.subject

    finally:
        await asyncio.gather(inbox1.delete(), inbox2.delete())
```

## Troubleshooting

### Email Not Arriving

```python
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.errors import TimeoutError
import re

# Add debug logging
try:
    print("Waiting for email...")
    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject=re.compile(r"test", re.IGNORECASE),
        )
    )
    print(f"Received: {email.subject}")
except TimeoutError:
    print("Timeout! Checking inbox manually:")
    emails = await inbox.list_emails()
    print(f"Found {len(emails)} emails:")
    for e in emails:
        print(f"  - {e.subject}")
    raise
```

### Filter Not Matching

```python
from vaultsandbox import WaitForEmailOptions

# Log filter mismatches
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        predicate=lambda e: (
            (matches := "Test" in e.subject)
            or print(f"Subject \"{e.subject}\" doesn't match")
            or matches
        ),
    )
)
```

Or with a helper function:

```python
from vaultsandbox import WaitForEmailOptions

def debug_predicate(email):
    matches = "Test" in email.subject
    if not matches:
        print(f"Subject \"{email.subject}\" doesn't match")
    return matches

email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        predicate=debug_predicate,
    )
)
```

## Next Steps

- **[Managing Inboxes](/client-python/guides/managing-inboxes/)** - Learn inbox operations
- **[Real-time Monitoring](/client-python/guides/real-time/)** - Subscribe to emails as they arrive
- **[Testing Patterns](/client-python/testing/password-reset/)** - Real-world testing examples
- **[API Reference: Inbox](/client-python/api/inbox/)** - Complete API documentation
