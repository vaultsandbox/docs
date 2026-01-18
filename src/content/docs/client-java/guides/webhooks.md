---
title: Webhooks
description: Set up webhooks to receive real-time notifications when emails arrive
---

Webhooks provide a way to receive HTTP callbacks when events occur in your inbox. Instead of polling or maintaining SSE connections, your application receives push notifications automatically.

## Creating a Webhook

Create a webhook for an inbox to receive notifications when emails arrive:

```java
Inbox inbox = client.createInbox();

WebhookData webhook = inbox.createWebhook(
    "https://your-app.com/webhook/emails",
    List.of(WebhookEventType.EMAIL_RECEIVED)
);

System.out.println("Webhook ID: " + webhook.getId());
System.out.println("Secret: " + webhook.getSecret()); // Save this for signature verification
```

### Using the Builder Pattern

For more options, use the `CreateWebhookRequest` builder:

```java
CreateWebhookRequest request = CreateWebhookRequest.builder()
    .url("https://your-app.com/webhook/emails")
    .events(WebhookEventType.EMAIL_RECEIVED)
    .description("Production email notifications")
    .build();

WebhookData webhook = inbox.createWebhook(request);
```

### Webhook Options

| Property      | Type                     | Required | Description                             |
| ------------- | ------------------------ | -------- | --------------------------------------- |
| `url`         | `String`                 | Yes      | The URL to send webhook requests to     |
| `events`      | `List<WebhookEventType>` | Yes      | Events that trigger the webhook         |
| `template`    | `String` or `Object`     | No       | Payload format template                 |
| `filter`      | `FilterConfig`           | No       | Filter which emails trigger the webhook |
| `description` | `String`                 | No       | Human-readable description (max 500)    |

### Event Types

| Event                              | Description                 |
| ---------------------------------- | --------------------------- |
| `WebhookEventType.EMAIL_RECEIVED`  | Email received by the inbox |
| `WebhookEventType.EMAIL_STORED`    | Email successfully stored   |
| `WebhookEventType.EMAIL_DELETED`   | Email deleted from inbox    |

## Managing Webhooks

### List Webhooks

```java
List<WebhookData> webhooks = inbox.listWebhooks();

System.out.println("Total webhooks: " + webhooks.size());
for (WebhookData webhook : webhooks) {
    System.out.printf("- %s: %s (%s)%n",
        webhook.getId(),
        webhook.getUrl(),
        webhook.isEnabled() ? "enabled" : "disabled");
}
```

### Get Webhook Details

```java
WebhookData webhook = inbox.getWebhook("whk_webhook_id");

System.out.println("URL: " + webhook.getUrl());
System.out.println("Events: " + webhook.getEvents());
System.out.println("Created: " + webhook.getCreatedAt());
System.out.println("Last delivery: " + webhook.getLastDeliveryAt());

WebhookStats stats = webhook.getStats();
if (stats != null) {
    System.out.printf("Deliveries: %d/%d (%.1f%% success)%n",
        stats.getSuccessfulDeliveries(),
        stats.getTotalDeliveries(),
        stats.getSuccessRate());
}
```

### Update Webhook

```java
UpdateWebhookRequest update = UpdateWebhookRequest.builder()
    .url("https://your-app.com/webhook/v2/emails")
    .enabled(true)
    .description("Updated webhook endpoint")
    .build();

WebhookData updated = inbox.updateWebhook("whk_webhook_id", update);
```

### Disable Webhook

```java
UpdateWebhookRequest update = UpdateWebhookRequest.builder()
    .enabled(false)
    .build();

inbox.updateWebhook("whk_webhook_id", update);
```

### Delete Webhook

```java
inbox.deleteWebhook("whk_webhook_id");
System.out.println("Webhook deleted");
```

## Filtering Webhooks

Use filters to control which emails trigger webhooks:

