---
title: Delivery Strategies
description: Learn about SSE and polling delivery strategies in VaultSandbox Python Client
---

VaultSandbox Python Client supports two email delivery strategies: **Server-Sent Events (SSE)** for real-time updates and **Polling** for compatibility. The SDK intelligently chooses the best strategy automatically or allows manual configuration.

## Overview

When you wait for emails or subscribe to new email notifications, the SDK needs to know when emails arrive. It does this using one of two strategies:

1. **SSE (Server-Sent Events)**: Real-time push notifications from the server
2. **Polling**: Periodic checking for new emails

## Strategy Comparison

| Feature             | SSE                             | Polling                     |
| ------------------- | ------------------------------- | --------------------------- |
| **Latency**         | Near-instant (~100ms)           | Poll interval (default: 2s) |
| **Server Load**     | Lower (persistent connection)   | Higher (repeated requests)  |
| **Network Traffic** | Lower (only when emails arrive) | Higher (constant polling)   |
| **Compatibility**   | Requires persistent connections | Works everywhere            |
| **Firewall/Proxy**  | May be blocked                  | Always works                |
| **Resource Impact** | Lower (push-based)              | Higher (constant requests)  |

## Auto Strategy (Recommended)

The default `AUTO` strategy automatically selects the best delivery method:

1. **Tries SSE first** - Attempts to establish an SSE connection
2. **Falls back to polling** - If SSE fails or is unavailable, uses polling
3. **Adapts to environment** - Works seamlessly in different network conditions

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

# Auto strategy (default)
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url="https://smtp.vaultsandbox.com",
    strategy=DeliveryStrategyType.AUTO,  # Default, can be omitted
) as client:
    # SDK will automatically choose the best strategy
    inbox = await client.create_inbox()
    email = await inbox.wait_for_email(timeout=10000)
```

### When Auto Chooses SSE

- Gateway supports SSE
- Network allows persistent connections
- No restrictive proxy/firewall

### When Auto Falls Back to Polling

- Gateway doesn't support SSE
- SSE connection fails
- Behind restrictive proxy/firewall
- Network requires periodic reconnection

## SSE Strategy

Server-Sent Events provide real-time push notifications when emails arrive.

### Advantages

- **Near-instant delivery**: Emails appear within milliseconds
- **Lower server load**: Single persistent connection
- **Efficient**: Only transmits when emails arrive
- **Resource-friendly**: No constant polling

### Configuration

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url="https://smtp.vaultsandbox.com",
    strategy=DeliveryStrategyType.SSE,
    sse_reconnect_interval=5000,      # Wait 5s before reconnecting
    sse_max_reconnect_attempts=10,    # Try up to 10 reconnections
) as client:
    inbox = await client.create_inbox()
    # ...
```

### SSE Configuration Options

| Option                       | Type  | Default | Description                            |
| ---------------------------- | ----- | ------- | -------------------------------------- |
| `sse_reconnect_interval`     | `int` | `5000`  | Initial delay before reconnection (ms) |
| `sse_max_reconnect_attempts` | `int` | `10`    | Maximum reconnection attempts          |

### Reconnection Behavior

SSE uses **exponential backoff** for reconnections:

```
1st attempt: sse_reconnect_interval (5s)
2nd attempt: sse_reconnect_interval * 2 (10s)
3rd attempt: sse_reconnect_interval * 4 (20s)
...up to sse_max_reconnect_attempts
```

### Example Usage

```python
import asyncio
import re
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async def main():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url="https://smtp.vaultsandbox.com",
        strategy=DeliveryStrategyType.SSE,
    ) as client:
        inbox = await client.create_inbox()

        # Real-time subscription (uses SSE)
        async def handle_email(email):
            print(f"Instant notification: {email.subject}")

        unsubscribe = await inbox.on_new_email(handle_email)

        # Waiting also uses SSE (faster than polling)
        email = await inbox.wait_for_email(
            timeout=10000,
            subject=re.compile(r"Welcome"),
        )

        await unsubscribe()

asyncio.run(main())
```

