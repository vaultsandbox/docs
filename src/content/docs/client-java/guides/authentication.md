---
title: Email Authentication Testing
description: Guide for testing email authentication (SPF/DKIM/DMARC) in VaultSandbox Java client
---

Email authentication testing ensures your emails will be delivered successfully and not marked as spam. VaultSandbox provides detailed authentication results for every email received.

## Why Test Email Authentication?

- **Verify deliverability** - Ensure emails reach inboxes, not spam folders
- **Meet compliance requirements** - Many organizations require SPF/DKIM/DMARC
- **Protect brand reputation** - Prevent spoofing and phishing using your domain
- **Catch configuration issues early** - Find problems before production deployment

## Basic Authentication Check

```java
Email email = inbox.waitForEmail(Duration.ofSeconds(30));
AuthResults auth = email.getAuthResults();

AuthValidation validation = auth.validate();
assertThat(validation.isFullyAuthenticated())
    .as("All authentication checks should pass")
    .isTrue();
```

## Authentication Components

VaultSandbox validates four authentication mechanisms:

| Mechanism | Purpose | Result Values |
|-----------|---------|---------------|
| **SPF** | Validates sender IP is authorized | pass, fail, softfail, neutral, none, temperror, permerror |
| **DKIM** | Validates email signature | pass, fail, none |
| **DMARC** | Policy enforcement for SPF/DKIM | pass, fail, none |
| **Reverse DNS** | Validates PTR record | pass, fail, none |

## Testing Individual Mechanisms

### SPF Testing

SPF (Sender Policy Framework) verifies that the sending server's IP address is authorized to send email for the domain.

```java
@Test
void shouldPassSpf() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    SpfResult spf = email.getAuthResults().getSpf();

    assertThat(spf.getResult()).isEqualToIgnoringCase("pass");
    assertThat(spf.getDomain()).isEqualTo("example.com");
}
```

SPF result values:
- `pass` - IP is authorized
- `fail` - IP is explicitly not authorized
- `softfail` - IP is probably not authorized
- `neutral` - No assertion about the IP
- `none` - No SPF record found

### DKIM Testing

DKIM (DomainKeys Identified Mail) verifies the email was signed by the domain and wasn't modified in transit. Multiple DKIM signatures may be present.

```java
@Test
void shouldPassDkim() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    List<DkimResult> dkimResults = email.getAuthResults().getDkim();

    assertThat(dkimResults).isNotEmpty();

    // Check that at least one signature passes
    boolean anyPass = dkimResults.stream()
        .anyMatch(dkim -> "pass".equalsIgnoreCase(dkim.getResult()));
    assertThat(anyPass).isTrue();

    // Inspect individual signatures
    for (DkimResult dkim : dkimResults) {
        System.out.printf("DKIM: %s (domain: %s, selector: %s)%n",
            dkim.getResult(), dkim.getDomain(), dkim.getSelector());
    }
}
```

### DMARC Testing

DMARC (Domain-based Message Authentication, Reporting, and Conformance) builds on SPF and DKIM, specifying how receivers should handle authentication failures.

```java
@Test
void shouldPassDmarc() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    DmarcResult dmarc = email.getAuthResults().getDmarc();

    assertThat(dmarc.getResult()).isEqualToIgnoringCase("pass");

    // Verify domain has a strict policy
    assertThat(dmarc.getPolicy()).isIn("quarantine", "reject");
}
```

DMARC policies:
- `none` - No action, monitoring only
- `quarantine` - Treat suspicious emails as spam
- `reject` - Reject emails that fail authentication

### Reverse DNS Testing

Reverse DNS validates that the sending IP has a valid PTR record matching the sender's hostname.

```java
@Test
void shouldHaveValidReverseDns() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    ReverseDnsResult rdns = email.getAuthResults().getReverseDns();

    assertThat(rdns.isVerified()).isTrue();
    assertThat(rdns.getHostname()).isNotBlank();
    assertThat(rdns.getIp()).isNotBlank();
}
```

## Complete Authentication Test

