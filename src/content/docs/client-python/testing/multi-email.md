---
title: Testing Multi-Email Scenarios
description: Learn how to test scenarios involving multiple emails with VaultSandbox and pytest
---

Many real-world email flows involve sending multiple emails in sequence or in parallel. VaultSandbox provides efficient methods for testing these scenarios without using arbitrary timeouts.

## Waiting for Multiple Emails

The `wait_for_email_count()` method is the recommended way to test scenarios that send multiple emails. It's more efficient and reliable than using arbitrary timeouts.

### Basic Example

```python
import os
from vaultsandbox import VaultSandboxClient, WaitForEmailOptions

async def test_multiple_notifications():
    async with VaultSandboxClient(
        base_url=os.environ["VAULTSANDBOX_URL"],
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        inbox = await client.create_inbox()

        # Send multiple emails
        await send_notifications(inbox.email_address, 3)

        # Wait for all 3 emails to arrive
        await inbox.wait_for_email_count(3, timeout=30000)

        # Now list and verify all emails
        emails = await inbox.list_emails()
        assert len(emails) == 3
        assert "Notification" in emails[0].subject

        await inbox.delete()
```

## Testing Email Sequences

Test workflows that send emails in a specific sequence:

```python
import pytest
from vaultsandbox import VaultSandboxClient, WaitForEmailOptions

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


class TestWelcomeEmailSequence:
    @pytest.mark.asyncio
    async def test_sends_complete_onboarding_sequence(self, inbox):
        # Trigger user registration
        await register_user(inbox.email_address)

        # Wait for all 4 onboarding emails
        await inbox.wait_for_email_count(4, timeout=30000)

        emails = await inbox.list_emails()

        # Sort by received time to verify sequence order
        emails.sort(key=lambda e: e.received_at)

        # Verify sequence order and content
        assert "Welcome" in emails[0].subject
        assert "Getting Started" in emails[1].subject
        assert "Tips and Tricks" in emails[2].subject
        assert "Here to Help" in emails[3].subject

        # Verify timing between emails
        time1 = emails[0].received_at.timestamp()
        time2 = emails[1].received_at.timestamp()
        time_diff = time2 - time1

        # Emails should be spaced at least 1 second apart
        assert time_diff > 1.0
```

## Testing Batch Notifications

Test scenarios where multiple similar emails are sent at once:

```python
@pytest.mark.asyncio
async def test_receives_batch_of_order_confirmation_emails(inbox):
    order_ids = ["ORD-001", "ORD-002", "ORD-003"]

    # Place multiple orders
    for order_id in order_ids:
        await place_order(inbox.email_address, order_id)

    # Wait for all confirmations
    await inbox.wait_for_email_count(3, timeout=30000)

    emails = await inbox.list_emails()

    # Verify each order has a confirmation
    for order_id in order_ids:
        confirmation = next(
            (email for email in emails if order_id in email.text),
            None
        )
        assert confirmation is not None
        assert "Order Confirmation" in confirmation.subject
```

## Testing Email Timing

Validate that emails arrive within expected time windows:

```python
import time

@pytest.mark.asyncio
async def test_sends_emails_at_correct_intervals(inbox):
    start_time = time.time()

    # Trigger time-based email sequence
    await start_trial_period(inbox.email_address)

    # Wait for initial email immediately
    welcome = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject="Welcome to your trial",
        )
    )

    assert time.time() - start_time < 5.0

    # Wait for reminder email (should come after delay)
    await inbox.wait_for_email_count(2, timeout=60000)

    emails = await inbox.list_emails()
    reminder = next(
        (email for email in emails if "Trial Reminder" in email.subject),
        None
    )

    time_between = (
        reminder.received_at.timestamp() - welcome.received_at.timestamp()
    )

    # Reminder should come at least 30 seconds after welcome
    assert time_between > 30.0
```

## Processing Emails as They Arrive

For scenarios where you need to process emails immediately as they arrive, use `on_new_email()`:

