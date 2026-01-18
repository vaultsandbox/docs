// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://vaultsandbox.dev',
	trailingSlash: 'always',
	integrations: [
		starlight({
			title: 'VaultSandbox',
			description: 'Production-like email testing. Self-hosted and secure.',
			customCss: ['./src/styles/custom.css'],
			logo: {
				light: './src/assets/logo-light.svg',
				dark: './src/assets/logo-dark.svg',
				replacesTitle: true,
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/vaultsandbox' }],
			components: {
				Head: './src/components/Head.astro',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', link: '/' },
						{ label: 'Quick Start', link: '/getting-started/quickstart/' },
						{ label: 'Quick Start - Custom Domain', link: '/getting-started/quickstart-custom-domain/' },
						{ label: 'Architecture Overview', link: '/getting-started/architecture/' },
					],
				},
				{
					label: 'Deployment',
					items: [
						{ label: 'Deployment Setup', link: '/deployment/deployment-setup/' },
						{ label: 'Docker Compose Setup', link: '/deployment/docker-compose/' },
						{ label: 'Hardened Images', link: '/deployment/hardened-images/' },
						{ label: 'Local Development', link: '/deployment/local-development/' },
					],
				},
				{
					label: 'Gateway',
					items: [
						{ label: 'Overview', link: '/gateway/' },
						{ label: 'Configuration Reference', link: '/gateway/configuration/' },
						{ label: 'Web Interface', link: '/gateway/webui/' },
						{ label: 'API Keys & Authentication', link: '/gateway/api-keys/' },
						{ label: 'Webhooks', link: '/gateway/webhooks/' },
						{ label: 'Security & Encryption', link: '/gateway/security/' },
						{ label: 'API Reference', link: '/gateway/api-reference/' },
					],
				},
				{
					label: 'CLI',
					collapsed: true,
					items: [
						{ label: 'Overview', link: '/cli/' },
						{ label: 'Installation', link: '/cli/installation/' },
						{ label: 'Configuration', link: '/cli/configuration/' },
						{ label: 'TUI Dashboard', link: '/cli/tui/' },
						{
							label: 'Commands',
							collapsed: true,
							items: [
								{ label: 'Inbox', link: '/cli/commands/inbox/' },
								{ label: 'Email', link: '/cli/commands/email/' },
								{ label: 'Wait', link: '/cli/commands/wait/' },
								{ label: 'Export & Import', link: '/cli/commands/data/' },
							],
						},
					],
				},
				{
					label: 'Node.js Client',
					collapsed: true,
					items: [
						{ label: 'Overview', link: '/client-node/' },
						{ label: 'Installation', link: '/client-node/installation/' },
						{ label: 'Configuration', link: '/client-node/configuration/' },
						{
							label: 'Core Concepts',
							collapsed: true,
							items: [
								{ label: 'Inboxes', link: '/client-node/concepts/inboxes/' },
								{ label: 'Email Objects', link: '/client-node/concepts/emails/' },
								{ label: 'Authentication Results', link: '/client-node/concepts/auth-results/' },
							],
						},
						{
							label: 'Usage Guides',
							collapsed: true,
							items: [
								{ label: 'Managing Inboxes', link: '/client-node/guides/managing-inboxes/' },
								{ label: 'Waiting for Emails', link: '/client-node/guides/waiting-for-emails/' },
								{ label: 'Working with Attachments', link: '/client-node/guides/attachments/' },
								{ label: 'Email Authentication', link: '/client-node/guides/authentication/' },
								{ label: 'Real-time Monitoring', link: '/client-node/guides/real-time/' },
								{ label: 'Webhooks', link: '/client-node/guides/webhooks/' },
							],
						},
						{
							label: 'Testing Patterns',
							collapsed: true,
							items: [
								{ label: 'Password Reset Flows', link: '/client-node/testing/password-reset/' },
								{ label: 'Multi-email Scenarios', link: '/client-node/testing/multi-email/' },
								{ label: 'CI/CD Integration', link: '/client-node/testing/cicd/' },
							],
						},
						{
							label: 'API Reference',
							collapsed: true,
							items: [
								{ label: 'VaultSandboxClient', link: '/client-node/api/client/' },
								{ label: 'Inbox', link: '/client-node/api/inbox/' },
								{ label: 'Email', link: '/client-node/api/email/' },
								{ label: 'Error Handling', link: '/client-node/api/errors/' },
							],
						},
						{
							label: 'Advanced Topics',
							collapsed: true,
							items: [
								{ label: 'Import/Export', link: '/client-node/advanced/import-export/' },
								{ label: 'Delivery Strategies', link: '/client-node/advanced/strategies/' },
							],
						},
					],
				},
				{
					label: 'Python Client',
					collapsed: true,
					items: [
						{ label: 'Overview', link: '/client-python/' },
						{ label: 'Installation', link: '/client-python/installation/' },
						{ label: 'Configuration', link: '/client-python/configuration/' },
						{
							label: 'Core Concepts',
							collapsed: true,
							items: [
								{ label: 'Inboxes', link: '/client-python/concepts/inboxes/' },
								{ label: 'Email Objects', link: '/client-python/concepts/emails/' },
								{ label: 'Authentication Results', link: '/client-python/concepts/auth-results/' },
							],
						},
						{
							label: 'Usage Guides',
							collapsed: true,
							items: [
								{ label: 'Managing Inboxes', link: '/client-python/guides/managing-inboxes/' },
								{ label: 'Waiting for Emails', link: '/client-python/guides/waiting-for-emails/' },
								{ label: 'Working with Attachments', link: '/client-python/guides/attachments/' },
								{ label: 'Email Authentication', link: '/client-python/guides/authentication/' },
								{ label: 'Real-time Monitoring', link: '/client-python/guides/real-time/' },
								{ label: 'Webhooks', link: '/client-python/guides/webhooks/' },
							],
						},
						{
							label: 'Testing Patterns',
							collapsed: true,
							items: [
								{ label: 'Password Reset Flows', link: '/client-python/testing/password-reset/' },
								{ label: 'Multi-email Scenarios', link: '/client-python/testing/multi-email/' },
								{ label: 'CI/CD Integration', link: '/client-python/testing/cicd/' },
							],
						},
						{
							label: 'API Reference',
							collapsed: true,
							items: [
								{ label: 'VaultSandboxClient', link: '/client-python/api/client/' },
								{ label: 'Inbox', link: '/client-python/api/inbox/' },
								{ label: 'Email', link: '/client-python/api/email/' },
								{ label: 'Error Handling', link: '/client-python/api/errors/' },
							],
						},
						{
							label: 'Advanced Topics',
							collapsed: true,
							items: [
								{ label: 'Import/Export', link: '/client-python/advanced/import-export/' },
								{ label: 'Delivery Strategies', link: '/client-python/advanced/strategies/' },
							],
						},
					],
				},
				{
					label: 'Java Client',
					collapsed: true,
					items: [
						{ label: 'Overview', link: '/client-java/' },
						{ label: 'Installation', link: '/client-java/installation/' },
						{ label: 'Configuration', link: '/client-java/configuration/' },
						{
							label: 'Core Concepts',
							collapsed: true,
							items: [
								{ label: 'Inboxes', link: '/client-java/concepts/inboxes/' },
								{ label: 'Email Objects', link: '/client-java/concepts/emails/' },
								{ label: 'Authentication Results', link: '/client-java/concepts/auth-results/' },
							],
						},
						{
							label: 'Usage Guides',
							collapsed: true,
							items: [
								{ label: 'Managing Inboxes', link: '/client-java/guides/managing-inboxes/' },
								{ label: 'Waiting for Emails', link: '/client-java/guides/waiting-for-emails/' },
								{ label: 'Working with Attachments', link: '/client-java/guides/attachments/' },
								{ label: 'Email Authentication', link: '/client-java/guides/authentication/' },
								{ label: 'Real-time Monitoring', link: '/client-java/guides/real-time/' },
								{ label: 'Webhooks', link: '/client-java/guides/webhooks/' },
							],
						},
						{
							label: 'Testing Patterns',
							collapsed: true,
							items: [
								{ label: 'Password Reset Flows', link: '/client-java/testing/password-reset/' },
								{ label: 'Multi-email Scenarios', link: '/client-java/testing/multi-email/' },
								{ label: 'CI/CD Integration', link: '/client-java/testing/cicd/' },
							],
						},
						{
							label: 'API Reference',
							collapsed: true,
							items: [
								{ label: 'VaultSandboxClient', link: '/client-java/api/client/' },
								{ label: 'Inbox', link: '/client-java/api/inbox/' },
								{ label: 'Email', link: '/client-java/api/email/' },
								{ label: 'Error Handling', link: '/client-java/api/errors/' },
							],
						},
						{
							label: 'Advanced Topics',
							collapsed: true,
							items: [
								{ label: 'Import/Export', link: '/client-java/advanced/import-export/' },
								{ label: 'Delivery Strategies', link: '/client-java/advanced/strategies/' },
							],
						},
					],
				},
				{
					label: 'Go Client',
					collapsed: true,
					items: [
						{ label: 'Overview', link: '/client-go/' },
						{ label: 'Installation', link: '/client-go/installation/' },
						{ label: 'Configuration', link: '/client-go/configuration/' },
						{
							label: 'Core Concepts',
							collapsed: true,
							items: [
								{ label: 'Inboxes', link: '/client-go/concepts/inboxes/' },
								{ label: 'Email Objects', link: '/client-go/concepts/emails/' },
								{ label: 'Authentication Results', link: '/client-go/concepts/auth-results/' },
							],
						},
						{
							label: 'Usage Guides',
							collapsed: true,
							items: [
								{ label: 'Managing Inboxes', link: '/client-go/guides/managing-inboxes/' },
								{ label: 'Waiting for Emails', link: '/client-go/guides/waiting-for-emails/' },
								{ label: 'Working with Attachments', link: '/client-go/guides/attachments/' },
								{ label: 'Email Authentication', link: '/client-go/guides/authentication/' },
								{ label: 'Real-time Monitoring', link: '/client-go/guides/real-time/' },
								{ label: 'Webhooks', link: '/client-go/guides/webhooks/' },
							],
						},
						{
							label: 'Testing Patterns',
							collapsed: true,
							items: [
								{ label: 'Password Reset Flows', link: '/client-go/testing/password-reset/' },
								{ label: 'Multi-email Scenarios', link: '/client-go/testing/multi-email/' },
								{ label: 'CI/CD Integration', link: '/client-go/testing/cicd/' },
							],
						},
						{
							label: 'API Reference',
							collapsed: true,
							items: [
								{ label: 'VaultSandboxClient', link: '/client-go/api/client/' },
								{ label: 'Inbox', link: '/client-go/api/inbox/' },
								{ label: 'Email', link: '/client-go/api/email/' },
								{ label: 'Error Handling', link: '/client-go/api/errors/' },
							],
						},
						{
							label: 'Advanced Topics',
							collapsed: true,
							items: [
								{ label: 'Import/Export', link: '/client-go/advanced/import-export/' },
								{ label: 'Delivery Strategies', link: '/client-go/advanced/strategies/' },
							],
						},
					],
				},
				{
					label: '.NET Client',
					collapsed: true,
					items: [
						{ label: 'Overview', link: '/client-dotnet/' },
						{ label: 'Installation', link: '/client-dotnet/installation/' },
						{ label: 'Configuration', link: '/client-dotnet/configuration/' },
						{
							label: 'Core Concepts',
							collapsed: true,
							items: [
								{ label: 'Inboxes', link: '/client-dotnet/concepts/inboxes/' },
								{ label: 'Email Objects', link: '/client-dotnet/concepts/emails/' },
								{ label: 'Authentication Results', link: '/client-dotnet/concepts/auth-results/' },
							],
						},
						{
							label: 'Usage Guides',
							collapsed: true,
							items: [
								{ label: 'Managing Inboxes', link: '/client-dotnet/guides/managing-inboxes/' },
								{ label: 'Waiting for Emails', link: '/client-dotnet/guides/waiting-for-emails/' },
								{ label: 'Working with Attachments', link: '/client-dotnet/guides/attachments/' },
								{ label: 'Email Authentication', link: '/client-dotnet/guides/authentication/' },
								{ label: 'Real-time Monitoring', link: '/client-dotnet/guides/real-time/' },
								{ label: 'Webhooks', link: '/client-dotnet/guides/webhooks/' },
							],
						},
						{
							label: 'Testing Patterns',
							collapsed: true,
							items: [
								{ label: 'Password Reset Flows', link: '/client-dotnet/testing/password-reset/' },
								{ label: 'Multi-email Scenarios', link: '/client-dotnet/testing/multi-email/' },
								{ label: 'CI/CD Integration', link: '/client-dotnet/testing/cicd/' },
							],
						},
						{
							label: 'API Reference',
							collapsed: true,
							items: [
								{ label: 'VaultSandboxClient', link: '/client-dotnet/api/client/' },
								{ label: 'Inbox', link: '/client-dotnet/api/inbox/' },
								{ label: 'Email', link: '/client-dotnet/api/email/' },
								{ label: 'Error Handling', link: '/client-dotnet/api/errors/' },
							],
						},
						{
							label: 'Advanced Topics',
							collapsed: true,
							items: [
								{ label: 'Import/Export', link: '/client-dotnet/advanced/import-export/' },
								{ label: 'Delivery Strategies', link: '/client-dotnet/advanced/strategies/' },
							],
						},
					],
				},
				{
					label: 'SDK Development',
					collapsed: true,
					items: [
						{ label: 'Client SDK Specification', link: '/sdk/client-spec/' },
						{ label: 'Cryptographic Protocol', link: '/sdk/crypto-spec/' },
						{ label: 'Test Specification', link: '/sdk/tests-spec/' },
					],
				},
			],
		}),
	],
});
