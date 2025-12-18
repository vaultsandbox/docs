---
title: CI/CD Integration
description: Guide for integrating VaultSandbox Java client into CI/CD pipelines
---

This guide covers integrating VaultSandbox email testing into your CI/CD pipelines, including configuration for popular CI platforms, test framework setup, and best practices.

## Overview

CI/CD integration requires:
- Environment setup with API keys
- Configuration optimized for CI environments
- Test framework integration (JUnit 5 or TestNG)
- Pipeline configuration for your CI platform

## JUnit 5 Configuration

### Base Test Class

Create a base class that handles client lifecycle and inbox management:

```java
import com.vaultsandbox.client.ClientConfig;
import com.vaultsandbox.client.Inbox;
import com.vaultsandbox.client.StrategyType;
import com.vaultsandbox.client.VaultSandboxClient;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;

import java.time.Duration;

public abstract class BaseEmailTest {

    protected static VaultSandboxClient client;
    protected Inbox inbox;

    @BeforeAll
    static void setUpClient() {
        String apiKey = System.getenv("VAULTSANDBOX_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                "VAULTSANDBOX_API_KEY environment variable not set"
            );
        }

        client = VaultSandboxClient.create(
            ClientConfig.builder()
                .apiKey(apiKey)
                .strategy(StrategyType.POLLING) // More reliable in CI
                .waitTimeout(Duration.ofSeconds(60))
                .pollInterval(Duration.ofSeconds(2))
                .maxRetries(5)
                .build()
        );
    }

    @AfterAll
    static void tearDownClient() {
        if (client != null) {
            try {
                client.deleteAllInboxes();
            } finally {
                client.close();
            }
        }
    }

    @BeforeEach
    void setUpInbox() {
        inbox = client.createInbox();
    }

    @AfterEach
    void tearDownInbox() {
        if (inbox != null) {
            try {
                client.deleteInbox(inbox.getEmailAddress());
            } catch (Exception e) {
                // Log but don't fail
            }
        }
    }
}
```

### Test Example

```java
import com.vaultsandbox.client.Email;
import com.vaultsandbox.client.EmailFilter;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordResetTest extends BaseEmailTest {

    @Test
    void shouldReceivePasswordResetEmail() {
        userService.requestPasswordReset(inbox.getEmailAddress());

        Email email = inbox.waitForEmail(
            EmailFilter.subjectContains("Reset"),
            Duration.ofSeconds(60)
        );

        assertThat(email).isNotNull();
    }
}
```

## TestNG Configuration

```java
import com.vaultsandbox.client.ClientConfig;
import com.vaultsandbox.client.Inbox;
import com.vaultsandbox.client.StrategyType;
import com.vaultsandbox.client.VaultSandboxClient;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.AfterSuite;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.BeforeSuite;

public class EmailTestBase {

    protected static VaultSandboxClient client;
    protected Inbox inbox;

    @BeforeSuite
    public void setUpSuite() {
        client = VaultSandboxClient.create(
            ClientConfig.builder()
                .apiKey(System.getenv("VAULTSANDBOX_API_KEY"))
                .strategy(StrategyType.POLLING)
                .build()
        );
    }

    @AfterSuite
    public void tearDownSuite() {
        if (client != null) {
            client.deleteAllInboxes();
            client.close();
        }
    }

    @BeforeMethod
    public void setUpMethod() {
        inbox = client.createInbox();
    }

    @AfterMethod
    public void tearDownMethod() {
        if (inbox != null) {
            client.deleteInbox(inbox.getEmailAddress());
        }
    }
}
```

## GitHub Actions

### Basic Workflow

```yaml
# .github/workflows/email-tests.yml
name: Email Integration Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Cache Gradle packages
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}

      - name: Run tests
        env:
          VAULTSANDBOX_API_KEY: ${{ secrets.VAULTSANDBOX_API_KEY }}
        run: ./gradlew test

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: build/reports/tests/
```