### When to Use SSE

- **Real-time monitoring**: When you need instant email notifications
- **Long-running tests**: Reduces overall test time
- **High email volume**: More efficient than polling
- **Development/local**: Fast feedback during development

### Limitations

- Requires persistent HTTP connection support
- May not work behind some corporate proxies
- Some cloud environments may close long-lived connections
- Requires server-side SSE support

## Polling Strategy

Polling periodically checks for new emails at a configured interval.

### Advantages

- **Universal compatibility**: Works in all environments
- **Firewall-friendly**: Standard HTTP requests
- **Predictable**: Easy to reason about behavior
- **Resilient**: Automatically recovers from transient failures

### Configuration

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url="https://smtp.vaultsandbox.com",
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=2000,     # Check every 2 seconds
    polling_max_backoff=30000, # Max backoff delay
) as client:
    inbox = await client.create_inbox()
    # ...
```

### Polling Configuration Options

| Option                | Type  | Default | Description                        |
| --------------------- | ----- | ------- | ---------------------------------- |
| `polling_interval`    | `int` | `2000`  | How often to poll for emails (ms)  |
| `polling_max_backoff` | `int` | `30000` | Maximum backoff delay (ms)         |

### Backoff Behavior

Polling uses **exponential backoff with jitter** when no new emails arrive:

- **Backoff multiplier**: 1.5x
- **Jitter factor**: 30% random variation
- **Maximum backoff**: Configurable via `polling_max_backoff`

When new emails arrive, the backoff resets to `polling_interval`.

### Example Usage

```python
import asyncio
import re
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async def main():
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url="https://smtp.vaultsandbox.com",
        strategy=DeliveryStrategyType.POLLING,
        polling_interval=1000,  # Poll every 1 second
    ) as client:
        inbox = await client.create_inbox()

        # Polling-based subscription
        async def handle_email(email):
            print(f"Polled notification: {email.subject}")

        unsubscribe = await inbox.on_new_email(handle_email)

        # Waiting uses polling (checks every polling_interval)
        email = await inbox.wait_for_email(
            timeout=10000,
            subject=re.compile(r"Welcome"),
        )

        await unsubscribe()

asyncio.run(main())
```

### Choosing Poll Interval

Different intervals suit different scenarios:

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

# Fast polling (500ms) - Development/local testing
async with VaultSandboxClient(
    api_key="dev-key",
    base_url="http://localhost:3000",
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=500,
) as fast_client:
    pass

# Standard polling (2000ms) - Default, good balance
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url="https://smtp.vaultsandbox.com",
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=2000,
) as standard_client:
    pass

# Slow polling (5000ms) - CI/CD or rate-limited environments
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url="https://smtp.vaultsandbox.com",
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=5000,
) as slow_client:
    pass
```

### When to Use Polling

- **Corporate networks**: Restrictive firewall/proxy environments
- **CI/CD pipelines**: Guaranteed compatibility
- **Rate-limited APIs**: Control request frequency
- **Debugging**: Predictable request timing
- **Low email volume**: Polling overhead is minimal

### Performance Optimization

For `wait_for_email()`, you can override the polling interval:

```python
from vaultsandbox import WaitForEmailOptions

# Default client polling: 2s
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=2000,
) as client:
    inbox = await client.create_inbox()

    # Override for specific operation (faster)
    email = await inbox.wait_for_email(
        timeout=30000,
        poll_interval=1000,  # Check every 1s for this operation
    )
```

## Choosing the Right Strategy

### Use Auto (Default)

For most use cases, let the SDK choose:

```python
from vaultsandbox import VaultSandboxClient

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    # strategy=DeliveryStrategyType.AUTO is implicit
) as client:
    pass
```

**Best for:**

