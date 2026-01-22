---
title: Chaos Engineering
description: Test email resilience by simulating SMTP failures and network issues
---

Chaos engineering allows you to simulate various SMTP failure scenarios and network issues during email testing. This helps verify your application handles email delivery failures gracefully.

## Prerequisites

Chaos features must be enabled on the gateway server. Check availability:

```go
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	vaultsandbox "github.com/vaultsandbox/client-go"
)

func main() {
	client, err := vaultsandbox.New(os.Getenv("VAULTSANDBOX_API_KEY"))
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	info := client.ServerInfo()

	if info.ChaosEnabled {
		fmt.Println("Chaos features available")
	} else {
		fmt.Println("Chaos features disabled on this server")
	}
}
```

## Enabling Chaos

### Setting Chaos Configuration

```go
config, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	Latency: &vaultsandbox.LatencyConfig{
		Enabled:    true,
		MinDelayMs: 1000,
		MaxDelayMs: 5000,
	},
})
if err != nil {
	log.Fatal(err)
}
```

### Getting Current Configuration

```go
config, err := inbox.GetChaosConfig(ctx)
if err != nil {
	log.Fatal(err)
}

fmt.Printf("Chaos enabled: %v\n", config.Enabled)
if config.Latency != nil {
	fmt.Printf("Latency enabled: %v\n", config.Latency.Enabled)
}
```

### Disabling Chaos

```go
if err := inbox.DisableChaos(ctx); err != nil {
	log.Fatal(err)
}
```

## Chaos Configuration

```go
import vaultsandbox "github.com/vaultsandbox/client-go"

// Available chaos configuration types
_ = &vaultsandbox.ChaosConfig{}
_ = &vaultsandbox.LatencyConfig{}
_ = &vaultsandbox.ConnectionDropConfig{}
_ = &vaultsandbox.RandomErrorConfig{}
_ = &vaultsandbox.GreylistConfig{}
_ = &vaultsandbox.BlackholeConfig{}
```

| Property         | Type                    | Required | Description                          |
| ---------------- | ----------------------- | -------- | ------------------------------------ |
| `Enabled`        | `bool`                  | Yes      | Master switch for all chaos features |
| `ExpiresAt`      | `*time.Time`            | No       | Auto-disable chaos after this time   |
| `Latency`        | `*LatencyConfig`        | No       | Inject artificial delays             |
| `ConnectionDrop` | `*ConnectionDropConfig` | No       | Simulate connection failures         |
| `RandomError`    | `*RandomErrorConfig`    | No       | Return random SMTP error codes       |
| `Greylist`       | `*GreylistConfig`       | No       | Simulate greylisting behavior        |
| `Blackhole`      | `*BlackholeConfig`      | No       | Accept but silently discard emails   |

## Latency Injection

Inject artificial delays into email processing to test timeout handling and slow connections.

```go
config, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	Latency: &vaultsandbox.LatencyConfig{
		Enabled:     true,
		MinDelayMs:  500,       // Minimum delay (default: 500)
		MaxDelayMs:  5000,      // Maximum delay (default: 10000, max: 60000)
		Jitter:      true,      // Randomize within range (default: true)
		Probability: 0.5,       // 50% of emails affected (default: 1.0)
	},
})
```

### Configuration Options

| Property      | Type      | Default | Description                                            |
| ------------- | --------- | ------- | ------------------------------------------------------ |
| `Enabled`     | `bool`    | —       | Enable/disable latency injection                       |
| `MinDelayMs`  | `int`     | `500`   | Minimum delay in milliseconds                          |
| `MaxDelayMs`  | `int`     | `10000` | Maximum delay in milliseconds (max: 60000)             |
| `Jitter`      | `bool`    | `true`  | Randomize delay within range. If false, uses max delay |
| `Probability` | `float64` | `1.0`   | Probability of applying delay (0.0-1.0)                |

### Use Cases

- Test application timeout handling
- Verify UI responsiveness during slow email delivery
- Test retry logic with variable delays

## Connection Drop

Simulate connection failures by dropping SMTP connections.

```go
config, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	ConnectionDrop: &vaultsandbox.ConnectionDropConfig{
		Enabled:     true,
		Probability: 0.3,    // 30% of connections dropped
		Graceful:    false,  // Abrupt RST instead of graceful FIN
	},
})
```

### Configuration Options

