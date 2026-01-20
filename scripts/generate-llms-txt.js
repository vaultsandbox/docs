/**
 * Generate LLM-friendly documentation files
 *
 * This script generates section-specific text files optimized for LLM consumption.
 * It processes markdown/MDX files, strips MDX-specific syntax, converts Starlight
 * callouts to blockquotes, and outputs clean text files.
 *
 * Usage: node scripts/generate-llms-txt.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, relative, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DOCS_DIR = join(ROOT_DIR, 'src/content/docs');
const OUTPUT_DIR = join(ROOT_DIR, 'public/llms');

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));
const VERSION = packageJson.version;

// SDK languages configuration
const SDK_LANGS = [
	{ id: 'node', name: 'Node.js', dir: 'client-node' },
	{ id: 'python', name: 'Python', dir: 'client-python' },
	{ id: 'java', name: 'Java', dir: 'client-java' },
	{ id: 'go', name: 'Go', dir: 'client-go' },
	{ id: 'dotnet', name: '.NET', dir: 'client-dotnet' },
];

// SDK sub-sections
const SDK_SUBSECTIONS = [
	{ id: 'quickstart', name: 'Quick Start', patterns: ['index.*', 'installation.*', 'configuration.*'] },
	{ id: 'concepts', name: 'Concepts', patterns: ['concepts/**'] },
	{ id: 'api', name: 'API Reference', patterns: ['api/**'] },
	{ id: 'guides', name: 'Guides', patterns: ['guides/**'] },
	{ id: 'testing', name: 'Testing', patterns: ['testing/**'] },
	{ id: 'advanced', name: 'Advanced', patterns: ['advanced/**'] },
];

// Build SDK sections dynamically
function buildSdkSections() {
	const sections = {};
	for (const lang of SDK_LANGS) {
		for (const sub of SDK_SUBSECTIONS) {
			const key = `llms-sdk-${lang.id}-${sub.id}.txt`;
			sections[key] = {
				title: `VaultSandbox ${lang.name} SDK - ${sub.name}`,
				description: `${lang.name} SDK ${sub.name.toLowerCase()} documentation`,
				patterns: sub.patterns.map((p) => `${lang.dir}/${p}`),
			};
		}
	}
	return sections;
}

// Section mappings: output file -> glob patterns (relative to DOCS_DIR)
const SECTIONS = {
	'llms-core.txt': {
		title: 'VaultSandbox Core Documentation',
		description: 'Overview, architecture, getting started, and deployment guides',
		patterns: ['index.md', 'getting-started/**', 'deployment/**'],
	},
	'llms-gateway.txt': {
		title: 'VaultSandbox Gateway Documentation',
		description: 'Gateway configuration, API, webhooks, and security',
		patterns: ['gateway/**'],
	},
	'llms-cli.txt': {
		title: 'VaultSandbox CLI Documentation',
		description: 'Command-line interface reference',
		patterns: ['cli/**'],
	},
	...buildSdkSections(),
};

/**
 * Match files against a glob-like pattern
 */
function matchPattern(filePath, pattern) {
	// Normalize paths
	filePath = filePath.replace(/\\/g, '/');
	pattern = pattern.replace(/\\/g, '/');

	// Handle exact match (no wildcards)
	if (!pattern.includes('*')) {
		return filePath === pattern || filePath === pattern.replace(/\.md$/, '.mdx');
	}

	// Handle ** (matches any directory depth)
	if (pattern.includes('**')) {
		const prefix = pattern.split('**')[0];
		return filePath.startsWith(prefix);
	}

	// Handle patterns like "dir/index.*" or "dir/file.*"
	if (pattern.endsWith('.*')) {
		const base = pattern.slice(0, -2); // Remove .*
		return filePath.startsWith(base + '.md') || filePath.startsWith(base + '.mdx');
	}

	// Handle * (matches single segment)
	const regex = new RegExp('^' + pattern.replace(/\*/g, '[^/]*') + '$');
	return regex.test(filePath);
}

/**
 * Recursively find all markdown/MDX files in a directory
 */
