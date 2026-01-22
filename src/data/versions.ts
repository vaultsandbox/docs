// Centralized version numbers for all client SDKs
// Update these values when releasing new versions

export const versions = {
	dotnet: '0.9.0',
	java: '0.9.0',
	go: '0.9.0',
	node: '0.9.0',
	python: '0.9.0',
} as const;

export type ClientName = keyof typeof versions;
