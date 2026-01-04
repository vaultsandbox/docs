---
title: Authentication Results
description: Understanding email authentication (SPF, DKIM, DMARC) in VaultSandbox
---

VaultSandbox validates email authentication for every received email, providing detailed SPF, DKIM, DMARC, and reverse DNS results.

## What is Email Authentication?

Email authentication helps verify that an email:

- Came from the claimed sender domain (**SPF**)
- Wasn't modified in transit (**DKIM**)
- Complies with the domain's policy (**DMARC**)
- Came from a legitimate mail server (**Reverse DNS**)

## AuthResults Object

Every email has an `authResults` property:

```java
Email email = inbox.waitForEmail(Duration.ofSeconds(10));

AuthResults auth = email.getAuthResults();

System.out.println(auth.getSpf());       // SPF result
System.out.println(auth.getDkim());      // DKIM results (list)
System.out.println(auth.getDmarc());     // DMARC result
System.out.println(auth.getReverseDns()); // Reverse DNS result
```

## SPF (Sender Policy Framework)

Verifies the sending server is authorized to send from the sender's domain.

### SPF Result Structure

```java
SpfResult spf = email.getAuthResults().getSpf();

if (spf != null) {
    System.out.println(spf.getResult());  // "pass", "fail", "softfail", etc.
    System.out.println(spf.getDomain());  // Domain checked
    System.out.println(spf.getIp());      // IP address being validated
    System.out.println(spf.getDetails()); // Additional explanation
}
```

### SPF Status Values

| Status      | Meaning                                    |
| ----------- | ------------------------------------------ |
| `pass`      | Sending server is authorized               |
| `fail`      | Sending server is NOT authorized           |
| `softfail`  | Probably not authorized (policy says ~all) |
| `neutral`   | Domain makes no assertion                  |
| `temperror` | Temporary error during check               |
| `permerror` | Permanent error in SPF record              |
| `none`      | No SPF record found                        |

### SpfResult Properties

| Property  | Type     | Description                                                                 |
| --------- | -------- | --------------------------------------------------------------------------- |
| `result`  | `String` | SPF check result: pass, fail, softfail, neutral, none, temperror, permerror |
| `domain`  | `String` | Domain being checked                                                        |
| `ip`      | `String` | IP address of the sending server                                            |
| `details` | `String` | Additional explanation about the result                                     |

### SpfResult Methods

| Method         | Return Type | Description                    |
| -------------- | ----------- | ------------------------------ |
| `getResult()`  | `String`    | Returns the SPF result         |
| `getDomain()`  | `String`    | Returns the checked domain     |
| `getIp()`      | `String`    | Returns the sending server IP  |
| `getDetails()` | `String`    | Returns additional explanation |

### SPF Example

```java
Email email = inbox.waitForEmail(Duration.ofSeconds(10));

SpfResult spf = email.getAuthResults().getSpf();
if (spf != null) {
    assertThat(spf.getResult()).isEqualTo("pass");
    assertThat(spf.getDomain()).isEqualTo("example.com");

    System.out.printf("SPF %s for %s%n", spf.getResult(), spf.getDomain());
}
```

## DKIM (DomainKeys Identified Mail)

Cryptographically verifies the email hasn't been modified and came from the claimed domain.

### DKIM Result Structure

```java
List<DkimResult> dkim = email.getAuthResults().getDkim(); // List of results

if (dkim != null && !dkim.isEmpty()) {
    for (DkimResult result : dkim) {
        System.out.println(result.getResult());    // "pass", "fail", "none"
        System.out.println(result.getDomain());    // Signing domain
        System.out.println(result.getSelector());  // DKIM selector
        System.out.println(result.getSignature()); // DKIM signature info
    }
}
```

**Note**: An email can have multiple DKIM signatures (one per signing domain).

### DKIM Status Values

| Status | Meaning                 |
| ------ | ----------------------- |
| `pass` | Signature is valid      |
| `fail` | Signature is invalid    |
| `none` | No DKIM signature found |

### DkimResult Properties

| Property    | Type     | Description                                      |
| ----------- | -------- | ------------------------------------------------ |
| `result`    | `String` | DKIM verification result: pass, fail, none       |
| `domain`    | `String` | Signing domain                                   |
| `selector`  | `String` | DKIM selector (identifies the public key in DNS) |
| `signature` | `String` | DKIM signature information                       |

### DkimResult Methods

| Method           | Return Type | Description                 |
| ---------------- | ----------- | --------------------------- |
| `getResult()`    | `String`    | Returns the DKIM result     |
| `getDomain()`    | `String`    | Returns the signing domain  |
| `getSelector()`  | `String`    | Returns the DKIM selector   |
| `getSignature()` | `String`    | Returns DKIM signature info |

### DKIM Example