```java
FilterConfig filter = FilterConfig.builder()
    .addRule(FilterableField.FROM_ADDRESS, FilterOperator.DOMAIN, "example.com")
    .addRule(FilterableField.SUBJECT, FilterOperator.CONTAINS, "Invoice")
    .mode(FilterMode.ALL) // ALL = AND, ANY = OR
    .build();

CreateWebhookRequest request = CreateWebhookRequest.builder()
    .url("https://your-app.com/webhook/emails")
    .events(WebhookEventType.EMAIL_RECEIVED)
    .filter(filter)
    .build();

WebhookData webhook = inbox.createWebhook(request);
```

### Filterable Fields

| Field                        | Description                    |
| ---------------------------- | ------------------------------ |
| `FilterableField.SUBJECT`    | Email subject line             |
| `FilterableField.FROM_ADDRESS` | Sender email address         |
| `FilterableField.FROM_NAME`  | Sender display name            |
| `FilterableField.TO_ADDRESS` | First recipient email address  |
| `FilterableField.TO_NAME`    | First recipient display name   |
| `FilterableField.BODY_TEXT`  | Plain text body (first 5KB)    |
| `FilterableField.BODY_HTML`  | HTML body (first 5KB)          |

### Filter Operators

| Operator                    | Description                    | Example Value       |
| --------------------------- | ------------------------------ | ------------------- |
| `FilterOperator.EQUALS`     | Exact match                    | `noreply@example.com` |
| `FilterOperator.CONTAINS`   | Contains substring             | `Reset`             |
| `FilterOperator.STARTS_WITH` | Starts with string            | `RE:`               |
| `FilterOperator.ENDS_WITH`  | Ends with string               | `@company.com`      |
| `FilterOperator.DOMAIN`     | Email domain match             | `example.com`       |
| `FilterOperator.REGEX`      | Regular expression match       | `Order #\\d+`       |
| `FilterOperator.EXISTS`     | Field exists and is non-empty  | `true`              |

### Case Sensitivity

By default, matching is case-insensitive. To enable case-sensitive matching:

```java
FilterRule rule = new FilterRule(
    FilterableField.SUBJECT,
    FilterOperator.CONTAINS,
    "URGENT",
    true  // caseSensitive
);

FilterConfig filter = FilterConfig.builder()
    .addRule(rule)
    .mode(FilterMode.ALL)
    .build();
```

### Require Authentication

Only trigger webhooks for authenticated emails:

```java
FilterConfig filter = FilterConfig.builder()
    .mode(FilterMode.ALL)
    .requireAuth(true) // Only emails passing SPF/DKIM/DMARC
    .build();

CreateWebhookRequest request = CreateWebhookRequest.builder()
    .url("https://your-app.com/webhook/verified-emails")
    .events(WebhookEventType.EMAIL_RECEIVED)
    .filter(filter)
    .build();
```

## Templates

Templates control the webhook payload format.

### Built-in Templates

```java
// Slack-formatted payload
CreateWebhookRequest slackRequest = CreateWebhookRequest.builder()
    .url("https://hooks.slack.com/services/...")
    .events(WebhookEventType.EMAIL_RECEIVED)
    .template("slack")
    .build();

WebhookData slackWebhook = inbox.createWebhook(slackRequest);

// Discord-formatted payload
CreateWebhookRequest discordRequest = CreateWebhookRequest.builder()
    .url("https://discord.com/api/webhooks/...")
    .events(WebhookEventType.EMAIL_RECEIVED)
    .template("discord")
    .build();

WebhookData discordWebhook = inbox.createWebhook(discordRequest);

// Microsoft Teams
CreateWebhookRequest teamsRequest = CreateWebhookRequest.builder()
    .url("https://outlook.office.com/webhook/...")
    .events(WebhookEventType.EMAIL_RECEIVED)
    .template("teams")
    .build();

WebhookData teamsWebhook = inbox.createWebhook(teamsRequest);
```

Available templates: `slack`, `discord`, `teams`, `simple`, `notification`, `zapier`, `default`

