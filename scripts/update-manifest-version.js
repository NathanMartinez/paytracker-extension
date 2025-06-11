#!/usr/bin/env node

/**
 * Update manifest.json version to match package.json version
 * This ensures consistency between npm package version and Chrome extension version
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function updateManifestVersion() {
	try {
		// Read package.json
		const packageJsonPath = join(projectRoot, 'package.json');
		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
		const version = packageJson.version;

		console.log(`📦 Package version: ${version}`);

		// Read manifest.json
		const manifestPath = join(projectRoot, 'static', 'manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

		console.log(`🔧 Current manifest version: ${manifest.version}`);

		// Update manifest version
		manifest.version = version;

		// Write back to manifest.json with proper formatting
		writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');

		console.log(`✅ Updated manifest.json version to ${version}`);

		// Also update build manifest if it exists
		const buildManifestPath = join(projectRoot, 'build', 'manifest.json');
		try {
			const buildManifest = JSON.parse(readFileSync(buildManifestPath, 'utf8'));
			buildManifest.version = version;
			writeFileSync(buildManifestPath, JSON.stringify(buildManifest, null, '\t') + '\n');
			console.log(`✅ Updated build/manifest.json version to ${version}`);
		} catch (err) {
			// Build manifest doesn't exist yet, that's fine
			console.log(`ℹ️  Build manifest not found (will be created during build)`);
		}
	} catch (error) {
		console.error('❌ Error updating manifest version:', error.message);
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	updateManifestVersion();
}

export default updateManifestVersion;
