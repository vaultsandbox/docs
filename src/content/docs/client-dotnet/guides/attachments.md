---
title: Working with Attachments
description: Access, decode, and validate email attachments
---

VaultSandbox automatically decrypts email attachments and provides them as `byte[]` arrays ready to process.

## Accessing Attachments

### Basic Access

```csharp
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Subject = "Invoice",
    UseRegex = true,
    Timeout = TimeSpan.FromSeconds(10)
});

Console.WriteLine($"Email has {email.Attachments?.Count ?? 0} attachments");

foreach (var att in email.Attachments ?? [])
{
    Console.WriteLine($"- {att.Filename} ({att.ContentType}, {att.Size} bytes)");
}
```

## Attachment Structure

### EmailAttachment Properties

```csharp
var attachment = email.Attachments?[0];

if (attachment != null)
{
    Console.WriteLine(attachment.Filename);           // "invoice.pdf"
    Console.WriteLine(attachment.ContentType);        // "application/pdf"
    Console.WriteLine(attachment.Size);               // 15234 (bytes)
    Console.WriteLine(attachment.Content.Length);     // byte[] length
    Console.WriteLine(attachment.ContentId);          // "part123@example.com" (optional)
    Console.WriteLine(attachment.ContentDisposition); // "attachment" or "inline"
}
```

## Working with Different File Types

### Text Files

```csharp
var txtAttachment = email.Attachments?.FirstOrDefault(
    att => att.ContentType.Contains("text"));

if (txtAttachment?.Content != null)
{
    var text = Encoding.UTF8.GetString(txtAttachment.Content);
    Console.WriteLine($"Text content: {text}");

    // Validate content
    Assert.Contains("expected text", text);
}
```

### JSON Files

```csharp
using System.Text.Json;

var jsonAttachment = email.Attachments?.FirstOrDefault(
    att => att.ContentType.Contains("json") || att.Filename.EndsWith(".json"));

if (jsonAttachment?.Content != null)
{
    var jsonText = Encoding.UTF8.GetString(jsonAttachment.Content);
    var data = JsonSerializer.Deserialize<JsonDocument>(jsonText);

    Console.WriteLine($"Parsed JSON: {data}");
    Assert.Equal("success", data?.RootElement.GetProperty("status").GetString());
}
```

### CSV Files

```csharp
var csvAttachment = email.Attachments?.FirstOrDefault(
    att => att.Filename.EndsWith(".csv"));

if (csvAttachment?.Content != null)
{
    var csvText = Encoding.UTF8.GetString(csvAttachment.Content);
    var lines = csvText.Split('\n');

    Console.WriteLine($"CSV has {lines.Length} lines");
    Assert.Contains("Name,Email,Status", lines[0]);
}
```

### PDF Files

```csharp
var pdfAttachment = email.Attachments?.FirstOrDefault(
    att => att.ContentType == "application/pdf");

if (pdfAttachment?.Content != null)
{
    // Save to disk
    await File.WriteAllBytesAsync("invoice.pdf", pdfAttachment.Content);

    // Verify PDF signature
    var header = Encoding.ASCII.GetString(pdfAttachment.Content[..5]);
    Assert.Equal("%PDF-", header);

    // Check size
    Assert.True(pdfAttachment.Size > 1000);
}
```

### Images

```csharp
var imageAttachment = email.Attachments?.FirstOrDefault(
    att => att.ContentType.StartsWith("image/"));

if (imageAttachment?.Content != null)
{
    // Save image
    var extension = GetExtension(imageAttachment.ContentType);
    await File.WriteAllBytesAsync($"logo.{extension}", imageAttachment.Content);

    // Verify it's a valid PNG (check magic bytes)
    if (imageAttachment.ContentType == "image/png")
    {
        byte[] pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
        Assert.Equal(pngSignature, imageAttachment.Content[..8]);
    }
}

string GetExtension(string contentType) => contentType switch
{
    "image/png" => "png",
    "image/jpeg" => "jpg",
    "image/gif" => "gif",
    "image/webp" => "webp",
    _ => "bin"
};
```