### Custom Templates

```java
String templateBody = """
    {
        "email_id": "{{id}}",
        "sender": "{{data.from.address}}",
        "subject_line": "{{data.subject}}",
        "received_timestamp": "{{timestamp}}"
    }
    """;

CustomTemplate customTemplate = new CustomTemplate(templateBody, "application/json");

CreateWebhookRequest request = CreateWebhookRequest.builder()
    .url("https://your-app.com/webhook/emails")
    .events(WebhookEventType.EMAIL_RECEIVED)
    .template(customTemplate)
    .build();

WebhookData webhook = inbox.createWebhook(request);
```

### Template Variables

| Variable              | Description           |
| --------------------- | --------------------- |
| `{{id}}`              | Event ID              |
| `{{type}}`            | Event type            |
| `{{createdAt}}`       | Unix timestamp        |
| `{{timestamp}}`       | ISO 8601 timestamp    |
| `{{data.from.address}}` | Sender email        |
| `{{data.from.name}}`  | Sender name           |
| `{{data.subject}}`    | Email subject         |
| `{{data.snippet}}`    | Email preview         |
| `{{data.inboxEmail}}` | Inbox address         |

## Testing Webhooks

### Send Test Request

```java
TestWebhookResponse result = inbox.testWebhook("whk_webhook_id");

if (result.isSuccess()) {
    System.out.println("Test successful!");
    System.out.println("Status: " + result.getStatusCode());
    System.out.println("Response time: " + result.getResponseTime() + "ms");
} else {
    System.err.println("Test failed: " + result.getError());
}
```

### Test Response Properties

| Property       | Type      | Description                              |
| -------------- | --------- | ---------------------------------------- |
| `success`      | `boolean` | Whether the test succeeded               |
| `statusCode`   | `Integer` | HTTP status code from endpoint           |
| `responseTime` | `Long`    | Response time in milliseconds            |
| `responseBody` | `String`  | Response body (truncated to 1KB)         |
| `error`        | `String`  | Error message if test failed             |
| `payloadSent`  | `Object`  | Test payload that was sent               |

## Rotating Secrets

Rotate webhook secrets periodically for security:

```java
RotateSecretResponse result = inbox.rotateWebhookSecret("whk_webhook_id");

System.out.println("New secret: " + result.getSecret());
System.out.println("Old secret valid until: " + result.getPreviousSecretValidUntil());

// Update your application with the new secret
// The old secret remains valid during the 1-hour grace period
```

## Verifying Webhook Signatures

Always verify webhook signatures in your endpoint. Webhooks include the following headers:

| Header              | Description                |
| ------------------- | -------------------------- |
| `X-Vault-Signature` | HMAC-SHA256 signature      |
| `X-Vault-Timestamp` | Unix timestamp             |
| `X-Vault-Event`     | Event type                 |
| `X-Vault-Delivery`  | Unique delivery ID         |

The signature is computed over `${timestamp}.${raw_request_body}`:

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;

public class WebhookVerifier {

    public static boolean verifySignature(
            String rawBody,
            String signature,
            String timestamp,
            String secret) {

        try {
            String signedPayload = timestamp + "." + rawBody;

            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8),
                "HmacSHA256"
            );
            hmac.init(keySpec);

            byte[] hash = hmac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8));
            String expectedSignature = "sha256=" + bytesToHex(hash);

            return MessageDigest.isEqual(
                signature.getBytes(StandardCharsets.UTF_8),
                expectedSignature.getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            return false;
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
```

### Spring Boot Example

```java
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

@RestController
public class WebhookController {

    private static final String WEBHOOK_SECRET = System.getenv("WEBHOOK_SECRET");

    @PostMapping("/webhook/emails")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String rawBody,
            @RequestHeader("X-Vault-Signature") String signature,
            @RequestHeader("X-Vault-Timestamp") String timestamp) {

        if (!WebhookVerifier.verifySignature(rawBody, signature, timestamp, WEBHOOK_SECRET)) {
            return ResponseEntity.status(401).body("Invalid signature");
        }

        // Process the webhook
        System.out.println("Email received: " + rawBody);
        return ResponseEntity.ok("OK");
    }
}
```

## Error Handling

```java
import com.vaultsandbox.client.exception.WebhookNotFoundException;
import com.vaultsandbox.client.exception.InboxNotFoundException;
import com.vaultsandbox.client.exception.ApiException;