```java
@Test
void shouldPassAllAuthentication() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    AuthResults auth = email.getAuthResults();

    assertThat(auth).isNotNull();

    // Check each mechanism individually
    assertThat(auth.getSpf().getResult())
        .isEqualToIgnoringCase("pass");

    assertThat(auth.getDkim())
        .isNotEmpty()
        .anyMatch(d -> "pass".equalsIgnoreCase(d.getResult()));

    assertThat(auth.getDmarc().getResult())
        .isEqualToIgnoringCase("pass");

    assertThat(auth.getReverseDns().isVerified())
        .isTrue();

    // Or use the validation helper
    AuthValidation validation = auth.validate();
    assertThat(validation.getFailed())
        .as("Failed checks: %s", validation.getFailed())
        .isEmpty();
}
```

## Using the Validation Helper

The `AuthValidation` class provides convenient methods for checking authentication status.

```java
AuthValidation validation = auth.validate();

// Check overall status
boolean allPassed = validation.isFullyAuthenticated();
// or
boolean allPassed = validation.isPassed();

// Get passed checks
List<String> passed = validation.getPassed();  // ["SPF", "DKIM", "DMARC", "ReverseDNS"]

// Get failed checks with reasons
List<String> failed = validation.getFailed();  // ["SPF: softfail", "DKIM: fail"]
// or
List<String> failures = validation.getFailures();  // alias for getFailed()

// Check specific mechanisms
boolean spfPassed = validation.hasSpf();
boolean dkimPassed = validation.hasDkim();
boolean dmarcPassed = validation.hasDmarc();
boolean rdnsPassed = validation.hasReverseDns();
```

### Assertion Examples

```java
AuthValidation validation = auth.validate();

// All checks must pass
assertThat(validation.isFullyAuthenticated()).isTrue();

// Specific checks must pass
assertThat(validation.hasSpf()).isTrue();
assertThat(validation.hasDkim()).isTrue();

// No failures allowed
assertThat(validation.getFailed()).isEmpty();

// At least some checks passed
assertThat(validation.getPassed()).isNotEmpty();
```

## Real-World Testing Patterns

### Pre-Production Validation

Validate email authentication before deploying to production:

```java
@Test
void validateProductionReadiness() {
    // Trigger transactional email from your application
    sendTransactionalEmail(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    AuthResults auth = email.getAuthResults();

    // Strict production requirements
    AuthValidation validation = auth.validate();
    assertThat(validation.getFailed())
        .as("Email fails authentication: %s", validation.getFailed())
        .isEmpty();

    // Verify DMARC policy is strict (not "none")
    assertThat(auth.getDmarc().getPolicy())
        .as("DMARC policy should be strict for production")
        .isIn("quarantine", "reject");
}
```

### Production Readiness Helper

```java
public class EmailAuthChecker {

    public boolean isProductionReady(Email email) {
        AuthResults auth = email.getAuthResults();
        if (auth == null) {
            return false;
        }

        AuthValidation validation = auth.validate();
        if (!validation.isFullyAuthenticated()) {
            return false;
        }

        // Require strict DMARC policy
        String policy = auth.getDmarc().getPolicy();
        return "quarantine".equals(policy) || "reject".equals(policy);
    }

    public List<String> getAuthIssues(Email email) {
        AuthResults auth = email.getAuthResults();
        if (auth == null) {
            return List.of("No authentication results available");
        }

        List<String> issues = new ArrayList<>(auth.validate().getFailed());

        // Check DMARC policy
        if ("none".equals(auth.getDmarc().getPolicy())) {
            issues.add("DMARC policy is 'none' (should be quarantine or reject)");
        }

        return issues;
    }
}
```

### Lenient Validation for Development

```java
@Test
void developmentAuthCheck() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    AuthResults auth = email.getAuthResults();

    // In development, at least one mechanism should pass
    if (auth != null) {
        AuthValidation validation = auth.validate();
        assertThat(validation.getPassed())
            .as("At least one auth mechanism should pass")
            .isNotEmpty();
    }
}
```

