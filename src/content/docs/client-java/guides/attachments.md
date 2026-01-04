---
title: Working with Attachments
description: Guide for working with email attachments in VaultSandbox Java client
---

Email attachments in VaultSandbox are accessible through the `Email` object and provide methods to retrieve content and metadata.

## Accessing Attachments

```java
Email email = inbox.waitForEmail(Duration.ofSeconds(30));
List<Attachment> attachments = email.getAttachments();

for (Attachment attachment : attachments) {
    System.out.println("File: " + attachment.getFilename());
    System.out.println("Type: " + attachment.getContentType());
    System.out.println("Size: " + attachment.getSize() + " bytes");
}
```

## Attachment Properties

| Property      | Type     | Description                         |
| ------------- | -------- | ----------------------------------- |
| `filename`    | `String` | Original filename                   |
| `contentType` | `String` | MIME type (e.g., "application/pdf") |
| `size`        | `int`    | Size in bytes                       |
| `content`     | `byte[]` | File content                        |

```java
Attachment attachment = email.getAttachments().get(0);

String filename = attachment.getFilename();     // "invoice.pdf"
String mimeType = attachment.getContentType();  // "application/pdf"
int sizeBytes = attachment.getSize();           // 15234
byte[] content = attachment.getContent();       // raw bytes
```

## Working with Different File Types

### Text Files

```java
Attachment textFile = attachments.stream()
    .filter(a -> a.getFilename().endsWith(".txt"))
    .findFirst()
    .orElseThrow();

String content = new String(textFile.getContent(), StandardCharsets.UTF_8);
assertThat(content).contains("expected text");
```

### JSON Files

```java
Attachment jsonFile = attachments.stream()
    .filter(a -> a.getFilename().endsWith(".json"))
    .findFirst()
    .orElseThrow();

String json = new String(jsonFile.getContent(), StandardCharsets.UTF_8);

// Parse with Gson
JsonObject data = JsonParser.parseString(json).getAsJsonObject();
assertThat(data.get("key").getAsString()).isEqualTo("value");

// Or with Jackson
ObjectMapper mapper = new ObjectMapper();
MyData data = mapper.readValue(jsonFile.getContent(), MyData.class);
```

### CSV Files

```java
Attachment csvFile = attachments.stream()
    .filter(a -> a.getFilename().endsWith(".csv"))
    .findFirst()
    .orElseThrow();

String csv = new String(csvFile.getContent(), StandardCharsets.UTF_8);

// Parse lines manually
List<String[]> rows = Arrays.stream(csv.split("\n"))
    .map(line -> line.split(","))
    .collect(Collectors.toList());

// Or use OpenCSV
CSVReader reader = new CSVReader(
    new StringReader(new String(csvFile.getContent(), StandardCharsets.UTF_8))
);
List<String[]> rows = reader.readAll();
```

### PDF Files

```java
Attachment pdfFile = attachments.stream()
    .filter(a -> a.getFilename().endsWith(".pdf"))
    .findFirst()
    .orElseThrow();

assertThat(pdfFile.getContentType()).isEqualTo("application/pdf");

// Verify it's a valid PDF (magic bytes)
byte[] content = pdfFile.getContent();
assertThat(new String(content, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("%PDF");

// Extract text with Apache PDFBox
try (PDDocument doc = PDDocument.load(pdfFile.getContent())) {
    PDFTextStripper stripper = new PDFTextStripper();
    String text = stripper.getText(doc);
    assertThat(text).contains("Invoice");
}
```

### Images

```java
Attachment image = attachments.stream()
    .filter(a -> a.getContentType().startsWith("image/"))
    .findFirst()
    .orElseThrow();

assertThat(image.getContentType()).startsWith("image/");

// Read as BufferedImage
BufferedImage img = ImageIO.read(
    new ByteArrayInputStream(image.getContent())
);
assertThat(img.getWidth()).isGreaterThan(0);
assertThat(img.getHeight()).isGreaterThan(0);
```

### ZIP Archives

```java
Attachment zipFile = attachments.stream()
    .filter(a -> a.getFilename().endsWith(".zip"))
    .findFirst()
    .orElseThrow();

try (ZipInputStream zis = new ZipInputStream(
        new ByteArrayInputStream(zipFile.getContent()))) {
    ZipEntry entry;
    while ((entry = zis.getNextEntry()) != null) {
        System.out.println("Entry: " + entry.getName());
        // Read entry content
        byte[] entryContent = zis.readAllBytes();
        zis.closeEntry();
    }
}
```

## Finding Attachments

### By Filename

```java
Optional<Attachment> attachment = attachments.stream()
    .filter(a -> a.getFilename().equals("report.pdf"))
    .findFirst();
```

### By Extension