```java
Email email = inbox.waitForEmail(Duration.ofSeconds(10));

List<DkimResult> dkim = email.getAuthResults().getDkim();
if (dkim != null && !dkim.isEmpty()) {
    DkimResult first = dkim.get(0);

    assertThat(first.getResult()).isEqualTo("pass");
    assertThat(first.getDomain()).isEqualTo("example.com");

    System.out.printf("DKIM %s (%s._domainkey.%s)%n",
        first.getResult(), first.getSelector(), first.getDomain());
}
```

### Check If Any DKIM Signature Passes

```java
List<DkimResult> dkim = email.getAuthResults().getDkim();
boolean anyPass = dkim != null && dkim.stream()
    .anyMatch(d -> "pass".equalsIgnoreCase(d.getResult()));
```

## DMARC (Domain-based Message Authentication)

Checks that SPF or DKIM align with the From address and enforces the domain's policy.

### DMARC Result Structure

```java
DmarcResult dmarc = email.getAuthResults().getDmarc();

if (dmarc != null) {
    System.out.println(dmarc.getResult());   // "pass", "fail", "none"
    System.out.println(dmarc.getDomain());   // Domain checked
    System.out.println(dmarc.getPolicy());   // Domain's policy
    System.out.println(dmarc.getAligned());  // Whether SPF/DKIM align with From header
    System.out.println(dmarc.isAligned());   // Convenience: true if aligned
}
```

### DMARC Status Values

| Status | Meaning                                  |
| ------ | ---------------------------------------- |
| `pass` | DMARC check passed (SPF or DKIM aligned) |
| `fail` | DMARC check failed                       |
| `none` | No DMARC policy found                    |

### DMARC Policies

| Policy       | Meaning                         |
| ------------ | ------------------------------- |
| `none`       | No action (monitoring only)     |
| `quarantine` | Treat suspicious emails as spam |
| `reject`     | Reject emails that fail DMARC   |

### DmarcResult Properties

| Property  | Type      | Description                                                |
| --------- | --------- | ---------------------------------------------------------- |
| `result`  | `String`  | DMARC check result: pass, fail, none                       |
| `domain`  | `String`  | From domain being checked                                  |
| `policy`  | `String`  | Domain's DMARC policy: `none`, `quarantine`, or `reject`   |
| `aligned` | `Boolean` | Whether SPF/DKIM results align with the From header domain |

### DmarcResult Methods

| Method         | Return Type | Description                                   |
| -------------- | ----------- | --------------------------------------------- |
| `getResult()`  | `String`    | Returns the DMARC result                      |
| `getDomain()`  | `String`    | Returns the From domain                       |
| `getPolicy()`  | `String`    | Returns the domain's DMARC policy             |
| `getAligned()` | `Boolean`   | Returns alignment status (may be null)        |
| `isAligned()`  | `boolean`   | Convenience: true if aligned, false otherwise |

### DMARC Example

```java
Email email = inbox.waitForEmail(Duration.ofSeconds(10));

DmarcResult dmarc = email.getAuthResults().getDmarc();
if (dmarc != null) {
    assertThat(dmarc.getResult()).isEqualTo("pass");
    assertThat(dmarc.getDomain()).isEqualTo("example.com");

    System.out.printf("DMARC %s (policy: %s)%n",
        dmarc.getResult(), dmarc.getPolicy());
}
```

## Reverse DNS

Verifies the sending server's IP resolves to a hostname that matches the sending domain.

### Reverse DNS Result Structure

```java
ReverseDnsResult reverseDns = email.getAuthResults().getReverseDns();

if (reverseDns != null) {
    System.out.println(reverseDns.isVerified()); // true if verified, false otherwise
    System.out.println(reverseDns.getIp());       // IP address being validated
    System.out.println(reverseDns.getHostname()); // Resolved hostname
}
```

### ReverseDnsResult Properties

| Property   | Type      | Description                             |
| ---------- | --------- | --------------------------------------- |
| `verified` | `boolean` | Whether reverse DNS verification passed |
| `ip`       | `String`  | IP address of the sending server        |
| `hostname` | `String`  | Resolved hostname from PTR record       |

### ReverseDnsResult Methods

| Method          | Return Type | Description                             |
| --------------- | ----------- | --------------------------------------- |
| `isVerified()`  | `boolean`   | Returns true if reverse DNS is verified |
| `getIp()`       | `String`    | Returns the IP address being validated  |
| `getHostname()` | `String`    | Returns the resolved hostname           |

### Reverse DNS Example

```java
Email email = inbox.waitForEmail(Duration.ofSeconds(10));

ReverseDnsResult rdns = email.getAuthResults().getReverseDns();
if (rdns != null) {
    System.out.printf("Reverse DNS: %s for %s -> %s%n",
        rdns.isVerified() ? "verified" : "not verified",
        rdns.getIp(), rdns.getHostname());

    if (rdns.isVerified()) {
        System.out.println("Reverse DNS verification passed");
    }
}
```

