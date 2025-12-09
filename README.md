<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./src/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./src/assets/logo-light.svg">
  <img alt="VaultSandbox" src="./src/assets/logo-dark.svg">
</picture>

# VaultSandbox Documentation

Source code for [vaultsandbox.dev](https://vaultsandbox.dev) — the official documentation for [VaultSandbox](https://www.vaultsandbox.com), a self-hosted email testing platform.

Built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:4321)
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── content/docs/     # Markdown documentation pages
├── assets/           # Processed images (Astro optimizes these)
├── components/       # Custom Astro components
└── styles/           # Custom CSS
public/
└── images/           # Static images (served as-is)
astro.config.mjs      # Starlight config and sidebar navigation
```

## Adding Content

1. Create/edit Markdown files in `src/content/docs/`
2. Add the page to the sidebar in `astro.config.mjs`
3. Run `npm run build` to verify no errors

## License

[MIT](LICENSE)

## Support

- [Documentation](https://vaultsandbox.dev/)
- [Issue Tracker](https://github.com/vaultsandbox/docs/issues)
- [Discussions](https://github.com/vaultsandbox/gateway/discussions)
- [Website](https://www.vaultsandbox.com)
