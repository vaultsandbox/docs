---
title: Error Handling
description: Complete guide to error handling and retry behavior in VaultSandbox Python Client
---

The VaultSandbox Client SDK provides comprehensive error handling with automatic retries for transient failures and specific error types for different failure scenarios.

## Error Hierarchy

All SDK errors extend from the base `VaultSandboxError` class, allowing you to catch all SDK-specific errors with a single `except` block.

```
VaultSandboxError (base class)
├── ApiError
├── NetworkError
├── TimeoutError
├── InboxNotFoundError
├── EmailNotFoundError
├── InboxAlreadyExistsError
├── InvalidImportDataError
├── DecryptionError
├── SignatureVerificationError
├── UnsupportedVersionError
├── InvalidPayloadError
├── InvalidAlgorithmError
├── InvalidSizeError
├── ServerKeyMismatchError
├── SSEError
└── StrategyError
```

## Automatic Retries

The SDK automatically retries failed HTTP requests for transient errors. This helps mitigate temporary network issues or server-side problems.

### Default Retry Behavior

By default, requests are retried for these HTTP status codes:

- `408` - Request Timeout
- `429` - Too Many Requests (Rate Limiting)
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable
- `504` - Gateway Timeout

### Configuration

Configure retry behavior when creating the client:

```python
from vaultsandbox import VaultSandboxClient

async with VaultSandboxClient(
    api_key="your-api-key",
    base_url="https://smtp.vaultsandbox.com",
    max_retries=5,  # Default: 3
    retry_delay=2000,  # Default: 1000ms
    retry_on_status_codes=(408, 429, 500, 502, 503, 504),  # Default
) as client:
    pass
```

### Retry Strategy

The SDK uses **exponential backoff** for retries:

- 1st retry: `retry_delay` ms
- 2nd retry: `retry_delay * 2` ms
- 3rd retry: `retry_delay * 4` ms
- And so on...

#### Example

```python
# With retry_delay=1000 and max_retries=3
# Retry schedule:
#   1st attempt: immediate
#   2nd attempt: after 1000ms
#   3rd attempt: after 2000ms
#   4th attempt: after 4000ms
#   Total time: up to 7 seconds + request time
```

## Error Types

### VaultSandboxError

Base class for all SDK errors. Use this to catch any SDK-specific error.

```python
class VaultSandboxError(Exception):
    """Base exception for all VaultSandbox SDK errors."""
    pass
```

#### Example

```python
from vaultsandbox import VaultSandboxError

try:
    inbox = await client.create_inbox()
    # Use inbox...
except VaultSandboxError as e:
    print(f"VaultSandbox error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

---

### ApiError

Thrown for API-level errors such as invalid requests or permission denied.

```python
class ApiError(VaultSandboxError):
    status_code: int
    message: str
```

#### Properties

- `status_code`: HTTP status code from the API
- `message`: Error message from the server

#### Common Status Codes

| Status | Meaning |
| ------ | ------- |
| `400` | Bad request (invalid parameters, missing required fields) |
| `401` | Invalid API key |
| `403` | Permission denied |
| `404` | Resource not found (inbox or email) |
| `409` | Conflict (duplicate inbox) |
| `429` | Rate limit exceeded |

#### Example

```python
from vaultsandbox import ApiError

try:
    inbox = await client.create_inbox()
except ApiError as e:
    print(f"API Error ({e.status_code}): {e.message}")

    if e.status_code == 400:
        print("Invalid request parameters")
        # May include: "clientKemPk is required when encryption is enabled"
    elif e.status_code == 401:
        print("Invalid API key")
    elif e.status_code == 403:
        print("Permission denied")
    elif e.status_code == 409:
        print("Conflict - inbox already exists")
    elif e.status_code == 429:
        print("Rate limit exceeded")
```

---

### NetworkError

Thrown when there is a network-level failure (e.g., cannot connect to server).

```python
class NetworkError(VaultSandboxError):
    pass
```

#### Example

```python
from vaultsandbox import NetworkError

try:
    inbox = await client.create_inbox()
except NetworkError as e:
    print(f"Network error: {e}")
    print("Check your internet connection and server URL")
```

---

### TimeoutError

Thrown by methods like `wait_for_email()` and `wait_for_email_count()` when the timeout is reached before the condition is met.

```python
class TimeoutError(VaultSandboxError):
    pass
```

#### Example

```python
from vaultsandbox import TimeoutError, WaitForEmailOptions
import re

try:
    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=5000,
            subject=re.compile(r"Welcome"),
        )
    )