```java
// Single extension
Optional<Attachment> pdf = attachments.stream()
    .filter(a -> a.getFilename().endsWith(".pdf"))
    .findFirst();

// Multiple extensions
List<Attachment> images = attachments.stream()
    .filter(a -> a.getFilename().matches(".*\\.(jpg|png|gif)$"))
    .collect(Collectors.toList());
```

### By Content Type

```java
// Exact match
Optional<Attachment> pdf = attachments.stream()
    .filter(a -> "application/pdf".equals(a.getContentType()))
    .findFirst();

// Prefix match
List<Attachment> images = attachments.stream()
    .filter(a -> a.getContentType().startsWith("image/"))
    .collect(Collectors.toList());
```

### By Size

```java
// Attachments over 1MB
List<Attachment> large = attachments.stream()
    .filter(a -> a.getSize() > 1024 * 1024)
    .collect(Collectors.toList());

// Attachments under 100KB
List<Attachment> small = attachments.stream()
    .filter(a -> a.getSize() < 100 * 1024)
    .collect(Collectors.toList());
```

## Saving Attachments

### Basic Save

```java
attachment.saveTo(Path.of("/tmp/downloaded.pdf"));
```

### With Validation

```java
Path destination = Path.of("/tmp", attachment.getFilename());

// Ensure parent directory exists
Files.createDirectories(destination.getParent());

// Save
attachment.saveTo(destination);

// Verify
assertThat(Files.exists(destination)).isTrue();
assertThat(Files.size(destination)).isEqualTo(attachment.getSize());
```

### Save All Attachments

```java
Path outputDir = Path.of("/tmp/attachments");
Files.createDirectories(outputDir);

for (Attachment attachment : email.getAttachments()) {
    Path dest = outputDir.resolve(attachment.getFilename());
    attachment.saveTo(dest);
    System.out.println("Saved: " + dest);
}
```

:::note
`saveTo()` throws `IllegalStateException` if the attachment content is not available due to corrupted data or a server issue.
:::

## Validating Attachments

### Presence Check

```java
@Test
void shouldHaveAttachment() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));

    assertThat(email.getAttachments())
        .isNotEmpty()
        .anyMatch(a -> a.getFilename().endsWith(".pdf"));
}
```

### Content Type Validation

```java
@Test
void shouldHavePdfAttachment() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));

    Attachment pdf = email.getAttachments().stream()
        .filter(a -> "application/pdf".equals(a.getContentType()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("PDF not found"));

    assertThat(pdf.getFilename()).endsWith(".pdf");
}
```

### Size Validation

```java
@Test
void shouldHaveReasonableSize() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));

    for (Attachment attachment : email.getAttachments()) {
        assertThat(attachment.getSize())
            .as("Attachment %s should not be empty", attachment.getFilename())
            .isGreaterThan(0);

        assertThat(attachment.getSize())
            .as("Attachment %s should be under 10MB", attachment.getFilename())
            .isLessThan(10 * 1024 * 1024);
    }
}
```

### Content Validation

```java
@Test
void shouldContainExpectedData() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));

    Attachment csv = email.getAttachments().stream()
        .filter(a -> a.getFilename().endsWith(".csv"))
        .findFirst()
        .orElseThrow();

    String content = new String(csv.getContent(), StandardCharsets.UTF_8);

    assertThat(content).contains("header1,header2");
    assertThat(content.lines().count()).isGreaterThan(1);
}
```

## Testing Patterns

### Wait for Email with Attachments

```java
@Test
void shouldReceiveEmailWithAttachment() {
    Email email = inbox.waitForEmail(
        EmailFilter.matching(e -> !e.getAttachments().isEmpty()),
        Duration.ofSeconds(30)
    );

    assertThat(email.getAttachments()).isNotEmpty();
}
```

### Verify Attachment Count

```java
@Test
void shouldHaveExpectedAttachments() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));

    assertThat(email.getAttachments())
        .hasSize(2)
        .extracting(Attachment::getFilename)
        .containsExactlyInAnyOrder("invoice.pdf", "receipt.csv");
}
```

### Complete Attachment Test

```java
@Test
void shouldReceiveInvoiceWithAttachments() {
    // Trigger action that sends email with attachments
    orderService.sendInvoice(inbox.getEmailAddress(), orderId);

    // Wait for email
    Email email = inbox.waitForEmail(
        EmailFilter.subjectContains("Invoice"),
        Duration.ofSeconds(30)
    );

    // Verify attachments
    assertThat(email.getAttachments()).hasSize(2);

    // Check PDF invoice
    Attachment invoice = email.getAttachments().stream()
        .filter(a -> a.getFilename().contains("invoice"))
        .findFirst()
        .orElseThrow();
    assertThat(invoice.getContentType()).isEqualTo("application/pdf");
    assertThat(invoice.getSize()).isGreaterThan(0);

    // Check CSV line items
    Attachment lineItems = email.getAttachments().stream()
        .filter(a -> a.getFilename().endsWith(".csv"))
        .findFirst()
        .orElseThrow();
    String csv = new String(lineItems.getContent(), StandardCharsets.UTF_8);
    assertThat(csv).contains("Product,Quantity,Price");
}
```

