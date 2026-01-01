// Centralized version numbers for all client SDKs
// Update these values when releasing new versions

export const versions = {
  dotnet: "0.5.1",
  java: "0.5.2",
  go: "0.5.1",
  node: "0.5.1",
  python: "0.5.1",
} as const;

export type ClientName = keyof typeof versions;
