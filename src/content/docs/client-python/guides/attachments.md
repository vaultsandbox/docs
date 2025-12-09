---
title: Working with Attachments
description: Access, decode, and validate email attachments
---

VaultSandbox automatically decrypts email attachments and provides them as `bytes` ready to process.

## Accessing Attachments

### Basic Access

```python
import re
from vaultsandbox import WaitForEmailOptions

email = await inbox.wait_for_email(
    WaitForEmailOptions(
        subject=re.compile(r"Invoice"),
        timeout=10000,
    )
)

print(f"Email has {len(email.attachments)} attachments")

for att in email.attachments:
    print(f"- {att.filename} ({att.content_type}, {att.size} bytes)")
```

## Attachment Structure

### Attachment Properties

```python
attachment = email.attachments[0]

print(attachment.filename)            # "invoice.pdf"
print(attachment.content_type)        # "application/pdf"
print(attachment.size)                # 15234 (bytes)
print(attachment.content)             # bytes
print(attachment.content_id)          # "part123@example.com" (optional)
print(attachment.content_disposition) # "attachment" or "inline"
```

## Working with Different File Types

### Text Files

```python
txt_attachment = next(
    (att for att in email.attachments if "text" in att.content_type),
    None
)

if txt_attachment and txt_attachment.content:
    text = txt_attachment.content.decode("utf-8")
    print(f"Text content: {text}")

    # Validate content
    assert "expected text" in text
```

### JSON Files

```python
import json

json_attachment = next(
    (att for att in email.attachments
     if "json" in att.content_type or att.filename.endswith(".json")),
    None
)

if json_attachment and json_attachment.content:
    json_text = json_attachment.content.decode("utf-8")
    data = json.loads(json_text)

    print(f"Parsed JSON: {data}")
    assert data["status"] == "success"
```

### CSV Files

```python
csv_attachment = next(
    (att for att in email.attachments if att.filename.endswith(".csv")),
    None
)

if csv_attachment and csv_attachment.content:
    csv_text = csv_attachment.content.decode("utf-8")
    lines = csv_text.split("\n")

    print(f"CSV has {len(lines)} lines")
    assert "Name,Email,Status" in lines[0]
```

### PDF Files

```python
from pathlib import Path

pdf_attachment = next(
    (att for att in email.attachments if att.content_type == "application/pdf"),
    None
)

if pdf_attachment and pdf_attachment.content:
    # Save to disk
    Path("invoice.pdf").write_bytes(pdf_attachment.content)

    # Verify PDF signature
    header = pdf_attachment.content[:5].decode("latin-1")
    assert header == "%PDF-"

    # Check size
    assert pdf_attachment.size > 1000
```

### Images

```python
from pathlib import Path

image_attachment = next(
    (att for att in email.attachments if att.content_type.startswith("image/")),
    None
)

if image_attachment and image_attachment.content:
    # Get file extension
    extension_map = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
    }
    ext = extension_map.get(image_attachment.content_type, "bin")

    # Save image
    Path(f"logo.{ext}").write_bytes(image_attachment.content)

    # Verify it's a valid image (check magic bytes)
    if image_attachment.content_type == "image/png":
        png_signature = list(image_attachment.content[:8])
        assert png_signature == [137, 80, 78, 71, 13, 10, 26, 10]
```

### ZIP Archives

```python
import zipfile
import io

zip_attachment = next(
    (att for att in email.attachments if att.content_type == "application/zip"),
    None
)

if zip_attachment and zip_attachment.content:
    with zipfile.ZipFile(io.BytesIO(zip_attachment.content)) as zf:
        entries = zf.namelist()

        print(f"ZIP contains {len(entries)} files:")
        for entry in entries:
            print(f"  - {entry}")

        # Extract specific file
        if "README.md" in entries:
            content = zf.read("README.md").decode("utf-8")
            print(f"README: {content}")
```

## Finding Attachments

### By Filename

```python
invoice = next(
    (att for att in email.attachments if att.filename == "invoice.pdf"),
    None
)

assert invoice is not None
```

### By Extension