- General testing
- Unknown network conditions
- Mixed environments (dev, staging, CI)
- When you want it to "just work"

### Force SSE

When you need guaranteed real-time performance:

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=DeliveryStrategyType.SSE,
) as client:
    pass
```

**Best for:**

- Local development (known to support SSE)
- Real-time monitoring dashboards
- High-volume email testing
- Latency-sensitive tests

**Caveat:** Will raise `SSEError` if SSE is unavailable.

### Force Polling

When compatibility is more important than speed:

```python
import os
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

polling_interval = 3000 if os.environ.get("CI") else 1000

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=polling_interval,
) as client:
    pass
```

**Best for:**

- CI/CD environments (guaranteed to work)
- Corporate networks with restrictive proxies
- When SSE is known to be problematic
- Rate-limited scenarios

## Environment-Specific Configuration

### Development

Fast feedback with SSE:

```python
# .env.development
# VAULTSANDBOX_URL=http://localhost:3000
# VAULTSANDBOX_STRATEGY=sse

import os
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

def get_strategy():
    strategy_str = os.environ.get("VAULTSANDBOX_STRATEGY", "auto")
    return {
        "sse": DeliveryStrategyType.SSE,
        "polling": DeliveryStrategyType.POLLING,
        "auto": DeliveryStrategyType.AUTO,
    }.get(strategy_str, DeliveryStrategyType.AUTO)

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=get_strategy(),
) as client:
    pass
```

### CI/CD

Reliable polling:

```python
# .env.ci
# VAULTSANDBOX_URL=https://smtp.vaultsandbox.com
# VAULTSANDBOX_STRATEGY=polling
# VAULTSANDBOX_POLLING_INTERVAL=3000

import os
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=int(os.environ.get("VAULTSANDBOX_POLLING_INTERVAL", "2000")),
) as client:
    pass
```

### Production Testing

Auto with tuned reconnection:

```python
import os
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=DeliveryStrategyType.AUTO,
    # SSE config (if available)
    sse_reconnect_interval=10000,
    sse_max_reconnect_attempts=5,
    # Polling fallback config
    polling_interval=5000,
) as client:
    pass
```

## Monitoring Strategy Performance

### Measure Email Delivery Latency

```python
import asyncio
import time
from vaultsandbox import VaultSandboxClient

async def measure_delivery_latency(send_test_email):
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
    ) as client:
        inbox = await client.create_inbox()

        start_time = time.time()

        # Send email
        await send_test_email(inbox.email_address)

        # Wait for email
        email = await inbox.wait_for_email(timeout=30000)

        latency = (time.time() - start_time) * 1000
        print(f"Email delivery latency: {latency:.0f}ms")

        await inbox.delete()

asyncio.run(measure_delivery_latency(send_test_email))
```

### Compare Strategies

```python
import asyncio
import time
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async def compare_strategies(send_test_email):
    # Test SSE
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
        strategy=DeliveryStrategyType.SSE,
    ) as sse_client:
        sse_inbox = await sse_client.create_inbox()
        sse_start = time.time()
        await send_test_email(sse_inbox.email_address)
        await sse_inbox.wait_for_email(timeout=10000)
        sse_latency = (time.time() - sse_start) * 1000
        await sse_inbox.delete()

    # Test Polling
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
        strategy=DeliveryStrategyType.POLLING,
        polling_interval=2000,
    ) as poll_client:
        poll_inbox = await poll_client.create_inbox()
        poll_start = time.time()
        await send_test_email(poll_inbox.email_address)
        await poll_inbox.wait_for_email(timeout=10000)
        poll_latency = (time.time() - poll_start) * 1000
        await poll_inbox.delete()

    print(f"SSE latency: {sse_latency:.0f}ms")
    print(f"Polling latency: {poll_latency:.0f}ms")
    print(f"Difference: {poll_latency - sse_latency:.0f}ms")

