// Centralized version numbers for all client SDKs
// Update these values when releasing new versions

export const versions = {
	dotnet: '0.8.0',
	java: '0.8.0',
	go: '0.8.0',
	node: '0.8.0',
	python: '0.8.0',
} as const;

export type ClientName = keyof typeof versions;
