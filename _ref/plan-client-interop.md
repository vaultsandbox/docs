# Implementation Plan: client-interop

Cross-SDK integration test suite for VaultSandbox client libraries.

## Overview

This repository orchestrates end-to-end interoperability tests across all 5 SDK implementations:

- `client-go`
- `client-node`
- `client-dotnet`
- `client-python`
- `client-java`

Tests verify that:

1. Inboxes created by SDK-A can be exported and imported by SDK-B
2. Emails encrypted by the server can be decrypted by any SDK
3. All SDKs conform to `vaultsandbox-spec.md`

---

## Phase 1: Repository Setup

### 1.1 Create repository structure

```
client-interop/
├── .github/
│   └── workflows/
│       └── interop-tests.yml
├── .env.example
├── .gitignore
├── Makefile
├── README.md
├── pytest.ini
├── requirements.txt
└── tests/
    ├── conftest.py
    ├── test_export_import.py
    ├── test_email_decrypt.py
    └── helpers/
        ├── __init__.py
        ├── sdk_runner.py
        └── smtp.py
```

### 1.2 Environment configuration

`.env.example`:

```
VAULTSANDBOX_URL=http://localhost:9999
VAULTSANDBOX_API_KEY=dev_api_key
SMTP_HOST=localhost
SMTP_PORT=25

# Paths to SDK repos (relative to client-interop)
CLIENT_GO_PATH=../client-go
CLIENT_NODE_PATH=../client-node
CLIENT_DOTNET_PATH=../client-dotnet
CLIENT_PYTHON_PATH=../client-python
CLIENT_JAVA_PATH=../client-java
```

---

## Phase 2: SDK Test Helpers

Each SDK needs a minimal CLI tool that the orchestrator can invoke.

### 2.1 Command interface (all SDKs must implement)

| Command                | Stdin       | Stdout                | Description                          |
| ---------------------- | ----------- | --------------------- | ------------------------------------ |
| `create-inbox`         | -           | JSON export           | Create inbox, return exported JSON   |
| `import-inbox`         | JSON export | `{"success":true}`    | Import inbox from JSON               |
| `send-email <address>` | -           | `{"messageId":"..."}` | Send test email via SMTP             |
| `read-emails`          | JSON export | `{"emails":[...]}`    | Import inbox, fetch & decrypt emails |
| `cleanup <address>`    | -           | -                     | Delete inbox                         |

### 2.2 Go: `client-go/cmd/testhelper/main.go`

```go
package main

import (
    "encoding/json"
    "fmt"
    "os"

    vaultsandbox "github.com/vaultsandbox/client-go"
)

func main() {
    if len(os.Args) < 2 {
        fatal("usage: testhelper <command> [args]")
    }

    switch os.Args[1] {
    case "create-inbox":
        createInbox()
    case "import-inbox":
        importInbox()
    case "read-emails":
        readEmails()
    case "send-email":
        sendEmail(os.Args[2])
    case "cleanup":
        cleanup(os.Args[2])
    default:
        fatal("unknown command: " + os.Args[1])
    }
}
```

Build: `go build -o testhelper ./cmd/testhelper`

### 2.3 Node: `client-node/scripts/testhelper.ts`

```typescript
import { VaultSandboxClient } from '../src/client';

const command = process.argv[2];

async function main() {
	const client = new VaultSandboxClient({
		url: process.env.VAULTSANDBOX_URL!,
		apiKey: process.env.VAULTSANDBOX_API_KEY!,
	});

	switch (command) {
		case 'create-inbox':
			await createInbox(client);
			break;
		case 'import-inbox':
			await importInbox(client);
			break;
		case 'read-emails':
			await readEmails(client);
			break;
		// ... etc
	}

	await client.close();
}
```

Run: `npx ts-node scripts/testhelper.ts <command>`

### 2.4 .NET: `client-dotnet/tools/TestHelper/Program.cs`

```csharp
using VaultSandbox.Client;

var command = args[0];
var client = new VaultSandboxClientBuilder()
    .WithUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .Build();

switch (command)
{
    case "create-inbox":
        await CreateInbox(client);
        break;
    case "import-inbox":
        await ImportInbox(client);
        break;
    // ... etc
}
```

Run: `dotnet run --project tools/TestHelper -- <command>`

### 2.5 Python: `client-python/scripts/testhelper.py`

```python
import sys
import json
from vaultsandbox import VaultSandboxClient

def main():
    command = sys.argv[1]
    client = VaultSandboxClient(
        url=os.environ["VAULTSANDBOX_URL"],
        api_key=os.environ["VAULTSANDBOX_API_KEY"],
    )

    if command == "create-inbox":
        create_inbox(client)
    elif command == "import-inbox":
        import_inbox(client)
    elif command == "read-emails":
        read_emails(client)
    # ... etc

if __name__ == "__main__":
    main()
```

Run: `python scripts/testhelper.py <command>`