except TimeoutError:
    print("Timed out waiting for email")
    print("Email may not have been sent or took too long to deliver")

    # Check what emails did arrive
    emails = await inbox.list_emails()
    print(f"Found {len(emails)} emails:")
    for e in emails:
        print(f"  - {e.subject}")
```

---

### InboxNotFoundError

Thrown when an operation targets an inbox that does not exist (HTTP 404).

```python
class InboxNotFoundError(VaultSandboxError):
    pass
```

#### Example

```python
from vaultsandbox import InboxNotFoundError, ApiError

try:
    emails = await inbox.list_emails()
except InboxNotFoundError:
    print("Inbox no longer exists")
    print("It may have expired or been deleted")
except ApiError as e:
    if e.status_code == 404:
        print("Inbox not found")
```

---

### EmailNotFoundError

Thrown when an operation targets an email that does not exist (HTTP 404).

```python
class EmailNotFoundError(VaultSandboxError):
    pass
```

#### Example

```python
from vaultsandbox import EmailNotFoundError, ApiError

try:
    email = await inbox.get_email("non-existent-id")
except EmailNotFoundError:
    print("Email not found")
    print("It may have been deleted")
except ApiError as e:
    if e.status_code == 404:
        print("Email not found")
```

---

### InboxAlreadyExistsError

Thrown when attempting to import an inbox that already exists in the client.

```python
class InboxAlreadyExistsError(VaultSandboxError):
    pass
```

**Note**: This error is only raised during **import** operations. When creating an inbox with a duplicate email address or KEM key, the server returns an `ApiError` with status code `409` instead.

#### Example

```python
from vaultsandbox import InboxAlreadyExistsError

try:
    inbox = await client.import_inbox(exported_data)
except InboxAlreadyExistsError:
    print("Inbox already imported in this client")
    print("Use a new client instance or delete the existing inbox")
```

---

### InvalidImportDataError

Thrown when imported inbox data fails validation (missing fields, invalid keys, server mismatch, etc.).

```python
class InvalidImportDataError(VaultSandboxError):
    pass
```

#### Example

```python
import json
from vaultsandbox import InvalidImportDataError

try:
    corrupted_data = json.loads(corrupted_json)
    inbox = await client.import_inbox(corrupted_data)
except InvalidImportDataError as e:
    print(f"Invalid import data: {e}")
    print("The exported data may be corrupted or from a different server")
```

---

### DecryptionError

Thrown if the client fails to decrypt an email. This is rare and may indicate data corruption or a bug.

```python
class DecryptionError(VaultSandboxError):
    pass
```

#### Example

```python
import logging
from vaultsandbox import DecryptionError

logger = logging.getLogger(__name__)

try:
    emails = await inbox.list_emails()
except DecryptionError as e:
    print(f"Failed to decrypt email: {e}")
    print("This is a critical error - please report it")

    # Log for investigation
    logger.critical(
        "Decryption failure",
        extra={
            "inbox": inbox.email_address,
            "error": str(e),
        }
    )
```

#### Handling

Decryption errors should **always** be logged and investigated as they may indicate:

- Data corruption
- SDK bug
- MITM attack (rare)
- Server-side encryption issue

---

### SignatureVerificationError

Thrown if the cryptographic signature of a message from the server cannot be verified. This is a **critical security error** that may indicate a man-in-the-middle (MITM) attack.

```python
class SignatureVerificationError(VaultSandboxError):
    pass
```

#### Example

```python
import logging
from datetime import datetime
from vaultsandbox import SignatureVerificationError

logger = logging.getLogger(__name__)

try:
    inbox = await client.create_inbox()
except SignatureVerificationError as e:
    print("CRITICAL: Signature verification failed!")
    print("This may indicate a MITM attack")
    print(f"Message: {e}")

    # Log immediately
    logger.critical(
        "Signature verification failed",
        extra={
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
        }
    )

    # Alert security team
    alert_security_team(e)

    raise  # Do not continue
```

#### Handling

Signature verification errors should **never** be ignored:

1. **Log immediately** with full context
2. **Alert security/operations team**
3. **Stop processing** - do not continue with the operation
4. **Investigate** - check for network issues, proxy problems, or actual attacks

---

### UnsupportedVersionError

Thrown when the protocol version or export format version is not supported.

```python
class UnsupportedVersionError(VaultSandboxError):
    pass
```

#### Example

```python
from vaultsandbox import UnsupportedVersionError

try:
    inbox = await client.import_inbox_from_file("./old-export.json")
