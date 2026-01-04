---
title: Authentication Results
description: Understanding email authentication (SPF, DKIM, DMARC) in VaultSandbox
---

VaultSandbox validates email authentication for every received email, providing detailed SPF, DKIM, DMARC, and reverse DNS results.

## What is Email Authentication?

Email authentication helps verify that an email:

- Came from the claimed sender domain (**SPF**)
- Wasn't modified in transit (**DKIM**)
- Complies with the domain's policy (**DMARC**)
- Came from a legitimate mail server (**Reverse DNS**)

## AuthResults Object

Every email has an `auth_results` property:

```python
from vaultsandbox import WaitForEmailOptions

email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

auth = email.auth_results

print(auth.spf)         # SPFResult or None
print(auth.dkim)        # list[DKIMResult]
print(auth.dmarc)       # DMARCResult or None
print(auth.reverse_dns) # ReverseDNSResult or None
```

## SPF (Sender Policy Framework)

Verifies the sending server is authorized to send from the sender's domain.

### SPF Result Structure

```python
from vaultsandbox.types import SPFStatus

spf = email.auth_results.spf

if spf:
    print(spf.result)   # SPFStatus.PASS, SPFStatus.FAIL, etc.
    print(spf.domain)   # Domain checked
    print(spf.ip)       # IP address checked
    print(spf.details)  # Human-readable details
```

### SPF Status Values

| Status      | Meaning                                    |
| ----------- | ------------------------------------------ |
| `PASS`      | Sending server is authorized               |
| `FAIL`      | Sending server is NOT authorized           |
| `SOFTFAIL`  | Probably not authorized (policy says ~all) |
| `NEUTRAL`   | Domain makes no assertion                  |
| `TEMPERROR` | Temporary error during check               |
| `PERMERROR` | Permanent error in SPF record              |
| `NONE`      | No SPF record found                        |

### SPF Example

```python
from vaultsandbox.types import SPFStatus

email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

if email.auth_results.spf:
    spf = email.auth_results.spf

    assert spf.result == SPFStatus.PASS
    assert spf.domain == "example.com"

    print(f"SPF {spf.result.value} for {spf.domain}")
```

## DKIM (DomainKeys Identified Mail)

Cryptographically verifies the email hasn't been modified and came from the claimed domain.

### DKIM Result Structure

```python
from vaultsandbox.types import DKIMStatus

dkim = email.auth_results.dkim  # List of results

if dkim:
    for result in dkim:
        print(result.result)     # DKIMStatus.PASS, DKIMStatus.FAIL, etc.
        print(result.domain)     # Signing domain
        print(result.selector)   # DKIM selector
        print(result.signature)  # DKIM signature information
```

**Note**: An email can have multiple DKIM signatures (one per signing domain).

### DKIM Status Values

| Status | Meaning                 |
| ------ | ----------------------- |
| `PASS` | Signature is valid      |
| `FAIL` | Signature is invalid    |
| `NONE` | No DKIM signature found |

### DKIM Example

```python
from vaultsandbox.types import DKIMStatus

email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

if email.auth_results.dkim:
    dkim = email.auth_results.dkim[0]

    assert dkim.result == DKIMStatus.PASS
    assert dkim.domain == "example.com"

    print(f"DKIM {dkim.result.value} ({dkim.selector}._domainkey.{dkim.domain})")
```

## DMARC (Domain-based Message Authentication)

Checks that SPF or DKIM align with the From address and enforces the domain's policy.

### DMARC Result Structure

```python
from vaultsandbox.types import DMARCStatus, DMARCPolicy

dmarc = email.auth_results.dmarc

if dmarc:
    print(dmarc.result)   # DMARCStatus.PASS, DMARCStatus.FAIL, etc.
    print(dmarc.domain)   # Domain checked
    print(dmarc.policy)   # DMARCPolicy.NONE, QUARANTINE, REJECT
    print(dmarc.aligned)  # Whether SPF/DKIM aligns with From domain
```

### DMARC Status Values

| Status | Meaning                                  |
| ------ | ---------------------------------------- |
| `PASS` | DMARC check passed (SPF or DKIM aligned) |
| `FAIL` | DMARC check failed                       |
| `NONE` | No DMARC policy found                    |

### DMARC Policies

| Policy       | Meaning                         |
| ------------ | ------------------------------- |
| `NONE`       | No action (monitoring only)     |
| `QUARANTINE` | Treat suspicious emails as spam |
| `REJECT`     | Reject emails that fail DMARC   |

