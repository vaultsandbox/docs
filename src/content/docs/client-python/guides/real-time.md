---
title: Real-time Monitoring
description: Subscribe to emails as they arrive using Server-Sent Events
---

VaultSandbox supports real-time email notifications via Server-Sent Events (SSE), enabling instant processing of emails as they arrive.

## Basic Subscription

### Subscribe to Single Inbox

```python
inbox = await client.create_inbox()

print(f"Monitoring: {inbox.email_address}")

def handle_email(email):
    print(f"New email: {email.subject}")
    print(f"   From: {email.from_address}")
    print(f"   Received: {email.received_at}")

unsubscribe = inbox.on_new_email(handle_email)

# Later, stop monitoring
# unsubscribe()
```

### Subscribe with Processing

```python
async def handle_email(email):
    print(f"Processing: {email.subject}")

    # Extract links
    if email.links:
        print(f"Links found: {email.links}")

    # Check authentication
    auth = email.auth_results.validate()
    if not auth.passed:
        print(f"Authentication failed: {auth.failures}")

    # Mark as processed
    await email.mark_as_read()

unsubscribe = inbox.on_new_email(handle_email)
```

## Monitoring Multiple Inboxes

### Using InboxMonitor

```python
inbox1 = await client.create_inbox()
inbox2 = await client.create_inbox()
inbox3 = await client.create_inbox()

monitor = client.monitor_inboxes([inbox1, inbox2, inbox3])

def handle_email(inbox, email):
    print(f"Email in {inbox.email_address}")
    print(f"   Subject: {email.subject}")
    print(f"   From: {email.from_address}")

monitor.on("email", handle_email)

# Later, stop monitoring all
# monitor.unsubscribe()
```

### Monitoring with Handlers

```python
monitor = client.monitor_inboxes([inbox1, inbox2])

async def handle_email(inbox, email):
    if email.from_address == "alerts@example.com":
        await handle_alert(email)
    elif "Invoice" in email.subject:
        await handle_invoice(inbox, email)
    else:
        print(f"Other email: {email.subject}")

monitor.on("email", handle_email)
```

## Unsubscribing

### Unsubscribe from Single Inbox

```python
def handle_email(email):
    print(f"Email: {email.subject}")

unsubscribe = inbox.on_new_email(handle_email)

# Unsubscribe when done
unsubscribe()
```

### Conditional Unsubscribe

```python
unsubscribe = None

def handle_email(email):
    print(f"Email: {email.subject}")

    # Unsubscribe after receiving welcome email
    if "Welcome" in email.subject:
        unsubscribe()

unsubscribe = inbox.on_new_email(handle_email)
```

### Unsubscribe from Monitor

```python
monitor = client.monitor_inboxes([inbox1, inbox2])

def handle_email(inbox, email):
    print(f"Email: {email.subject}")

monitor.on("email", handle_email)

# Unsubscribe from all inboxes
monitor.unsubscribe()
```

## Real-World Patterns

### Wait for Specific Email

```python
import asyncio
from vaultsandbox.errors import TimeoutError

async def wait_for_specific_email(inbox, predicate, timeout=30000):
    future = asyncio.get_event_loop().create_future()
    timer_handle = None

    def on_timeout():
        if not future.done():
            unsubscribe()
            future.set_exception(TimeoutError("Timeout waiting for email"))

    def on_email(email):
        nonlocal timer_handle
        if predicate(email):
            if timer_handle:
                timer_handle.cancel()
            unsubscribe()
            if not future.done():
                future.set_result(email)

    unsubscribe = inbox.on_new_email(on_email)

    timer_handle = asyncio.get_event_loop().call_later(
        timeout / 1000,
        on_timeout
    )

    return await future

# Usage
email = await wait_for_specific_email(
    inbox,
    lambda e: "Password Reset" in e.subject,
    timeout=10000
)
```

### Collect Multiple Emails

