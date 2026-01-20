// Centralized version numbers for all client SDKs
// Update these values when releasing new versions

export const versions = {
	dotnet: '0.8.5',
	java: '0.8.5',
	go: '0.8.5',
	node: '0.8.5',
	python: '0.8.5',
} as const;

export type ClientName = keyof typeof versions;