### DMARC Example

```python
from vaultsandbox.types import DMARCStatus

email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

if email.auth_results.dmarc:
    dmarc = email.auth_results.dmarc

    assert dmarc.result == DMARCStatus.PASS
    assert dmarc.domain == "example.com"

    print(f"DMARC {dmarc.result.value} (policy: {dmarc.policy.value if dmarc.policy else 'none'})")
```

## Reverse DNS

Verifies the sending server's IP resolves to a hostname that matches the sending domain.

### Reverse DNS Result Structure

```python
reverse_dns = email.auth_results.reverse_dns

if reverse_dns:
    print(reverse_dns.verified)   # True if verified, False otherwise
    print(reverse_dns.ip)         # Server IP
    print(reverse_dns.hostname)   # Resolved hostname (may be None)
```

### Reverse DNS Example

```python
email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

if email.auth_results.reverse_dns:
    rdns = email.auth_results.reverse_dns

    print(f"Reverse DNS: {rdns.ip} → {rdns.hostname}")
    print(f"Verified: {rdns.verified}")
```

## Validation Helper

The `validate()` method provides a summary of all authentication checks. It requires explicit `pass` status for each check - `none` or other statuses are considered failures.

```python
validation = email.auth_results.validate()

print(validation.passed)           # True if SPF, DKIM, and DMARC all passed
print(validation.spf_passed)       # Whether SPF explicitly passed
print(validation.dkim_passed)      # Whether at least one DKIM signature passed
print(validation.dmarc_passed)     # Whether DMARC explicitly passed
print(validation.reverse_dns_passed)  # Whether reverse DNS passed
print(validation.failures)         # List of failure reasons
```

### AuthResultsValidation Structure

```python
@dataclass
class AuthResultsValidation:
    passed: bool              # True if SPF, DKIM, and DMARC all passed
    spf_passed: bool          # Whether SPF check passed
    dkim_passed: bool         # Whether at least one DKIM signature passed
    dmarc_passed: bool        # Whether DMARC check passed
    reverse_dns_passed: bool  # Whether reverse DNS check passed
    failures: list[str]       # Array of failure descriptions
```

> **Note:** The `passed` field reflects whether SPF, DKIM, and DMARC all passed. Reverse DNS is tracked separately in `reverse_dns_passed` but does not affect the overall `passed` status.

### Validation Examples

**All checks pass**:

```python
validation = email.auth_results.validate()

# AuthResultsValidation(
#     passed=True,
#     spf_passed=True,
#     dkim_passed=True,
#     dmarc_passed=True,
#     reverse_dns_passed=True,
#     failures=[]
# )

assert validation.passed is True
assert validation.spf_passed is True
assert validation.dkim_passed is True
assert validation.dmarc_passed is True
assert validation.failures == []
```

**Some checks fail**:

```python
validation = email.auth_results.validate()

# AuthResultsValidation(
#     passed=False,
#     spf_passed=False,
#     dkim_passed=True,
#     dmarc_passed=False,
#     reverse_dns_passed=True,
#     failures=[
#         "SPF check failed: softfail (domain: example.com)",
#         "DMARC policy: fail (policy: reject)"
#     ]
# )

if not validation.passed:
    print("Authentication failures:")
    for failure in validation.failures:
        print(f"  - {failure}")

    # Check individual results
    print(f"SPF: {'PASS' if validation.spf_passed else 'FAIL'}")
    print(f"DKIM: {'PASS' if validation.dkim_passed else 'FAIL'}")
    print(f"DMARC: {'PASS' if validation.dmarc_passed else 'FAIL'}")
    print(f"Reverse DNS: {'PASS' if validation.reverse_dns_passed else 'FAIL'}")
```

## Testing Patterns

### Strict Authentication

```python
import pytest
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_email_passes_all_authentication_checks(inbox):
    await send_email(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    validation = email.auth_results.validate()

    assert validation.passed is True
    assert validation.failures == []
```

### Lenient Authentication

```python
import pytest
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.types import DKIMStatus

@pytest.mark.asyncio
async def test_email_has_valid_dkim_signature(inbox):
    await send_email(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    # Only check DKIM (most reliable)
    assert email.auth_results.dkim is not None
    assert len(email.auth_results.dkim) > 0
    assert email.auth_results.dkim[0].result == DKIMStatus.PASS
```