| Property      | Type      | Default | Description                                  |
| ------------- | --------- | ------- | -------------------------------------------- |
| `Enabled`     | `bool`    | —       | Enable/disable connection dropping           |
| `Probability` | `float64` | `1.0`   | Probability of dropping connection (0.0-1.0) |
| `Graceful`    | `bool`    | `true`  | Use graceful close (FIN) vs abrupt (RST)     |

### Use Cases

- Test connection reset handling
- Verify TCP error recovery
- Test application behavior when SMTP connections fail mid-delivery

## Random Errors

Return random SMTP error codes to test error handling.

```go
config, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	RandomError: &vaultsandbox.RandomErrorConfig{
		Enabled:    true,
		ErrorRate:  0.1,  // 10% of emails return errors
		ErrorTypes: []vaultsandbox.RandomErrorType{
			vaultsandbox.RandomErrorTypeTemporary,  // Only 4xx errors
		},
	},
})
```

### Configuration Options

| Property     | Type                | Default                        | Description                       |
| ------------ | ------------------- | ------------------------------ | --------------------------------- |
| `Enabled`    | `bool`              | —                              | Enable/disable random errors      |
| `ErrorRate`  | `float64`           | `0.1`                          | Probability of returning an error |
| `ErrorTypes` | `[]RandomErrorType` | `[RandomErrorTypeTemporary]`   | Types of errors to return         |

### Error Types

| Type                         | SMTP Codes | Description                          |
| ---------------------------- | ---------- | ------------------------------------ |
| `RandomErrorTypeTemporary`   | 4xx        | Temporary failures, should retry     |
| `RandomErrorTypePermanent`   | 5xx        | Permanent failures, should not retry |

### Use Cases

- Test 4xx SMTP error handling and retry logic
- Test 5xx SMTP error handling and failure notifications
- Verify application handles both error types correctly

## Greylisting Simulation

Simulate greylisting behavior where the first delivery attempt is rejected and subsequent retries are accepted.

```go
config, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	Greylist: &vaultsandbox.GreylistConfig{
		Enabled:       true,
		RetryWindowMs: 300000,  // 5 minute window
		MaxAttempts:   2,       // Accept on second attempt
		TrackBy:       vaultsandbox.GreylistTrackByIPSender,  // Track by IP and sender
	},
})
```

### Configuration Options

| Property        | Type              | Default                   | Description                              |
| --------------- | ----------------- | ------------------------- | ---------------------------------------- |
| `Enabled`       | `bool`            | —                         | Enable/disable greylisting               |
| `RetryWindowMs` | `int`             | `300000`                  | Window for tracking retries (5 min)      |
| `MaxAttempts`   | `int`             | `2`                       | Attempts before accepting                |
| `TrackBy`       | `GreylistTrackBy` | `GreylistTrackByIPSender` | How to identify unique delivery attempts |

### Tracking Methods

| Method                     | Description                           |
| -------------------------- | ------------------------------------- |
| `GreylistTrackByIP`        | Track by sender IP only               |
| `GreylistTrackBySender`    | Track by sender email only            |
| `GreylistTrackByIPSender`  | Track by combination of IP and sender |

### Use Cases

- Test SMTP retry behavior when mail servers use greylisting
- Verify retry intervals and backoff logic
- Test handling of temporary 4xx rejections

## Blackhole Mode

Accept emails but silently discard them without storing.

```go
config, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	Blackhole: &vaultsandbox.BlackholeConfig{
		Enabled:         true,
		TriggerWebhooks: false,  // Don't trigger webhooks for discarded emails
	},
})
```

### Configuration Options

| Property          | Type   | Default | Description                           |
| ----------------- | ------ | ------- | ------------------------------------- |
| `Enabled`         | `bool` | —       | Enable/disable blackhole mode         |
| `TriggerWebhooks` | `bool` | `false` | Trigger webhooks for discarded emails |

### Use Cases

- Test behavior when emails are silently lost
- Test webhook integration even when emails aren't stored
- Simulate email delivery that succeeds at SMTP level but fails at storage

## Auto-Expiring Chaos

Set chaos to automatically disable after a specific time:

```go
import "time"

// Enable chaos for 1 hour
expiresAt := time.Now().Add(time.Hour)

config, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled:   true,
	ExpiresAt: &expiresAt,
	Latency: &vaultsandbox.LatencyConfig{
		Enabled:    true,
		MaxDelayMs: 3000,
	},
})
```

After `ExpiresAt`, chaos is automatically disabled and normal email delivery resumes.

## Combining Chaos Scenarios

Multiple chaos features can be enabled simultaneously:

