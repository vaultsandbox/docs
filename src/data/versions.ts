// Centralized version numbers for all client SDKs
// Update these values when releasing new versions

export const versions = {
	dotnet: '0.6.0',
	java: '0.6.0',
	go: '0.6.0',
	node: '0.6.0',
	python: '0.6.0',
} as const;

export type ClientName = keyof typeof versions;
