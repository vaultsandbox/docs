---
title: Email Authentication Testing
description: Test SPF, DKIM, and DMARC email authentication
---

VaultSandbox validates SPF, DKIM, DMARC, and reverse DNS for every email, helping you catch authentication issues before production.

## Why Test Email Authentication?

Email authentication prevents:

- Emails being marked as spam
- Emails being rejected by receivers
- Domain spoofing and phishing
- Delivery failures

Testing authentication ensures your emails will be trusted by Gmail, Outlook, and other providers.

## Basic Authentication Check

### Using validate()

```python
from vaultsandbox import WaitForEmailOptions

email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
validation = email.auth_results.validate()

if validation.passed:
    print("All authentication checks passed")
else:
    print("Authentication failures:")
    for failure in validation.failures:
        print(f"  - {failure}")
```

### Checking Individual Results

```python
auth = email.auth_results

print(f"SPF: {auth.spf.status if auth.spf else 'N/A'}")
print(f"DKIM: {auth.dkim[0].status if auth.dkim else 'N/A'}")
print(f"DMARC: {auth.dmarc.status if auth.dmarc else 'N/A'}")
print(f"Reverse DNS: {auth.reverse_dns.status if auth.reverse_dns else 'N/A'}")
```

## Testing SPF

### Basic SPF Test

```python
import pytest
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_email_passes_spf_check(inbox):
    await send_email(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    assert email.auth_results.spf is not None
    assert email.auth_results.spf.status == "pass"
```

### Detailed SPF Validation

```python
@pytest.mark.asyncio
async def test_spf_validation_details(inbox):
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    spf = email.auth_results.spf

    if spf:
        assert spf.status == "pass"
        assert spf.domain == "example.com"

        print(f"SPF {spf.status} for {spf.domain}")
        print(f"Info: {spf.info}")
```

### Handling SPF Failures

```python
@pytest.mark.asyncio
async def test_handles_spf_failure(inbox):
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    spf = email.auth_results.spf

    if spf and spf.status != "pass":
        print(f"SPF {spf.status}: {spf.info}")

        # Common failures
        if spf.status == "fail":
            print("Server IP not authorized in SPF record")
            print("Action: Add server IP to SPF record")
        elif spf.status == "softfail":
            print("Server probably not authorized (~all in SPF)")
        elif spf.status == "none":
            print("No SPF record found")
            print("Action: Add SPF record to DNS")
```

## Testing DKIM

### Basic DKIM Test

```python
@pytest.mark.asyncio
async def test_email_has_valid_dkim_signature(inbox):
    await send_email(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    assert email.auth_results.dkim is not None
    assert len(email.auth_results.dkim) > 0
    assert email.auth_results.dkim[0].status == "pass"
```

### Multiple DKIM Signatures

```python
@pytest.mark.asyncio
async def test_validates_all_dkim_signatures(inbox):
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    dkim = email.auth_results.dkim

    if dkim and len(dkim) > 0:
        print(f"Email has {len(dkim)} DKIM signature(s)")

        for i, sig in enumerate(dkim):
            print(f"Signature {i + 1}: status={sig.status}, domain={sig.domain}, selector={sig.selector}")
            assert sig.status == "pass"

        # At least one signature should pass
        any_passed = any(sig.status == "pass" for sig in dkim)
        assert any_passed
```

### DKIM Selector Verification

```python
@pytest.mark.asyncio
async def test_dkim_uses_correct_selector(inbox):
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    dkim = email.auth_results.dkim[0] if email.auth_results.dkim else None

    if dkim:
        assert dkim.selector == "default"  # Or your expected selector
        assert dkim.domain == "example.com"

        # DKIM DNS record should exist at:
        # {selector}._domainkey.{domain}
        print(f"DKIM key at: {dkim.selector}._domainkey.{dkim.domain}")
```

## Testing DMARC

### Basic DMARC Test

```python
@pytest.mark.asyncio
async def test_email_passes_dmarc(inbox):
    await send_email(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    assert email.auth_results.dmarc is not None
    assert email.auth_results.dmarc.status == "pass"
```

