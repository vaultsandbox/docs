---
title: Client Configuration
description: Configure the VaultSandbox client for your environment
---

This page covers all configuration options for the VaultSandbox Python client.

## Basic Configuration

### Creating a Client

```python
from vaultsandbox import VaultSandboxClient

async with VaultSandboxClient(
    base_url="https://mail.example.com",
    api_key="your-api-key",
) as client:
    # Use client...
    pass
```

## Configuration Options

### Required Options

#### api_key

**Type**: `str`

**Description**: API key for authentication

**Example**:

```python
api_key="vs_1234567890abcdef..."
```

**Best practices**:

- Store in environment variables
- Never commit to version control
- Rotate periodically

### Optional Options

#### base_url

**Type**: `str`

**Default**: `"https://smtp.vaultsandbox.com"`

**Description**: Base URL of your VaultSandbox Gateway

**Examples**:

```python
base_url="https://mail.example.com"
base_url="http://localhost:3000"  # Local development
```

**Requirements**:

- Must include protocol (`https://` or `http://`)
- Should not include trailing slash
- Must be accessible from your application

#### timeout

**Type**: `int` (milliseconds)

**Default**: `30000`

**Description**: HTTP request timeout in milliseconds

**Examples**:

```python
timeout=30000  # 30 seconds (default)
timeout=60000  # 60 seconds for slow networks
timeout=10000  # 10 seconds for fast networks
```

#### strategy

**Type**: `DeliveryStrategyType`

**Default**: `DeliveryStrategyType.AUTO`

**Description**: Email delivery strategy

**Options**:

- `DeliveryStrategyType.AUTO` - Automatically choose best strategy (tries SSE first, falls back to polling)
- `DeliveryStrategyType.SSE` - Server-Sent Events for real-time delivery
- `DeliveryStrategyType.POLLING` - Poll for new emails at intervals

**Examples**:

```python
from vaultsandbox import DeliveryStrategyType

strategy=DeliveryStrategyType.AUTO     # Recommended
strategy=DeliveryStrategyType.SSE      # Force SSE
strategy=DeliveryStrategyType.POLLING  # Force polling
```

**When to use each**:

- `AUTO`: Most use cases (recommended)
- `SSE`: When you need real-time, low-latency delivery
- `POLLING`: When SSE is blocked by firewall/proxy

#### max_retries

**Type**: `int`

**Default**: `3`

**Description**: Maximum retry attempts for failed HTTP requests

**Examples**:

```python
max_retries=3  # Default
max_retries=5  # More resilient
max_retries=0  # No retries
```

#### retry_delay

**Type**: `int` (milliseconds)

**Default**: `1000`

**Description**: Base delay between retry attempts (uses exponential backoff)

**Examples**:

```python
retry_delay=1000  # 1s, 2s, 4s, ...
retry_delay=500   # 500ms, 1s, 2s, ...
retry_delay=2000  # 2s, 4s, 8s, ...
```

#### retry_on_status_codes

**Type**: `tuple[int, ...]`

**Default**: `(408, 429, 500, 502, 503, 504)`

**Description**: HTTP status codes that trigger a retry

**Example**:

```python
retry_on_status_codes=(408, 429, 500, 502, 503, 504)  # Default
retry_on_status_codes=(500, 502, 503)  # Only server errors
retry_on_status_codes=()  # Never retry
```

#### polling_interval

**Type**: `int` (milliseconds)

**Default**: `2000`

**Description**: Polling interval when using polling strategy

**Examples**:

```python
polling_interval=2000  # Poll every 2 seconds (default)
polling_interval=5000  # Poll every 5 seconds
polling_interval=500   # Poll every 500ms (aggressive)
```

**Considerations**:

- Lower = more responsive, more API calls
- Higher = less API calls, slower detection
- Subject to rate limiting

#### polling_max_backoff

**Type**: `int` (milliseconds)

**Default**: `30000`

**Description**: Maximum backoff delay for polling strategy

**Examples**:

```python
polling_max_backoff=30000  # 30 seconds max (default)
polling_max_backoff=60000  # 60 seconds max
```

#### sse_reconnect_interval

**Type**: `int` (milliseconds)

**Default**: `5000`

**Description**: Initial delay before SSE reconnection attempt

**Examples**:

```python
sse_reconnect_interval=5000   # Default
sse_reconnect_interval=1000   # Faster reconnection
sse_reconnect_interval=10000  # Slower reconnection
```

**Note**: Uses exponential backoff (5s, 10s, 20s, ...)

#### sse_max_reconnect_attempts

**Type**: `int`

**Default**: `10`

**Description**: Maximum SSE reconnection attempts before giving up

**Examples**:

```python
sse_max_reconnect_attempts=10   # Default
sse_max_reconnect_attempts=100  # Keep trying longer
sse_max_reconnect_attempts=3    # Give up quickly
```

## Configuration Examples

### Production Configuration

```python
import os
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async with VaultSandboxClient(
    # Required
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],

    # Recommended production settings
    strategy=DeliveryStrategyType.AUTO,
    max_retries=5,
    retry_delay=2000,
    sse_reconnect_interval=5000,
    sse_max_reconnect_attempts=10,
) as client:
    # Use client...
    pass
```