### Testing Multiple Email Types

```java
@Test
void shouldAuthenticateAllEmailTypes() {
    Map<String, Runnable> emailTriggers = Map.of(
        "Welcome", () -> sendWelcomeEmail(inbox.getEmailAddress()),
        "Password Reset", () -> sendPasswordReset(inbox.getEmailAddress()),
        "Order Confirmation", () -> sendOrderConfirmation(inbox.getEmailAddress())
    );

    for (Map.Entry<String, Runnable> entry : emailTriggers.entrySet()) {
        String emailType = entry.getKey();

        // Trigger email
        entry.getValue().run();

        // Wait and validate
        Email email = inbox.waitForEmail(Duration.ofSeconds(30));
        AuthValidation validation = email.getAuthResults().validate();

        assertThat(validation.isFullyAuthenticated())
            .as("%s email should pass all authentication", emailType)
            .isTrue();

        // Clean up for next iteration
        email.delete();
    }
}
```

## Handling Missing Authentication

Some emails may not have authentication results available:

```java
@Test
void shouldHandleMissingAuth() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    AuthResults auth = email.getAuthResults();

    // Auth may be null for some senders
    if (auth == null) {
        System.out.println("Warning: No authentication results available");
        System.out.println("This may indicate the email was sent from a");
        System.out.println("server that doesn't support authentication.");
        return;
    }

    // Proceed with validation
    AuthValidation validation = auth.validate();
    assertThat(validation.getFailed()).isEmpty();
}
```

### Null-Safe Pattern

```java
public boolean isAuthenticated(Email email) {
    return Optional.ofNullable(email.getAuthResults())
        .map(AuthResults::validate)
        .map(AuthValidation::isFullyAuthenticated)
        .orElse(false);
}
```

## Debugging Authentication Issues

```java
void debugAuthResults(Email email) {
    AuthResults auth = email.getAuthResults();
    if (auth == null) {
        System.out.println("No authentication results available");
        return;
    }

    System.out.println("=== Authentication Results ===");

    // SPF
    SpfResult spf = auth.getSpf();
    if (spf != null) {
        System.out.printf("SPF: %s (domain: %s)%n",
            spf.getResult(), spf.getDomain());
    }

    // DKIM
    List<DkimResult> dkimResults = auth.getDkim();
    if (dkimResults != null && !dkimResults.isEmpty()) {
        System.out.printf("DKIM: %d signature(s)%n", dkimResults.size());
        for (DkimResult dkim : dkimResults) {
            System.out.printf("  - %s (domain: %s, selector: %s)%n",
                dkim.getResult(), dkim.getDomain(), dkim.getSelector());
        }
    }

    // DMARC
    DmarcResult dmarc = auth.getDmarc();
    if (dmarc != null) {
        System.out.printf("DMARC: %s (domain: %s, policy: %s)%n",
            dmarc.getResult(), dmarc.getDomain(), dmarc.getPolicy());
    }

    // Reverse DNS
    ReverseDnsResult rdns = auth.getReverseDns();
    if (rdns != null) {
        System.out.printf("Reverse DNS: %s (ip: %s, hostname: %s)%n",
            rdns.isVerified() ? "verified" : "not verified",
            rdns.getIp(), rdns.getHostname());
    }

    // Summary
    AuthValidation validation = auth.validate();
    System.out.println("\nSummary:");
    System.out.println("  Passed: " + validation.getPassed());
    System.out.println("  Failed: " + validation.getFailed());
}
```

## Testing Authentication Failures

### Detecting SPF Failures

```java
@Test
void shouldDetectSpfFailure() {
    // Send from unauthorized IP (requires test setup)
    sendFromUnauthorizedSender(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    SpfResult spf = email.getAuthResults().getSpf();

    assertThat(spf.getResult()).isIn("fail", "softfail", "FAIL", "SOFTFAIL");
}
```

### Detecting DKIM Failures