```python
pdfs = [att for att in email.attachments if att.filename.endswith(".pdf")]

print(f"Found {len(pdfs)} PDF attachments")
```

### By Content Type

```python
images = [att for att in email.attachments if att.content_type.startswith("image/")]

documents = [
    att for att in email.attachments
    if att.content_type in ["application/pdf", "application/msword"]
]
```

### By Size

```python
# Larger than 1MB
large_attachments = [att for att in email.attachments if att.size > 1024 * 1024]

# Smaller than 10KB
small_attachments = [att for att in email.attachments if att.size < 10 * 1024]
```

## Saving Attachments

### Save to Disk

```python
from pathlib import Path

def save_attachment(attachment, directory="./downloads"):
    dir_path = Path(directory)
    dir_path.mkdir(parents=True, exist_ok=True)

    file_path = dir_path / attachment.filename
    file_path.write_bytes(attachment.content)

    print(f"Saved: {file_path}")
    return str(file_path)

# Usage
for att in email.attachments:
    save_attachment(att)
```

### Save with Validation

```python
from pathlib import Path

def save_attachment_safely(attachment, directory="./downloads"):
    # Validate filename (prevent directory traversal)
    safe_name = Path(attachment.filename).name
    if safe_name != attachment.filename:
        raise ValueError("Invalid filename")

    # Check size
    if attachment.size > 10 * 1024 * 1024:  # 10MB limit
        raise ValueError("Attachment too large")

    # Save
    dir_path = Path(directory)
    dir_path.mkdir(parents=True, exist_ok=True)

    file_path = dir_path / safe_name
    file_path.write_bytes(attachment.content)

    return str(file_path)
```

## Validating Attachments

### Check Presence

```python
import pytest
import re
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_email_includes_invoice_pdf(inbox):
    email = await inbox.wait_for_email(
        WaitForEmailOptions(
            subject=re.compile(r"Invoice"),
            timeout=10000,
        )
    )

    assert len(email.attachments) > 0

    pdf = next(
        (att for att in email.attachments if re.match(r"invoice.*\.pdf", att.filename, re.IGNORECASE)),
        None
    )

    assert pdf is not None
```

### Validate Content Type

```python
attachment = email.attachments[0]

assert attachment.content_type == "application/pdf"

# Or more flexible
assert attachment.content_type in ["application/pdf", "application/x-pdf"]
```

### Validate Size

```python
attachment = email.attachments[0]

# Not empty
assert attachment.size > 0

# Within expected range
assert attachment.size > 1000  # At least 1KB
assert attachment.size < 5 * 1024 * 1024  # Less than 5MB

# Exact size (if known)
assert attachment.size == expected_size
```

### Validate Content

```python
attachment = email.attachments[0]

if attachment.content:
    # Check content exists
    assert len(attachment.content) == attachment.size

    # For text files
    text = attachment.content.decode("utf-8")
    assert "expected content" in text

    # For binary files (check signature)
    signature = list(attachment.content[:4])
    assert signature == [0x25, 0x50, 0x44, 0x46]  # PDF signature
```

## Testing Patterns

### Test with Attachments

```python
import pytest
import re
from vaultsandbox import WaitForEmailOptions

class TestEmailWithAttachments:

    @pytest.mark.asyncio
    async def test_receives_invoice_with_pdf(self, client, inbox):
        await app.send_invoice(
            to=inbox.email_address,
            order_id="12345",
        )

        email = await inbox.wait_for_email(
            WaitForEmailOptions(
                subject=re.compile(r"Invoice"),
                predicate=lambda e: len(e.attachments) > 0,
                timeout=10000,
            )
        )

        # Validate attachment
        pdf = next(
            (att for att in email.attachments if att.content_type == "application/pdf"),
            None
        )

        assert pdf is not None
        assert re.match(r"invoice.*\.pdf", pdf.filename, re.IGNORECASE)
        assert pdf.size > 1000

        # Validate PDF content
        if pdf.content:
            header = pdf.content[:5].decode("latin-1")
            assert header == "%PDF-"

    @pytest.mark.asyncio
    async def test_receives_report_with_multiple_attachments(self, inbox):
        await app.send_report(inbox.email_address)

        email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))

        assert len(email.attachments) == 3

        # Verify each attachment
        csv = next((att for att in email.attachments if att.filename.endswith(".csv")), None)
        pdf = next((att for att in email.attachments if att.filename.endswith(".pdf")), None)
        json_att = next((att for att in email.attachments if att.filename.endswith(".json")), None)

        assert csv is not None
        assert pdf is not None
        assert json_att is not None
```

