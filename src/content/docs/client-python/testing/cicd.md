---
title: CI/CD Integration
description: Learn how to integrate VaultSandbox email testing into your CI/CD pipelines with pytest
---

VaultSandbox is designed specifically for automated testing in CI/CD pipelines. This guide shows you how to integrate email testing into popular CI/CD platforms using pytest.

## pytest Setup

Configure pytest with proper setup and teardown for reliable email testing.

### Basic Configuration

```ini
# pytest.ini
[pytest]
asyncio_mode = auto
timeout = 30
testpaths = tests
```

Or with `pyproject.toml`:

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
timeout = 30
testpaths = ["tests"]

[tool.pytest-asyncio]
mode = "auto"
```

### conftest.py Setup

```python
# tests/conftest.py
import os
import pytest
from vaultsandbox import VaultSandboxClient

@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session", autouse=True)
def verify_environment():
    """Verify environment variables are set."""
    if not os.environ.get("VAULTSANDBOX_URL"):
        pytest.skip("VAULTSANDBOX_URL environment variable is required")
    if not os.environ.get("VAULTSANDBOX_API_KEY"):
        pytest.skip("VAULTSANDBOX_API_KEY environment variable is required")

@pytest.fixture
async def client():
    """Create a VaultSandbox client for tests."""
    async with VaultSandboxClient(
        base_url=os.environ["VAULTSANDBOX_URL"],
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        yield client

@pytest.fixture
async def inbox(client):
    """Create an inbox for tests with automatic cleanup."""
    inbox = await client.create_inbox()
    yield inbox
    try:
        await inbox.delete()
    except Exception as e:
        print(f"Failed to delete inbox: {e}")

@pytest.fixture(scope="session", autouse=True)
async def cleanup_orphaned_inboxes():
    """Clean up any orphaned inboxes after all tests."""
    yield
    # Run cleanup after all tests complete
    try:
        async with VaultSandboxClient(
            base_url=os.environ.get("VAULTSANDBOX_URL", ""),
            api_key=os.environ.get("VAULTSANDBOX_API_KEY", ""),
        ) as client:
            deleted = await client.delete_all_inboxes()
            if deleted > 0:
                print(f"Cleaned up {deleted} orphaned inboxes")
    except Exception as e:
        print(f"Failed to clean up orphaned inboxes: {e}")
```

### Test Structure

```python
# tests/test_email.py
import pytest
import re
from vaultsandbox import WaitForEmailOptions

class TestEmailFlow:
    @pytest.mark.asyncio
    async def test_receives_welcome_email(self, inbox):
        await send_welcome_email(inbox.email_address)

        email = await inbox.wait_for_email(
            WaitForEmailOptions(
                timeout=10000,
                subject=re.compile(r"Welcome", re.IGNORECASE),
            )
        )

        assert "Welcome" in email.subject
        assert email.from_address == "noreply@example.com"
```

## GitHub Actions

### Basic Workflow

```yaml
# .github/workflows/test.yml
name: Email Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  email-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -e ".[test]"

      - name: Run email tests
        env:
          VAULTSANDBOX_URL: ${{ secrets.VAULTSANDBOX_URL }}
          VAULTSANDBOX_API_KEY: ${{ secrets.VAULTSANDBOX_API_KEY }}
        run: pytest tests/email/ -v
```

### With Docker Compose

If you're running VaultSandbox Gateway locally in CI:

```yaml
# .github/workflows/test-with-gateway.yml
name: Email Tests (Self-Hosted)

on: [push, pull_request]

jobs:
  email-tests:
    runs-on: ubuntu-latest

    services:
      vaultsandbox:
        image: vaultsandbox/gateway:latest
        ports:
          - 3000:3000
          - 2525:25
        env:
          API_KEYS: test-api-key-12345
          SMTP_HOST: 0.0.0.0
          SMTP_PORT: 25

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -e ".[test]"

      - name: Wait for VaultSandbox
        run: |
          timeout 30 sh -c 'until nc -z localhost 3000; do sleep 1; done'

      - name: Run email tests
        env:
          VAULTSANDBOX_URL: http://localhost:3000
          VAULTSANDBOX_API_KEY: test-api-key-12345
        run: pytest tests/ -v
```

### Parallel Testing

```yaml
# .github/workflows/test-parallel.yml
name: Parallel Email Tests

on: [push, pull_request]

jobs:
  email-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-group: [auth, transactional, notifications]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - run: pip install -e ".[test]"

      - name: Run test group
        env:
          VAULTSANDBOX_URL: ${{ secrets.VAULTSANDBOX_URL }}
          VAULTSANDBOX_API_KEY: ${{ secrets.VAULTSANDBOX_API_KEY }}
        run: pytest tests/${{ matrix.test-group }}/ -v
```

## GitLab CI

### Basic Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - test

email-tests:
  stage: test
  image: python:3.12
  cache:
    paths:
      - .cache/pip
  variables:
    PIP_CACHE_DIR: '$CI_PROJECT_DIR/.cache/pip'
    VAULTSANDBOX_URL: $VAULTSANDBOX_URL
    VAULTSANDBOX_API_KEY: $VAULTSANDBOX_API_KEY
  before_script:
    - pip install -e ".[test]"
  script:
    - pytest tests/email/ -v
```

### With Docker Compose

```yaml
# .gitlab-ci.yml
stages:
  - test

email-tests:
  stage: test
  image: python:3.12
  services:
    - name: vaultsandbox/gateway:latest
      alias: vaultsandbox
  variables:
    VAULTSANDBOX_URL: http://vaultsandbox:3000
    VAULTSANDBOX_API_KEY: test-api-key-12345
    # Service configuration
    API_KEYS: test-api-key-12345
    SMTP_HOST: 0.0.0.0
  before_script:
    - pip install -e ".[test]"
    - apt-get update && apt-get install -y netcat-openbsd
    - timeout 30 sh -c 'until nc -z vaultsandbox 3000; do sleep 1; done'
  script:
    - pytest tests/ -v
```

## CircleCI

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  email-tests:
    docker:
      - image: cimg/python:3.12
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "pyproject.toml" }}
      - run:
          name: Install dependencies
          command: pip install -e ".[test]"
      - save_cache:
          paths:
            - ~/.cache/pip
          key: v1-dependencies-{{ checksum "pyproject.toml" }}
      - run:
          name: Run email tests
          command: pytest tests/ -v
          environment:
            VAULTSANDBOX_URL: ${VAULTSANDBOX_URL}
            VAULTSANDBOX_API_KEY: ${VAULTSANDBOX_API_KEY}