```python
import asyncio
from vaultsandbox.errors import TimeoutError

async def collect_emails(inbox, count, timeout=30000):
    emails = []
    future = asyncio.get_event_loop().create_future()
    timer_handle = None

    def on_timeout():
        if not future.done():
            unsubscribe()
            future.set_exception(
                TimeoutError(f"Timeout: only received {len(emails)}/{count}")
            )

    def on_email(email):
        nonlocal timer_handle
        emails.append(email)
        print(f"Received {len(emails)}/{count}")

        if len(emails) >= count:
            if timer_handle:
                timer_handle.cancel()
            unsubscribe()
            if not future.done():
                future.set_result(emails)

    unsubscribe = inbox.on_new_email(on_email)

    timer_handle = asyncio.get_event_loop().call_later(
        timeout / 1000,
        on_timeout
    )

    return await future

# Usage
emails = await collect_emails(inbox, 3, timeout=20000)
```

### Process Email Pipeline

```python
async def process_email_pipeline(inbox):
    async def handle_email(email):
        try:
            print(f"Processing: {email.subject}")

            # Step 1: Validate
            auth = email.auth_results.validate()
            if not auth.passed:
                print(f"Failed auth: {auth.failures}")
                return

            # Step 2: Extract data
            links = email.links
            attachments = email.attachments

            # Step 3: Store/process
            await store_email(email)

            # Step 4: Notify
            await notify_processed(email.id)

            # Step 5: Cleanup
            await email.delete()

            print(f"Processed: {email.subject}")

        except Exception as e:
            print(f"Error processing: {e}")

    unsubscribe = inbox.on_new_email(handle_email)
    return unsubscribe

# Usage
unsubscribe = await process_email_pipeline(inbox)
# Later: unsubscribe()
```

## Testing with Real-Time Monitoring

### Integration Test

```python
import pytest
import asyncio

@pytest.mark.asyncio
async def test_real_time_email_processing(client):
    inbox = await client.create_inbox()
    received = []

    def handle_email(email):
        received.append(email)

    unsubscribe = inbox.on_new_email(handle_email)

    try:
        # Send test emails
        await send_email(inbox.email_address, "Test 1")
        await send_email(inbox.email_address, "Test 2")

        # Wait for emails to arrive
        await asyncio.sleep(5)

        assert len(received) == 2
        assert received[0].subject == "Test 1"
        assert received[1].subject == "Test 2"

    finally:
        unsubscribe()
        await inbox.delete()
```

### Async Processing Test

```python
import pytest
import asyncio

@pytest.mark.asyncio
async def test_processes_emails_asynchronously(client):
    inbox = await client.create_inbox()
    processed = []

    async def handle_email(email):
        await process_email(email)
        processed.append(email.id)

    unsubscribe = inbox.on_new_email(handle_email)

    try:
        await send_email(inbox.email_address, "Test")

        # Wait for processing
        for _ in range(100):  # 10 seconds max
            if len(processed) > 0:
                break
            await asyncio.sleep(0.1)

        assert len(processed) == 1

    finally:
        unsubscribe()
        await inbox.delete()
```

## Error Handling

### Handle Subscription Errors

```python
def handle_email(email):
    try:
        process_email(email)
    except Exception as e:
        print(f"Error processing email: {e}")
        # Don't re-raise - keeps subscription active

unsubscribe = inbox.on_new_email(handle_email)
```

### Reconnection Handling

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

# The SDK automatically reconnects on connection loss
# Configure reconnection behavior in client options

async with VaultSandboxClient(
    base_url=url,
    api_key=api_key,
    strategy=DeliveryStrategyType.SSE,
    sse_reconnect_interval=5000,  # Reconnect after 5s
    sse_max_reconnect_attempts=10,  # Try 10 times
) as client:
    inbox = await client.create_inbox()
    # ...
```

### Graceful Shutdown

```python
import asyncio

async def graceful_shutdown(subscriptions, client):
    print("Shutting down...")

    # Unsubscribe from all
    for unsub in subscriptions:
        unsub()

    # Wait for pending operations
    await asyncio.sleep(1)

    print("Shutdown complete")

# Usage
subscriptions = [unsubscribe1, unsubscribe2]
await graceful_shutdown(subscriptions, client)
```

## SSE vs Polling

### SSE (Default)

SSE is the default strategy and provides instant notification of new emails:

- Real-time push notifications
- Processing emails as they arrive
- Building real-time dashboards
- Minimal latency

```python
from vaultsandbox import VaultSandboxClient