## Validation Helper

The `validate()` method provides a summary of all authentication checks:

```java
AuthValidation validation = email.getAuthResults().validate();

System.out.println(validation.isFullyAuthenticated()); // All checks passed
System.out.println(validation.isPassed());             // Alias for isFullyAuthenticated()
System.out.println(validation.hasSpf());               // SPF check passed
System.out.println(validation.hasDkim());              // DKIM check passed
System.out.println(validation.hasDmarc());             // DMARC check passed
System.out.println(validation.hasReverseDns());        // Reverse DNS check passed
System.out.println(validation.getPassed());            // List of passed checks
System.out.println(validation.getFailed());            // List of failure reasons
System.out.println(validation.getFailures());          // Alias for getFailed()
```

### AuthValidation Methods

| Method                   | Return Type    | Description                                       |
| ------------------------ | -------------- | ------------------------------------------------- |
| `isFullyAuthenticated()` | `boolean`      | True if all checks passed and at least one exists |
| `isPassed()`             | `boolean`      | Alias for isFullyAuthenticated()                  |
| `hasSpf()`               | `boolean`      | SPF check passed                                  |
| `hasDkim()`              | `boolean`      | At least one DKIM signature passed                |
| `hasDmarc()`             | `boolean`      | DMARC check passed                                |
| `hasReverseDns()`        | `boolean`      | Reverse DNS check passed                          |
| `getPassed()`            | `List<String>` | List of passed check names                        |
| `getFailed()`            | `List<String>` | List of failure descriptions                      |
| `getFailures()`          | `List<String>` | Alias for getFailed()                             |

### Validation Examples

**All checks pass**:

```java
AuthValidation validation = email.getAuthResults().validate();

// validation.getPassed() = ["SPF", "DKIM", "DMARC", "ReverseDNS"]
// validation.getFailed() = []
// validation.isFullyAuthenticated() = true

assertThat(validation.isFullyAuthenticated()).isTrue();
assertThat(validation.getFailed()).isEmpty();
```

**Some checks fail**:

```java
AuthValidation validation = email.getAuthResults().validate();

// validation.getPassed() = ["DKIM", "ReverseDNS"]
// validation.getFailed() = ["SPF: fail", "DMARC: fail"]
// validation.isFullyAuthenticated() = false

if (!validation.isFullyAuthenticated()) {
    System.err.println("Authentication failures:");
    for (String failure : validation.getFailed()) {
        System.err.println("  - " + failure);
    }
}
```

## Testing Patterns

### Strict Authentication

```java
@Test
void shouldPassAllAuthenticationChecks() {
    sendEmail(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(Duration.ofSeconds(10));
    AuthValidation validation = email.getAuthResults().validate();

    assertThat(validation.isFullyAuthenticated()).isTrue();
    assertThat(validation.hasSpf()).isTrue();
    assertThat(validation.hasDkim()).isTrue();
    assertThat(validation.hasDmarc()).isTrue();
}
```

### Lenient Authentication

```java
@Test
void shouldHaveValidDkimSignature() {
    sendEmail(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(Duration.ofSeconds(10));
    List<DkimResult> dkim = email.getAuthResults().getDkim();

    // Only check DKIM (most reliable)
    assertThat(dkim).isNotNull();
    assertThat(dkim).isNotEmpty();
    assertThat(dkim.get(0).getResult()).isEqualTo("pass");
}
```

### Handling Missing Authentication

```java
@Test
void shouldHandleEmailsWithoutAuthentication() {
    Email email = inbox.waitForEmail(Duration.ofSeconds(10));

    AuthResults auth = email.getAuthResults();

    // Auth may be null for some email sources
    if (auth != null) {
        AuthValidation validation = auth.validate();

        // Log results for debugging
        if (!validation.isFullyAuthenticated()) {
            System.out.println("Auth failures (expected for test emails): "
                + validation.getFailed());
        }
    }
}
```

### Testing Specific Checks

```java
class EmailAuthenticationTest {
    private Inbox inbox;
    private Email email;

    @BeforeEach
    void setUp() {
        inbox = client.createInbox();
        sendEmail(inbox.getEmailAddress());
        email = inbox.waitForEmail(Duration.ofSeconds(10));
    }

    @AfterEach
    void tearDown() {
        inbox.delete();
    }

    @Test
    void shouldPassSpfCheck() {
        SpfResult spf = email.getAuthResults().getSpf();
        if (spf != null) {
            assertThat(spf.getResult()).isIn("pass", "neutral", "softfail");
        }
    }

    @Test
    void shouldPassDkimCheck() {
        List<DkimResult> dkim = email.getAuthResults().getDkim();
        if (dkim != null && !dkim.isEmpty()) {
            boolean anyPassed = dkim.stream()
                .anyMatch(d -> "pass".equalsIgnoreCase(d.getResult()));
            assertThat(anyPassed).isTrue();
        }
    }

    @Test
    void shouldPassDmarcCheck() {
        DmarcResult dmarc = email.getAuthResults().getDmarc();
        if (dmarc != null) {
            assertThat(dmarc.getResult()).isIn("pass", "none");
        }
    }
}
```