### Process Attachment Content

```python
import pytest
from vaultsandbox import WaitForEmailOptions

@pytest.mark.asyncio
async def test_processes_csv_attachment(inbox):
    await app.send_report(inbox.email_address)

    email = await inbox.wait_for_email(WaitForEmailOptions(timeout=10000))
    csv = next((att for att in email.attachments if att.filename.endswith(".csv")), None)

    assert csv is not None

    if csv.content:
        text = csv.content.decode("utf-8")
        lines = text.strip().split("\n")
        headers = lines[0].split(",")

        assert "Name" in headers
        assert "Email" in headers
        assert len(lines) > 1  # Has data rows
```

## Advanced Patterns

### Extract and Process All Attachments

```python
import asyncio

async def process_attachments(email):
    async def process_single(att):
        if att.content_type.startswith("image/"):
            return await process_image(att)
        elif att.content_type == "application/pdf":
            return await process_pdf(att)
        elif "text" in att.content_type:
            return await process_text(att)
        else:
            return {"type": "unknown", "filename": att.filename}

    results = await asyncio.gather(*[process_single(att) for att in email.attachments])
    return results

async def process_image(att):
    return {
        "type": "image",
        "filename": att.filename,
        "size": att.size,
    }

async def process_pdf(att):
    return {
        "type": "pdf",
        "filename": att.filename,
        "size": att.size,
    }

async def process_text(att):
    content = att.content.decode("utf-8") if att.content else ""
    return {
        "type": "text",
        "filename": att.filename,
        "length": len(content),
    }
```

### Attachment Metadata Collection

```python
def collect_attachment_metadata(email):
    def format_bytes(size):
        if size < 1024:
            return f"{size} B"
        if size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        return f"{size / (1024 * 1024):.1f} MB"

    return [
        {
            "filename": att.filename,
            "content_type": att.content_type,
            "size": att.size,
            "size_human": format_bytes(att.size),
            "has_content": att.content is not None,
            "is_inline": att.content_disposition == "inline",
        }
        for att in email.attachments
    ]

# Usage
metadata = collect_attachment_metadata(email)
for item in metadata:
    print(item)
```

## Troubleshooting

### No Attachments Found

```python
if len(email.attachments) == 0:
    print("No attachments in email")
    print(f"Subject: {email.subject}")
    print(f"From: {email.from_address}")

    # Check if attachments mentioned in body
    if email.text and "attach" in email.text.lower():
        print("Warning: Email mentions attachments but none found")
```

### Attachment Content Missing

```python
attachment = email.attachments[0]

if not attachment.content:
    print("Attachment content is None")
    print(f"Filename: {attachment.filename}")
    print(f"Size: {attachment.size}")
    print("This may indicate:")
    print("- Attachment failed to download")
    print("- Attachment was too large")
    print("- Decryption error")
```

### Invalid File Format

```python
import json

try:
    data = json.loads(attachment.content.decode("utf-8"))
except (json.JSONDecodeError, UnicodeDecodeError) as e:
    print("Failed to parse JSON attachment")
    print(f"Filename: {attachment.filename}")
    preview = attachment.content[:100].decode("utf-8", errors="replace") if attachment.content else ""
    print(f"Content preview: {preview}")
```

## Next Steps

- **[Email Objects](/client-python/concepts/emails/)** - Understanding email structure
- **[Managing Inboxes](/client-python/guides/managing-inboxes/)** - Inbox operations
- **[Testing Patterns](/client-python/testing/password-reset/)** - Real-world examples
- **[API Reference: Email](/client-python/api/email/)** - Complete API documentation
