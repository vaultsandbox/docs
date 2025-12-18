---
title: Password Reset Testing
description: Complete guide for testing password reset email flows in Java
---

This guide covers testing password reset email flows, including triggering reset requests, receiving emails, extracting reset links, and validating complete workflows.

## Overview

Password reset is a critical user flow that must work reliably. Testing it requires:
- Triggering reset requests
- Receiving reset emails
- Extracting reset links and tokens
- Validating token handling and expiration

## Basic Password Reset Test

```java
@Test
void shouldReceivePasswordResetEmail() {
    Inbox inbox = client.createInbox();

    try {
        // Request password reset
        userService.requestPasswordReset(inbox.getEmailAddress());

        // Wait for email
        Email email = inbox.waitForEmail(
            EmailFilter.subjectContains("Password Reset"),
            Duration.ofSeconds(30)
        );

        // Verify email received
        assertThat(email).isNotNull();
        assertThat(email.getSubject()).containsIgnoringCase("password");
    } finally {
        client.deleteInbox(inbox.getEmailAddress());
    }
}
```

## JUnit 5 Integration

A complete test class with proper lifecycle management:

```java
import com.vaultsandbox.client.ClientConfig;
import com.vaultsandbox.client.Email;
import com.vaultsandbox.client.EmailFilter;
import com.vaultsandbox.client.Inbox;
import com.vaultsandbox.client.VaultSandboxClient;
import org.junit.jupiter.api.*;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordResetTest {

    private static VaultSandboxClient client;
    private Inbox inbox;

    @BeforeAll
    static void setUpClass() {
        client = VaultSandboxClient.create(
            ClientConfig.builder()
                .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
                .waitTimeout(Duration.ofSeconds(30))
                .build()
        );
    }

    @AfterAll
    static void tearDownClass() {
        if (client != null) {
            client.close();
        }
    }

    @BeforeEach
    void setUp() {
        inbox = client.createInbox();
    }

    @AfterEach
    void tearDown() {
        if (inbox != null) {
            client.deleteInbox(inbox.getEmailAddress());
        }
    }

    @Test
    void shouldReceivePasswordResetEmail() {
        userService.requestPasswordReset(inbox.getEmailAddress());

        Email email = inbox.waitForEmail(
            EmailFilter.subjectContains("Reset")
        );

        assertThat(email.getText()).contains("reset your password");
    }
}
```

## Link Extraction Patterns

### Simple Extraction

Extract reset links from the email:

```java
@Test
void shouldContainValidResetLink() {
    userService.requestPasswordReset(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(
        EmailFilter.subjectContains("Reset")
    );

    // Get links
    List<String> links = email.getLinks();
    assertThat(links).isNotEmpty();

    // Find reset link
    String resetLink = links.stream()
        .filter(l -> l.contains("/reset") || l.contains("/password"))
        .findFirst()
        .orElseThrow(() -> new AssertionError("No reset link found"));

    assertThat(resetLink).startsWith("https://");
}
```

### Regex Extraction

Extract tokens using regular expressions:

```java
@Test
void shouldExtractResetToken() {
    userService.requestPasswordReset(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(
        EmailFilter.subjectContains("Reset")
    );

    // Extract token from link
    Pattern pattern = Pattern.compile("/reset\\?token=([a-zA-Z0-9]+)");
    String content = email.getText() != null ? email.getText() : email.getHtml();

    Matcher matcher = pattern.matcher(content);
    assertThat(matcher.find()).isTrue();

    String token = matcher.group(1);
    assertThat(token).hasSizeGreaterThan(20);
}
```

## Email Content Validation

Validate the structure and content of reset emails:

```java
@Test
void shouldHaveProperContent() {
    userService.requestPasswordReset(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(
        EmailFilter.subjectContains("Reset")
    );

    // Validate structure
    assertAll(
        () -> assertThat(email.getFrom()).contains("noreply@"),
        () -> assertThat(email.getSubject()).containsIgnoringCase("password"),
        () -> assertThat(email.getText()).isNotNull(),
        () -> assertThat(email.getLinks()).isNotEmpty()
    );

    // Validate content
    String text = email.getText();
    assertAll(
        () -> assertThat(text).contains("reset"),
        () -> assertThat(text).contains("password"),
        () -> assertThat(text).containsIgnoringCase(inbox.getEmailAddress())
    );
}
```

