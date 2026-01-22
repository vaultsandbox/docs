---
title: Chaos Engineering
description: Test email resilience by simulating SMTP failures and network issues
---

Chaos engineering allows you to simulate various SMTP failure scenarios and network issues during email testing. This helps verify your application handles email delivery failures gracefully.

## Prerequisites

Chaos features must be enabled on the gateway server. Check availability:

```python
import os
from vaultsandbox import VaultSandboxClient

async with VaultSandboxClient(
    base_url=os.environ["VAULTSANDBOX_URL"],
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
) as client:
    server_info = await client.get_server_info()

    if server_info.chaos_enabled:
        print("Chaos features available")
    else:
        print("Chaos features disabled on this server")
```

## Enabling Chaos

### During Inbox Creation

```python
from vaultsandbox import CreateInboxOptions, ChaosConfig, LatencyConfig

inbox = await client.create_inbox(
    CreateInboxOptions(
        chaos=ChaosConfig(
            enabled=True,
            latency=LatencyConfig(
                enabled=True,
                min_delay_ms=1000,
                max_delay_ms=5000,
            ),
        ),
    )
)
```

### After Inbox Creation

```python
from vaultsandbox import LatencyConfig

chaos = await inbox.set_chaos(
    enabled=True,
    latency=LatencyConfig(
        enabled=True,
        min_delay_ms=1000,
        max_delay_ms=5000,
    ),
)
```

### Getting Current Configuration

```python
config = await inbox.get_chaos()

print(f"Chaos enabled: {config.enabled}")
if config.latency:
    print(f"Latency enabled: {config.latency.enabled}")
```

### Disabling Chaos

```python
await inbox.disable_chaos()
```

## Chaos Configuration

```python
from vaultsandbox import (
    ChaosConfig,
    LatencyConfig,
    ConnectionDropConfig,
    RandomErrorConfig,
    GreylistConfig,
    BlackholeConfig,
)
```

| Property          | Type                   | Required | Description                            |
| ----------------- | ---------------------- | -------- | -------------------------------------- |
| `enabled`         | `bool`                 | Yes      | Master switch for all chaos features   |
| `expires_at`      | `str`                  | No       | Auto-disable chaos after this time     |
| `latency`         | `LatencyConfig`        | No       | Inject artificial delays               |
| `connection_drop` | `ConnectionDropConfig` | No       | Simulate connection failures           |
| `random_error`    | `RandomErrorConfig`    | No       | Return random SMTP error codes         |
| `greylist`        | `GreylistConfig`       | No       | Simulate greylisting behavior          |
| `blackhole`       | `BlackholeConfig`      | No       | Accept but silently discard emails     |

## Latency Injection

Inject artificial delays into email processing to test timeout handling and slow connections.

```python
from vaultsandbox import LatencyConfig

await inbox.set_chaos(
    enabled=True,
    latency=LatencyConfig(
        enabled=True,
        min_delay_ms=500,       # Minimum delay (default: 500)
        max_delay_ms=5000,      # Maximum delay (default: 10000, max: 60000)
        jitter=True,            # Randomize within range (default: True)
        probability=0.5,        # 50% of emails affected (default: 1.0)
    ),
)
```

### Configuration Options

| Property       | Type    | Default | Description                                           |
| -------------- | ------- | ------- | ----------------------------------------------------- |
| `enabled`      | `bool`  | —       | Enable/disable latency injection                      |
| `min_delay_ms` | `int`   | `500`   | Minimum delay in milliseconds                         |
| `max_delay_ms` | `int`   | `10000` | Maximum delay in milliseconds (max: 60000)            |
| `jitter`       | `bool`  | `True`  | Randomize delay within range. If False, uses max_delay|
| `probability`  | `float` | `1.0`   | Probability of applying delay (0.0-1.0)               |

### Use Cases

- Test application timeout handling
- Verify UI responsiveness during slow email delivery
- Test retry logic with variable delays

## Connection Drop

Simulate connection failures by dropping SMTP connections.

```python
from vaultsandbox import ConnectionDropConfig

await inbox.set_chaos(
    enabled=True,
    connection_drop=ConnectionDropConfig(
        enabled=True,
        probability=0.3,    # 30% of connections dropped
        graceful=False,     # Abrupt RST instead of graceful FIN
    ),
)
```

### Configuration Options

| Property      | Type    | Default | Description                                  |
| ------------- | ------- | ------- | -------------------------------------------- |
| `enabled`     | `bool`  | —       | Enable/disable connection dropping           |
| `probability` | `float` | `1.0`   | Probability of dropping connection (0.0-1.0) |
| `graceful`    | `bool`  | `True`  | Use graceful close (FIN) vs abrupt (RST)     |

### Use Cases

- Test connection reset handling
- Verify TCP error recovery
- Test application behavior when SMTP connections fail mid-delivery

## Random Errors

Return random SMTP error codes to test error handling.