## Advanced Patterns

### Batch Processing

```java
void processAllAttachments(List<Email> emails) {
    emails.stream()
        .flatMap(e -> e.getAttachments().stream())
        .forEach(this::processAttachment);
}

void processAttachment(Attachment attachment) {
    switch (attachment.getContentType()) {
        case "application/pdf" -> processPdf(attachment);
        case "text/csv" -> processCsv(attachment);
        default -> logUnknownType(attachment);
    }
}
```

### Metadata Collection

```java
record AttachmentInfo(
    String emailId,
    String filename,
    String contentType,
    int size
) {}

List<AttachmentInfo> collectMetadata(List<Email> emails) {
    return emails.stream()
        .flatMap(email -> email.getAttachments().stream()
            .map(a -> new AttachmentInfo(
                email.getId(),
                a.getFilename(),
                a.getContentType(),
                a.getSize()
            )))
        .collect(Collectors.toList());
}
```

### Helper Methods

```java
class AttachmentHelper {
    public static Optional<Attachment> findByExtension(
            List<Attachment> attachments, String extension) {
        return attachments.stream()
            .filter(a -> a.getFilename().endsWith(extension))
            .findFirst();
    }

    public static Optional<Attachment> findByContentType(
            List<Attachment> attachments, String contentTypePrefix) {
        return attachments.stream()
            .filter(a -> a.getContentType().startsWith(contentTypePrefix))
            .findFirst();
    }

    public static List<Attachment> filterBySize(
            List<Attachment> attachments, int minBytes, int maxBytes) {
        return attachments.stream()
            .filter(a -> a.getSize() >= minBytes && a.getSize() <= maxBytes)
            .collect(Collectors.toList());
    }
}
```

## Troubleshooting

### Empty Attachments List

If `email.getAttachments()` returns an empty list:

1. **Check the email source** - Some emails embed content inline rather than as attachments
2. **Verify Content-Disposition header** - Attachments require `Content-Disposition: attachment`
3. **Check raw email** - Use `email.getRaw()` to inspect the actual MIME structure

```java
if (email.getAttachments().isEmpty()) {
    System.out.println("No attachments found");
    System.out.println("Raw email:\n" + email.getRaw());
}
```

### Content Not Available

If `attachment.getContent()` returns `null` or `saveTo()` throws `IllegalStateException`, this typically indicates corrupted data or a server issue:

```java
try {
    attachment.saveTo(Path.of("/tmp/file.pdf"));
} catch (IllegalStateException e) {
    System.err.println("Attachment content not available: " + e.getMessage());
    // Check if the email was received correctly
    System.err.println("This may indicate corrupted data or a server issue");
}
```

### Corrupted Content

If attachment content appears corrupted:

1. **Check size matches** - Compare `getSize()` with actual byte array length
2. **Verify encoding** - Some content may need specific charset handling
3. **Check MIME type** - Content type might be incorrectly set

```java
byte[] content = attachment.getContent();
if (content.length != attachment.getSize()) {
    System.err.println("Size mismatch: expected " + attachment.getSize()
        + ", got " + content.length);
}
```

### Missing Filename

Some emails use `Content-ID` instead of filename:

```java
String filename = attachment.getFilename();
if (filename == null || filename.isEmpty()) {
    // Generate filename from content type
    String ext = switch (attachment.getContentType()) {
        case "application/pdf" -> ".pdf";
        case "image/png" -> ".png";
        case "image/jpeg" -> ".jpg";
        default -> ".bin";
    };
    filename = "attachment-" + System.currentTimeMillis() + ext;
}
```

### Wrong Content Type

Some senders use generic `application/octet-stream`:

```java
// Detect actual type from content
byte[] content = attachment.getContent();
String actualType = detectMimeType(content);

// Or check magic bytes
if (content.length >= 4) {
    String magic = new String(content, 0, 4, StandardCharsets.US_ASCII);
    if (magic.equals("%PDF")) {
        System.out.println("This is actually a PDF");
    }
}
```

## Java-Specific Considerations

- Use `StandardCharsets.UTF_8` for text encoding
- Use `Path` API for file operations
- Use `Stream` API for filtering and processing
- Use `ByteArrayInputStream` for in-memory processing
- Use Records for data classes (Java 16+)

## Next Steps

- [Email Objects](/client-java/concepts/emails/) - Understanding email properties
- [Waiting for Emails](/client-java/guides/waiting-for-emails/) - Email delivery strategies
- [API Reference: Email](/client-java/api/email/) - Complete Email API documentation
