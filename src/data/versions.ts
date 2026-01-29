// Centralized version numbers for all client SDKs
// Update these values when releasing new versions

export const versions = {
	dotnet: '0.9.2',
	java: '0.9.2',
	go: '0.9.2,
	node: '0.9.2',
	python: '0.9.2',
} as const;

export type ClientName = keyof typeof versions;