## Security Testing

### Authentication Checks

Verify email authentication (SPF, DKIM) passes for transactional emails:

```java
@Test
void shouldHaveValidAuthentication() {
    userService.requestPasswordReset(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(
        EmailFilter.subjectContains("Reset")
    );

    AuthResults auth = email.getAuthResults();
    assertThat(auth).isNotNull();

    // Verify authentication passes
    ValidationResult result = auth.validate();
    assertThat(result.getFailed())
        .as("Authentication should pass for transactional emails")
        .isEmpty();

    // Check specific mechanisms
    assertThat(auth.getSpf().getResult()).isEqualToIgnoringCase("pass");
    assertThat(auth.getDkim()).isNotEmpty();
    assertThat(auth.getDkim().get(0).getResult()).isEqualToIgnoringCase("pass");
}
```

### Testing Token Expiration

```java
@Test
void shouldHandleExpiredToken() throws InterruptedException {
    userService.requestPasswordReset(inbox.getEmailAddress());

    Email email = inbox.waitForEmail(
        EmailFilter.subjectContains("Reset")
    );

    String resetLink = extractResetLink(email);

    // Wait for token to expire (or use short-lived test tokens)
    Thread.sleep(Duration.ofMinutes(5).toMillis());

    // Attempt reset with expired token
    assertThatThrownBy(() -> userService.resetPassword(resetLink, "newPass"))
        .isInstanceOf(TokenExpiredException.class);
}
```

### Testing Multiple Reset Requests

Verify that new tokens invalidate previous ones:

```java
@Test
void shouldInvalidatePreviousTokens() {
    // First request
    userService.requestPasswordReset(inbox.getEmailAddress());
    Email firstEmail = inbox.waitForEmail(
        EmailFilter.subjectContains("Reset")
    );
    String firstLink = extractResetLink(firstEmail);

    // Second request
    userService.requestPasswordReset(inbox.getEmailAddress());
    Email secondEmail = inbox.waitForEmail(
        EmailFilter.subjectContains("Reset"),
        Duration.ofSeconds(30)
    );
    String secondLink = extractResetLink(secondEmail);

    // First token should be invalid
    assertThat(firstLink).isNotEqualTo(secondLink);

    // Using first token should fail
    assertThatThrownBy(() -> userService.resetPassword(firstLink, "newPass"))
        .isInstanceOf(InvalidTokenException.class);

    // Second token should work
    userService.resetPassword(secondLink, "newPassword123");
}
```

## Complete Flow Test

Test the entire password reset workflow end-to-end:

```java
@Test
void shouldCompletePasswordResetFlow() {
    String email = inbox.getEmailAddress();
    String originalPassword = "oldPassword123";
    String newPassword = "newPassword456";

    // Setup: Create user
    userService.createUser(email, originalPassword);

    // Step 1: Request reset
    userService.requestPasswordReset(email);

    // Step 2: Get email
    Email resetEmail = inbox.waitForEmail(
        EmailFilter.subjectContains("Reset"),
        Duration.ofSeconds(30)
    );

    // Step 3: Extract link
    String resetLink = extractResetLink(resetEmail);
    assertThat(resetLink).isNotNull();

    // Step 4: Reset password
    userService.resetPassword(resetLink, newPassword);

    // Step 5: Verify old password no longer works
    assertThatThrownBy(() -> userService.login(email, originalPassword))
        .isInstanceOf(AuthenticationException.class);

    // Step 6: Verify new password works
    User user = userService.login(email, newPassword);
    assertThat(user).isNotNull();
}
```

## Spring Boot Integration Test

A real-world example with Spring Boot:

```java
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class PasswordResetIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private UserRepository userRepository;

    private VaultSandboxClient vaultClient;
    private Inbox inbox;

    @BeforeEach
    void setUp() {
        vaultClient = VaultSandboxClient.create(
            System.getenv("VAULTSANDBOX_API_KEY")
        );
        inbox = vaultClient.createInbox();
    }

    @AfterEach
    void tearDown() {
        vaultClient.deleteInbox(inbox.getEmailAddress());
        vaultClient.close();
    }

    @Test
    void shouldResetPasswordViaApi() {
        // Create test user
        User user = new User(inbox.getEmailAddress(), "password123");
        userRepository.save(user);

        // Request reset via API
        restTemplate.postForEntity(
            "/api/password-reset",
            Map.of("email", inbox.getEmailAddress()),
            Void.class
        );

        // Wait for email
        Email email = inbox.waitForEmail(
            EmailFilter.subjectContains("Reset"),
            Duration.ofSeconds(30)
        );

        // Extract and use reset link
        String token = extractToken(email);

        ResponseEntity<Void> response = restTemplate.postForEntity(
            "/api/password-reset/confirm",
            Map.of("token", token, "newPassword", "newPass456"),
            Void.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        // Verify new password works
        ResponseEntity<String> loginResponse = restTemplate.postForEntity(
            "/api/login",
            Map.of("email", inbox.getEmailAddress(), "password", "newPass456"),
            String.class
        );

        assertThat(loginResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
```

## Helper Methods

Reusable utility methods for password reset testing:

```java
private String extractResetLink(Email email) {
    return email.getLinks().stream()
        .filter(l -> l.contains("/reset") || l.contains("token="))
        .findFirst()
        .orElseThrow(() -> new AssertionError("No reset link found"));
}

private String extractToken(Email email) {
    String link = extractResetLink(email);
    Pattern pattern = Pattern.compile("[?&]token=([^&]+)");
    Matcher matcher = pattern.matcher(link);
    if (matcher.find()) {
        return matcher.group(1);
    }
    throw new AssertionError("No token in link: " + link);
}
```

## Best Practices

### Use Specific Filters

Avoid matching unrelated emails by using specific filters:

```java
// Good - specific filter
EmailFilter.subjectContains("Password Reset")
    .and(EmailFilter.from("noreply@example.com"))

// Bad - too broad
EmailFilter.any()
```

### Clean Up After Tests

Always clean up resources even if tests fail:

```java
@AfterEach
void tearDown() {
    try {
        client.deleteInbox(inbox.getEmailAddress());
    } catch (Exception e) {
        // Log but don't fail test
    }
}
```

### Use Appropriate Timeouts

CI environments may be slower than local development:

```java
// Generous timeout for CI
Email email = inbox.waitForEmail(
    filter,
    Duration.ofSeconds(60)
);
```

### Test Complete Flow

Don't just test email receipt—test the entire workflow:

1. Request reset
2. Receive email
3. Extract link/token
4. Use link to reset password
5. Verify password changed
6. Verify old password rejected

## Checklist

| Test Case | Description |
|-----------|-------------|
| Email received | Reset email arrives after request |
| Valid sender | From address matches expected |
| Valid subject | Subject contains "reset" or "password" |
| Contains link | Email has a clickable reset link |
| Valid token | Token can be extracted from link |
| Token works | Password can be reset with token |
| Token expires | Expired tokens are rejected |
| Token single-use | Used tokens are rejected |
| New token invalidates old | Multiple requests invalidate previous tokens |
| Old password rejected | Original password fails after reset |
| New password works | New password authenticates successfully |
| Authentication passes | SPF/DKIM verify correctly |

## Related Pages

- [Multi-Email Scenarios](/client-java/testing/multi-email/) - Testing multiple emails
- [CI/CD Integration](/client-java/testing/cicd/) - Pipeline setup
- [Authentication Results](/client-java/concepts/auth-results/) - Email authentication
- [Waiting for Emails](/client-java/guides/waiting-for-emails/) - Email waiting patterns