workflows:
  test:
    jobs:
      - email-tests
```

## Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent {
        docker {
            image 'python:3.12'
        }
    }

    environment {
        VAULTSANDBOX_URL = credentials('vaultsandbox-url')
        VAULTSANDBOX_API_KEY = credentials('vaultsandbox-api-key')
    }

    stages {
        stage('Install') {
            steps {
                sh 'pip install -e ".[test]"'
            }
        }

        stage('Test') {
            steps {
                sh 'pytest tests/ -v --junitxml=test-results/results.xml'
            }
        }
    }

    post {
        always {
            junit 'test-results/**/*.xml'
        }
    }
}
```

## Environment Variables

### Required Variables

Set these environment variables in your CI platform:

| Variable               | Description            | Example                         |
| ---------------------- | ---------------------- | ------------------------------- |
| `VAULTSANDBOX_URL`     | Gateway URL            | `https://smtp.vaultsandbox.com` |
| `VAULTSANDBOX_API_KEY` | API authentication key | `vs_1234567890abcdef`           |

### Optional Variables

| Variable                        | Description           | Default   |
| ------------------------------- | --------------------- | --------- |
| `VAULTSANDBOX_STRATEGY`         | Delivery strategy     | `sse`     |
| `VAULTSANDBOX_TIMEOUT`          | Default timeout (ms)  | `30000`   |
| `VAULTSANDBOX_POLLING_INTERVAL` | Polling interval (ms) | `2000`    |