### CI/CD Configuration

```python
import os
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],

    # Faster polling for CI
    strategy=DeliveryStrategyType.AUTO,
    polling_interval=1000,  # Poll every second
    max_retries=3,
    retry_delay=500,
) as client:
    # Use client...
    pass
```

### Development Configuration

```python
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async with VaultSandboxClient(
    base_url="http://localhost:3000",
    api_key="dev-api-key",

    # Aggressive settings for fast feedback
    strategy=DeliveryStrategyType.POLLING,  # More reliable in dev
    polling_interval=500,  # Very responsive
    max_retries=1,  # Fail fast
) as client:
    # Use client...
    pass
```

### High-Reliability Configuration

```python
import os
from vaultsandbox import VaultSandboxClient, DeliveryStrategyType

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],

    # Maximum reliability
    max_retries=10,
    retry_delay=2000,
    retry_on_status_codes=(408, 429, 500, 502, 503, 504),
    sse_reconnect_interval=1000,
    sse_max_reconnect_attempts=100,
) as client:
    # Use client...
    pass
```

## Environment Variables

Store configuration in environment variables:

### `.env` File

```bash
VAULTSANDBOX_URL=https://mail.example.com
VAULTSANDBOX_API_KEY=vs_1234567890abcdef...
```

### Usage with python-dotenv

```python
import os
from dotenv import load_dotenv
from vaultsandbox import VaultSandboxClient

load_dotenv()  # Load .env file

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ.get("VAULTSANDBOX_URL", "https://smtp.vaultsandbox.com"),
) as client:
    # Use client...
    pass
```

### Usage without python-dotenv

```python
import os
from vaultsandbox import VaultSandboxClient

async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ.get("VAULTSANDBOX_URL", "https://smtp.vaultsandbox.com"),
) as client:
    # Use client...
    pass
```

## Context Manager

The client is designed to be used as an async context manager, which ensures proper cleanup:

```python
async with VaultSandboxClient(api_key=api_key) as client:
    inbox = await client.create_inbox()
    # Use inbox...
# Client is automatically closed here
```

### Manual Close

If you can't use the context manager, call `close()` manually:

```python
client = VaultSandboxClient(api_key=api_key)

try:
    inbox = await client.create_inbox()
    # Use inbox...
finally:
    await client.close()
```

### What `close()` Does

- Terminates all active SSE connections
- Stops all polling operations
- Cleans up resources

**Note**: `close()` does NOT delete inboxes from the server. Inboxes expire based on their TTL. Use `delete_all_inboxes()` to explicitly delete inboxes.

## Strategy Selection Guide

### Auto (Recommended)

**Use when**: You want optimal performance with automatic fallback

**Behavior**:

1. Tries SSE first
2. Falls back to polling if SSE fails
3. Automatically reconnects on errors

**Pros**:

- Best of both worlds
- No manual configuration needed
- Resilient to network issues

**Cons**:

- Slightly more complex internally

### SSE (Server-Sent Events)

**Use when**: You need real-time, low-latency delivery

**Behavior**:

- Persistent connection to server
- Push-based email notification
- Instant delivery

**Pros**:

- Real-time delivery (no polling delay)
- Efficient (no repeated HTTP requests)
- Deterministic tests

**Cons**:

- Requires persistent connection
- May be blocked by some proxies/firewalls
- More complex error handling

### Polling

**Use when**: SSE is blocked or unreliable

**Behavior**:

- Periodic HTTP requests for new emails
- Pull-based email retrieval
- Configurable interval

**Pros**:

- Works in all network environments
- No persistent connection required
- Simple and predictable

**Cons**:

- Delay based on polling interval
- More HTTP requests
- Less efficient than SSE

## Best Practices

### Security

**Do**:

```python
import os

# Use environment variables
async with VaultSandboxClient(
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    base_url=os.environ["VAULTSANDBOX_URL"],
) as client:
    pass
```

**Don't**:

```python
# Hard-code credentials
async with VaultSandboxClient(
    api_key="vs_1234567890...",  # Never do this
    base_url="https://mail.example.com",
) as client:
    pass
```

### Resource Management

**Do**:

```python
async with VaultSandboxClient(api_key=api_key) as client:
    await run_tests(client)
# Client automatically closed
```

**Don't**:

```python
client = VaultSandboxClient(api_key=api_key)
await run_tests(client)
# Forgot to close, resources leak
```

### Error Handling

**Do**:

```python
from vaultsandbox import ApiError, NetworkError

try:
    inbox = await client.create_inbox()
except ApiError as e:
    print(f"API error ({e.status_code}): {e.message}")
except NetworkError as e:
    print(f"Network error: {e}")
```

## Next Steps

- **[Core Concepts: Inboxes](/client-python/concepts/inboxes/)** - Learn about inboxes
- **[Managing Inboxes](/client-python/guides/managing-inboxes/)** - Common inbox operations
- **[Testing Patterns](/client-python/testing/password-reset/)** - Integrate with your tests
- **[API Reference: Client](/client-python/api/client/)** - Full API documentation
