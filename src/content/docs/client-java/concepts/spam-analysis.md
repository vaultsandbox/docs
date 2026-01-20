---
title: Spam Analysis
description: Working with spam analysis results in the VaultSandbox Java client
---

VaultSandbox can analyze incoming emails for spam using [Rspamd](https://rspamd.com/). When enabled, emails include spam scores, classifications, and detailed rule information.

For server configuration and setup, see the [Gateway Spam Analysis documentation](/gateway/spam-analysis/).

## Enabling Spam Analysis

### Check Server Availability

First, verify spam analysis is enabled on the server:

```java
ServerInfo info = client.getServerInfo();

if (info.isSpamAnalysisEnabled()) {
    System.out.println("Spam analysis is available");
} else {
    System.out.println("Spam analysis is not enabled on this server");
}
```

### Create Inbox with Spam Analysis

Enable spam analysis when creating an inbox:

```java
Inbox inbox = client.createInbox(
    CreateInboxOptions.builder()
        .spamAnalysis(true)
        .build()
);

System.out.println("Spam analysis: " + inbox.isSpamAnalysis());  // true
```

If not specified, inboxes use the server's default setting (`VSB_SPAM_ANALYSIS_INBOX_DEFAULT`).

## Accessing Spam Results

### SpamAnalysisResult Structure

Every email may include a `spamAnalysis` property:

```java
Email email = inbox.waitForEmail(Duration.ofSeconds(10));

SpamAnalysisResult spam = email.getSpamAnalysis();

if (spam != null) {
    System.out.println("Status: " + spam.getStatus());

    if (spam.getStatus() == SpamAnalysisStatus.ANALYZED) {
        System.out.println("Score: " + spam.getScore());
        System.out.println("Required: " + spam.getRequiredScore());
        System.out.println("Is spam: " + spam.isSpam());
        System.out.println("Action: " + spam.getAction());
    }
}
```

### Helper Methods

The `Email` class provides convenient methods:

```java
// Check if email is spam
Boolean isSpam = email.isSpam();
// Returns: true (spam), false (not spam), or null (not analyzed)

// Get the spam score
Double score = email.getSpamScore();
// Returns: number (score) or null (not analyzed)
```

## Status Values

| Status    | Description                                            |
| --------- | ------------------------------------------------------ |
| `ANALYZED`| Email was successfully analyzed by Rspamd              |
| `SKIPPED` | Analysis was skipped (disabled globally or per-inbox)  |
| `ERROR`   | Analysis failed (timeout, Rspamd unavailable, etc.)    |

## Action Values

Rspamd returns an action recommendation based on the spam score:

| Action            | Description                                |
| ----------------- | ------------------------------------------ |
| `NO_ACTION`       | Email is likely legitimate                 |
| `GREYLIST`        | Temporary rejection recommended            |
| `ADD_HEADER`      | Add spam header but deliver                |
| `REWRITE_SUBJECT` | Modify subject line to indicate spam       |
| `SOFT_REJECT`     | Temporary rejection                        |
| `REJECT`          | Email should be rejected                   |

## Working with Symbols

Symbols represent individual spam detection rules that triggered:

```java
SpamAnalysisResult spam = email.getSpamAnalysis();

if (spam != null && spam.isAnalyzed()) {
    System.out.println("Triggered rules:");

    for (SpamSymbol symbol : spam.getSymbols()) {
        String sign = symbol.getScore() >= 0 ? "+" : "";
        System.out.printf("  %s: %s%.1f%n",
            symbol.getName(), sign, symbol.getScore());

        if (symbol.getDescription() != null) {
            System.out.println("    " + symbol.getDescription());
        }

        if (!symbol.getOptions().isEmpty()) {
            System.out.println("    Options: " + String.join(", ", symbol.getOptions()));
        }
    }
}
```

Common symbol patterns:

- **Positive scores**: Spam indicators (e.g., `FORGED_SENDER`, `BAYES_SPAM`)
- **Negative scores**: Legitimate indicators (e.g., `DKIM_SIGNED`, `SPF_ALLOW`)

### Convenience Methods

The `SpamAnalysisResult` class provides methods to filter symbols:

```java
// Get spam indicators (positive scores, sorted by impact)
List<SpamSymbol> spamIndicators = spam.getSpamIndicators();

// Get legitimacy indicators (negative scores, sorted by impact)
List<SpamSymbol> hamIndicators = spam.getLegitimacyIndicators();

System.out.println("Top spam indicators:");
for (SpamSymbol s : spamIndicators) {
    System.out.printf("  %s: +%.1f%n", s.getName(), s.getScore());
}

System.out.println("Legitimacy indicators:");
for (SpamSymbol s : hamIndicators) {
    System.out.printf("  %s: %.1f%n", s.getName(), s.getScore());
}
```

## Testing Patterns

### Verify Emails Are Not Spam

```java
@Test
void shouldNotBeFlaggedAsSpam() {
    sendPasswordResetEmail(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(Duration.ofSeconds(30));

    // Check spam status
    assertThat(email.isSpam()).isFalse();

    // Optionally check score is low
    Double score = email.getSpamScore();
    if (score != null) {
        assertThat(score).isLessThan(5.0);
    }
}
```

### Check Spam Analysis Availability

```java
@Test
void shouldPerformSpamAnalysis() {
    Inbox inbox = client.createInbox(
        CreateInboxOptions.builder()
            .spamAnalysis(true)
            .build()
    );

    try {
        sendEmail(inbox.getEmailAddress());
        Email email = inbox.waitForEmail(Duration.ofSeconds(30));

        assertThat(email.getSpamAnalysis()).isNotNull();
        assertThat(email.getSpamAnalysis().getStatus())
            .isEqualTo(SpamAnalysisStatus.ANALYZED);
    } finally {
        inbox.delete();
    }
}
```

### Analyze Triggered Rules

```java
@Test
void shouldHaveValidDkimSignature() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));

    SpamAnalysisResult spam = email.getSpamAnalysis();
    if (spam != null && spam.isAnalyzed()) {
        List<SpamSymbol> symbols = spam.getSymbols();
        Optional<SpamSymbol> dkimSigned = symbols.stream()
            .filter(s -> "DKIM_SIGNED".equals(s.getName())
                || "R_DKIM_ALLOW".equals(s.getName()))
            .findFirst();

        // DKIM_SIGNED has negative score (indicates legitimate email)
        if (dkimSigned.isPresent()) {
            assertThat(dkimSigned.get().getScore()).isLessThan(0);
        }
    }
}
```

### Handle Missing Analysis

```java
Boolean spamStatus = email.isSpam();
Double spamScore = email.getSpamScore();

if (spamStatus == null) {
    System.out.println("Spam analysis not available");
    SpamAnalysisResult spam = email.getSpamAnalysis();
    if (spam != null) {
        System.out.println("Reason: " + spam.getInfo());
    }
} else {
    System.out.println("Is spam: " + spamStatus);
    System.out.println("Score: " + spamScore);
}
```

## Complete Example

```java
import com.vaultsandbox.client.*;
import com.vaultsandbox.client.model.*;
import java.time.Duration;

public class SpamAnalysisExample {

    public static void analyzeEmailSpam() {
        ClientConfig config = ClientConfig.builder()
            .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
            .baseUrl(System.getenv("VAULTSANDBOX_URL"))
            .build();

        try (VaultSandboxClient client = VaultSandboxClient.create(config)) {
            // Check if spam analysis is available
            ServerInfo info = client.getServerInfo();
            if (!info.isSpamAnalysisEnabled()) {
                System.out.println("Spam analysis not available on this server");
                return;
            }

            // Create inbox with spam analysis enabled
            Inbox inbox = client.createInbox(
                CreateInboxOptions.builder()
                    .spamAnalysis(true)
                    .build()
            );
            System.out.println("Inbox: " + inbox.getEmailAddress());

            // Wait for email
            Email email = inbox.waitForEmail(Duration.ofSeconds(30));

            System.out.println("\n=== Email Details ===");
            System.out.println("From: " + email.getFrom());
            System.out.println("Subject: " + email.getSubject());

            System.out.println("\n=== Spam Analysis ===");

            SpamAnalysisResult spam = email.getSpamAnalysis();
            if (spam == null) {
                System.out.println("No spam analysis data");
            } else if (!spam.isAnalyzed()) {
                System.out.println("Status: " + spam.getStatus());
                System.out.println("Info: " + (spam.getInfo() != null ? spam.getInfo() : "N/A"));
            } else {
                System.out.printf("Score: %.1f / %.1f%n",
                    spam.getScore(), spam.getRequiredScore());
                System.out.println("Is Spam: " + email.isSpam());
                System.out.println("Action: " + spam.getAction());
                System.out.println("Processing Time: " + spam.getProcessingTimeMs() + "ms");

                if (!spam.getSymbols().isEmpty()) {
                    System.out.println("\nTriggered Rules:");
                    spam.getSymbols().stream()
                        .sorted((a, b) -> Double.compare(
                            Math.abs(b.getScore()), Math.abs(a.getScore())))
                        .limit(10)
                        .forEach(s -> {
                            String sign = s.getScore() >= 0 ? "+" : "";
                            System.out.printf("  %s: %s%.1f%n",
                                s.getName(), sign, s.getScore());
                        });
                }
            }

            inbox.delete();
        }
    }

    public static void main(String[] args) {
        analyzeEmailSpam();
    }
}
```

## Understanding the "skipped" Status

Spam analysis can be skipped for several reasons:

1. **Global setting disabled** - `VSB_SPAM_ANALYSIS_ENABLED=false` on the server
2. **Per-inbox setting** - Inbox created with `spamAnalysis: false`
3. **Server mode** - Spam analysis not available in `backend` mode

Check the `info` field for the skip reason:

```java
SpamAnalysisResult spam = email.getSpamAnalysis();

if (spam != null && spam.getStatus() == SpamAnalysisStatus.SKIPPED) {
    System.out.println("Spam analysis was skipped");
    System.out.println("Reason: " + spam.getInfo());
}
```

## Error Handling

When spam analysis fails:

```java
SpamAnalysisResult spam = email.getSpamAnalysis();

if (spam != null && spam.getStatus() == SpamAnalysisStatus.ERROR) {
    System.err.println("Spam analysis failed");
    System.err.println("Error: " + spam.getInfo());

    // Common causes:
    // - Rspamd service unavailable
    // - Network timeout
    // - Configuration issues
}
```

## Next Steps

- **[Gateway Spam Analysis](/gateway/spam-analysis/)** - Server configuration and Rspamd setup
- **[Email API Reference](/client-java/api/email/)** - Complete email API documentation
- **[Authentication Results](/client-java/concepts/auth-results/)** - Email authentication (SPF/DKIM/DMARC)
- **[Managing Inboxes](/client-java/guides/managing-inboxes/)** - Inbox creation options