### DMARC Policy Verification

```python
@pytest.mark.asyncio
async def test_dmarc_policy_is_enforced(inbox):
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    dmarc = email.auth_results.dmarc

    if dmarc:
        print(f"DMARC status: {dmarc.status}")
        print(f"DMARC policy: {dmarc.policy}")

        # Policy should be restrictive in production
        assert dmarc.policy in ["quarantine", "reject"]
```

### DMARC Alignment Check

```python
@pytest.mark.asyncio
async def test_dmarc_alignment_requirements(inbox):
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    # DMARC requires either SPF or DKIM to align with From domain
    auth = email.auth_results
    dmarc_passed = auth.dmarc and auth.dmarc.status == "pass"

    if not dmarc_passed:
        print("DMARC failed. Checking alignment:")

        spf_passed = auth.spf and auth.spf.status == "pass"
        dkim_passed = auth.dkim and any(d.status == "pass" for d in auth.dkim)

        print(f"SPF passed: {spf_passed}")
        print(f"DKIM passed: {dkim_passed}")

        # At least one should pass for DMARC to pass
        assert spf_passed or dkim_passed
```

## Testing Reverse DNS

### Basic Reverse DNS Test

```python
@pytest.mark.asyncio
async def test_server_has_valid_reverse_dns(inbox):
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    rdns = email.auth_results.reverse_dns

    if rdns:
        assert rdns.status == "pass"
        assert rdns.hostname

        print(f"Reverse DNS: {rdns.ip} -> {rdns.hostname}")
        print(f"Status: {rdns.status}")
```

## Complete Authentication Test

### All Checks Pass

```python
@pytest.mark.asyncio
async def test_email_passes_all_authentication_checks(inbox):
    await app.send_production_email(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    validation = email.auth_results.validate()

    # All checks should pass in production
    assert validation.passed

    # Check individual components if needed (already covered by validation.passed)
    auth = email.auth_results
    assert auth.spf and auth.spf.status == "pass"
    assert auth.dkim and any(d.status == "pass" for d in auth.dkim)
    assert auth.dmarc and auth.dmarc.status == "pass"

    # Log results
    print("Authentication Results:")
    print(f"  SPF: {auth.spf.status if auth.spf else 'N/A'}")
    print(f"  DKIM: {auth.dkim[0].status if auth.dkim else 'N/A'}")
    print(f"  DMARC: {auth.dmarc.status if auth.dmarc else 'N/A'}")
    print(f"  Reverse DNS: {auth.reverse_dns.status if auth.reverse_dns else 'N/A'}")
```

### Graceful Failure Handling

```python
@pytest.mark.asyncio
async def test_handles_authentication_failures_gracefully(inbox):
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    validation = email.auth_results.validate()

    # Log failures without failing test (for non-production)
    if not validation.passed:
        print("Authentication issues detected:")
        for failure in validation.failures:
            print(f"  - {failure}")

        # Provide remediation steps
        failures_str = " ".join(validation.failures)

        if "SPF" in failures_str:
            print("\nTo fix SPF:")
            print("  Add to DNS: v=spf1 ip4:YOUR_SERVER_IP -all")

        if "DKIM" in failures_str:
            print("\nTo fix DKIM:")
            print("  1. Generate DKIM keys")
            print("  2. Add public key to DNS")
            print("  3. Configure mail server to sign emails")

        if "DMARC" in failures_str:
            print("\nTo fix DMARC:")
            print("  Add to DNS: v=DMARC1; p=none; rua=mailto:dmarc@example.com")

    # In production, this should be assert validation.passed
```

## Real-World Testing Patterns

### Pre-Production Validation