### With Matrix Testing

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        java: ['21', '22']

    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK ${{ matrix.java }}
        uses: actions/setup-java@v4
        with:
          java-version: ${{ matrix.java }}
          distribution: 'temurin'

      - name: Run tests
        env:
          VAULTSANDBOX_API_KEY: ${{ secrets.VAULTSANDBOX_API_KEY }}
        run: ./gradlew test
```

## GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test

variables:
  GRADLE_OPTS: "-Dorg.gradle.daemon=false"

email-tests:
  stage: test
  image: eclipse-temurin:21-jdk
  variables:
    VAULTSANDBOX_API_KEY: $VAULTSANDBOX_API_KEY
  script:
    - ./gradlew test
  artifacts:
    when: always
    reports:
      junit: build/test-results/test/*.xml
    paths:
      - build/reports/tests/
  cache:
    key: gradle
    paths:
      - .gradle/
```

## CircleCI

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  test:
    docker:
      - image: cimg/openjdk:21.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - gradle-{{ checksum "build.gradle" }}
      - run:
          name: Run tests
          command: ./gradlew test
          environment:
            VAULTSANDBOX_API_KEY: ${VAULTSANDBOX_API_KEY}
      - save_cache:
          paths:
            - ~/.gradle
          key: gradle-{{ checksum "build.gradle" }}
      - store_test_results:
          path: build/test-results
      - store_artifacts:
          path: build/reports/tests

workflows:
  test:
    jobs:
      - test
```

## Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any

    tools {
        jdk 'JDK21'
    }

    environment {
        VAULTSANDBOX_API_KEY = credentials('vaultsandbox-api-key')
    }

    stages {
        stage('Test') {
            steps {
                sh './gradlew test'
            }
            post {
                always {
                    junit 'build/test-results/test/*.xml'
                    publishHTML([
                        allowMissing: false,
                        reportDir: 'build/reports/tests/test',
                        reportFiles: 'index.html',
                        reportName: 'Test Report'
                    ])
                }
            }
        }
    }
}
```

## Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: JavaToolInstaller@0
    inputs:
      versionSpec: '21'
      jdkArchitectureOption: 'x64'
      jdkSourceOption: 'PreInstalled'

  - task: Gradle@3
    inputs:
      gradleWrapperFile: 'gradlew'
      tasks: 'test'
      publishJUnitResults: true
      testResultsFiles: '**/TEST-*.xml'
    env:
      VAULTSANDBOX_API_KEY: $(VAULTSANDBOX_API_KEY)
```

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `VAULTSANDBOX_API_KEY` | API key for authentication |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VAULTSANDBOX_URL` | `https://smtp.vaultsandbox.com` | API endpoint |
| `VAULTSANDBOX_TIMEOUT` | `60` | Default timeout in seconds |

### Configuration Helper

A utility class to read configuration from environment variables:

```java
import com.vaultsandbox.client.ClientConfig;
import com.vaultsandbox.client.StrategyType;

import java.time.Duration;

public class CIConfig {

    public static ClientConfig fromEnvironment() {
        String apiKey = requireEnv("VAULTSANDBOX_API_KEY");
        String baseUrl = getEnv("VAULTSANDBOX_URL",
            "https://smtp.vaultsandbox.com");
        int timeout = Integer.parseInt(
            getEnv("VAULTSANDBOX_TIMEOUT", "60"));

        return ClientConfig.builder()
            .apiKey(apiKey)
            .baseUrl(baseUrl)
            .strategy(StrategyType.POLLING)
            .waitTimeout(Duration.ofSeconds(timeout))
            .pollInterval(Duration.ofSeconds(2))
            .maxRetries(5)
            .build();
    }

    private static String requireEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                name + " environment variable not set"
            );
        }
        return value;
    }

    private static String getEnv(String name, String defaultValue) {
        String value = System.getenv(name);
        return value != null ? value : defaultValue;
    }
}
```

## Gradle Configuration

### build.gradle

