#!/usr/bin/env node

/**
 * Validate manifest.json for Chrome extension compliance
 * Checks for required fields, proper format, and Chrome Web Store requirements
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function validateManifest() {
	try {
		console.log('🔍 Validating manifest.json...');

		// Read manifest.json
		const manifestPath = join(projectRoot, 'static', 'manifest.json');
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

		const errors = [];
		const warnings = [];

		// Required fields for Manifest V3
		const requiredFields = ['name', 'version', 'manifest_version'];
		requiredFields.forEach((field) => {
			if (!manifest[field]) {
				errors.push(`Missing required field: ${field}`);
			}
		});

		// Check manifest version
		if (manifest.manifest_version !== 3) {
			errors.push('manifest_version must be 3 for new extensions');
		}

		// Version format validation
		if (manifest.version && !/^\d+(\.\d+)*$/.test(manifest.version)) {
			errors.push('Version must be in format: major.minor.patch (e.g., 1.0.0)');
		}

		// Check name length
		if (manifest.name && manifest.name.length > 75) {
			errors.push('Extension name must be 75 characters or less');
		}

		// Check description
		if (!manifest.description) {
			warnings.push('Description is recommended for Chrome Web Store');
		} else if (manifest.description.length > 132) {
			warnings.push('Description should be 132 characters or less for Chrome Web Store');
		}

		// Check icons
		if (!manifest.icons) {
			warnings.push('Icons are recommended for better user experience');
		} else {
			const recommendedSizes = [16, 32, 48, 128];
			recommendedSizes.forEach((size) => {
				if (!manifest.icons[size]) {
					warnings.push(`Icon size ${size}x${size} is recommended`);
				}
			});
		}

		// Check action (popup)
		if (manifest.action) {
			if (manifest.action.default_popup && !manifest.action.default_popup.endsWith('.html')) {
				warnings.push('default_popup should point to an HTML file');
			}
		}

		// Check permissions
		if (!manifest.permissions || manifest.permissions.length === 0) {
			warnings.push('No permissions declared - extension may have limited functionality');
		}

		// Check for dangerous permissions
		const dangerousPermissions = ['<all_urls>', 'http://*/*', 'https://*/*'];
		if (manifest.host_permissions) {
			manifest.host_permissions.forEach((permission) => {
				if (dangerousPermissions.includes(permission)) {
					warnings.push(`Host permission "${permission}" may require additional review`);
				}
			});
		}

		// Validate package.json version matches
		try {
			const packageJsonPath = join(projectRoot, 'package.json');
			const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

			if (packageJson.version !== manifest.version) {
				errors.push(
					`Version mismatch: package.json (${packageJson.version}) vs manifest.json (${manifest.version})`
				);
			}
		} catch (err) {
			warnings.push('Could not validate version against package.json');
		}

		// Report results
		console.log('\n📋 Validation Results:');
		console.log(`• Name: ${manifest.name || 'Not set'}`);
		console.log(`• Version: ${manifest.version || 'Not set'}`);
		console.log(`• Manifest Version: ${manifest.manifest_version || 'Not set'}`);
		console.log(
			`• Description: ${manifest.description ? `${manifest.description.substring(0, 50)}...` : 'Not set'}`
		);

		if (errors.length > 0) {
			console.log('\n❌ Errors:');
			errors.forEach((error) => console.log(`  • ${error}`));
		}

		if (warnings.length > 0) {
			console.log('\n⚠️  Warnings:');
			warnings.forEach((warning) => console.log(`  • ${warning}`));
		}

		if (errors.length === 0) {
			console.log('\n✅ Manifest validation passed!');
			if (warnings.length === 0) {
				console.log('🎉 No warnings - manifest looks great!');
			}
			return true;
		} else {
			console.log(`\n💥 Manifest validation failed with ${errors.length} error(s)`);
			process.exit(1);
		}
	} catch (error) {
		console.error('❌ Error validating manifest:', error.message);
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	validateManifest();
}

export default validateManifest;
