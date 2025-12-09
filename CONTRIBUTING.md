# Contributing to VaultSandbox Documentation

First off, thank you for considering contributing! This project and its community appreciate your time and effort.

Please take a moment to review this document in order to make the contribution process easy and effective for everyone involved.

## Code of Conduct

This project and everyone participating in it is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to hello@vaultsandbox.com.

## How You Can Contribute

There are many ways to contribute: fixing typos, improving clarity, adding new guides, or translating content.

### Reporting Issues

If you find a bug in the documentation (broken links, incorrect information, typos), please ensure the issue was not already reported by searching on GitHub under [Issues](https://github.com/vaultsandbox/docs/issues). If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/vaultsandbox/docs/issues/new).

### Suggesting Enhancements

If you have an idea for a new guide or a restructuring of existing content, please open an issue with a clear title and description. Describe the enhancement, its potential benefits, and any implementation ideas you might have.

### Pull Requests

We love pull requests. Here's a quick guide:

1.  Fork the repository.
2.  Create a new branch for your changes: `git checkout -b docs/my-improvement`.
3.  Make your changes, adhering to the style guide.
4.  Preview your changes locally to ensure everything renders correctly.
5.  Commit your changes with a descriptive commit message.
6.  Push your branch to your fork.
7.  Open a pull request to the `main` branch of the upstream repository.

## Development Setup

This project is a static site built with **Astro** and **Starlight**.

### Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/vaultsandbox/docs.git
    cd docs
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
    The documentation site will be running at `http://localhost:4321`.

## Validating Changes

Before submitting a PR, please ensure your changes build correctly.

- **Build the site**:

  ```bash
  npm run build
  ```

  This ensures there are no compilation errors or broken asset links.

- **Check for dead links** (optional but recommended):
  If you added new internal links, verify they work by clicking through them in the local preview.

## Writing Guidelines

- **Format**: We use Markdown (`.md`) and MDX (`.mdx`).
- **Images**: Place images in `src/assets/` (for processed images) or `public/images/` (for static assets). Use relative paths.
- **Tone**: Keep the tone professional, concise, and developer-focused.
- **Frontmatter**: Ensure every new page has a `title` and `description` in the frontmatter.

### Example Frontmatter

```markdown
---
title: My New Guide
description: A short description of what this guide covers.
---
```

Thank you for your contribution!