except UnsupportedVersionError as e:
    print(f"Unsupported version: {e}")
    print("The export file was created with an incompatible SDK version")
```

---

### InvalidPayloadError

Thrown when an encrypted payload has malformed JSON or is missing required fields.

```python
class InvalidPayloadError(VaultSandboxError):
    pass
```

#### Example

```python
from vaultsandbox import InvalidPayloadError

try:
    emails = await inbox.list_emails()
except InvalidPayloadError as e:
    print(f"Invalid payload: {e}")
    print("The server response was malformed")
```

---

### InvalidAlgorithmError

Thrown when an encrypted payload specifies an unrecognized or unsupported cryptographic algorithm.

```python
class InvalidAlgorithmError(VaultSandboxError):
    pass
```

#### Example

```python
from vaultsandbox import InvalidAlgorithmError

try:
    emails = await inbox.list_emails()
except InvalidAlgorithmError as e:
    print(f"Invalid algorithm: {e}")
    print("The server is using an unsupported cryptographic algorithm")
```

---

### InvalidSizeError

Thrown when a decoded cryptographic field has an incorrect size (e.g., wrong key length).

```python
class InvalidSizeError(VaultSandboxError):
    pass
```

#### Example

```python
from vaultsandbox import InvalidSizeError

try:
    inbox = await client.import_inbox(exported)
except InvalidSizeError as e:
    print(f"Invalid size: {e}")
    print("A cryptographic field has the wrong size - data may be corrupted")
```

---

### ServerKeyMismatchError

Thrown when the server's public key doesn't match the pinned key from inbox creation. This is a **critical security error** that may indicate a man-in-the-middle (MITM) attack or server misconfiguration.

```python
class ServerKeyMismatchError(VaultSandboxError):
    pass
```

#### Example

```python
import logging
from vaultsandbox import ServerKeyMismatchError

logger = logging.getLogger(__name__)

try:
    emails = await inbox.list_emails()
except ServerKeyMismatchError as e:
    print("CRITICAL: Server key mismatch!")
    print("This may indicate a MITM attack or server misconfiguration")

    logger.critical(
        "Server key mismatch detected",
        extra={"error": str(e)}
    )

    raise  # Do not continue
```

#### Handling

Server key mismatch errors should be treated similarly to signature verification errors:

1. **Log immediately** with full context
2. **Alert security/operations team**
3. **Stop processing** - do not continue with the operation
4. **Investigate** - verify server configuration and network integrity

---

### SSEError

Thrown for errors related to the Server-Sent Events (SSE) connection.

```python
class SSEError(VaultSandboxError):
    pass
```

#### Example

```python
from vaultsandbox import VaultSandboxClient, SSEError, DeliveryStrategyType

try:
    async with VaultSandboxClient(
        api_key="your-api-key",
        strategy=DeliveryStrategyType.SSE,
    ) as client:
        inbox = await client.create_inbox()
        subscription = await inbox.on_new_email(
            lambda email: print(f"New email: {email.subject}")
        )
except SSEError as e:
    print(f"SSE connection error: {e}")
    print("Falling back to polling strategy")

    # Recreate client with polling
    async with VaultSandboxClient(
        api_key="your-api-key",
        strategy=DeliveryStrategyType.POLLING,
    ) as client:
        pass
```

---

### StrategyError

Thrown when a delivery strategy is not set or is invalid.

```python
class StrategyError(VaultSandboxError):
    pass
```

#### Example

```python
from vaultsandbox import StrategyError

try:
    inbox = await client.create_inbox()
    subscription = await inbox.on_new_email(
        lambda email: print(f"New email: {email.subject}")
    )
except StrategyError as e:
    print(f"Strategy error: {e}")
    print("This may indicate the delivery strategy is not properly configured")
```

## Error Handling Patterns

### Basic Error Handling

```python
from vaultsandbox import (
    VaultSandboxClient,
    ApiError,
    TimeoutError,
    NetworkError,
    VaultSandboxError,
)