### 2.6 Java: `client-java/src/test/java/TestHelper.java`

```java
public class TestHelper {
    public static void main(String[] args) throws Exception {
        String command = args[0];
        VaultSandboxClient client = VaultSandboxClient.builder()
            .url(System.getenv("VAULTSANDBOX_URL"))
            .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
            .build();

        switch (command) {
            case "create-inbox" -> createInbox(client);
            case "import-inbox" -> importInbox(client);
            case "read-emails" -> readEmails(client);
            // ... etc
        }
    }
}
```

Run: `./gradlew -q testHelper --args="<command>"`

---

## Phase 3: Python Orchestrator

### 3.1 Dependencies

`requirements.txt`:

```
pytest>=7.0
python-dotenv>=1.0
```

### 3.2 SDK Runner Helper

`tests/helpers/sdk_runner.py`:

```python
import subprocess
import json
import os
from dataclasses import dataclass
from typing import Literal

SDK = Literal["go", "node", "dotnet", "python", "java"]

@dataclass
class SDKRunner:
    sdk: SDK
    path: str

    def run(self, command: str, stdin: str = None) -> dict:
        """Run testhelper command and return parsed JSON output."""

        if self.sdk == "go":
            cmd = ["./testhelper", command]
        elif self.sdk == "node":
            cmd = ["npx", "ts-node", "scripts/testhelper.ts", command]
        elif self.sdk == "dotnet":
            cmd = ["dotnet", "run", "--project", "tools/TestHelper", "--", command]
        elif self.sdk == "python":
            cmd = ["python", "scripts/testhelper.py", command]
        elif self.sdk == "java":
            cmd = ["./gradlew", "-q", "testHelper", f"--args={command}"]

        result = subprocess.run(
            cmd,
            cwd=self.path,
            input=stdin,
            capture_output=True,
            text=True,
            env={**os.environ}
        )

        if result.returncode != 0:
            raise RuntimeError(f"{self.sdk} {command} failed: {result.stderr}")

        return json.loads(result.stdout)

def get_runners() -> dict[SDK, SDKRunner]:
    return {
        "go": SDKRunner("go", os.environ["CLIENT_GO_PATH"]),
        "node": SDKRunner("node", os.environ["CLIENT_NODE_PATH"]),
        "dotnet": SDKRunner("dotnet", os.environ["CLIENT_DOTNET_PATH"]),
        "python": SDKRunner("python", os.environ["CLIENT_PYTHON_PATH"]),
        "java": SDKRunner("java", os.environ["CLIENT_JAVA_PATH"]),
    }
```

### 3.3 Test Fixtures

`tests/conftest.py`:

```python
import pytest
from dotenv import load_dotenv
from helpers.sdk_runner import get_runners, SDK

load_dotenv()

SDKS: list[SDK] = ["go", "node", "dotnet", "python", "java"]

@pytest.fixture(scope="session")
def runners():
    return get_runners()

@pytest.fixture(params=SDKS, ids=lambda s: f"creator={s}")
def creator_sdk(request, runners):
    return runners[request.param]

@pytest.fixture(params=SDKS, ids=lambda s: f"importer={s}")
def importer_sdk(request, runners):
    return runners[request.param]
```

### 3.4 Core Tests

`tests/test_export_import.py`:

```python
import pytest
import smtplib
from email.mime.text import MIMEText
import os
import time

def send_test_email(to_address: str, subject: str, body: str):
    """Send email via SMTP."""
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = "test@example.com"
    msg["To"] = to_address

    with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ["SMTP_PORT"])) as smtp:
        smtp.send_message(msg)

class TestExportImport:
    """Test that exports from SDK-A can be imported by SDK-B."""

    def test_cross_sdk_import(self, creator_sdk, importer_sdk, runners):
        # Skip self-import (already tested in each SDK)
        if creator_sdk.sdk == importer_sdk.sdk:
            pytest.skip("Same SDK import tested in SDK repo")

        # 1. Create inbox with creator SDK
        export_data = creator_sdk.run("create-inbox")
        email_address = export_data["emailAddress"]

        try:
            # 2. Send test email
            subject = f"Interop test {creator_sdk.sdk}→{importer_sdk.sdk}"
            body = "Test body content"
            send_test_email(email_address, subject, body)

            # 3. Wait for email processing
            time.sleep(2)

            # 4. Import and read with importer SDK
            result = importer_sdk.run("read-emails", stdin=json.dumps(export_data))

            # 5. Verify
            assert len(result["emails"]) >= 1
            email = result["emails"][0]
            assert email["subject"] == subject
            assert body in email["text"]

        finally:
            # Cleanup
            creator_sdk.run(f"cleanup {email_address}")
```

`tests/test_email_decrypt.py`:

```python
class TestEmailDecryption:
    """Test that all SDKs can decrypt emails from the server."""

    def test_decrypt_with_attachments(self, creator_sdk):
        """Test decryption of emails with attachments."""
        export_data = creator_sdk.run("create-inbox")
        email_address = export_data["emailAddress"]

        try:
            # Send email with attachment (extend SMTP helper for this)
            # ...

            result = creator_sdk.run("read-emails", stdin=json.dumps(export_data))

            assert len(result["emails"]) >= 1
            assert len(result["emails"][0]["attachments"]) >= 1

        finally:
            creator_sdk.run(f"cleanup {email_address}")
```

---

## Phase 4: CI/CD

### 4.1 GitHub Actions

`.github/workflows/interop-tests.yml`:

```yaml
name: Interop Tests

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
  repository_dispatch:
    types: [sdk-updated] # Triggered by SDK repos
  schedule:
    - cron: '0 6 * * *' # Daily at 6am UTC

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Checkout client-go
        uses: actions/checkout@v4
        with:
          repository: vaultsandbox/client-go
          path: client-go

      - name: Checkout client-node
        uses: actions/checkout@v4
        with:
          repository: vaultsandbox/client-node
          path: client-node

      - name: Checkout client-dotnet
        uses: actions/checkout@v4
        with:
          repository: vaultsandbox/client-dotnet
          path: client-dotnet

      - name: Checkout client-python
        uses: actions/checkout@v4
        with:
          repository: vaultsandbox/client-python
          path: client-python

      - name: Checkout client-java
        uses: actions/checkout@v4
        with:
          repository: vaultsandbox/client-java
          path: client-java

      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0'

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - name: Build test helpers
        run: |
          cd client-go && go build -o testhelper ./cmd/testhelper
          cd ../client-node && npm ci
          cd ../client-dotnet && dotnet build tools/TestHelper
          cd ../client-python && pip install -e .
          cd ../client-java && ./gradlew build -x test

      - name: Run interop tests
        env:
          VAULTSANDBOX_URL: ${{ secrets.VAULTSANDBOX_URL }}
          VAULTSANDBOX_API_KEY: ${{ secrets.VAULTSANDBOX_API_KEY }}
          SMTP_HOST: ${{ secrets.SMTP_HOST }}
          SMTP_PORT: ${{ secrets.SMTP_PORT }}
          CLIENT_GO_PATH: ./client-go
          CLIENT_NODE_PATH: ./client-node
          CLIENT_DOTNET_PATH: ./client-dotnet
          CLIENT_PYTHON_PATH: ./client-python
          CLIENT_JAVA_PATH: ./client-java
        run: |
          pip install -r requirements.txt
          pytest -v --tb=short
```

### 4.2 Cross-Repo Triggers

Each SDK repo should trigger interop tests when pushing to main. Add this workflow to each SDK:

`client-go/.github/workflows/trigger-interop.yml` (same for all SDKs):

```yaml
name: Trigger Interop Tests

on:
  push:
    branches: [main]

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger client-interop tests
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.INTEROP_TRIGGER_TOKEN }}
          repository: vaultsandbox/client-interop
          event-type: sdk-updated
          client-payload: '{"sdk": "go", "sha": "${{ github.sha }}"}'
```

**Setup required:**

1. Create a GitHub Personal Access Token (PAT) with `repo` scope
2. Add it as `INTEROP_TRIGGER_TOKEN` secret to each SDK repo
3. The PAT must have write access to `client-interop` repo

**Flow:**

```
client-go push to main
       │
       ▼
trigger-interop.yml runs
       │
       ▼
repository_dispatch to client-interop
       │
       ▼
interop-tests.yml runs (all 5 SDKs)
       │
       ▼
Full 20-combination matrix tested
```

---

## Phase 5: Test Matrix

The full test matrix for 5 SDKs (5×4 = 20 cross-SDK combinations):

| Creator | Importers                |
| ------- | ------------------------ |
| Go      | Node, .NET, Python, Java |
| Node    | Go, .NET, Python, Java   |
| .NET    | Go, Node, Python, Java   |
| Python  | Go, Node, .NET, Java     |
| Java    | Go, Node, .NET, Python   |

Total: **20 cross-SDK test combinations** (excluding self-tests which are covered in each SDK's own test suite).

---

## Implementation Order

1. **Create `client-interop` repo** with basic structure
2. **Add testhelper to client-go** - simplest to start with
3. **Add testhelper to client-node**
4. **Add testhelper to client-dotnet**
5. **Add testhelper to client-python**
6. **Add testhelper to client-java**
7. **Write Python orchestrator** with Go↔Node tests first
8. **Add remaining SDKs to the matrix**
9. **Set up GitHub Actions** with live server
10. **Set up cross-repo triggers** (PAT + workflow in each SDK)
11. **Add edge case tests** (attachments, unicode, large emails)

---

## Notes

- Each testhelper should output JSON to stdout, errors to stderr
- Use exit code 0 for success, non-zero for failure
- The orchestrator handles all SMTP sending (SDKs don't need SMTP code in testhelper)
- Consider adding `--verbose` flag to testhelpers for debugging