```python
@pytest.mark.asyncio
async def test_processes_notifications_in_real_time(client, inbox):
    received_subjects = []

    # Subscribe to new emails
    def on_email(inbox, email):
        received_subjects.append(email.subject)
        print(f"Received: {email.subject}")

    unsubscribe = inbox.on_new_email(on_email)

    try:
        # Trigger multiple notifications
        await send_multiple_notifications(inbox.email_address, 5)

        # Wait for all emails to arrive
        await inbox.wait_for_email_count(5, timeout=30000)

        # Verify all were processed
        assert len(received_subjects) == 5
        for subject in received_subjects:
            assert "Notification" in subject

    finally:
        # Cleanup subscription
        unsubscribe()
```

## Testing Parallel Email Flows

Test scenarios where different email types are triggered simultaneously:

```python
import asyncio

@pytest.mark.asyncio
async def test_handles_multiple_concurrent_email_types(inbox):
    # Trigger different email flows simultaneously
    await asyncio.gather(
        send_welcome_email(inbox.email_address),
        send_order_confirmation(inbox.email_address, "ORD-123"),
        send_newsletter_subscription(inbox.email_address),
    )

    # Wait for all 3 emails
    await inbox.wait_for_email_count(3, timeout=30000)

    emails = await inbox.list_emails()

    # Verify all email types arrived
    welcome = next((e for e in emails if "Welcome" in e.subject), None)
    order = next((e for e in emails if "Order" in e.subject), None)
    newsletter = next((e for e in emails if "Newsletter" in e.subject), None)

    assert welcome is not None
    assert order is not None
    assert newsletter is not None
```

## Filtering and Validating Multiple Emails

Use list comprehensions and Python's collection methods to validate email collections:

```python
@pytest.mark.asyncio
async def test_validates_all_notification_emails(inbox):
    await send_bulk_notifications(inbox.email_address, 10)

    await inbox.wait_for_email_count(10, timeout=30000)

    emails = await inbox.list_emails()

    # All should be from the same sender
    unique_senders = set(e.from_address for e in emails)
    assert len(unique_senders) == 1
    assert "notifications@example.com" in unique_senders

    # All should have valid authentication
    for email in emails:
        validation = email.auth_results.validate()
        assert validation is not None

    # All should have links
    emails_with_links = [e for e in emails if len(e.links) > 0]
    assert len(emails_with_links) == 10

    # Check that all emails are unique
    subjects = [e.subject for e in emails]
    unique_subjects = set(subjects)
    assert len(unique_subjects) == 10
```

## Testing with Multiple Inboxes

Test scenarios involving multiple recipients:

```python
import asyncio

@pytest.mark.asyncio
async def test_sends_emails_to_multiple_recipients(client):
    # Create multiple inboxes
    inbox1 = await client.create_inbox()
    inbox2 = await client.create_inbox()
    inbox3 = await client.create_inbox()

    try:
        # Send announcement to all
        await send_announcement([
            inbox1.email_address,
            inbox2.email_address,
            inbox3.email_address,
        ])

        # Wait for emails in all inboxes
        email1, email2, email3 = await asyncio.gather(
            inbox1.wait_for_email(
                WaitForEmailOptions(timeout=10000, subject="Announcement")
            ),
            inbox2.wait_for_email(
                WaitForEmailOptions(timeout=10000, subject="Announcement")
            ),
            inbox3.wait_for_email(
                WaitForEmailOptions(timeout=10000, subject="Announcement")
            ),
        )

        # Verify all received the same content
        assert email1.subject == email2.subject
        assert email2.subject == email3.subject
        assert email1.text == email2.text

    finally:
        # Cleanup all inboxes
        await asyncio.gather(
            inbox1.delete(),
            inbox2.delete(),
            inbox3.delete(),
        )
```

## Monitoring Multiple Inboxes

Use `monitor_inboxes()` to watch multiple inboxes simultaneously:

```python
import asyncio

@pytest.mark.asyncio
async def test_monitors_multiple_inboxes_for_new_emails(client):
    inbox1 = await client.create_inbox()
    inbox2 = await client.create_inbox()

    received_emails = []

    # Monitor both inboxes
    monitor = client.monitor_inboxes([inbox1, inbox2])

    def on_email(inbox, email):
        received_emails.append({
            "inbox_address": inbox.email_address,
            "subject": email.subject,
        })

    monitor.on_email(on_email)
    await monitor.start()

    try:
        # Give monitor time to establish connection
        await asyncio.sleep(1)

        # Send emails to both inboxes
        await send_email(inbox1.email_address, "Test 1")
        await send_email(inbox2.email_address, "Test 2")

        # Wait for both emails
        await asyncio.gather(
            inbox1.wait_for_email_count(1, timeout=10000),
            inbox2.wait_for_email_count(1, timeout=10000),
        )

        # Give the monitor a moment to process
        await asyncio.sleep(1)

        assert len(received_emails) == 2
        assert received_emails[0]["inbox_address"] == inbox1.email_address
        assert received_emails[1]["inbox_address"] == inbox2.email_address

    finally:
        await monitor.unsubscribe()
        await asyncio.gather(inbox1.delete(), inbox2.delete())
```

## Best Practices

### Use wait_for_email_count() for Known Quantities

When you know exactly how many emails to expect, always use `wait_for_email_count()`:

```python
# Good: Efficient and reliable
await inbox.wait_for_email_count(3, timeout=30000)

# Avoid: Arbitrary timeout with polling
await asyncio.sleep(10)
emails = await inbox.list_emails()
```

### Set Appropriate Timeouts

Calculate timeouts based on expected email count and delivery speed:

```python
# For fast local testing
await inbox.wait_for_email_count(5, timeout=10000)  # 2s per email

# For CI/CD or production gateways
await inbox.wait_for_email_count(5, timeout=30000)  # 6s per email

# For very large batches
await inbox.wait_for_email_count(100, timeout=120000)  # 1.2s per email
```

### Verify Email Ordering When Important

If order matters, explicitly check timestamps:

```python
emails = await inbox.list_emails()

# Sort by received time
emails.sort(key=lambda e: e.received_at)

# Verify first email came before second
assert emails[0].received_at < emails[1].received_at
```

### Clean Up Multiple Inboxes

Use `asyncio.gather()` to clean up multiple inboxes efficiently:

```python
@pytest.fixture
async def inboxes(client):
    inboxes = [
        await client.create_inbox(),
        await client.create_inbox(),
        await client.create_inbox(),
    ]
    yield inboxes
    await asyncio.gather(*[inbox.delete() for inbox in inboxes])
```

### Use Descriptive Test Names

Make it clear what email scenario you're testing:

```python
# Good: Clear what's being tested
@pytest.mark.asyncio
async def test_sends_3_order_confirmation_emails_in_sequence(inbox):
    pass

# Avoid: Vague description
@pytest.mark.asyncio
async def test_works_with_multiple_emails(inbox):
    pass
```

## Performance Considerations

### Polling Interval

Adjust the polling interval based on expected email volume:

```python
from vaultsandbox import WaitForEmailOptions

# Default polling
await inbox.wait_for_email_count(10, timeout=30000)

# Faster polling for time-sensitive tests
await inbox.wait_for_email_count(
    10,
    WaitForEmailOptions(
        timeout=30000,
        poll_interval=500,  # Poll every 500ms
    )
)

# Slower polling for large batches
await inbox.wait_for_email_count(
    100,
    WaitForEmailOptions(
        timeout=120000,
        poll_interval=5000,  # Poll every 5 seconds
    )
)
```

### Batch Operations

Fetch all emails once rather than making multiple API calls:

```python
# Good: Single API call
emails = await inbox.list_emails()
welcome = next((e for e in emails if "Welcome" in e.subject), None)
confirmation = next((e for e in emails if "Confirmation" in e.subject), None)

# Avoid: Multiple API calls
email1 = await inbox.get_email(id1)
email2 = await inbox.get_email(id2)
email3 = await inbox.get_email(id3)
```

## Next Steps

- [CI/CD Integration](/client-python/testing/cicd/) - Run multi-email tests in CI
- [Real-time Monitoring](/client-python/guides/real-time/) - Process emails as they arrive
- [Managing Inboxes](/client-python/guides/managing-inboxes/) - Learn more about inbox operations