```python
from vaultsandbox import RandomErrorConfig

await inbox.set_chaos(
    enabled=True,
    random_error=RandomErrorConfig(
        enabled=True,
        error_rate=0.1,                 # 10% of emails return errors
        error_types=["temporary"],      # Only 4xx errors
    ),
)
```

### Configuration Options

| Property      | Type        | Default         | Description                       |
| ------------- | ----------- | --------------- | --------------------------------- |
| `enabled`     | `bool`      | —               | Enable/disable random errors      |
| `error_rate`  | `float`     | `0.1`           | Probability of returning an error |
| `error_types` | `list[str]` | `["temporary"]` | Types of errors to return         |

### Error Types

| Type        | SMTP Codes | Description                          |
| ----------- | ---------- | ------------------------------------ |
| `temporary` | 4xx        | Temporary failures, should retry     |
| `permanent` | 5xx        | Permanent failures, should not retry |

### Use Cases

- Test 4xx SMTP error handling and retry logic
- Test 5xx SMTP error handling and failure notifications
- Verify application handles both error types correctly

## Greylisting Simulation

Simulate greylisting behavior where the first delivery attempt is rejected and subsequent retries are accepted.

```python
from vaultsandbox import GreylistConfig

await inbox.set_chaos(
    enabled=True,
    greylist=GreylistConfig(
        enabled=True,
        retry_window_ms=300000,     # 5 minute window
        max_attempts=2,             # Accept on second attempt
        track_by="ip_sender",       # Track by IP and sender combination
    ),
)
```

### Configuration Options

| Property          | Type  | Default       | Description                              |
| ----------------- | ----- | ------------- | ---------------------------------------- |
| `enabled`         | `bool`| —             | Enable/disable greylisting               |
| `retry_window_ms` | `int` | `300000`      | Window for tracking retries (5 min)      |
| `max_attempts`    | `int` | `2`           | Attempts before accepting                |
| `track_by`        | `str` | `"ip_sender"` | How to identify unique delivery attempts |

### Tracking Methods

| Method      | Description                           |
| ----------- | ------------------------------------- |
| `ip`        | Track by sender IP only               |
| `sender`    | Track by sender email only            |
| `ip_sender` | Track by combination of IP and sender |

### Use Cases

- Test SMTP retry behavior when mail servers use greylisting
- Verify retry intervals and backoff logic
- Test handling of temporary 4xx rejections

## Blackhole Mode

Accept emails but silently discard them without storing.

```python
from vaultsandbox import BlackholeConfig

await inbox.set_chaos(
    enabled=True,
    blackhole=BlackholeConfig(
        enabled=True,
        trigger_webhooks=False,     # Don't trigger webhooks for discarded emails
    ),
)
```

### Configuration Options

| Property           | Type   | Default | Description                           |
| ------------------ | ------ | ------- | ------------------------------------- |
| `enabled`          | `bool` | —       | Enable/disable blackhole mode         |
| `trigger_webhooks` | `bool` | `False` | Trigger webhooks for discarded emails |

### Use Cases

- Test behavior when emails are silently lost
- Test webhook integration even when emails aren't stored
- Simulate email delivery that succeeds at SMTP level but fails at storage

## Auto-Expiring Chaos

Set chaos to automatically disable after a specific time:

```python
from datetime import datetime, timezone, timedelta

# Enable chaos for 1 hour
expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

await inbox.set_chaos(
    enabled=True,
    expires_at=expires_at,
    latency=LatencyConfig(enabled=True, max_delay_ms=3000),
)
```

After `expires_at`, chaos is automatically disabled and normal email delivery resumes.

## Combining Chaos Scenarios

Multiple chaos features can be enabled simultaneously:

```python
from vaultsandbox import LatencyConfig, RandomErrorConfig

await inbox.set_chaos(
    enabled=True,
    # 30% of emails delayed 1-5 seconds
    latency=LatencyConfig(
        enabled=True,
        min_delay_ms=1000,
        max_delay_ms=5000,
        probability=0.3,
    ),
    # 10% of emails return temporary errors
    random_error=RandomErrorConfig(
        enabled=True,
        error_rate=0.1,
        error_types=["temporary"],
    ),
)
```

## Complete Example