# SSE is used by default
async with VaultSandboxClient(
    base_url=url,
    api_key=api_key,
) as client:
    # ...
```

### When to Use Polling

Use polling when:

- SSE is blocked by firewall/proxy
- Running in CI/CD environments
- Running in environments that don't support persistent connections

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async with VaultSandboxClient(
    base_url=url,
    api_key=api_key,
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=2000,  # Poll every 2 seconds
) as client:
    # ...
```

## Advanced Patterns

### Rate-Limited Processing

```python
import asyncio
from collections import deque

class RateLimitedProcessor:
    def __init__(self, inbox, rate_limit_ms=1000):
        self.queue = deque()
        self.processing = False
        self.rate_limit_ms = rate_limit_ms
        self.unsubscribe = inbox.on_new_email(self._on_email)

    def _on_email(self, email):
        self.queue.append(email)
        asyncio.create_task(self._process_queue())

    async def _process_queue(self):
        if self.processing or not self.queue:
            return

        self.processing = True

        while self.queue:
            email = self.queue.popleft()
            await self._process_email(email)
            await asyncio.sleep(self.rate_limit_ms / 1000)

        self.processing = False

    async def _process_email(self, email):
        print(f"Processing: {email.subject}")
        # Process email...

    def stop(self):
        self.unsubscribe()

# Usage
processor = RateLimitedProcessor(inbox, rate_limit_ms=1000)
# Later: processor.stop()
```

### Priority Processing

```python
def get_priority(email):
    if "URGENT" in email.subject:
        return "high"
    if email.from_address == "alerts@example.com":
        return "high"
    if email.attachments:
        return "medium"
    return "low"

async def handle_email(email):
    priority = get_priority(email)

    if priority == "high":
        await process_immediately(email)
    elif priority == "medium":
        await queue_for_processing(email)
    else:
        await log_and_discard(email)

unsubscribe = inbox.on_new_email(handle_email)
```

### Distributed Processing

```python
import itertools

monitor = client.monitor_inboxes([inbox1, inbox2, inbox3])

workers = [create_worker("worker-1"), create_worker("worker-2"), create_worker("worker-3")]
worker_cycle = itertools.cycle(workers)

def handle_email(inbox, email):
    worker = next(worker_cycle)
    worker.process(email)

monitor.on("email", handle_email)
```

## Cleanup

### Proper Cleanup in Tests

```python
import pytest

class TestEmailMonitoring:
    @pytest.fixture
    async def setup(self, client):
        inbox = await client.create_inbox()
        unsubscribe = None

        yield {
            "inbox": inbox,
            "set_unsubscribe": lambda fn: setattr(self, "_unsubscribe", fn),
        }

        if hasattr(self, "_unsubscribe") and self._unsubscribe:
            self._unsubscribe()
        await inbox.delete()

    @pytest.mark.asyncio
    async def test_monitors_emails(self, setup):
        inbox = setup["inbox"]

        def handle_email(email):
            print(f"Email: {email.subject}")

        unsubscribe = inbox.on_new_email(handle_email)
        setup["set_unsubscribe"](unsubscribe)

        # Test code...
```

Or with a simpler approach:

```python
import pytest

@pytest.fixture
async def monitored_inbox(client):
    inbox = await client.create_inbox()
    subscriptions = []

    class MonitoredInbox:
        def __init__(self):
            self.inbox = inbox

        def on_new_email(self, callback):
            unsub = inbox.on_new_email(callback)
            subscriptions.append(unsub)
            return unsub

    yield MonitoredInbox()

    # Cleanup
    for unsub in subscriptions:
        unsub()
    await inbox.delete()

@pytest.mark.asyncio
async def test_monitors_emails(monitored_inbox):
    received = []

    monitored_inbox.on_new_email(lambda e: received.append(e))

    # Test code...
```

## Next Steps

- **[Waiting for Emails](/client-python/guides/waiting-for-emails/)** - Alternative polling-based approach
- **[Managing Inboxes](/client-python/guides/managing-inboxes/)** - Inbox operations
- **[Delivery Strategies](/client-python/advanced/strategies/)** - SSE vs Polling deep dive
- **[Configuration](/client-python/configuration/)** - Configure SSE behavior