### Handling Missing Authentication

```python
import pytest
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_handles_emails_without_authentication(inbox):
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    # Some senders don't have SPF/DKIM configured
    # Note: validate() requires explicit 'pass' status - 'none' is considered a failure
    validation = email.auth_results.validate()

    # Check individual results
    print(f"SPF: {'PASS' if validation.spf_passed else 'FAIL'}")
    print(f"DKIM: {'PASS' if validation.dkim_passed else 'FAIL'}")
    print(f"DMARC: {'PASS' if validation.dmarc_passed else 'FAIL'}")
    print(f"Reverse DNS: {'PASS' if validation.reverse_dns_passed else 'FAIL'}")

    # Log failures for debugging
    if not validation.passed:
        print(f"Auth failures (expected for test emails): {validation.failures}")
```

### Testing Specific Checks

```python
import pytest
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.types import SPFStatus, DKIMStatus, DMARCStatus

@pytest.fixture
async def inbox(client):
    inbox = await client.create_inbox()
    yield inbox
    await inbox.delete()

@pytest.fixture
async def email(inbox):
    await send_email(inbox.email_address)
    return await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

@pytest.mark.asyncio
async def test_spf_check(email):
    # For production emails, require explicit pass
    if email.auth_results.spf:
        assert email.auth_results.spf.result == SPFStatus.PASS

@pytest.mark.asyncio
async def test_dkim_check(email):
    # At least one DKIM signature must pass
    if email.auth_results.dkim:
        any_passed = any(d.result == DKIMStatus.PASS for d in email.auth_results.dkim)
        assert any_passed is True

@pytest.mark.asyncio
async def test_dmarc_check(email):
    # For production emails, require explicit pass
    if email.auth_results.dmarc:
        assert email.auth_results.dmarc.result == DMARCStatus.PASS
```

## Why Authentication Matters

### Production Readiness

Testing authentication catches issues like:

- **Misconfigured SPF records** → emails rejected by Gmail/Outlook
- **Missing DKIM signatures** → reduced deliverability
- **DMARC failures** → emails sent to spam
- **Reverse DNS mismatches** → flagged as suspicious

### Real-World Example

```python
import pytest
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_production_email_configuration(inbox, app):
    await app.send_welcome_email(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    validation = email.auth_results.validate()

    # In production, these should all pass
    if not validation.passed:
        print("Email authentication issues detected:")
        for failure in validation.failures:
            print(f"   {failure}")
        print("")
        print("Action required:")

        if any("SPF" in f for f in validation.failures):
            print("- Fix SPF record for your domain")
        if any("DKIM" in f for f in validation.failures):
            print("- Configure DKIM signing in your email service")
        if any("DMARC" in f for f in validation.failures):
            print("- Add/fix DMARC policy")

    # Fail test if authentication fails
    assert validation.passed is True
```

## Troubleshooting

### No Authentication Results

```python
auth = email.auth_results

if not auth.spf and not auth.dkim and not auth.dmarc:
    print("No authentication performed")
    print("This may happen for:")
    print("- Emails sent from localhost/internal servers")
    print("- Test SMTP servers without authentication")
```

### All Checks Fail

```python
validation = email.auth_results.validate()

if not validation.passed:
    print(f"Authentication failed: {validation.failures}")

    # Common causes:
    # 1. No SPF record: Add "v=spf1 ip4:YOUR_IP -all" to DNS
    # 2. No DKIM: Configure your mail server to sign emails
    # 3. No DMARC: Add "v=DMARC1; p=none" to DNS
    # 4. Wrong IP: Update SPF record with correct server IP
```

### Understanding Failure Reasons

```python
validation = email.auth_results.validate()

for failure in validation.failures:
    if "SPF" in failure:
        print("Fix SPF: Update DNS TXT record for your domain")
    if "DKIM" in failure:
        print("Fix DKIM: Enable DKIM signing in your email service")
    if "DMARC" in failure:
        print("Fix DMARC: Add DMARC policy to DNS")
```

## Next Steps

- **[Email Authentication Guide](/client-python/guides/authentication/)** - Testing authentication in depth
- **[Email Objects](/client-python/concepts/emails/)** - Understanding email structure
- **[Testing Patterns](/client-python/testing/password-reset/)** - Real-world testing examples
- **[Gateway Security](/gateway/security/)** - Understanding the security model