asyncio.run(compare_strategies(send_test_email))
```

## Troubleshooting

### SSE Connection Failures

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType, SSEError

try:
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
        strategy=DeliveryStrategyType.SSE,
    ) as client:
        inbox = await client.create_inbox()
        # Use inbox...
except SSEError as e:
    print(f"SSE failed: {e}")
    print("Falling back to polling...")

    # Recreate with polling
    async with VaultSandboxClient(
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        base_url=os.environ["VAULTSANDBOX_URL"],
        strategy=DeliveryStrategyType.POLLING,
    ) as client:
        inbox = await client.create_inbox()
        # Continue with polling...
```

### Polling Too Slow

If emails arrive slowly with polling:

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

# Problem: Default 2s polling is too slow

# Solution 1: Faster polling
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=500,  # Check every 500ms
) as faster_client:
    pass

# Solution 2: Use SSE if available
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=DeliveryStrategyType.SSE,  # Real-time delivery
) as sse_client:
    pass

# Solution 3: Override for specific wait
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=2000,
) as client:
    inbox = await client.create_inbox()
    email = await inbox.wait_for_email(
        timeout=10000,
        poll_interval=500,  # Fast polling for this operation
    )
```

## Best Practices

### 1. Use Auto Strategy by Default

Let the SDK choose unless you have specific requirements:

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

# Good: Let SDK choose
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
) as client:
    pass

# Only specify when needed
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=DeliveryStrategyType.POLLING,  # CI needs guaranteed compatibility
) as ci_client:
    pass
```

### 2. Tune for Environment

Configure differently for each environment:

```python
import os
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

def create_client():
    api_key = os.environ["VAULTSANDBOX_API_KEY"]
    base_url = os.environ["VAULTSANDBOX_URL"]

    if os.environ.get("CI"):
        # CI: Reliable polling
        return VaultSandboxClient(
            api_key=api_key,
            base_url=base_url,
            strategy=DeliveryStrategyType.POLLING,
            polling_interval=3000,
        )
    elif os.environ.get("ENV") == "development":
        # Dev: Fast SSE
        return VaultSandboxClient(
            api_key=api_key,
            base_url=base_url,
            strategy=DeliveryStrategyType.SSE,
        )
    else:
        # Production: Auto with tuning
        return VaultSandboxClient(
            api_key=api_key,
            base_url=base_url,
            strategy=DeliveryStrategyType.AUTO,
            sse_reconnect_interval=5000,
            polling_interval=2000,
        )
```

### 3. Handle SSE Gracefully

Always have a fallback if forcing SSE:

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType, SSEError

async def create_client_with_fallback():
    try:
        client = VaultSandboxClient(
            api_key=os.environ["VAULTSANDBOX_API_KEY"],
            base_url=os.environ["VAULTSANDBOX_URL"],
            strategy=DeliveryStrategyType.SSE,
        )
        # Test connection
        await client.check_key()
        return client
    except SSEError:
        print("SSE unavailable, using polling")
        return VaultSandboxClient(
            api_key=os.environ["VAULTSANDBOX_API_KEY"],
            base_url=os.environ["VAULTSANDBOX_URL"],
            strategy=DeliveryStrategyType.POLLING,
        )
```

### 4. Don't Poll Too Aggressively

Avoid very short polling intervals in production:

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

# Avoid: Too aggressive
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=100,  # 100ms - too frequent!
) as aggressive_client:
    pass

# Good: Reasonable interval
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
    strategy=DeliveryStrategyType.POLLING,
    polling_interval=2000,  # 2s - balanced
) as balanced_client:
    pass
```

## Next Steps

- [Real-time Monitoring Guide](/client-python/guides/real-time/) - Using subscriptions
- [Configuration Reference](/client-python/configuration/) - All config options
- [Error Handling](/client-python/api/errors/) - Handle SSE errors
- [CI/CD Integration](/client-python/testing/cicd/) - Strategy for CI environments