### ZIP Archives

```csharp
using System.IO.Compression;

var zipAttachment = email.Attachments?.FirstOrDefault(
    att => att.ContentType == "application/zip");

if (zipAttachment?.Content != null)
{
    using var stream = new MemoryStream(zipAttachment.Content);
    using var archive = new ZipArchive(stream, ZipArchiveMode.Read);

    Console.WriteLine($"ZIP contains {archive.Entries.Count} files:");
    foreach (var entry in archive.Entries)
    {
        Console.WriteLine($"  - {entry.FullName}");
    }

    // Extract specific file
    var readme = archive.GetEntry("README.md");
    if (readme != null)
    {
        using var reader = new StreamReader(readme.Open());
        var content = await reader.ReadToEndAsync();
        Console.WriteLine($"README: {content}");
    }
}
```

## Finding Attachments

### By Filename

```csharp
var invoice = email.Attachments?.FirstOrDefault(
    att => att.Filename == "invoice.pdf");

Assert.NotNull(invoice);
```

### By Extension

```csharp
var pdfs = email.Attachments?.Where(
    att => att.Filename.EndsWith(".pdf")).ToList();

Console.WriteLine($"Found {pdfs?.Count ?? 0} PDF attachments");
```

### By Content Type

```csharp
var images = email.Attachments?.Where(
    att => att.ContentType.StartsWith("image/"));

var documents = email.Attachments?.Where(
    att => att.ContentType is "application/pdf" or "application/msword");
```

### By Size

```csharp
// Larger than 1MB
var largeAttachments = email.Attachments?.Where(
    att => att.Size > 1024 * 1024);

// Smaller than 10KB
var smallAttachments = email.Attachments?.Where(
    att => att.Size < 10 * 1024);
```

## Saving Attachments

### Save to Disk

```csharp
async Task SaveAttachmentAsync(EmailAttachment attachment, string directory = "./downloads")
{
    Directory.CreateDirectory(directory);

    var filePath = Path.Combine(directory, attachment.Filename);
    await File.WriteAllBytesAsync(filePath, attachment.Content);

    Console.WriteLine($"Saved: {filePath}");
}

// Usage
foreach (var att in email.Attachments ?? [])
{
    await SaveAttachmentAsync(att);
}
```

### Save with Validation

```csharp
async Task<string> SaveAttachmentSafelyAsync(
    EmailAttachment attachment,
    string directory = "./downloads")
{
    // Validate filename (prevent directory traversal)
    var safeName = Path.GetFileName(attachment.Filename);
    if (safeName != attachment.Filename)
    {
        throw new ArgumentException("Invalid filename");
    }

    // Check size (10MB limit)
    if (attachment.Size > 10 * 1024 * 1024)
    {
        throw new InvalidOperationException("Attachment too large");
    }

    Directory.CreateDirectory(directory);

    var filePath = Path.Combine(directory, safeName);
    await File.WriteAllBytesAsync(filePath, attachment.Content);

    return filePath;
}
```

## Validating Attachments

### Check Presence

```csharp
[Fact]
public async Task Email_Includes_Invoice_Pdf()
{
    var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Subject = "Invoice",
        UseRegex = true,
        Timeout = TimeSpan.FromSeconds(10)
    });

    Assert.NotNull(email.Attachments);
    Assert.NotEmpty(email.Attachments);

    var pdf = email.Attachments.FirstOrDefault(
        att => Regex.IsMatch(att.Filename, @"invoice.*\.pdf", RegexOptions.IgnoreCase));

    Assert.NotNull(pdf);
}
```

### Validate Content Type

```csharp
var attachment = email.Attachments?[0];

Assert.NotNull(attachment);
Assert.Equal("application/pdf", attachment.ContentType);

// Or more flexible
Assert.Contains(attachment.ContentType, new[] { "application/pdf", "application/x-pdf" });
```

### Validate Size