```groovy
plugins {
    id 'java'
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    implementation 'com.vaultsandbox:client-java:1.0.0'

    testImplementation 'org.junit.jupiter:junit-jupiter:5.11.0'
    testImplementation 'org.assertj:assertj-core:3.26.0'
}

test {
    useJUnitPlatform()

    // CI-friendly timeouts
    systemProperty 'junit.jupiter.execution.timeout.default', '5m'

    testLogging {
        events "passed", "skipped", "failed"
        exceptionFormat "full"
    }

    // Parallel execution
    maxParallelForks = Runtime.runtime.availableProcessors().intdiv(2) ?: 1
}
```

### Separate Integration Tests

Configure a separate source set for integration tests:

```groovy
sourceSets {
    integrationTest {
        java.srcDir 'src/integrationTest/java'
        resources.srcDir 'src/integrationTest/resources'
        compileClasspath += main.output + test.output
        runtimeClasspath += main.output + test.output
    }
}

configurations {
    integrationTestImplementation.extendsFrom testImplementation
    integrationTestRuntimeOnly.extendsFrom testRuntimeOnly
}

task integrationTest(type: Test) {
    testClassesDirs = sourceSets.integrationTest.output.classesDirs
    classpath = sourceSets.integrationTest.runtimeClasspath

    useJUnitPlatform()

    // Only run with API key present
    onlyIf { System.getenv('VAULTSANDBOX_API_KEY') != null }
}
```

## Maven Configuration

### pom.xml

```xml
<project>
    <properties>
        <java.version>21</java.version>
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
    </properties>

    <dependencies>
        <dependency>
            <groupId>com.vaultsandbox</groupId>
            <artifactId>client-java</artifactId>
            <version>1.0.0</version>
        </dependency>

        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.11.0</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.2.5</version>
                <configuration>
                    <environmentVariables>
                        <VAULTSANDBOX_API_KEY>${env.VAULTSANDBOX_API_KEY}</VAULTSANDBOX_API_KEY>
                    </environmentVariables>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
```

## Best Practices

### Use Polling Strategy

Polling is more reliable than SSE in CI environments where persistent connections may be problematic:

```java
ClientConfig.builder()
    .strategy(StrategyType.POLLING)
    .pollInterval(Duration.ofSeconds(2))
    .build()
```

### Generous Timeouts

CI environments may be slower than local development. Configure generous timeouts:

```java
ClientConfig.builder()
    .waitTimeout(Duration.ofSeconds(60))
    .httpTimeout(Duration.ofSeconds(30))
    .build()
```

### Clean Up Resources

Always clean up inboxes to avoid resource leaks and ensure test isolation:

```java
@AfterAll
static void cleanup() {
    client.deleteAllInboxes();
    client.close();
}
```

### Skip Tests Without API Key

Allow tests to be skipped when the API key is not available (e.g., on forks or local builds without credentials):

```java
import org.junit.jupiter.api.Assumptions;

@BeforeAll
static void checkEnvironment() {
    Assumptions.assumeTrue(
        System.getenv("VAULTSANDBOX_API_KEY") != null,
        "Skipping: VAULTSANDBOX_API_KEY not set"
    );
}
```

### Tag Integration Tests

Use JUnit 5 tags to categorize and selectively run tests:

```java
import org.junit.jupiter.api.Tag;

@Tag("integration")
@Tag("email")
class EmailIntegrationTest extends BaseEmailTest {
    // Tests that require external services
}
```

### Run Integration Tests Separately

Keep unit tests fast by running integration tests separately:

```bash
# Unit tests only (fast)
./gradlew test

# Integration tests (requires API key)
./gradlew integrationTest
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Timeouts | Increase `waitTimeout`, use POLLING strategy |
| Connection refused | Check firewall, use POLLING |
| API key not found | Verify secret configuration in CI platform |
| Flaky tests | Use specific filters, longer timeouts |
| Resource leaks | Ensure cleanup in @AfterAll |

## Related Pages

- [Password Reset Testing](/client-java/testing/password-reset/) - Testing password reset flows
- [Multi-Email Flows](/client-java/testing/multi-email/) - Testing complex email sequences
- [Delivery Strategies](/client-java/advanced/strategies/) - SSE vs Polling strategies
- [Configuration](/client-java/configuration/) - All configuration options