function findFiles(dir, baseDir = dir) {
	const files = [];

	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);

		if (stat.isDirectory()) {
			files.push(...findFiles(fullPath, baseDir));
		} else if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
			files.push(relative(baseDir, fullPath).replace(/\\/g, '/'));
		}
	}

	return files;
}

/**
 * Extract frontmatter from markdown content
 */
function extractFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---\n/);
	if (!match) {
		return { frontmatter: {}, content };
	}

	const frontmatterStr = match[1];
	const frontmatter = {};

	// Simple YAML parsing for title and description
	for (const line of frontmatterStr.split('\n')) {
		const colonIndex = line.indexOf(':');
		if (colonIndex > 0) {
			const key = line.slice(0, colonIndex).trim();
			let value = line.slice(colonIndex + 1).trim();
			// Remove quotes if present
			if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
				value = value.slice(1, -1);
			}
			frontmatter[key] = value;
		}
	}

	return {
		frontmatter,
		content: content.slice(match[0].length),
	};
}

/**
 * Convert Starlight callouts to markdown blockquotes
 * :::tip[Title] -> > **Tip: Title**
 */
function convertCallouts(content) {
	// Match Starlight callout syntax: :::type[optional title]
	const calloutRegex = /:::(tip|note|caution|danger|warning)(?:\[(.*?)\])?\n([\s\S]*?):::/g;

	return content.replace(calloutRegex, (match, type, title, body) => {
		const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
		const header = title ? `**${typeLabel}: ${title}**` : `**${typeLabel}**`;

		// Convert body to blockquote format
		const quotedBody = body
			.trim()
			.split('\n')
			.map((line) => `> ${line}`)
			.join('\n');

		return `> ${header}\n>\n${quotedBody}`;
	});
}

/**
 * Remove MDX-specific syntax (imports, JSX components)
 */