async with VaultSandboxClient(api_key=api_key) as client:
    try:
        inbox = await client.create_inbox()
        print(f"Send email to: {inbox.email_address}")

        email = await inbox.wait_for_email()
        print(f"Email received: {email.subject}")

        await inbox.delete()
    except TimeoutError:
        print("Timed out waiting for email")
    except ApiError as e:
        print(f"API Error ({e.status_code}): {e.message}")
    except NetworkError as e:
        print(f"Network error: {e}")
    except VaultSandboxError as e:
        print(f"VaultSandbox error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
```

### Retry with Custom Logic

```python
from vaultsandbox import TimeoutError, WaitForEmailOptions
import asyncio

async def wait_for_email_with_retry(inbox, options, max_attempts=3):
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            return await inbox.wait_for_email(options)
        except TimeoutError as e:
            last_error = e
            print(f"Attempt {attempt}/{max_attempts} timed out")

            if attempt < max_attempts:
                print("Retrying...")
                await asyncio.sleep(2)
        except Exception:
            # Non-timeout error, don't retry
            raise

    raise last_error

# Usage
try:
    email = await wait_for_email_with_retry(
        inbox,
        WaitForEmailOptions(timeout=10000, subject="Welcome"),
        max_attempts=3,
    )
    print(f"Email received: {email.subject}")
except TimeoutError:
    print("Failed after retries")
```

### Graceful Degradation

```python
from vaultsandbox import TimeoutError, WaitForEmailOptions

async def get_emails_with_fallback(inbox):
    try:
        # Try to wait for new email
        return [await inbox.wait_for_email(
            WaitForEmailOptions(timeout=5000)
        )]
    except TimeoutError:
        print("No new emails, checking existing...")
        # Fall back to listing existing emails
        return await inbox.list_emails()
```

### pytest Cleanup with Error Handling

```python
import pytest
from vaultsandbox import VaultSandboxClient, ApiError

@pytest.fixture
async def client():
    async with VaultSandboxClient(
        api_key="your-api-key",
    ) as client:
        yield client

@pytest.fixture
async def inbox(client):
    inbox = await client.create_inbox()
    yield inbox

    # Always clean up, even if test failed
    try:
        await inbox.delete()
    except ApiError as e:
        if e.status_code == 404:
            # Inbox already deleted, that's fine
            print("Inbox already deleted")
        else:
            # Log but don't fail the test
            print(f"Failed to delete inbox: {e.message}")

@pytest.mark.asyncio
async def test_should_receive_email(inbox):
    # Send email to inbox.email_address...

    email = await inbox.wait_for_email()
    assert "Test" in email.subject
```

## Best Practices

### 1. Always Handle TimeoutError

Timeouts are common in email testing. Always handle them explicitly:

```python
from vaultsandbox import TimeoutError, WaitForEmailOptions

try:
    email = await inbox.wait_for_email(
        WaitForEmailOptions(timeout=10000)
    )
except TimeoutError:
    # List what emails did arrive
    emails = await inbox.list_emails()
    print(f"Expected email not found. Received {len(emails)} emails:")
    for e in emails:
        print(f"  - \"{e.subject}\" from {e.from_address}")
    raise
```

### 2. Log Critical Errors

Always log signature verification and decryption errors:

```python
import logging
from datetime import datetime
from vaultsandbox import SignatureVerificationError, DecryptionError

logger = logging.getLogger(__name__)

try:
    inbox = await client.create_inbox()
except (SignatureVerificationError, DecryptionError) as e:
    # Critical security/integrity error
    logger.critical(
        "Critical security error",
        extra={
            "error": str(e),
            "error_type": type(e).__name__,
            "timestamp": datetime.now().isoformat(),
        }
    )

    # Alert operations team
    alert_ops(e)

    raise
```

### 3. Use Specific Error Types

Catch specific errors before generic ones:

```python
# Good: Specific to general
try:
    # ...
    pass
except ApiError as e:
    if e.status_code == 404:
        # Handle not found case (inbox or email)
        pass
    else:
        # Handle other API errors
        pass
except TimeoutError:
    # Handle timeout case
    pass
except VaultSandboxError:
    # Handle any other SDK error
    pass
except Exception:
    # Handle unexpected errors
    pass

# Avoid: Too generic
try:
    # ...
    pass
except VaultSandboxError:
    # Can't differentiate between error types
    pass
```

### 4. Clean Up Resources

Always clean up, even when errors occur:

```python
async with VaultSandboxClient(api_key=api_key) as client:
    try:
        inbox = await client.create_inbox()
        # Use inbox...
    except Exception as e:
        print(f"Error: {e}")
        raise
# Client automatically closed via context manager
```

Or with manual cleanup:

```python
client = VaultSandboxClient(api_key=api_key)
try:
    inbox = await client.create_inbox()
    # Use inbox...
except Exception as e:
    print(f"Error: {e}")
    raise
finally:
    await client.close()
```

## Next Steps

- [CI/CD Integration](/client-python/testing/cicd/) - Error handling in CI
- [VaultSandboxClient API](/client-python/api/client/) - Client configuration