```csharp
var attachment = email.Attachments?[0];

Assert.NotNull(attachment);

// Not empty
Assert.True(attachment.Size > 0);

// Within expected range
Assert.True(attachment.Size > 1000);        // At least 1KB
Assert.True(attachment.Size < 5 * 1024 * 1024);  // Less than 5MB

// Exact size (if known)
Assert.Equal(expectedSize, attachment.Size);
```

### Validate Content

```csharp
var attachment = email.Attachments?[0];

Assert.NotNull(attachment?.Content);

// Check content exists
Assert.Equal(attachment.Size, attachment.Content.Length);

// For text files
var text = Encoding.UTF8.GetString(attachment.Content);
Assert.Contains("expected content", text);

// For binary files (check signature)
byte[] pdfSignature = [0x25, 0x50, 0x44, 0x46];  // %PDF
Assert.Equal(pdfSignature, attachment.Content[..4]);
```

### Checksum Verification

```csharp
using System.Security.Cryptography;

var attachment = email.Attachments?[0];

if (attachment?.Content != null && attachment.Checksum != null)
{
    var actualHash = Convert.ToHexString(SHA256.HashData(attachment.Content));
    Assert.Equal(attachment.Checksum, actualHash, StringComparer.OrdinalIgnoreCase);
}
```

## Testing Patterns

### Test with Attachments

```csharp
public class AttachmentTests : IAsyncLifetime
{
    private IVaultSandboxClient _client = null!;
    private IInbox _inbox = null!;

    public async Task InitializeAsync()
    {
        _client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
            .Build();

        _inbox = await _client.CreateInboxAsync();
    }

    public async Task DisposeAsync()
    {
        if (_inbox != null)
        {
            await _client.DeleteInboxAsync(_inbox.EmailAddress);
        }
    }

    [Fact]
    public async Task Receives_Invoice_With_Pdf()
    {
        await _app.SendInvoiceAsync(new InvoiceRequest
        {
            To = _inbox.EmailAddress,
            OrderId = "12345"
        });

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Subject = "Invoice",
            UseRegex = true,
            Predicate = e => e.Attachments?.Count > 0,
            Timeout = TimeSpan.FromSeconds(10)
        });

        // Validate attachment
        var pdf = email.Attachments!.FirstOrDefault(
            att => att.ContentType == "application/pdf");

        Assert.NotNull(pdf);
        Assert.Matches(@"invoice.*\.pdf", pdf.Filename, RegexOptions.IgnoreCase);
        Assert.True(pdf.Size > 1000);

        // Validate PDF content
        var header = Encoding.ASCII.GetString(pdf.Content[..5]);
        Assert.Equal("%PDF-", header);
    }

    [Fact]
    public async Task Receives_Report_With_Multiple_Attachments()
    {
        await _app.SendReportAsync(_inbox.EmailAddress);

        var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
        {
            Timeout = TimeSpan.FromSeconds(10)
        });

        Assert.Equal(3, email.Attachments?.Count);

        // Verify each attachment
        var csv = email.Attachments?.FirstOrDefault(att => att.Filename.EndsWith(".csv"));
        var pdf = email.Attachments?.FirstOrDefault(att => att.Filename.EndsWith(".pdf"));
        var json = email.Attachments?.FirstOrDefault(att => att.Filename.EndsWith(".json"));

        Assert.NotNull(csv);
        Assert.NotNull(pdf);
        Assert.NotNull(json);
    }
}
```

### Process Attachment Content

```csharp
[Fact]
public async Task Processes_Csv_Attachment()
{
    await _app.SendReportAsync(_inbox.EmailAddress);

    var email = await _inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(10)
    });

    var csv = email.Attachments?.FirstOrDefault(att => att.Filename.EndsWith(".csv"));

    Assert.NotNull(csv?.Content);

    var text = Encoding.UTF8.GetString(csv.Content);
    var lines = text.Trim().Split('\n');
    var headers = lines[0].Split(',');

    Assert.Contains("Name", headers);
    Assert.Contains("Email", headers);
    Assert.True(lines.Length > 1);  // Has data rows
}
```

## Advanced Patterns