## Why Authentication Matters

### Production Readiness

Testing authentication catches issues like:

- **Misconfigured SPF records** - emails rejected by Gmail/Outlook
- **Missing DKIM signatures** - reduced deliverability
- **DMARC failures** - emails sent to spam
- **Reverse DNS mismatches** - flagged as suspicious

### Real-World Example

```java
@Test
void shouldHaveProductionReadyEmailConfiguration() {
    app.sendWelcomeEmail(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(Duration.ofSeconds(10));
    AuthValidation validation = email.getAuthResults().validate();

    // In production, these should all pass
    if (!validation.isFullyAuthenticated()) {
        System.err.println("Email authentication issues detected:");
        validation.getFailed().forEach(f -> System.err.println("   " + f));
        System.err.println();
        System.err.println("Action required:");

        if (!validation.hasSpf()) {
            System.err.println("- Fix SPF record for your domain");
        }
        if (!validation.hasDkim()) {
            System.err.println("- Configure DKIM signing in your email service");
        }
        if (!validation.hasDmarc()) {
            System.err.println("- Add/fix DMARC policy");
        }
    }

    // Fail test if authentication fails
    assertThat(validation.isFullyAuthenticated()).isTrue();
}
```

## Troubleshooting

### No Authentication Results

```java
AuthResults auth = email.getAuthResults();

if (auth == null) {
    System.out.println("No authentication results available");
    System.out.println("This may happen for:");
    System.out.println("- Emails sent from localhost/internal servers");
    System.out.println("- Test SMTP servers without authentication");
    return;
}

if (auth.getSpf() == null && auth.getDkim() == null && auth.getDmarc() == null) {
    System.out.println("No authentication performed");
}
```

### All Checks Fail

```java
AuthValidation validation = email.getAuthResults().validate();

if (!validation.isFullyAuthenticated()) {
    System.err.println("Authentication failed: " + validation.getFailed());

    // Common causes:
    // 1. No SPF record: Add "v=spf1 ip4:YOUR_IP -all" to DNS
    // 2. No DKIM: Configure your mail server to sign emails
    // 3. No DMARC: Add "v=DMARC1; p=none" to DNS
    // 4. Wrong IP: Update SPF record with correct server IP
}
```

### Understanding Failure Reasons

```java
AuthValidation validation = email.getAuthResults().validate();

for (String failure : validation.getFailed()) {
    if (failure.contains("SPF")) {
        System.out.println("Fix SPF: Update DNS TXT record for your domain");
    }
    if (failure.contains("DKIM")) {
        System.out.println("Fix DKIM: Enable DKIM signing in your email service");
    }
    if (failure.contains("DMARC")) {
        System.out.println("Fix DMARC: Add DMARC policy to DNS");
    }
    if (failure.contains("ReverseDNS")) {
        System.out.println("Fix rDNS: Configure PTR record for mail server IP");
    }
}
```

### Debug Helper Method

```java
void debugAuthResults(Email email) {
    AuthResults auth = email.getAuthResults();
    if (auth == null) {
        System.out.println("No authentication results");
        return;
    }

    SpfResult spf = auth.getSpf();
    System.out.println("SPF: " + (spf != null ? spf.getResult() : "N/A"));

    List<DkimResult> dkim = auth.getDkim();
    System.out.println("DKIM: " + (dkim != null && !dkim.isEmpty()
        ? dkim.get(0).getResult() : "N/A"));

    DmarcResult dmarc = auth.getDmarc();
    System.out.println("DMARC: " + (dmarc != null ? dmarc.getResult() : "N/A"));

    ReverseDnsResult rdns = auth.getReverseDns();
    System.out.println("rDNS: " + (rdns != null ? rdns.isVerified() : "N/A"));

    AuthValidation validation = auth.validate();
    System.out.println("Passed: " + validation.getPassed());
    System.out.println("Failed: " + validation.getFailed());
}
```

## Next Steps

- **[Email Authentication Guide](/client-java/guides/authentication/)** - Testing authentication in depth
- **[Email Objects](/client-java/concepts/emails/)** - Understanding email structure
- **[Testing Patterns](/client-java/testing/password-reset/)** - Real-world testing examples
- **[Gateway Security](/gateway/security/)** - Understanding the security model