```python
import os
from vaultsandbox import (
    VaultSandboxClient,
    CreateInboxOptions,
    ChaosConfig,
    LatencyConfig,
    RandomErrorConfig,
    GreylistConfig,
    WaitForEmailOptions,
)
from vaultsandbox.errors import ApiError


async def test_chaos_resilience():
    async with VaultSandboxClient(
        base_url=os.environ["VAULTSANDBOX_URL"],
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        # Check if chaos is available
        server_info = await client.get_server_info()
        if not server_info.chaos_enabled:
            print("Chaos features not available on this server")
            return

        # Create inbox with chaos enabled
        inbox = await client.create_inbox(
            CreateInboxOptions(
                chaos=ChaosConfig(
                    enabled=True,
                    latency=LatencyConfig(
                        enabled=True,
                        min_delay_ms=2000,
                        max_delay_ms=5000,
                        probability=0.5,
                    ),
                    random_error=RandomErrorConfig(
                        enabled=True,
                        error_rate=0.1,
                        error_types=["temporary"],
                    ),
                ),
            )
        )

        print(f"Testing with chaos: {inbox.email_address}")

        try:
            # Get current chaos configuration
            config = await inbox.get_chaos()
            print(f"Chaos enabled: {config.enabled}")
            print(f"Latency enabled: {config.latency.enabled if config.latency else False}")

            # Send test emails and verify handling
            # Your test logic here...

            # Update chaos configuration
            await inbox.set_chaos(
                enabled=True,
                greylist=GreylistConfig(
                    enabled=True,
                    max_attempts=3,
                ),
            )

            # More testing...

            # Disable chaos for normal operation tests
            await inbox.disable_chaos()

        finally:
            # Clean up
            await inbox.delete()


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_chaos_resilience())
```

## Testing Patterns

### Test Retry Logic

```python
from vaultsandbox import GreylistConfig, WaitForEmailOptions

# Enable greylisting to test retry behavior
await inbox.set_chaos(
    enabled=True,
    greylist=GreylistConfig(enabled=True, max_attempts=2),
)

# Send email - first attempt will fail, retry should succeed
await send_email(inbox.email_address)

# If your mail sender retries correctly, email should arrive
email = await inbox.wait_for_email(WaitForEmailOptions(timeout=60000))
```

### Test Timeout Handling

```python
from vaultsandbox import LatencyConfig, WaitForEmailOptions
from vaultsandbox.errors import TimeoutError

# Enable high latency
await inbox.set_chaos(
    enabled=True,
    latency=LatencyConfig(enabled=True, min_delay_ms=10000, max_delay_ms=15000),
)

# Test that your application handles timeouts correctly
try:
    await inbox.wait_for_email(WaitForEmailOptions(timeout=5000))
except TimeoutError:
    # Expected: TimeoutError
    print("Timeout handled correctly")
```

### Test Error Recovery

```python
from vaultsandbox import RandomErrorConfig

# Enable high error rate
await inbox.set_chaos(
    enabled=True,
    random_error=RandomErrorConfig(
        enabled=True,
        error_rate=0.8,
        error_types=["temporary", "permanent"],
    ),
)

# Test that your application handles errors and retries appropriately
```

## Error Handling

```python
from vaultsandbox import LatencyConfig
from vaultsandbox.errors import InboxNotFoundError, ApiError

try:
    await inbox.set_chaos(enabled=True, latency=LatencyConfig(enabled=True))
except InboxNotFoundError:
    print("Inbox not found")
except ApiError as e:
    if e.status_code == 403:
        print("Chaos features are disabled on this server")
    else:
        print(f"API error ({e.status_code}): {e.message}")
```

## pytest Integration

### Chaos Fixture

```python
import pytest
import os
from vaultsandbox import VaultSandboxClient, CreateInboxOptions, ChaosConfig, LatencyConfig


@pytest.fixture
async def client():
    async with VaultSandboxClient(
        base_url=os.environ["VAULTSANDBOX_URL"],
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        yield client


@pytest.fixture
async def chaos_inbox(client):
    """Create an inbox with chaos enabled."""
    server_info = await client.get_server_info()
    if not server_info.chaos_enabled:
        pytest.skip("Chaos features not available on this server")

    inbox = await client.create_inbox(
        CreateInboxOptions(
            chaos=ChaosConfig(
                enabled=True,
                latency=LatencyConfig(
                    enabled=True,
                    min_delay_ms=500,
                    max_delay_ms=2000,
                ),
            ),
        )
    )
    yield inbox
    await inbox.delete()


@pytest.mark.asyncio
async def test_handles_slow_delivery(chaos_inbox):
    """Test that application handles delayed email delivery."""
    # Your test code here
    pass
```

### Parameterized Chaos Tests

```python
import pytest
from vaultsandbox import LatencyConfig, RandomErrorConfig, GreylistConfig


@pytest.mark.asyncio
@pytest.mark.parametrize("chaos_type,config", [
    ("latency", {"latency": LatencyConfig(enabled=True, min_delay_ms=1000, max_delay_ms=3000)}),
    ("random_error", {"random_error": RandomErrorConfig(enabled=True, error_rate=0.5)}),
    ("greylist", {"greylist": GreylistConfig(enabled=True, max_attempts=2)}),
])
async def test_chaos_scenarios(inbox, chaos_type, config):
    """Test application resilience under different chaos scenarios."""
    await inbox.set_chaos(enabled=True, **config)

    # Test your application's resilience
    # ...
```

## Next Steps

- [Inbox API Reference](/client-python/api/inbox/) - Complete inbox methods including chaos
- [CI/CD Integration](/client-python/testing/cicd/) - Integrate chaos testing in pipelines
- [Error Handling](/client-python/api/errors/) - Handle chaos-related errors
