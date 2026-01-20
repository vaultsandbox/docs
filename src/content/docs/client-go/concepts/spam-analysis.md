---
title: Spam Analysis
description: Understanding spam analysis results from Rspamd integration in VaultSandbox
---

VaultSandbox integrates with [Rspamd](https://rspamd.com/) to provide spam analysis for incoming emails. When enabled, each email is analyzed and scored, with results included in the email metadata.

## What is Spam Analysis?

Spam analysis helps identify unwanted or malicious emails by:

- **Scoring emails** based on spam characteristics
- **Triggering rules** (symbols) that detect specific patterns
- **Recommending actions** (reject, add header, etc.)
- **Classifying emails** as spam or ham (not spam)

## Availability

Spam analysis requires:

1. **Server-side configuration**: The gateway must have Rspamd enabled (`VSB_SPAM_ANALYSIS_ENABLED=true`)
2. **Per-inbox setting**: The inbox must have spam analysis enabled (default depends on server configuration)

Check if the server supports spam analysis:

```go
serverInfo := client.ServerInfo()
if serverInfo.SpamAnalysisEnabled {
    fmt.Println("Spam analysis is available")
}
```

## SpamAnalysis Struct

Every email has a `SpamAnalysis` field when spam analysis is enabled:

```go
email, err := inbox.WaitForEmail(ctx, vaultsandbox.WithWaitTimeout(10*time.Second))
if err != nil {
    log.Fatal(err)
}

if email.SpamAnalysis != nil {
    fmt.Printf("Status: %s\n", email.SpamAnalysis.Status)
    fmt.Printf("Score: %v\n", email.SpamAnalysis.Score)
    fmt.Printf("IsSpam: %v\n", email.SpamAnalysis.IsSpam)
    fmt.Printf("Action: %s\n", email.SpamAnalysis.Action)
}
```

The `SpamAnalysis` struct is defined in the `spamanalysis` package:

```go
import "github.com/vaultsandbox/client-go/spamanalysis"

type SpamAnalysis struct {
    Status           SpamStatus   // "analyzed", "skipped", "error"
    Score            *float64     // Spam score (positive = more spammy)
    RequiredScore    *float64     // Threshold for spam classification
    Action           SpamAction   // Recommended action
    IsSpam           *bool        // Whether classified as spam
    Symbols          []SpamSymbol // Triggered rules with scores
    ProcessingTimeMs *int         // Analysis time in milliseconds
    Info             string       // Error/skip reason
}
```

## Status Values

| Status     | Meaning                                              |
| ---------- | ---------------------------------------------------- |
| `analyzed` | Email was successfully analyzed by Rspamd            |
| `skipped`  | Analysis was skipped (disabled globally or per-inbox)|
| `error`    | Analysis failed (Rspamd unavailable, timeout, etc.)  |

### Checking Status

```go
if email.SpamAnalysis != nil {
    switch email.SpamAnalysis.Status {
    case spamanalysis.StatusAnalyzed:
        fmt.Printf("Score: %.2f\n", *email.SpamAnalysis.Score)
    case spamanalysis.StatusSkipped:
        fmt.Printf("Skipped: %s\n", email.SpamAnalysis.Info)
    case spamanalysis.StatusError:
        fmt.Printf("Error: %s\n", email.SpamAnalysis.Info)
    }
}
```

## Action Values

Rspamd returns an action recommendation based on the spam score:

| Action            | Meaning                              |
| ----------------- | ------------------------------------ |
| `no action`       | Email is likely legitimate           |
| `greylist`        | Temporary rejection recommended      |
| `add header`      | Add spam header but deliver          |
| `rewrite subject` | Modify subject to indicate spam      |
| `soft reject`     | Temporary rejection (4xx SMTP)       |
| `reject`          | Permanently reject the email (5xx)   |

### Action Constants

```go
import "github.com/vaultsandbox/client-go/spamanalysis"

if email.SpamAnalysis.Action == spamanalysis.ActionReject {
    fmt.Println("Email would be rejected by most mail servers")
}

if email.SpamAnalysis.Action == spamanalysis.ActionAddHeader {
    fmt.Println("Email may end up in spam folder")
}
```

## Spam Score

The spam score indicates how likely an email is spam:

- **Negative scores**: Strong ham (legitimate email) indicators
- **Near zero**: Neutral
- **Positive scores**: Spam indicators
- **High positive** (typically >6): Likely spam

```go
if email.SpamAnalysis.WasAnalyzed() {
    score := *email.SpamAnalysis.Score
    requiredScore := *email.SpamAnalysis.RequiredScore

    fmt.Printf("Score: %.2f (threshold: %.2f)\n", score, requiredScore)

    if score >= requiredScore {
        fmt.Println("Classified as spam")
    } else {
        fmt.Println("Classified as ham (not spam)")
    }
}
```

## Symbols

Symbols represent individual rules that triggered during analysis. Each symbol contributes to the overall spam score.

### SpamSymbol Struct

```go
type SpamSymbol struct {
    Name        string   // Rule identifier (e.g., "DKIM_SIGNED")
    Score       float64  // Score contribution
    Description string   // Human-readable explanation
    Options     []string // Additional context
}
```

### Working with Symbols

```go
if email.SpamAnalysis.WasAnalyzed() {
    for _, symbol := range email.SpamAnalysis.Symbols {
        fmt.Printf("%s: %.2f\n", symbol.Name, symbol.Score)
        if symbol.Description != "" {
            fmt.Printf("  %s\n", symbol.Description)
        }
    }
}
```

### Common Symbols

| Symbol             | Score    | Meaning                          |
| ------------------ | -------- | -------------------------------- |
| `DKIM_SIGNED`      | Negative | Email has valid DKIM signature   |
| `SPF_ALLOW`        | Negative | SPF check passed                 |
| `BAYES_HAM`        | Negative | Bayesian filter indicates ham    |
| `BAYES_SPAM`       | Positive | Bayesian filter indicates spam   |
| `FORGED_SENDER`    | Positive | Sender address appears forged    |
| `MISSING_MID`      | Positive | Missing Message-ID header        |
| `RCVD_IN_DNSWL_*`  | Negative | IP is in DNS whitelist           |
| `RCVD_IN_SORBS_*`  | Positive | IP is in SORBS blocklist         |

### Categorizing Symbols

The package provides a helper to categorize symbols:

```go
import "github.com/vaultsandbox/client-go/spamanalysis"

if email.SpamAnalysis.WasAnalyzed() {
    positive, negative, neutral := spamanalysis.CategorizeSymbols(email.SpamAnalysis.Symbols)

    fmt.Println("Spam indicators:")
    for _, s := range positive {
        fmt.Printf("  +%.2f %s\n", s.Score, s.Name)
    }

    fmt.Println("Ham indicators:")
    for _, s := range negative {
        fmt.Printf("  %.2f %s\n", s.Score, s.Name)
    }
}
```

## Helper Methods

### Status Checks

```go
// Check if analysis was performed
if email.SpamAnalysis.WasAnalyzed() {
    // Safe to access Score, IsSpam, Symbols
}

// Check if analysis was skipped
if email.SpamAnalysis.WasSkipped() {
    fmt.Printf("Reason: %s\n", email.SpamAnalysis.Info)
}

// Check if analysis failed
if email.SpamAnalysis.HasError() {
    fmt.Printf("Error: %s\n", email.SpamAnalysis.Info)
}
```

### Safe Value Access

```go
// GetScore returns nil if not analyzed
score := email.SpamAnalysis.GetScore()
if score != nil {
    fmt.Printf("Score: %.2f\n", *score)
}

// GetIsSpam returns nil if not analyzed
isSpam := email.SpamAnalysis.GetIsSpam()
if isSpam != nil {
    fmt.Printf("Is spam: %v\n", *isSpam)
}
```

### Validation Summary

```go
validation := email.SpamAnalysis.Validate()

if validation.Available {
    fmt.Printf("Score: %.2f\n", validation.Score)
    fmt.Printf("Is spam: %v\n", validation.IsSpam)
    fmt.Printf("Action: %s\n", validation.Action)
} else {
    fmt.Printf("Not available: %s\n", validation.Reason)
}
```

### SpamValidation Struct

```go
type SpamValidation struct {
    Available bool       // Whether results are available
    IsSpam    bool       // Whether classified as spam
    Score     float64    // The spam score
    Action    SpamAction // Recommended action
    Reason    string     // Skip/error reason when not available
}
```

## Per-Inbox Configuration

Control spam analysis per inbox using `WithSpamAnalysis`:

```go
// Enable spam analysis for this inbox
inbox, err := client.CreateInbox(ctx, vaultsandbox.WithSpamAnalysis(true))

// Disable spam analysis for this inbox
inbox, err := client.CreateInbox(ctx, vaultsandbox.WithSpamAnalysis(false))

// Use server default (omit the option)
inbox, err := client.CreateInbox(ctx)
```

## Testing Patterns

### Verify Legitimate Emails Pass

```go
func TestEmailIsNotSpam(t *testing.T) {
    ctx := context.Background()
    inbox, err := client.CreateInbox(ctx, vaultsandbox.WithSpamAnalysis(true))
    if err != nil {
        t.Fatal(err)
    }
    defer inbox.Delete(ctx)

    sendEmail(inbox.EmailAddress())

    email, err := inbox.WaitForEmail(ctx, vaultsandbox.WithWaitTimeout(10*time.Second))
    if err != nil {
        t.Fatal(err)
    }

    if email.SpamAnalysis == nil {
        t.Skip("spam analysis not available")
    }

    if !email.SpamAnalysis.WasAnalyzed() {
        t.Skipf("spam analysis skipped: %s", email.SpamAnalysis.Info)
    }

    if *email.SpamAnalysis.IsSpam {
        t.Errorf("email classified as spam with score %.2f", *email.SpamAnalysis.Score)
        for _, s := range email.SpamAnalysis.Symbols {
            if s.Score > 0 {
                t.Logf("  %s: +%.2f", s.Name, s.Score)
            }
        }
    }
}
```

### Check Spam Score Threshold

```go
func TestEmailSpamScore(t *testing.T) {
    email, err := inbox.WaitForEmail(ctx, vaultsandbox.WithWaitTimeout(10*time.Second))
    if err != nil {
        t.Fatal(err)
    }

    if email.SpamAnalysis.WasAnalyzed() {
        score := *email.SpamAnalysis.Score

        // Expect score below a reasonable threshold
        if score > 3.0 {
            t.Errorf("spam score %.2f exceeds threshold 3.0", score)
        }
    }
}
```

### Verify Authentication Reduces Spam Score

```go
func TestAuthenticationReducesSpamScore(t *testing.T) {
    email, err := inbox.WaitForEmail(ctx, vaultsandbox.WithWaitTimeout(10*time.Second))
    if err != nil {
        t.Fatal(err)
    }

    if !email.SpamAnalysis.WasAnalyzed() {
        t.Skip("spam analysis not available")
    }

    // Check for authentication-related ham indicators
    hasAuthSymbols := false
    for _, s := range email.SpamAnalysis.Symbols {
        if s.Score < 0 && (strings.Contains(s.Name, "DKIM") ||
            strings.Contains(s.Name, "SPF") ||
            strings.Contains(s.Name, "DMARC")) {
            hasAuthSymbols = true
            t.Logf("Found auth symbol: %s (%.2f)", s.Name, s.Score)
        }
    }

    if !hasAuthSymbols {
        t.Log("Warning: No authentication symbols found - configure SPF/DKIM/DMARC")
    }
}
```

### Handle Skipped Analysis

```go
func TestHandleSkippedAnalysis(t *testing.T) {
    // Create inbox without spam analysis
    inbox, err := client.CreateInbox(ctx, vaultsandbox.WithSpamAnalysis(false))
    if err != nil {
        t.Fatal(err)
    }
    defer inbox.Delete(ctx)

    sendEmail(inbox.EmailAddress())

    email, err := inbox.WaitForEmail(ctx, vaultsandbox.WithWaitTimeout(10*time.Second))
    if err != nil {
        t.Fatal(err)
    }

    if email.SpamAnalysis != nil && email.SpamAnalysis.WasSkipped() {
        t.Logf("Spam analysis skipped as expected: %s", email.SpamAnalysis.Info)
    }
}
```

### Log Spam Analysis Details

```go
func logSpamAnalysis(email *vaultsandbox.Email) {
    sa := email.SpamAnalysis
    if sa == nil {
        fmt.Println("Spam analysis: not available")
        return
    }

    fmt.Printf("Spam analysis status: %s\n", sa.Status)

    if sa.WasAnalyzed() {
        fmt.Printf("  Score: %.2f (threshold: %.2f)\n", *sa.Score, *sa.RequiredScore)
        fmt.Printf("  Is spam: %v\n", *sa.IsSpam)
        fmt.Printf("  Action: %s\n", sa.Action)
        fmt.Printf("  Processing time: %dms\n", *sa.ProcessingTimeMs)

        if len(sa.Symbols) > 0 {
            fmt.Println("  Symbols:")
            for _, s := range sa.Symbols {
                fmt.Printf("    %+.2f %s\n", s.Score, s.Name)
            }
        }
    } else {
        fmt.Printf("  Info: %s\n", sa.Info)
    }
}
```

## Why Spam Analysis Matters

### Email Deliverability

Testing spam analysis catches issues like:

- **Missing authentication**: Emails without SPF/DKIM score higher
- **Blacklisted IPs**: Sending from IPs on blocklists
- **Suspicious content**: Patterns that trigger spam filters
- **Malformed headers**: Missing or incorrect email headers

### Real-World Example

```go
func TestProductionEmailDeliverability(t *testing.T) {
    ctx := context.Background()
    inbox, err := client.CreateInbox(ctx, vaultsandbox.WithSpamAnalysis(true))
    if err != nil {
        t.Fatal(err)
    }
    defer inbox.Delete(ctx)

    app.SendMarketingEmail(inbox.EmailAddress())

    email, err := inbox.WaitForEmail(ctx, vaultsandbox.WithWaitTimeout(10*time.Second))
    if err != nil {
        t.Fatal(err)
    }

    if email.SpamAnalysis.WasAnalyzed() {
        validation := email.SpamAnalysis.Validate()

        if validation.IsSpam {
            t.Errorf("Marketing email classified as spam (score: %.2f)", validation.Score)
            t.Log("Action required:")
            t.Log("- Review email content for spam triggers")
            t.Log("- Verify SPF/DKIM/DMARC configuration")
            t.Log("- Check sending IP reputation")

            positive, _, _ := spamanalysis.CategorizeSymbols(email.SpamAnalysis.Symbols)
            t.Log("Triggered spam rules:")
            for _, s := range positive {
                t.Logf("  +%.2f %s: %s", s.Score, s.Name, s.Description)
            }
        }

        // Warn if score is borderline
        if validation.Score > 4.0 && !validation.IsSpam {
            t.Logf("Warning: Score %.2f is borderline - may be flagged by stricter filters", validation.Score)
        }
    }
}
```

## Troubleshooting

### No Spam Analysis Results

```go
if email.SpamAnalysis == nil {
    fmt.Println("Spam analysis not available")
    fmt.Println("Possible causes:")
    fmt.Println("- Server has VSB_SPAM_ANALYSIS_ENABLED=false")
    fmt.Println("- Inbox created with WithSpamAnalysis(false)")
    fmt.Println("- Gateway running in backend mode")

    // Check server capabilities
    if !client.ServerInfo().SpamAnalysisEnabled {
        fmt.Println("Server does not have spam analysis enabled")
    }
}
```

### Analysis Error

```go
if email.SpamAnalysis != nil && email.SpamAnalysis.HasError() {
    fmt.Printf("Spam analysis failed: %s\n", email.SpamAnalysis.Info)
    fmt.Println("Possible causes:")
    fmt.Println("- Rspamd service unavailable")
    fmt.Println("- Connection timeout")
    fmt.Println("- Rspamd configuration error")
}
```

### High Spam Score for Legitimate Emails

```go
if email.SpamAnalysis.WasAnalyzed() && *email.SpamAnalysis.Score > 5.0 {
    fmt.Printf("High spam score: %.2f\n", *email.SpamAnalysis.Score)

    positive, negative, _ := spamanalysis.CategorizeSymbols(email.SpamAnalysis.Symbols)

    fmt.Println("\nSpam indicators (need fixing):")
    for _, s := range positive {
        fmt.Printf("  +%.2f %s: %s\n", s.Score, s.Name, s.Description)
    }

    fmt.Println("\nHam indicators (working correctly):")
    for _, s := range negative {
        fmt.Printf("  %.2f %s: %s\n", s.Score, s.Name, s.Description)
    }

    fmt.Println("\nCommon fixes:")
    fmt.Println("- Configure SPF record for your domain")
    fmt.Println("- Enable DKIM signing")
    fmt.Println("- Set up DMARC policy")
    fmt.Println("- Check IP reputation")
}
```

## Next Steps

- **[Gateway Spam Analysis](/gateway/spam-analysis/)** - Server-side configuration
- **[Authentication Results](/client-go/concepts/auth-results/)** - SPF/DKIM/DMARC validation
- **[Configuration](/client-go/configuration/)** - Client and inbox options
- **[Testing Patterns](/client-go/testing/password-reset/)** - Real-world testing examples
