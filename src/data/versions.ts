// Centralized version numbers for all client SDKs
// Update these values when releasing new versions

export const versions = {
	dotnet: '0.6.1',
	java: '0.6.1',
	go: '0.6.1',
	node: '0.6.1',
	python: '0.6.1',
} as const;

export type ClientName = keyof typeof versions;
