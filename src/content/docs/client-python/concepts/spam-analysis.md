---
title: Spam Analysis
description: Understanding spam analysis results from Rspamd integration in VaultSandbox
---

VaultSandbox can analyze incoming emails for spam using [Rspamd](https://rspamd.com/) integration. When enabled on the server, each email is scored and results are available in the email object.

## What is Spam Analysis?

Spam analysis helps identify unwanted or malicious emails by:

- Scoring emails based on various spam indicators
- Identifying triggered rules (symbols)
- Providing actionable recommendations (reject, add header, etc.)
- Operating at both global and per-inbox levels

## SpamAnalysisResult Object

When spam analysis is enabled, every email has a `spam_analysis` property:

```python
from vaultsandbox import WaitForEmailOptions

email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

if email.spam_analysis:
    print(email.spam_analysis.status)      # SpamAnalysisStatus.ANALYZED
    print(email.spam_analysis.score)       # 5.2
    print(email.spam_analysis.is_spam)     # False
    print(email.spam_analysis.action)      # SpamAction.ADD_HEADER
    print(email.spam_analysis.symbols)     # List of triggered rules
```

## Quick Access Properties

For convenience, the `Email` class provides shorthand properties:

```python
email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

# Quick access (returns None if not analyzed)
print(email.is_spam)      # True/False/None
print(email.spam_score)   # float or None
```

## Result Structure

### SpamAnalysisResult

```python
from vaultsandbox.types import SpamAnalysisStatus, SpamAction

@dataclass
class SpamAnalysisResult:
    status: SpamAnalysisStatus
    score: float | None = None
    required_score: float | None = None
    action: SpamAction | None = None
    is_spam: bool | None = None
    symbols: list[SpamSymbol] = field(default_factory=list)
    processing_time_ms: int | None = None
    info: str | None = None
```

| Property             | Type                            | Description                                            |
| -------------------- | ------------------------------- | ------------------------------------------------------ |
| `status`             | `SpamAnalysisStatus`            | Analysis status (analyzed, skipped, error)             |
| `score`              | `float \| None`                 | Overall spam score (positive = more spammy)            |
| `required_score`     | `float \| None`                 | Threshold for spam classification                      |
| `action`             | `SpamAction \| None`            | Recommended action from Rspamd                         |
| `is_spam`            | `bool \| None`                  | Whether score >= required_score                        |
| `symbols`            | `list[SpamSymbol]`              | List of triggered rules with their scores              |
| `processing_time_ms` | `int \| None`                   | Time taken for analysis in milliseconds                |
| `info`               | `str \| None`                   | Additional info (error message or skip reason)         |

### SpamAnalysisStatus

```python
from vaultsandbox.types import SpamAnalysisStatus

class SpamAnalysisStatus(str, Enum):
    ANALYZED = "analyzed"   # Email was successfully analyzed
    SKIPPED = "skipped"     # Analysis was skipped
    ERROR = "error"         # Analysis failed
```

| Status     | Description                                                |
| ---------- | ---------------------------------------------------------- |
| `ANALYZED` | Email was successfully analyzed by Rspamd                  |
| `SKIPPED`  | Analysis was skipped (disabled globally or for this inbox) |
| `ERROR`    | Analysis failed (timeout, connection error, etc.)          |

### SpamAction

Rspamd returns an action recommendation based on the spam score:

```python
from vaultsandbox.types import SpamAction

class SpamAction(str, Enum):
    NO_ACTION = "no action"
    GREYLIST = "greylist"
    ADD_HEADER = "add header"
    REWRITE_SUBJECT = "rewrite subject"
    SOFT_REJECT = "soft reject"
    REJECT = "reject"
```

| Action            | Description                              |
| ----------------- | ---------------------------------------- |
| `NO_ACTION`       | Email is likely legitimate               |
| `GREYLIST`        | Temporary rejection recommended          |
| `ADD_HEADER`      | Add spam header but deliver              |
| `REWRITE_SUBJECT` | Modify subject line to indicate spam     |
| `SOFT_REJECT`     | Temporary rejection                      |
| `REJECT`          | Permanently reject the email             |

### SpamSymbol

Symbols represent individual rules that triggered during analysis:

```python
@dataclass
class SpamSymbol:
    name: str
    score: float
    description: str | None = None
    options: list[str] | None = None
```

| Property      | Type               | Description                                            |
| ------------- | ------------------ | ------------------------------------------------------ |
| `name`        | `str`              | Rule identifier (e.g., `DKIM_SIGNED`, `BAYES_SPAM`)    |
| `score`       | `float`            | Score contribution (positive = spam, negative = ham)   |
| `description` | `str \| None`      | Human-readable explanation                             |
| `options`     | `list[str] \| None`| Additional context (e.g., matched URLs)                |

## Enabling Spam Analysis

### Server-Side

Spam analysis must be enabled on the Gateway server. See [Gateway Spam Analysis](/gateway/spam-analysis/) for server configuration.

### Per-Inbox Control

You can enable or disable spam analysis per inbox:

```python
from vaultsandbox import CreateInboxOptions

# Enable spam analysis for this inbox
inbox = await client.create_inbox(CreateInboxOptions(spam_analysis=True))

# Disable spam analysis for this inbox
inbox = await client.create_inbox(CreateInboxOptions(spam_analysis=False))

# Use server default (omit the option)
inbox = await client.create_inbox()
```

### Checking Server Support

Use `get_server_info()` to check if spam analysis is available:

```python
info = await client.get_server_info()

if info.spam_analysis_enabled:
    print("Spam analysis is available on this server")
else:
    print("Spam analysis is not enabled on this server")
```

## Working with Results

### Basic Spam Check

```python
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.types import SpamAnalysisStatus

email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

# Quick check using convenience property
if email.is_spam:
    print("This email is classified as spam")
elif email.is_spam is False:
    print("This email is not spam")
else:
    print("Spam analysis was not performed")
```

### Detailed Analysis

```python
from vaultsandbox.types import SpamAnalysisStatus, SpamAction

email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

if email.spam_analysis and email.spam_analysis.status == SpamAnalysisStatus.ANALYZED:
    analysis = email.spam_analysis

    print(f"Spam Score: {analysis.score}")
    print(f"Required Score: {analysis.required_score}")
    print(f"Is Spam: {analysis.is_spam}")
    print(f"Action: {analysis.action.value if analysis.action else 'none'}")
    print(f"Processing Time: {analysis.processing_time_ms}ms")

    print("\nTriggered Rules:")
    for symbol in analysis.symbols:
        desc = f" - {symbol.description}" if symbol.description else ""
        print(f"  {symbol.name}: {symbol.score:+.1f}{desc}")
```

### Handling Different Statuses

```python
from vaultsandbox.types import SpamAnalysisStatus

email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

if not email.spam_analysis:
    print("No spam analysis data available")
elif email.spam_analysis.status == SpamAnalysisStatus.ANALYZED:
    print(f"Analyzed: score={email.spam_analysis.score}")
elif email.spam_analysis.status == SpamAnalysisStatus.SKIPPED:
    print(f"Skipped: {email.spam_analysis.info or 'reason unknown'}")
elif email.spam_analysis.status == SpamAnalysisStatus.ERROR:
    print(f"Error: {email.spam_analysis.info or 'unknown error'}")
```

### Filtering by Spam Status

```python
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.types import SpamAnalysisStatus

# Wait for a non-spam email
email = await inbox.wait_for_email(
    WaitForEmailOptions(
        timeout=30000,
        predicate=lambda e: e.is_spam is False,
    )
)

# Or filter spam emails
spam_emails = [e for e in await inbox.list_emails() if e.is_spam]
```

## Testing Patterns

### Verify Spam Detection

```python
import pytest
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.types import SpamAnalysisStatus

@pytest.mark.asyncio
async def test_spam_detection_works(inbox):
    # Send a known spam-like email
    await send_spammy_email(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    assert email.spam_analysis is not None
    assert email.spam_analysis.status == SpamAnalysisStatus.ANALYZED
    assert email.is_spam is True
    assert email.spam_score is not None
    assert email.spam_score > 0
```

### Verify Legitimate Email

```python
import pytest
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.types import SpamAnalysisStatus, SpamAction

@pytest.mark.asyncio
async def test_legitimate_email_not_flagged(inbox):
    await send_welcome_email(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    assert email.is_spam is False
    assert email.spam_analysis.action in [SpamAction.NO_ACTION, SpamAction.ADD_HEADER]
```

### Check Specific Rules

```python
import pytest
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_dkim_signed_detected(inbox):
    await send_email_with_dkim(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    if email.spam_analysis:
        symbol_names = [s.name for s in email.spam_analysis.symbols]
        assert "DKIM_SIGNED" in symbol_names or "R_DKIM_ALLOW" in symbol_names
```

### Handle Missing Analysis

```python
import pytest
from vaultsandbox import WaitForEmailOptions
from vaultsandbox.types import SpamAnalysisStatus

@pytest.mark.asyncio
async def test_handles_missing_spam_analysis(inbox):
    """Test gracefully handles when spam analysis is disabled."""
    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

    # These should not raise, just return None
    is_spam = email.is_spam
    score = email.spam_score

    if email.spam_analysis:
        if email.spam_analysis.status == SpamAnalysisStatus.SKIPPED:
            print("Spam analysis was skipped for this inbox")
```

## Troubleshooting

### No Spam Analysis Data

```python
if not email.spam_analysis:
    # Check server support
    info = await client.get_server_info()
    if not info.spam_analysis_enabled:
        print("Spam analysis is not enabled on the server")
    else:
        print("Spam analysis enabled but no data - check inbox settings")
```

### Analysis Returns Error

```python
from vaultsandbox.types import SpamAnalysisStatus

if email.spam_analysis and email.spam_analysis.status == SpamAnalysisStatus.ERROR:
    print(f"Spam analysis failed: {email.spam_analysis.info}")
    # Common causes:
    # - Rspamd service unreachable
    # - Analysis timeout
    # - Invalid email format
```

### All Emails Show Skipped

```python
from vaultsandbox.types import SpamAnalysisStatus

if email.spam_analysis and email.spam_analysis.status == SpamAnalysisStatus.SKIPPED:
    print("Spam analysis skipped")
    # Check:
    # 1. Server has VSB_SPAM_ANALYSIS_ENABLED=true
    # 2. Inbox was created with spam_analysis=True (or default is True)
    # 3. Gateway is running in 'local' mode (not 'backend' mode)
```

## Next Steps

- **[Gateway Spam Analysis](/gateway/spam-analysis/)** - Server-side configuration
- **[Email Objects](/client-python/concepts/emails/)** - Understanding email structure
- **[Authentication Results](/client-python/concepts/auth-results/)** - Email authentication details
- **[API Reference: Email](/client-python/api/email/)** - Complete API documentation
