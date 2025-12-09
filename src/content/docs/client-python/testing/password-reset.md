---
title: Testing Password Reset Flows
description: Learn how to test password reset email flows with VaultSandbox and pytest
---

Password reset flows are one of the most common email testing scenarios. This guide demonstrates how to use VaultSandbox to test password reset emails end-to-end, including link extraction and email validation.

## Basic Password Reset Test

Here's a complete example of testing a password reset flow:

```python
import os
from vaultsandbox import VaultSandboxClient, WaitForEmailOptions

async def test_password_reset():
    async with VaultSandboxClient(
        base_url=os.environ["VAULTSANDBOX_URL"],
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        inbox = await client.create_inbox()

        # Trigger password reset in your application
        await your_app.request_password_reset(inbox.email_address)

        # Wait for and validate the reset email
        email = await inbox.wait_for_email(
            WaitForEmailOptions(
                timeout=10000,
                subject="Reset your password",
            )
        )

        # Extract reset link
        reset_link = next(
            (url for url in email.links if "/reset-password" in url),
            None
        )
        print(f"Reset link: {reset_link}")

        # Validate email authentication
        validation = email.auth_results.validate()
        assert isinstance(validation.passed, bool)
        assert isinstance(validation.failures, list)

        await inbox.delete()
```

## pytest Integration

Integrate password reset testing into your pytest test suite:

```python
import pytest
import re
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


class TestPasswordResetFlow:
    @pytest.mark.asyncio
    async def test_sends_password_reset_email_with_valid_link(self, inbox):
        # Trigger password reset
        await request_password_reset(inbox.email_address)

        # Wait for email
        email = await inbox.wait_for_email(
            WaitForEmailOptions(
                timeout=10000,
                subject=re.compile(r"Reset your password", re.IGNORECASE),
            )
        )

        # Validate sender
        assert email.from_address == "noreply@example.com"

        # Validate content
        assert "requested a password reset" in email.text
        assert email.html is not None

        # Extract and validate reset link
        reset_link = next(
            (url for url in email.links if "/reset-password" in url),
            None
        )
        assert reset_link is not None
        assert reset_link.startswith("https://")
        assert "token=" in reset_link

    @pytest.mark.asyncio
    async def test_contains_user_information_in_reset_email(self, inbox):
        user_email = inbox.email_address
        user_name = "John Doe"

        await request_password_reset(user_email, name=user_name)

        email = await inbox.wait_for_email(
            WaitForEmailOptions(
                timeout=10000,
                subject=re.compile(r"Reset your password", re.IGNORECASE),
            )
        )

        # Verify personalization
        assert user_name in email.text
        assert user_email in email.to

    @pytest.mark.asyncio
    async def test_validates_reset_link_is_functional(self, inbox):
        await request_password_reset(inbox.email_address)

        email = await inbox.wait_for_email(
            WaitForEmailOptions(
                timeout=10000,
                subject=re.compile(r"Reset your password", re.IGNORECASE),
            )
        )

        reset_link = next(
            (url for url in email.links if "/reset-password" in url),
            None
        )

        # Test that the link is accessible
        import httpx
        async with httpx.AsyncClient() as http:
            response = await http.get(reset_link)
            assert response.is_success
            assert response.status_code == 200
```

## Link Extraction Patterns

VaultSandbox automatically extracts all links from emails. Here are common patterns for finding password reset links:

```python
# Find by path
reset_link = next(
    (url for url in email.links if "/reset-password" in url),
    None
)

# Find by domain
reset_link = next(
    (url for url in email.links if "yourdomain.com/reset" in url),
    None
)

# Find by query parameter
reset_link = next(
    (url for url in email.links if "token=" in url),
    None
)

# Find using regex
import re
pattern = re.compile(r"/reset.*token=")
reset_link = next(
    (url for url in email.links if pattern.search(url)),
    None
)

# Extract token from link
from urllib.parse import urlparse, parse_qs

url = urlparse(reset_link)
params = parse_qs(url.query)
token = params.get("token", [None])[0]
assert token is not None
assert len(token) > 20
```

## Validating Email Content

Test the content and formatting of your password reset emails:

```python
@pytest.mark.asyncio
async def test_has_properly_formatted_reset_email(inbox):
    await request_password_reset(inbox.email_address)

    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject=re.compile(r"Reset your password", re.IGNORECASE),
        )
    )

    # Validate plain text version
    assert email.text is not None
    assert "reset your password" in email.text.lower()
    assert "undefined" not in email.text
    assert "[object Object]" not in email.text

    # Validate HTML version
    assert email.html is not None
    assert '<a href=' in email.html
    assert "reset" in email.html.lower()

    # Validate email has exactly one reset link
    reset_links = [url for url in email.links if "/reset-password" in url]
    assert len(reset_links) == 1

    # Validate headers
    assert email.headers.get("content-type") is not None
```

