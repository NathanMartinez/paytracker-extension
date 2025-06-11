#!/usr/bin/env node

/**
 * Release Preparation Script
 * Comprehensive script to prepare, validate, and create releases for the PayTracker extension
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes for console output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
	try {
		return execSync(command, {
			cwd: projectRoot,
			encoding: 'utf8',
			stdio: options.silent ? 'pipe' : 'inherit',
			...options
		});
	} catch (error) {
		throw new Error(`Command failed: ${command}\n${error.message}`);
	}
}

function checkGitHubCLI() {
	try {
		const version = exec('gh --version', { silent: true });
		if (version && version.includes('gh version')) {
			return true;
		}
	} catch (error) {
		// GitHub CLI not installed
	}
	return false;
}

function checkGitHubAuth() {
	try {
		const status = exec('gh auth status', { silent: true });
		return status && status.includes('Logged in to github.com');
	} catch (error) {
		return false;
	}
}

function readJsonFile(filePath) {
	try {
		return JSON.parse(readFileSync(filePath, 'utf8'));
	} catch (error) {
		throw new Error(`Failed to read JSON file ${filePath}: ${error.message}`);
	}
}

function writeJsonFile(filePath, data) {
	try {
		writeFileSync(filePath, JSON.stringify(data, null, '\t') + '\n');
	} catch (error) {
		throw new Error(`Failed to write JSON file ${filePath}: ${error.message}`);
	}
}

function getCurrentVersion() {
	const packageJson = readJsonFile(join(projectRoot, 'package.json'));
	return packageJson.version;
}

function incrementVersion(version, type) {
	const parts = version.split('.').map(Number);
	switch (type) {
		case 'major':
			return `${parts[0] + 1}.0.0`;
		case 'minor':
			return `${parts[0]}.${parts[1] + 1}.0`;
		case 'patch':
		default:
			return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
	}
}

function validatePrerequisites() {
	log('🔍 Validating prerequisites...', 'blue');

	// Check if we're in a git repository
	try {
		exec('git status', { silent: true });
	} catch (error) {
		throw new Error('Not in a git repository. Initialize git first: git init');
	}

	// Check for uncommitted changes
	const status = exec('git status --porcelain', { silent: true });
	if (status.trim()) {
		throw new Error(
			'Uncommitted changes detected. Please commit or stash changes before releasing.'
		);
	}

	// Check if we're on main branch
	const branch = exec('git branch --show-current', { silent: true }).trim();
	if (branch !== 'main' && branch !== 'master') {
		log(`⚠️  Warning: You're on branch '${branch}', not 'main'. Continue? (y/N)`, 'yellow');
		// In a real scenario, you'd want to prompt for user input
	}

	// Check Node.js version
	const nodeVersion = process.version;
	const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
	if (majorVersion < 18) {
		throw new Error(`Node.js 18+ required. Current version: ${nodeVersion}`);
	}

	// Check GitHub CLI (optional but recommended)
	if (checkGitHubCLI()) {
		log('✅ GitHub CLI detected', 'green');
		if (checkGitHubAuth()) {
			log('✅ GitHub CLI authenticated', 'green');
		} else {
			log('⚠️  GitHub CLI not authenticated. Run: gh auth login', 'yellow');
		}
	} else {
		log('⚠️  GitHub CLI not installed. Consider installing for easier releases', 'yellow');
		log('   Install: https://cli.github.com/', 'cyan');
	}

	log('✅ Prerequisites validated', 'green');
}

function runTests() {
	log('🧪 Running test suite...', 'blue');

	try {
		exec('npm run validate');
		log('✅ All tests passed', 'green');
	} catch (error) {
		throw new Error('Tests failed. Fix issues before releasing.');
	}
}

function updateVersion(releaseType) {
	log(`📦 Updating version (${releaseType})...`, 'blue');

	const currentVersion = getCurrentVersion();
	const newVersion = incrementVersion(currentVersion, releaseType);

	// Update package.json
	const packageJsonPath = join(projectRoot, 'package.json');
	const packageJson = readJsonFile(packageJsonPath);
	packageJson.version = newVersion;
	writeJsonFile(packageJsonPath, packageJson);

	// Update manifest.json
	const manifestPath = join(projectRoot, 'static', 'manifest.json');
	const manifest = readJsonFile(manifestPath);
	manifest.version = newVersion;
	writeJsonFile(manifestPath, manifest);

	log(`✅ Version updated: ${currentVersion} → ${newVersion}`, 'green');
	return newVersion;
}

function updateChangelog(version) {
	log('📝 Updating changelog...', 'blue');

	const changelogPath = join(projectRoot, 'CHANGELOG.md');
	const today = new Date().toISOString().split('T')[0];

	if (!existsSync(changelogPath)) {
		// Create new changelog
		const changelogContent = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [${version}] - ${today}

### Added
- Initial release of PayTracker Extension
- Transaction data extraction from PayTracker platform
- Multiple export formats (CSV, JSON, Excel)
- Privacy protection features
- Real-time data processing

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- Local data processing only
- Minimal permission requirements
`;
		writeFileSync(changelogPath, changelogContent);
	} else {
		// Update existing changelog
		const content = readFileSync(changelogPath, 'utf8');
		const newEntry = `## [${version}] - ${today}

### Added
- Add your new features here

### Changed
- Add your changes here

### Fixed
- Add your bug fixes here

`;

		// Insert new entry after the header
		const lines = content.split('\n');
		const insertIndex =
			lines.findIndex((line) => line.startsWith('## [')) ||
			lines.findIndex((line) => line.trim() === '') + 1;

		lines.splice(insertIndex, 0, newEntry);
		writeFileSync(changelogPath, lines.join('\n'));
	}

	log(`✅ Changelog updated for version ${version}`, 'green');
	log(`📝 Please edit CHANGELOG.md to add specific changes for this release`, 'yellow');
}

function buildExtension() {
	log('🏗️  Building extension...', 'blue');

	try {
		exec('npm run build:production');
		log('✅ Extension built successfully', 'green');
	} catch (error) {
		throw new Error('Build failed. Check build logs for details.');
	}
}

function createGitTag(version, push = false) {
	log('🏷️  Creating git tag...', 'blue');

	try {
		// Stage the changed files
		exec('git add package.json static/manifest.json CHANGELOG.md');

		// Commit the version bump
		exec(`git commit -m "chore: bump version to v${version}"`);

		// Create tag
		exec(`git tag -a v${version} -m "Release version ${version}"`);

		if (push) {
			exec('git push --follow-tags');
			log('✅ Changes and tags pushed to remote', 'green');
		} else {
			log('✅ Git tag created locally', 'green');
			log('📤 To push: git push --follow-tags', 'cyan');
		}
	} catch (error) {
		throw new Error('Failed to create git tag: ' + error.message);
	}
}

function createGitHubRelease(version, releaseNotes) {
	log('🚀 Creating GitHub release...', 'blue');

	if (!checkGitHubCLI()) {
		log('⚠️  GitHub CLI not available, skipping automatic release creation', 'yellow');
		log(
			'   Manual release: https://github.com/NathanMartinez/paytracker-extension/releases/new',
			'cyan'
		);
		return false;
	}

	if (!checkGitHubAuth()) {
		log('⚠️  GitHub CLI not authenticated, skipping automatic release creation', 'yellow');
		log('   Run: gh auth login', 'cyan');
		return false;
	}

	try {
		const zipFile = `paytracker-extension-v${version}.zip`;

		// Create release with notes
		const releaseCommand = `gh release create v${version} --title "PayTracker Extension v${version}" --notes-file -`;
		const releaseProcess = execSync(releaseCommand, {
			cwd: projectRoot,
			input: releaseNotes,
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'inherit']
		});

		// Upload ZIP file if it exists
		if (existsSync(join(projectRoot, zipFile))) {
			exec(`gh release upload v${version} ${zipFile}`);
			log(`✅ ZIP file uploaded: ${zipFile}`, 'green');
		} else {
			log('⚠️  ZIP file not found, skipping upload', 'yellow');
		}

		log('✅ GitHub release created successfully', 'green');
		log(
			`🔗 View release: https://github.com/NathanMartinez/paytracker-extension/releases/tag/v${version}`,
			'cyan'
		);
		return true;
	} catch (error) {
		log('❌ Failed to create GitHub release: ' + error.message, 'red');
		log(
			'   You can create it manually: https://github.com/NathanMartinez/paytracker-extension/releases/new',
			'cyan'
		);
		return false;
	}
}

function generateReleaseNotes(version) {
	log('📄 Generating release notes...', 'blue');

	const changelogPath = join(projectRoot, 'CHANGELOG.md');
	let releaseNotes = `# PayTracker Extension v${version}

## Installation Instructions

1. Download the \`paytracker-extension-v${version}.zip\` file from the assets below
2. Extract the contents to a folder
3. Open Chrome and navigate to \`chrome://extensions/\`
4. Enable "Developer mode" in the top-right corner
5. Click "Load unpacked" and select the extracted folder
6. The extension should now appear in your extensions list

## What's New
`;

	if (existsSync(changelogPath)) {
		try {
			const content = readFileSync(changelogPath, 'utf8');
			const lines = content.split('\n');
			const startIndex = lines.findIndex((line) => line.includes(`[${version}]`));
			const endIndex = lines.findIndex(
				(line, index) => index > startIndex && line.startsWith('## [')
			);

			if (startIndex !== -1) {
				const versionSection =
					endIndex !== -1 ? lines.slice(startIndex + 1, endIndex) : lines.slice(startIndex + 1);

				releaseNotes += versionSection.join('\n').trim();
			}
		} catch (error) {
			log('⚠️  Could not extract changelog content', 'yellow');
		}
	}

	releaseNotes += `

## Technical Details

- **Extension Version**: ${version}
- **Manifest Version**: 3
- **Minimum Chrome Version**: 88
- **Build Date**: ${new Date().toISOString()}

## Support

If you encounter any issues, please:
1. Check the [troubleshooting guide](https://github.com/NathanMartinez/paytracker-extension#troubleshooting)
2. Search [existing issues](https://github.com/NathanMartinez/paytracker-extension/issues)
3. Create a [new issue](https://github.com/NathanMartinez/paytracker-extension/issues/new) if needed

---

		**Full Changelog**: https://github.com/NathanMartinez/paytracker-extension/blob/main/CHANGELOG.md
`;

	const notesPath = join(projectRoot, `release-notes-v${version}.md`);
	writeFileSync(notesPath, releaseNotes);

	log(`✅ Release notes generated: release-notes-v${version}.md`, 'green');
	return releaseNotes;
}

function printSummary(version, releaseType) {
	log('\n' + '='.repeat(60), 'cyan');
	log('🎉 RELEASE PREPARATION COMPLETE', 'green');
	log('='.repeat(60), 'cyan');
	log(`📦 Version: ${version} (${releaseType})`, 'bright');
	log(`📅 Date: ${new Date().toISOString().split('T')[0]}`, 'bright');
	log(`📂 Package: paytracker-extension-v${version}.zip`, 'bright');

	log('\n📋 Next Steps:', 'yellow');
	log('1. Review and edit CHANGELOG.md with specific changes', 'cyan');
	log('2. Test the built extension in Chrome', 'cyan');

	if (checkGitHubCLI() && checkGitHubAuth()) {
		log('3. GitHub release already created via CLI ✅', 'green');
		log('4. Monitor download metrics and user feedback', 'cyan');
	} else {
		log('3. Push changes and tags: git push --follow-tags', 'cyan');
		log('4. GitHub Actions will automatically create the release', 'cyan');
		log('5. Monitor the CI/CD pipeline for completion', 'cyan');
	}

	log('\n🔗 Useful Commands:', 'yellow');
	log('• Test extension: Load build/ folder in chrome://extensions/', 'cyan');
	log('• View release: gh release view v' + version, 'cyan');
	log('• Manual release: npm run release:github', 'cyan');
	log('• Check CI status: gh run list', 'cyan');
	log('• Rollback: git reset --hard HEAD~1 && git tag -d v' + version, 'cyan');

	if (checkGitHubCLI()) {
		log('\n🚀 GitHub CLI Commands:', 'yellow');
		log('• Create release: gh release create v' + version + ' --generate-notes', 'cyan');
		log('• List releases: gh release list', 'cyan');
		log('• Upload assets: gh release upload v' + version + ' *.zip', 'cyan');
		log('• View workflows: gh workflow list', 'cyan');
	}

	log('\n' + '='.repeat(60), 'cyan');
}

async function main() {
	try {
		const args = process.argv.slice(2);
		const releaseType = args[0] || 'patch';
		const shouldPush = args.includes('--push') || args.includes('-p');
		const useGitHubCLI = args.includes('--github-cli') || args.includes('--gh');

		if (!['patch', 'minor', 'major'].includes(releaseType)) {
			throw new Error('Invalid release type. Use: patch, minor, or major');
		}

		log('🚀 PayTracker Extension Release Preparation', 'bright');
		log(`📦 Release Type: ${releaseType}`, 'blue');
		if (useGitHubCLI) {
			log('🔧 Using GitHub CLI for release creation', 'blue');
		}
		log('─'.repeat(50), 'cyan');

		// Step 1: Validate prerequisites
		validatePrerequisites();

		// Step 2: Run tests
		runTests();

		// Step 3: Update version
		const newVersion = updateVersion(releaseType);

		// Step 4: Update changelog
		updateChangelog(newVersion);

		// Step 5: Build extension
		buildExtension();

		// Step 6: Create git tag
		createGitTag(newVersion, shouldPush);

		// Step 7: Generate release notes
		const releaseNotes = generateReleaseNotes(newVersion);

		// Step 8: Create GitHub release (if using GitHub CLI)
		if (useGitHubCLI || (shouldPush && checkGitHubCLI() && checkGitHubAuth())) {
			createGitHubRelease(newVersion, releaseNotes);
		}

		// Step 9: Print summary
		printSummary(newVersion, releaseType);
	} catch (error) {
		log(`\n❌ Release preparation failed: ${error.message}`, 'red');
		process.exit(1);
	}
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
	console.log(`
PayTracker Extension Release Preparation Script

Usage:
  node scripts/prepare-release.js [type] [options]

Release Types:
  patch     Increment patch version (1.0.0 → 1.0.1) [default]
  minor     Increment minor version (1.0.0 → 1.1.0)
  major     Increment major version (1.0.0 → 2.0.0)

Options:
  --push, -p        Push changes and tags to remote immediately
  --github-cli, --gh Use GitHub CLI to create release automatically
  --help, -h        Show this help message

Examples:
  node scripts/prepare-release.js patch
  node scripts/prepare-release.js minor --push
  node scripts/prepare-release.js major --github-cli
  node scripts/prepare-release.js patch --push --github-cli

What this script does:
  1. Validates prerequisites and git status
  2. Runs the complete test suite
  3. Updates version in package.json and manifest.json
  4. Updates CHANGELOG.md
  5. Builds the extension
  6. Creates git commit and tag
  7. Generates release notes
  8. Optionally creates GitHub release via CLI
  9. Provides next steps guidance

GitHub CLI Integration:
  - Automatically creates GitHub release
  - Uploads ZIP file as release asset
  - Generates release notes from changelog
  - Requires: gh auth login

After running this script:
  - Review and edit CHANGELOG.md
  - Test the extension locally
  - Push changes: git push --follow-tags (if not using --push)
  - GitHub Actions will create the release automatically (if not using --github-cli)
`);
	process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
