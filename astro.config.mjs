// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://vaultsandbox.dev',
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
						{ label: 'Architecture Overview', link: '/getting-started/architecture/' },
					],
				},
				{
					label: 'Deployment',
					items: [
						{ label: 'Deployment Setup', link: '/deployment/deployment-setup/' },
						{ label: 'Docker Compose Setup', link: '/deployment/docker-compose/' },
					],
				},
				{
					label: 'Gateway',
					items: [
						{ label: 'Overview', link: '/gateway/' },
						{ label: 'Configuration Reference', link: '/gateway/configuration/' },
						{ label: 'Web Interface', link: '/gateway/webui/' },
						{ label: 'API Keys & Authentication', link: '/gateway/api-keys/' },
						{ label: 'Security & Encryption', link: '/gateway/security/' },
						{ label: 'API Reference', link: '/gateway/api-reference/' },
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
					label: 'SDK Development',
					collapsed: true,
					items: [{ label: 'Client SDK Specification', link: '/sdk/client-spec/' }],
				},
			],
		}),
	],
});