### Extract and Process All Attachments

```csharp
async Task<List<AttachmentResult>> ProcessAttachmentsAsync(Email email)
{
    var results = new List<AttachmentResult>();

    foreach (var att in email.Attachments ?? [])
    {
        var result = att.ContentType switch
        {
            var t when t.StartsWith("image/") => await ProcessImageAsync(att),
            "application/pdf" => await ProcessPdfAsync(att),
            var t when t.Contains("text") => ProcessText(att),
            _ => new AttachmentResult { Type = "unknown", Filename = att.Filename }
        };

        results.Add(result);
    }

    return results;
}

async Task<AttachmentResult> ProcessImageAsync(EmailAttachment att)
{
    return new AttachmentResult
    {
        Type = "image",
        Filename = att.Filename,
        Size = att.Size,
        Dimensions = await GetImageDimensionsAsync(att.Content)
    };
}
```

### Attachment Metadata Collection

```csharp
record AttachmentMetadata(
    string Filename,
    string ContentType,
    long Size,
    string SizeHuman,
    bool HasContent,
    bool IsInline);

List<AttachmentMetadata> CollectAttachmentMetadata(Email email)
{
    return (email.Attachments ?? []).Select(att => new AttachmentMetadata(
        att.Filename,
        att.ContentType,
        att.Size,
        FormatBytes(att.Size),
        att.Content.Length > 0,
        att.ContentDisposition == "inline"
    )).ToList();
}

string FormatBytes(long bytes) => bytes switch
{
    < 1024 => $"{bytes} B",
    < 1024 * 1024 => $"{bytes / 1024.0:F1} KB",
    _ => $"{bytes / (1024.0 * 1024.0):F1} MB"
};

// Usage
var metadata = CollectAttachmentMetadata(email);
foreach (var m in metadata)
{
    Console.WriteLine($"{m.Filename}: {m.ContentType} ({m.SizeHuman})");
}
```

### Inline vs Regular Attachments

```csharp
var inlineImages = email.Attachments?.Where(
    att => att.ContentDisposition == "inline");

var regularAttachments = email.Attachments?.Where(
    att => att.ContentDisposition == "attachment");
```

## Troubleshooting

### No Attachments Found

```csharp
if (email.Attachments?.Count is null or 0)
{
    Console.WriteLine("No attachments in email");
    Console.WriteLine($"Subject: {email.Subject}");
    Console.WriteLine($"From: {email.From}");

    // Check if attachments mentioned in body
    if (email.Text?.Contains("attach", StringComparison.OrdinalIgnoreCase) == true)
    {
        Console.WriteLine("Warning: Email mentions attachments but none found");
    }
}
```

### Attachment Content Missing

```csharp
var attachment = email.Attachments?[0];

if (attachment?.Content is null or { Length: 0 })
{
    Console.WriteLine("Attachment content is empty");
    Console.WriteLine($"Filename: {attachment?.Filename}");
    Console.WriteLine($"Size: {attachment?.Size}");
    Console.WriteLine("This may indicate:");
    Console.WriteLine("- Attachment failed to download");
    Console.WriteLine("- Attachment was too large");
    Console.WriteLine("- Decryption error");
}
```

### Invalid File Format

```csharp
try
{
    var json = JsonSerializer.Deserialize<JsonDocument>(attachment.Content);
}
catch (JsonException)
{
    Console.WriteLine("Failed to parse JSON attachment");
    Console.WriteLine($"Filename: {attachment.Filename}");
    Console.WriteLine($"Content preview: {Encoding.UTF8.GetString(attachment.Content[..Math.Min(100, attachment.Content.Length)])}");
}
```

## Next Steps

- **[Email Objects](/client-dotnet/concepts/emails/)** - Understanding email structure
- **[Managing Inboxes](/client-dotnet/guides/managing-inboxes/)** - Inbox operations
- **[Testing Patterns](/client-dotnet/testing/password-reset/)** - Real-world examples
- **[API Reference: Email](/client-dotnet/api/email/)** - Complete API documentation