### Configuration Helper

```python
# config/vaultsandbox.py
import os
from dataclasses import dataclass
from vaultsandbox.types import DeliveryStrategyType

@dataclass
class VaultSandboxConfig:
    base_url: str
    api_key: str
    strategy: DeliveryStrategyType = DeliveryStrategyType.SSE
    timeout: int = 30000
    polling_interval: int = 2000

def get_vaultsandbox_config() -> VaultSandboxConfig:
    strategy_str = os.environ.get("VAULTSANDBOX_STRATEGY", "sse").upper()
    strategy = getattr(DeliveryStrategyType, strategy_str, DeliveryStrategyType.SSE)

    return VaultSandboxConfig(
        base_url=os.environ["VAULTSANDBOX_URL"],
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
        strategy=strategy,
        timeout=int(os.environ.get("VAULTSANDBOX_TIMEOUT", "30000")),
        polling_interval=int(os.environ.get("VAULTSANDBOX_POLLING_INTERVAL", "2000")),
    )

# Usage in tests
from config.vaultsandbox import get_vaultsandbox_config

config = get_vaultsandbox_config()
client = VaultSandboxClient(
    base_url=config.base_url,
    api_key=config.api_key,
    strategy=config.strategy,
)
```

## Best Practices

### Always Clean Up

Ensure inboxes are deleted even when tests fail:

```python
@pytest.fixture
async def inbox(client):
    inbox = await client.create_inbox()
    yield inbox
    try:
        await inbox.delete()
    except Exception as e:
        # Log but don't fail the test
        print(f"Failed to delete inbox: {e}")
```

### Use Global Cleanup

Add a final cleanup step to delete any orphaned inboxes:

```python
# tests/conftest.py
import atexit
import asyncio

async def cleanup_all_inboxes():
    async with VaultSandboxClient(
        base_url=os.environ.get("VAULTSANDBOX_URL", ""),
        api_key=os.environ.get("VAULTSANDBOX_API_KEY", ""),
    ) as client:
        try:
            deleted = await client.delete_all_inboxes()
            if deleted > 0:
                print(f"Cleaned up {deleted} orphaned inboxes")
        except Exception as e:
            print(f"Failed to clean up orphaned inboxes: {e}")

def sync_cleanup():
    asyncio.run(cleanup_all_inboxes())

atexit.register(sync_cleanup)
```

### Set Appropriate Timeouts

CI environments can be slower than local development:

```python
import os

CI_TIMEOUT = 30000 if os.environ.get("CI") else 10000

@pytest.mark.asyncio
async def test_receives_email(inbox):
    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            timeout=CI_TIMEOUT,
            subject="Welcome",
        )
    )

    assert email is not None
```

### Use Test Isolation

Each test should create its own inbox:

```python
# Good: Isolated tests
class TestEmailFlow:
    @pytest.fixture
    async def inbox(self, client):
        inbox = await client.create_inbox()
        yield inbox
        await inbox.delete()

    @pytest.mark.asyncio
    async def test_1(self, inbox):
        # Uses fresh inbox
        pass

    @pytest.mark.asyncio
    async def test_2(self, inbox):
        # Uses different fresh inbox
        pass


# Avoid: Shared inbox across tests (causes flakiness)
# class TestEmailFlow:
#     @pytest.fixture(scope="class")  # BAD: Shared state
#     async def inbox(self, client):
#         return await client.create_inbox()
```

### Handle Flaky Tests

Add retries for occasionally flaky email tests using pytest-rerunfailures:

```ini
# pytest.ini
[pytest]
reruns = 2
reruns_delay = 1
```

Or with a decorator:

```python
import pytest

@pytest.mark.flaky(reruns=2, reruns_delay=1)
@pytest.mark.asyncio
async def test_receives_email(inbox):
    email = await inbox.wait_for_email(
        WaitForEmailOptions(timeout=10000, subject="Welcome")
    )
    assert email is not None
```

### Log Helpful Debug Info

Add logging to help debug CI failures:

```python
import logging

logger = logging.getLogger(__name__)

@pytest.mark.asyncio
async def test_receives_welcome_email(inbox):
    logger.info(f"Created inbox: {inbox.email_address}")

    await send_welcome_email(inbox.email_address)
    logger.info("Triggered welcome email")

    email = await inbox.wait_for_email(
        WaitForEmailOptions(timeout=10000, subject="Welcome")
    )

    logger.info(f"Received email: {email.subject}")
    assert email.from_address == "noreply@example.com"
```

## Troubleshooting

### Tests Timeout in CI

**Symptoms:** Tests pass locally but timeout in CI

**Solutions:**

- Increase timeout values for CI environment
- Check network connectivity to VaultSandbox Gateway
- Verify API key is correctly set in CI environment
- Use longer polling intervals to reduce API load

```python
import os

config = {
    "base_url": os.environ["VAULTSANDBOX_URL"],
    "api_key": os.environ["VAULTSANDBOX_API_KEY"],
    "polling_interval": 3000 if os.environ.get("CI") else 1000,
}
```

### Rate Limiting

**Symptoms:** Tests fail with 429 status codes

**Solutions:**

- Reduce test parallelization
- Increase retry delay
- Use fewer inboxes per test
- Configure rate limit handling

```python
from vaultsandbox import VaultSandboxClient

client = VaultSandboxClient(
    base_url=os.environ["VAULTSANDBOX_URL"],
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    max_retries=5,
    retry_delay=2000,
    retry_on_status_codes=[408, 429, 500, 502, 503, 504],
)
```

### Orphaned Inboxes

**Symptoms:** Running out of inbox quota

**Solutions:**

- Always use fixtures with cleanup
- Add global cleanup in conftest.py
- Manually clean up using `delete_all_inboxes()`

```python
# scripts/cleanup_inboxes.py
import asyncio
import os
from vaultsandbox import VaultSandboxClient

async def main():
    async with VaultSandboxClient(
        base_url=os.environ["VAULTSANDBOX_URL"],
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    ) as client:
        deleted = await client.delete_all_inboxes()
        print(f"Deleted {deleted} inboxes")

if __name__ == "__main__":
    asyncio.run(main())
```

```bash
# Manual cleanup
python scripts/cleanup_inboxes.py
```

### Connection Issues

**Symptoms:** Cannot connect to VaultSandbox Gateway

**Solutions:**

- Verify URL is correct and accessible from CI
- Check firewall rules
- Ensure service is running (for self-hosted)
- Test with curl/wget in CI

```yaml
- name: Test connectivity
  run: curl -f $VAULTSANDBOX_URL/health || exit 1
```

## Performance Optimization

### Parallel Test Execution

Run tests in parallel for faster CI builds:

```bash
# pytest with workers
pip install pytest-xdist
pytest tests/ -n 4  # 4 parallel workers

# Split tests across CI jobs
pytest tests/ --shard=1/4
pytest tests/ --shard=2/4
pytest tests/ --shard=3/4
pytest tests/ --shard=4/4
```

### Reduce API Calls

Minimize API calls by batching operations:

```python
# Good: Single API call
emails = await inbox.list_emails()
welcome = next((e for e in emails if "Welcome" in e.subject), None)

# Avoid: Multiple API calls
email1 = await inbox.get_email(id1)
email2 = await inbox.get_email(id2)
```

### Use SSE for Real-time Tests

Enable SSE strategy for faster delivery in supported environments:

```python
from vaultsandbox import VaultSandboxClient
from vaultsandbox.types import DeliveryStrategyType

client = VaultSandboxClient(
    base_url=os.environ["VAULTSANDBOX_URL"],
    api_key=os.environ["VAULTSANDBOX_API_KEY"],
    strategy=DeliveryStrategyType.SSE,  # Faster than polling
)
```

## Next Steps

- [Password Reset Testing](/client-python/testing/password-reset/) - Specific test patterns
- [Multi-Email Scenarios](/client-python/testing/multi-email/) - Testing multiple emails
- [Error Handling](/client-python/api/errors/) - Handle failures gracefully