```go
config, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	// 30% of emails delayed 1-5 seconds
	Latency: &vaultsandbox.LatencyConfig{
		Enabled:     true,
		MinDelayMs:  1000,
		MaxDelayMs:  5000,
		Probability: 0.3,
	},
	// 10% of emails return temporary errors
	RandomError: &vaultsandbox.RandomErrorConfig{
		Enabled:   true,
		ErrorRate: 0.1,
		ErrorTypes: []vaultsandbox.RandomErrorType{
			vaultsandbox.RandomErrorTypeTemporary,
		},
	},
})
```

## Complete Example

```go
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	vaultsandbox "github.com/vaultsandbox/client-go"
)

func main() {
	ctx := context.Background()

	client, err := vaultsandbox.New(os.Getenv("VAULTSANDBOX_API_KEY"))
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// Check if chaos is available
	info := client.ServerInfo()
	if !info.ChaosEnabled {
		log.Fatal("Chaos features not available on this server")
	}

	// Create inbox
	inbox, err := client.CreateInbox(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer inbox.Delete(ctx)

	// Enable chaos on the inbox
	config, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
		Enabled: true,
		Latency: &vaultsandbox.LatencyConfig{
			Enabled:     true,
			MinDelayMs:  2000,
			MaxDelayMs:  5000,
			Probability: 0.5,
		},
		RandomError: &vaultsandbox.RandomErrorConfig{
			Enabled:   true,
			ErrorRate: 0.1,
			ErrorTypes: []vaultsandbox.RandomErrorType{
				vaultsandbox.RandomErrorTypeTemporary,
			},
		},
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Testing with chaos: %s\n", inbox.EmailAddress())
	fmt.Printf("Chaos enabled: %v\n", config.Enabled)
	if config.Latency != nil {
		fmt.Printf("Latency enabled: %v\n", config.Latency.Enabled)
	}

	// Send test emails and verify handling
	// Your test logic here...

	// Update chaos configuration
	config, err = inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
		Enabled: true,
		Greylist: &vaultsandbox.GreylistConfig{
			Enabled:     true,
			MaxAttempts: 3,
		},
	})
	if err != nil {
		log.Fatal(err)
	}

	// More testing...

	// Disable chaos for normal operation tests
	if err := inbox.DisableChaos(ctx); err != nil {
		log.Fatal(err)
	}
}
```

## Testing Patterns

### Test Retry Logic

```go
import "time"

// Enable greylisting to test retry behavior
_, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	Greylist: &vaultsandbox.GreylistConfig{
		Enabled:     true,
		MaxAttempts: 2,
	},
})
if err != nil {
	log.Fatal(err)
}

// Send email - first attempt will fail, retry should succeed
sendEmail(inbox.EmailAddress())

// If your mail sender retries correctly, email should arrive
email, err := inbox.WaitForEmail(ctx, vaultsandbox.WithWaitTimeout(time.Minute))
if err != nil {
	log.Fatal(err)
}
fmt.Printf("Email received: %s\n", email.Subject)
```

### Test Timeout Handling

```go
import (
	"errors"
	"time"
)

// Enable high latency
_, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	Latency: &vaultsandbox.LatencyConfig{
		Enabled:    true,
		MinDelayMs: 10000,
		MaxDelayMs: 15000,
	},
})
if err != nil {
	log.Fatal(err)
}

// Test that your application handles timeouts correctly
email, err := inbox.WaitForEmail(ctx, vaultsandbox.WithWaitTimeout(5*time.Second))
if errors.Is(err, context.DeadlineExceeded) {
	fmt.Println("Timeout handled correctly")
} else if err != nil {
	log.Fatal(err)
}
```

### Test Error Recovery

```go
// Enable high error rate
_, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	RandomError: &vaultsandbox.RandomErrorConfig{
		Enabled:   true,
		ErrorRate: 0.8,
		ErrorTypes: []vaultsandbox.RandomErrorType{
			vaultsandbox.RandomErrorTypeTemporary,
			vaultsandbox.RandomErrorTypePermanent,
		},
	},
})
if err != nil {
	log.Fatal(err)
}

// Test that your application handles errors and retries appropriately
```

## Error Handling

```go
import "errors"

_, err := inbox.SetChaosConfig(ctx, &vaultsandbox.ChaosConfig{
	Enabled: true,
	Latency: &vaultsandbox.LatencyConfig{Enabled: true},
})

if errors.Is(err, vaultsandbox.ErrInboxNotFound) {
	fmt.Println("Inbox not found")
} else if err != nil {
	var apiErr *vaultsandbox.APIError
	if errors.As(err, &apiErr) {
		if apiErr.StatusCode == 403 {
			fmt.Println("Chaos features are disabled on this server")
		} else {
			fmt.Printf("API error (%d): %s\n", apiErr.StatusCode, apiErr.Message)
		}
	} else {
		log.Fatal(err)
	}
}
```