## Testing Security Features

Validate email authentication to ensure your emails won't be marked as spam:

```python
@pytest.mark.asyncio
async def test_passes_email_authentication_checks(inbox):
    await request_password_reset(inbox.email_address)

    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject=re.compile(r"Reset your password", re.IGNORECASE),
        )
    )

    validation = email.auth_results.validate()

    # Check that validation was performed
    assert validation is not None
    assert isinstance(validation.passed, bool)
    assert isinstance(validation.failures, list)

    # Log any failures for debugging
    if not validation.passed:
        print(f"Email authentication failures: {validation.failures}")

    # Check individual authentication methods (if configured)
    if email.auth_results.spf and email.auth_results.spf.status:
        from vaultsandbox.types import SPFStatus
        assert email.auth_results.spf.status in (
            SPFStatus.PASS,
            SPFStatus.NEUTRAL,
            SPFStatus.SOFTFAIL,
        )

    if email.auth_results.dkim and len(email.auth_results.dkim) > 0:
        assert email.auth_results.dkim[0].status is not None
```

## Testing Reset Token Expiration

Test that your password reset emails include expiration information:

```python
@pytest.mark.asyncio
async def test_includes_expiration_time_in_reset_email(inbox):
    await request_password_reset(inbox.email_address)

    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject=re.compile(r"Reset your password", re.IGNORECASE),
        )
    )

    # Validate expiration is mentioned
    text_lower = email.text.lower()
    has_expiration = any(phrase in text_lower for phrase in [
        "expires",
        "valid for",
        "24 hours",
        "1 hour",
    ])

    assert has_expiration
```

## Testing Multiple Reset Requests

Test what happens when a user requests multiple password resets:

```python
@pytest.mark.asyncio
async def test_handles_multiple_reset_requests(inbox):
    # Request multiple resets
    await request_password_reset(inbox.email_address)
    await request_password_reset(inbox.email_address)

    # Wait for both emails
    await inbox.wait_for_email_count(2, timeout=15000)

    emails = await inbox.list_emails()
    assert len(emails) == 2

    # Both should have reset links
    for email in emails:
        reset_link = next(
            (url for url in email.links if "/reset-password" in url),
            None
        )
        assert reset_link is not None

    # Tokens should be different (if your app invalidates old tokens)
    from urllib.parse import urlparse, parse_qs

    link1 = next(url for url in emails[0].links if "/reset-password" in url)
    link2 = next(url for url in emails[1].links if "/reset-password" in url)

    token1 = parse_qs(urlparse(link1).query).get("token", [None])[0]
    token2 = parse_qs(urlparse(link2).query).get("token", [None])[0]

    assert token1 != token2
```

## Best Practices

### Use Specific Subject Filters

Always filter by subject to ensure you're testing the right email:

```python
# Good: Specific subject filter
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=10000,
        subject=re.compile(r"Reset your password", re.IGNORECASE),
    )
)

# Avoid: No filter (might match wrong email in CI)
email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
```

### Clean Up Inboxes

Always delete inboxes after tests to avoid hitting limits:

```python
@pytest.fixture
async def inbox(client):
    inbox = await client.create_inbox()
    yield inbox
    await inbox.delete()
```

### Use Appropriate Timeouts

Set realistic timeouts based on your email delivery speed:

```python
import os

# Adjust timeout based on environment
CI_TIMEOUT = 15000 if os.environ.get("CI") else 5000

email = await inbox.wait_for_email(
    WaitForEmailOptions(timeout=CI_TIMEOUT)
)
```

### Test Complete Flow

Don't just validate that the email was sent - test that the link actually works:

```python
@pytest.mark.asyncio
async def test_completes_full_password_reset_flow(inbox):
    # 1. Request reset
    await request_password_reset(inbox.email_address)

    # 2. Get email
    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=10000,
            subject=re.compile(r"Reset your password", re.IGNORECASE),
        )
    )

    # 3. Extract link
    reset_link = next(
        (url for url in email.links if "/reset-password" in url),
        None
    )

    # 4. Visit reset page
    import httpx
    async with httpx.AsyncClient() as http:
        response = await http.get(reset_link)
        assert response.is_success

    # 5. Submit new password
    new_password = "NewSecurePassword123!"
    await submit_password_reset(reset_link, new_password)

    # 6. Verify login with new password
    login_success = await login(inbox.email_address, new_password)
    assert login_success
```

## Next Steps

- [Testing Multi-Email Scenarios](/client-python/testing/multi-email/) - Handle multiple emails
- [CI/CD Integration](/client-python/testing/cicd/) - Run tests in your pipeline
- [Working with Attachments](/client-python/guides/attachments/) - Test emails with attachments