try {
    WebhookData webhook = inbox.getWebhook("whk_webhook_id");
} catch (WebhookNotFoundException e) {
    System.err.println("Webhook not found");
} catch (InboxNotFoundException e) {
    System.err.println("Inbox not found");
} catch (ApiException e) {
    System.err.printf("API error (%d): %s%n", e.getStatusCode(), e.getMessage());
}
```

## Complete Example

```java
import com.vaultsandbox.client.*;
import com.vaultsandbox.client.model.*;

import java.util.List;

public class WebhookExample {
    public static void main(String[] args) {
        ClientConfig config = ClientConfig.builder()
            .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
            .baseUrl(System.getenv("VAULTSANDBOX_URL"))
            .build();

        try (VaultSandboxClient client = VaultSandboxClient.create(config)) {
            // Create inbox
            Inbox inbox = client.createInbox();
            System.out.println("Inbox: " + inbox.getEmailAddress());

            // Create webhook with filter
            FilterConfig filter = FilterConfig.builder()
                .addRule(FilterableField.FROM_ADDRESS, FilterOperator.DOMAIN, "example.com")
                .mode(FilterMode.ALL)
                .build();

            CreateWebhookRequest request = CreateWebhookRequest.builder()
                .url("https://your-app.com/webhook/emails")
                .events(WebhookEventType.EMAIL_RECEIVED, WebhookEventType.EMAIL_STORED)
                .description("Production email webhook")
                .filter(filter)
                .build();

            WebhookData webhook = inbox.createWebhook(request);
            System.out.println("Webhook created: " + webhook.getId());
            System.out.println("Secret: " + webhook.getSecret());

            // Test the webhook
            TestWebhookResponse testResult = inbox.testWebhook(webhook.getId());
            if (testResult.isSuccess()) {
                System.out.println("Webhook test successful!");
            } else {
                System.err.println("Webhook test failed: " + testResult.getError());
            }

            // List all webhooks
            List<WebhookData> webhooks = inbox.listWebhooks();
            System.out.println("Total webhooks: " + webhooks.size());

            // Update webhook
            UpdateWebhookRequest update = UpdateWebhookRequest.builder()
                .description("Updated description")
                .build();
            inbox.updateWebhook(webhook.getId(), update);

            // Rotate secret periodically
            // RotateSecretResponse newSecret = inbox.rotateWebhookSecret(webhook.getId());

            // Cleanup
            // inbox.deleteWebhook(webhook.getId());
            // inbox.delete();
        }
    }
}
```

## Webhook vs SSE vs Polling

| Feature           | Webhooks                  | SSE                       | Polling                   |
| ----------------- | ------------------------- | ------------------------- | ------------------------- |
| Delivery          | Push to your server       | Push to client            | Pull from client          |
| Connection        | None required             | Persistent                | Repeated requests         |
| Latency           | Near real-time            | Real-time                 | Depends on interval       |
| Server required   | Yes (webhook endpoint)    | No                        | No                        |
| Firewall friendly | Yes                       | Usually                   | Yes                       |
| Best for          | Server-to-server          | Browser/client apps       | Simple integrations       |

## Next Steps

- [Real-time Monitoring](/client-java/guides/real-time/) - SSE-based monitoring
- [Inbox API Reference](/client-java/api/inbox/) - Complete inbox methods
- [Error Handling](/client-java/api/errors/) - Handle webhook errors