## Testing Framework Integration

### Chaos Test Helper

```go
package myapp_test

import (
	"context"
	"os"
	"testing"

	vaultsandbox "github.com/vaultsandbox/client-go"
)

var (
	client *vaultsandbox.Client
)

func TestMain(m *testing.M) {
	var err error
	client, err = vaultsandbox.New(os.Getenv("VAULTSANDBOX_API_KEY"))
	if err != nil {
		panic(err)
	}
	defer client.Close()

	os.Exit(m.Run())
}

func setupChaosInbox(t *testing.T, config *vaultsandbox.ChaosConfig) *vaultsandbox.Inbox {
	t.Helper()

	info := client.ServerInfo()
	if !info.ChaosEnabled {
		t.Skip("Chaos features not available on this server")
	}

	ctx := context.Background()
	inbox, err := client.CreateInbox(ctx)
	if err != nil {
		t.Fatal(err)
	}

	_, err = inbox.SetChaosConfig(ctx, config)
	if err != nil {
		inbox.Delete(ctx)
		t.Fatal(err)
	}

	t.Cleanup(func() {
		inbox.Delete(ctx)
	})

	return inbox
}

func TestHandlesSlowDelivery(t *testing.T) {
	inbox := setupChaosInbox(t, &vaultsandbox.ChaosConfig{
		Enabled: true,
		Latency: &vaultsandbox.LatencyConfig{
			Enabled:    true,
			MinDelayMs: 500,
			MaxDelayMs: 2000,
		},
	})

	// Your test code here
	_ = inbox
}
```

### Table-Driven Chaos Tests

```go
package myapp_test

import (
	"context"
	"testing"

	vaultsandbox "github.com/vaultsandbox/client-go"
)

func TestChaosScenarios(t *testing.T) {
	info := client.ServerInfo()
	if !info.ChaosEnabled {
		t.Skip("Chaos features not available on this server")
	}

	tests := []struct {
		name   string
		config *vaultsandbox.ChaosConfig
	}{
		{
			name: "latency",
			config: &vaultsandbox.ChaosConfig{
				Enabled: true,
				Latency: &vaultsandbox.LatencyConfig{
					Enabled:    true,
					MinDelayMs: 1000,
					MaxDelayMs: 3000,
				},
			},
		},
		{
			name: "random_error",
			config: &vaultsandbox.ChaosConfig{
				Enabled: true,
				RandomError: &vaultsandbox.RandomErrorConfig{
					Enabled:   true,
					ErrorRate: 0.5,
				},
			},
		},
		{
			name: "greylist",
			config: &vaultsandbox.ChaosConfig{
				Enabled: true,
				Greylist: &vaultsandbox.GreylistConfig{
					Enabled:     true,
					MaxAttempts: 2,
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			inbox, err := client.CreateInbox(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer inbox.Delete(ctx)

			_, err = inbox.SetChaosConfig(ctx, tt.config)
			if err != nil {
				t.Fatal(err)
			}

			// Test your application's resilience
			// ...
		})
	}
}
```

### Cleanup Helper

```go
func withChaosInbox(t *testing.T, config *vaultsandbox.ChaosConfig, fn func(*vaultsandbox.Inbox)) {
	t.Helper()

	info := client.ServerInfo()
	if !info.ChaosEnabled {
		t.Skip("Chaos features not available on this server")
	}

	ctx := context.Background()
	inbox, err := client.CreateInbox(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer inbox.Delete(ctx)

	_, err = inbox.SetChaosConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}

	fn(inbox)
}

func TestWithChaos(t *testing.T) {
	withChaosInbox(t, &vaultsandbox.ChaosConfig{
		Enabled: true,
		Latency: &vaultsandbox.LatencyConfig{
			Enabled:    true,
			MinDelayMs: 100,
			MaxDelayMs: 500,
		},
	}, func(inbox *vaultsandbox.Inbox) {
		// Test with chaos-enabled inbox
	})
}
```

## Next Steps

- [Inbox API Reference](/client-go/api/inbox/) - Complete inbox methods including chaos
- [CI/CD Integration](/client-go/testing/cicd/) - Integrate chaos testing in pipelines
- [Error Handling](/client-go/guides/managing-inboxes/#error-handling) - Handle chaos-related errors