```java
@Test
void shouldDetectDkimFailure() {
    // Send with invalid signature (requires test setup)
    sendWithInvalidDkim(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    List<DkimResult> dkimResults = email.getAuthResults().getDkim();

    boolean allFailed = dkimResults.stream()
        .noneMatch(d -> "pass".equalsIgnoreCase(d.getResult()));
    assertThat(allFailed).isTrue();
}
```

### Verifying DMARC Policy Enforcement

```java
@Test
void shouldEnforceDmarcPolicy() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    DmarcResult dmarc = email.getAuthResults().getDmarc();

    // Ensure policy is enforcing (not just monitoring)
    assertThat(dmarc.getPolicy())
        .as("DMARC policy should enforce (quarantine or reject)")
        .isNotEqualTo("none");
}
```

## JUnit 5 Test Examples

### Basic Test Class

```java
class EmailAuthenticationTest {
    private VaultSandboxClient client;
    private Inbox inbox;

    @BeforeEach
    void setUp() {
        ClientConfig config = ClientConfig.builder()
            .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
            .baseUrl(System.getenv("VAULTSANDBOX_URL"))
            .build();
        client = VaultSandboxClient.create(config);
        inbox = client.createInbox();
    }

    @AfterEach
    void tearDown() {
        if (inbox != null) {
            inbox.delete();
        }
    }

    @Test
    void transactionalEmailShouldPassAllAuth() {
        // Trigger email from your application
        myApp.sendWelcomeEmail(inbox.getEmailAddress());

        Email email = inbox.waitForEmail(Duration.ofSeconds(30));

        AuthValidation validation = email.getAuthResults().validate();
        assertThat(validation.isFullyAuthenticated()).isTrue();
    }

    @Test
    void marketingEmailShouldPassAllAuth() {
        myApp.sendMarketingEmail(inbox.getEmailAddress());

        Email email = inbox.waitForEmail(Duration.ofSeconds(30));

        AuthValidation validation = email.getAuthResults().validate();
        assertThat(validation.isFullyAuthenticated()).isTrue();
    }
}
```

### Parameterized Tests

```java
@ParameterizedTest
@ValueSource(strings = {"welcome", "password-reset", "order-confirmation", "newsletter"})
void allEmailTypesShouldPassAuthentication(String emailType) {
    triggerEmail(emailType, inbox.getEmailAddress());

    Email email = inbox.waitForEmail(Duration.ofSeconds(30));
    AuthValidation validation = email.getAuthResults().validate();

    assertThat(validation.isFullyAuthenticated())
        .as("Email type '%s' should pass all authentication", emailType)
        .isTrue();
}
```

## Best Practices

1. **Test in staging before production** - Validate authentication works with your actual email infrastructure
2. **Use strict DMARC policies** - `quarantine` or `reject`, not `none`
3. **Test all email types** - Welcome, transactional, marketing emails may use different sending infrastructure
4. **Monitor over time** - Authentication can break due to DNS changes, key rotations, or infrastructure updates
5. **Document expected failures** - If certain test emails intentionally fail authentication, document why
6. **Handle missing auth gracefully** - Not all senders provide full authentication

## Troubleshooting

### SPF Failing

- Verify DNS SPF record includes all sending IPs
- Check if email is sent through an unauthorized relay
- Ensure SPF record doesn't exceed 10 DNS lookups

### DKIM Failing

- Verify DKIM keys are published in DNS
- Check selector matches the signing configuration
- Ensure private key matches published public key

### DMARC Failing

- DMARC requires either SPF or DKIM to pass with alignment
- Verify DMARC record is published at `_dmarc.domain.com`
- Check alignment mode (strict vs relaxed)

### Reverse DNS Failing

- Verify PTR record exists for sending IP
- Ensure PTR hostname resolves back to the same IP
- Contact hosting provider if you can't set PTR records

## Next Steps

- [Authentication Results](/client-java/concepts/auth-results/) - Detailed API reference
- [Email Objects](/client-java/concepts/emails/) - Understanding email properties
- [CI/CD Testing](/client-java/testing/cicd/) - Continuous integration patterns