function removeMdxSyntax(content) {
	// Remove import statements
	content = content.replace(/^import\s+.*?['"];?\s*$/gm, '');

	// Remove JSX components (self-closing and with content)
	// Be careful to preserve content inside JSX where possible
	content = content.replace(/<[A-Z][a-zA-Z]*\s*\/>/g, ''); // Self-closing
	content = content.replace(/<[A-Z][a-zA-Z]*[^>]*>[\s\S]*?<\/[A-Z][a-zA-Z]*>/g, ''); // With content

	// Remove div wrappers that might be used for styling
	content = content.replace(/<div[^>]*class="[^"]*"[^>]*>\n?/g, '');
	content = content.replace(/<\/div>\n?/g, '');

	// Clean up excessive blank lines
	content = content.replace(/\n{4,}/g, '\n\n\n');

	return content.trim();
}

/**
 * Process a single markdown file
 */
function processFile(filePath) {
	const fullPath = join(DOCS_DIR, filePath);
	const content = readFileSync(fullPath, 'utf-8');

	const { frontmatter, content: bodyContent } = extractFrontmatter(content);

	let processed = bodyContent;
	processed = convertCallouts(processed);
	processed = removeMdxSyntax(processed);

	return {
		title: frontmatter.title || basename(filePath, '.md').replace(/-/g, ' '),
		description: frontmatter.description || '',
		content: processed.trim(),
		source: '/' + filePath.replace(/\.mdx?$/, '/'),
	};
}

/**
 * Generate a section file
 */
function generateSection(outputFile, config) {
	const { title, description, patterns } = config;

	// Find all matching files
	const allFiles = findFiles(DOCS_DIR);
	const matchingFiles = allFiles.filter((file) => patterns.some((pattern) => matchPattern(file, pattern)));

	// Skip if no files match
	if (matchingFiles.length === 0) {
		return null;
	}

	// Sort files for consistent output (index files first, then alphabetically)
	matchingFiles.sort((a, b) => {
		const aIsIndex = basename(a).startsWith('index');
		const bIsIndex = basename(b).startsWith('index');
		if (aIsIndex && !bIsIndex) return -1;
		if (!aIsIndex && bIsIndex) return 1;
		return a.localeCompare(b);
	});

	// Process each file
	const processedFiles = matchingFiles.map(processFile);

	// Build output
	const lines = [];

	// Header
	lines.push(`# ${title}`);
	lines.push('');
	lines.push(`> ${description}`);
	lines.push('');
	lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
	lines.push(`Version: ${VERSION}`);
	lines.push('');

	// Table of contents
	lines.push('## Table of Contents');
	lines.push('');
	for (const file of processedFiles) {
		lines.push(`- ${file.title}`);
	}
	lines.push('');
	lines.push('---');
	lines.push('');

	// Content sections
	for (const file of processedFiles) {
		lines.push(`## ${file.title}`);
		if (file.description) {
			lines.push('');
			lines.push(`> ${file.description}`);
		}
		lines.push('');
		lines.push(`Source: ${file.source}`);
		lines.push('');
		lines.push(file.content);
		lines.push('');
		lines.push('---');
		lines.push('');
	}

	const output = lines.join('\n');

	// Write file
	const outputPath = join(OUTPUT_DIR, outputFile);
	writeFileSync(outputPath, output);

	const sizeKB = (Buffer.byteLength(output, 'utf-8') / 1024).toFixed(1);
	console.log(`  ${outputFile}: ${matchingFiles.length} files, ${sizeKB}KB`);

	return {
		file: outputFile,
		fileCount: matchingFiles.length,
		sizeKB: parseFloat(sizeKB),
	};
}

/**
 * Update the main llms.txt index file
 */
function updateIndex(stats) {
	const indexPath = join(ROOT_DIR, 'public/llms.txt');
	const currentContent = existsSync(indexPath) ? readFileSync(indexPath, 'utf-8') : '';

	// Build SDK sub-section links
	const sdkLinks = SDK_LANGS.map((lang) => {
		const subLinks = SDK_SUBSECTIONS.map(
			(sub) => `  - /llms/llms-sdk-${lang.id}-${sub.id}.txt - ${sub.name}`
		).join('\n');
		return `#### ${lang.name} SDK\n${subLinks}`;
	}).join('\n\n');

	// Build new section links
	const sectionLinks = `
## Section-Specific Documentation

For detailed documentation, use these focused files:

### Core
- /llms/llms-core.txt - Overview, architecture, getting started, deployment

### Gateway
- /llms/llms-gateway.txt - Gateway configuration, API, webhooks, security

### CLI
- /llms/llms-cli.txt - Command-line interface

### SDKs

${sdkLinks}
`;

	// Remove existing section links if present
	let baseContent = currentContent;
	const sectionStartMarker = '## Section-Specific Documentation';
	const sectionEndMarker = '## Documentation Sections';

	if (baseContent.includes(sectionStartMarker)) {
		const startIdx = baseContent.indexOf(sectionStartMarker);
		const endIdx = baseContent.indexOf(sectionEndMarker);
		if (endIdx > startIdx) {
			baseContent = baseContent.slice(0, startIdx) + baseContent.slice(endIdx);
		}
	}

	// Insert before "## Documentation Sections" or at the end
	let newContent;
	if (baseContent.includes('## Documentation Sections')) {
		newContent = baseContent.replace('## Documentation Sections', sectionLinks + '\n## Documentation Sections');
	} else {
		newContent = baseContent.trim() + '\n' + sectionLinks;
	}

	writeFileSync(indexPath, newContent);
	console.log('\n  Updated llms.txt with section links');
}

/**
 * Main entry point
 */
function main() {
	console.log('Generating LLM documentation files...\n');

	// Ensure output directory exists
	if (!existsSync(OUTPUT_DIR)) {
		mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	const stats = [];

	// Generate each section
	for (const [outputFile, config] of Object.entries(SECTIONS)) {
		const result = generateSection(outputFile, config);
		if (result) {
			stats.push(result);
		}
	}

	// Update main index
	updateIndex(stats);

	// Summary
	const totalSize = stats.reduce((sum, s) => sum + s.sizeKB, 0).toFixed(1);
	const totalFiles = stats.reduce((sum, s) => sum + s.fileCount, 0);

	console.log(`\nTotal: ${totalFiles} files processed, ${totalSize}KB generated`);
	console.log('Output directory: public/llms/');
}

main();