```python
import pytest

class TestEmailAuthPreProduction:
    @pytest.mark.asyncio
    async def test_validates_staging_environment_email_auth(self, inbox):
        email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
        validation = email.auth_results.validate()

        # Check individual results using the validation helper
        print(f"SPF: {'PASS' if validation.spf_passed else 'FAIL'}")
        print(f"DKIM: {'PASS' if validation.dkim_passed else 'FAIL'}")
        print(f"DMARC: {'PASS' if validation.dmarc_passed else 'FAIL'}")
        print(f"Reverse DNS: {'PASS' if validation.reverse_dns_passed else 'FAIL'}")

        # SPF should be configured (requires explicit 'pass')
        if not validation.spf_passed:
            print("SPF not configured correctly")
            if email.auth_results.spf:
                print(f"   Status: {email.auth_results.spf.status}")
                print(f"   Info: {email.auth_results.spf.info}")
            print("   Fix: Add SPF record to DNS")
        assert validation.spf_passed

        # DKIM should be present (at least one signature must pass)
        if not validation.dkim_passed:
            print("No valid DKIM signatures")
            print("   Fix: Configure DKIM signing in mail server")
        assert validation.dkim_passed
```

### Production Readiness Check

```python
@pytest.mark.asyncio
async def test_production_email_configuration(inbox):
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    validation = email.auth_results.validate()
    auth = email.auth_results

    # Helper functions to check status
    def check_spf():
        return auth.spf and auth.spf.status == "pass"

    def check_dkim():
        return auth.dkim and any(d.status == "pass" for d in auth.dkim)

    def check_dmarc():
        return auth.dmarc and auth.dmarc.status == "pass"

    # Production requirements
    production_ready = {
        "spf": check_spf(),
        "dkim": check_dkim(),
        "dmarc": check_dmarc(),
        "all_passed": validation.passed,
    }

    print("Production Readiness:")
    for key, value in production_ready.items():
        print(f"  {key}: {'PASS' if value else 'FAIL'}")

    # Fail if not production-ready
    if not validation.passed:
        issues = "\n  ".join(validation.failures)
        raise AssertionError(
            f"Email not production-ready:\n  {issues}\n\n"
            "Fix these issues before deploying to production."
        )

    assert validation.passed
```

## Debugging Authentication Issues

### Verbose Logging

```python
def log_authentication_details(email):
    auth = email.auth_results

    print("\n=== Email Authentication Details ===\n")

    # SPF
    if auth.spf:
        print("SPF:")
        print(f"  Status: {auth.spf.status}")
        print(f"  Domain: {auth.spf.domain}")
        print(f"  Info: {auth.spf.info}")
    else:
        print("SPF: No result")

    # DKIM
    if auth.dkim and len(auth.dkim) > 0:
        print("\nDKIM:")
        for i, sig in enumerate(auth.dkim):
            print(f"  Signature {i + 1}:")
            print(f"    Status: {sig.status}")
            print(f"    Domain: {sig.domain}")
            print(f"    Selector: {sig.selector}")
            print(f"    Info: {sig.info}")
    else:
        print("\nDKIM: No signatures")

    # DMARC
    if auth.dmarc:
        print("\nDMARC:")
        print(f"  Status: {auth.dmarc.status}")
        print(f"  Domain: {auth.dmarc.domain}")
        print(f"  Policy: {auth.dmarc.policy}")
    else:
        print("\nDMARC: No result")

    # Reverse DNS
    if auth.reverse_dns:
        print("\nReverse DNS:")
        print(f"  Status: {auth.reverse_dns.status}")
        print(f"  IP: {auth.reverse_dns.ip}")
        print(f"  Hostname: {auth.reverse_dns.hostname}")

    # Validation Summary
    validation = auth.validate()
    print("\nValidation Summary:")
    print(f"  Overall: {'PASS' if validation.passed else 'FAIL'}")
    if not validation.passed:
        print("  Failures:")
        for failure in validation.failures:
            print(f"    - {failure}")

# Usage
email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
log_authentication_details(email)
```

## Next Steps

- **[Authentication Results](/client-python/concepts/auth-results/)** - Deep dive into auth results
- **[Email Objects](/client-python/concepts/emails/)** - Understanding email structure
- **[Testing Patterns](/client-python/testing/password-reset/)** - Real-world test examples
- **[Gateway Security](/gateway/security/)** - Understanding the security model
