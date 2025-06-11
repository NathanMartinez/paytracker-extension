#!/usr/bin/env node

/**
 * Production Release Script for PayTracker Extension
 *
 * This script handles the complete production release workflow:
 * 1. Validates the codebase
 * 2. Updates versions
 * 3. Builds for production
 * 4. Packages the extension
 * 5. Generates release notes
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Color codes for console output
const colors = {
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	reset: '\x1b[0m',
	bold: '\x1b[1m'
};

// Utility functions
function log(message, color = 'reset') {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
	log(`\n${colors.bold}[${step}]${colors.reset} ${colors.cyan}${message}${colors.reset}`);
}

function logSuccess(message) {
	log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
	log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logWarning(message) {
	log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function runCommand(command, description) {
	try {
		log(`Running: ${command}`, 'blue');
		const output = execSync(command, {
			cwd: projectRoot,
			encoding: 'utf8',
			stdio: 'pipe'
		});
		logSuccess(description);
		return output;
	} catch (error) {
		logError(`Failed: ${description}`);
		logError(error.message);
		process.exit(1);
	}
}

function validateEnvironment() {
	logStep('1', 'Validating environment');

	// Check Node.js version
	const nodeVersion = process.version;
	const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
	if (majorVersion < 18) {
		logError(`Node.js 18+ required, found ${nodeVersion}`);
		process.exit(1);
	}
	logSuccess(`Node.js version: ${nodeVersion}`);

	// Check if git is available and repo is clean
	try {
		const gitStatus = runCommand('git status --porcelain', 'Checking git status');
		if (gitStatus.trim()) {
			logWarning('Working directory is not clean. Uncommitted changes detected:');
			console.log(gitStatus);
			logWarning('Consider committing changes before release.');
		} else {
			logSuccess('Working directory is clean');
		}
	} catch (error) {
		logWarning('Git not available or not in a git repository');
	}

	// Check if package.json exists
	const packageJsonPath = join(projectRoot, 'package.json');
	if (!existsSync(packageJsonPath)) {
		logError('package.json not found');
		process.exit(1);
	}
	logSuccess('package.json found');
}

function validateCodebase() {
	logStep('2', 'Validating codebase');

	runCommand('npm run lint', 'Code linting');
	runCommand('npm run type-check', 'TypeScript type checking');

	// Run tests if available
	try {
		runCommand('npm run test', 'Running tests');
	} catch (error) {
		logWarning('Tests not available or failed - continuing with caution');
	}
}

function updateVersions(versionType = 'patch') {
	logStep('3', `Updating versions (${versionType})`);

	// Get current version
	const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
	const currentVersion = packageJson.version;
	log(`Current version: ${currentVersion}`, 'blue');

	// Update package version
	runCommand(`npm version ${versionType} --no-git-tag-version`, 'Updating package.json version');

	// Update manifest version
	runCommand('npm run manifest:version', 'Syncing manifest.json version');

	// Get new version
	const updatedPackageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
	const newVersion = updatedPackageJson.version;
	logSuccess(`Version updated: ${currentVersion} → ${newVersion}`);

	return newVersion;
}

function buildForProduction() {
	logStep('4', 'Building for production');

	// Clean previous builds
	runCommand('npm run clean', 'Cleaning previous builds');

	// Build the extension
	runCommand('npm run build', 'Building extension');

	// Verify build output
	const buildPath = join(projectRoot, 'build');
	if (!existsSync(buildPath)) {
		logError('Build directory not found');
		process.exit(1);
	}

	const manifestPath = join(buildPath, 'manifest.json');
	if (!existsSync(manifestPath)) {
		logError('manifest.json not found in build directory');
		process.exit(1);
	}

	logSuccess('Production build completed');
}

function packageExtension(version) {
	logStep('5', 'Packaging extension');

	const zipFileName = `paytracker-extension-v${version}.zip`;
	const zipPath = join(projectRoot, zipFileName);

	// Remove existing zip if it exists
	if (existsSync(zipPath)) {
		runCommand(`rm -f "${zipPath}"`, 'Removing existing package');
	}

	// Create zip package
	runCommand(`cd build && zip -r "../${zipFileName}" . && cd ..`, 'Creating ZIP package');

	// Verify package was created
	if (!existsSync(zipPath)) {
		logError('Failed to create package');
		process.exit(1);
	}

	  // Get package size
	  const { statSync } = await import('fs');
	  const stats = statSync(zipPath);
	  const sizeKB = Math.round(stats.size / 1024);

	logSuccess(`Package created: ${zipFileName} (${sizeKB} KB)`);
	return zipFileName;
}

function generateReleaseNotes(version) {
	logStep('6', 'Generating release notes');

	const releaseNotesPath = join(projectRoot, `RELEASE_NOTES_v${version}.md`);
	const date = new Date().toISOString().split('T')[0];

	const releaseNotes = `# PayTracker Extension v${version}

**Release Date:** ${date}

## 📦 Installation

1. Download the \`paytracker-extension-v${version}.zip\` file
2. Extract the ZIP file
3. Open Chrome and navigate to \`chrome://extensions/\`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked" and select the extracted folder
6. The extension is now ready to use!

## 🆕 What's New in v${version}

<!-- Add release-specific changes here -->
- Bug fixes and improvements
- Enhanced performance
- Updated dependencies

## 🔧 Technical Details

- **Manifest Version:** 3
- **Minimum Chrome Version:** 88
- **Node.js Version Used:** ${process.version}
- **Build Date:** ${new Date().toISOString()}

## 🐛 Known Issues

- None reported

## 🆘 Support

If you encounter any issues:
1. Check the troubleshooting section in the README
2. Verify you're on a supported Chrome version (88+)
3. Try disabling other extensions temporarily
4. Contact the development team

---

**Checksums:**
- SHA256: \`(to be calculated)\`
- Size: \`(see package file)\`
`;

	writeFileSync(releaseNotesPath, releaseNotes);
	logSuccess(`Release notes generated: RELEASE_NOTES_v${version}.md`);
}

function createGitTag(version) {
	logStep('7', 'Creating git tag');

	try {
		// Check if we're in a git repository
		runCommand('git rev-parse --git-dir', 'Verifying git repository');

		// Create and push tag
		runCommand(`git add package.json static/manifest.json`, 'Staging version files');
		runCommand(`git commit -m "chore: release v${version}"`, 'Committing version update');
		runCommand(`git tag -a v${version} -m "Release v${version}"`, 'Creating git tag');

		logSuccess(`Git tag v${version} created`);
		log('Run "git push --follow-tags" to push the release', 'yellow');
	} catch (error) {
		logWarning('Git operations failed - skipping git tag creation');
	}
}

function printSummary(version, packageFile) {
	log('\n' + '='.repeat(60), 'green');
	log('🚀 RELEASE COMPLETED SUCCESSFULLY!', 'green');
	log('='.repeat(60), 'green');

	log(`\n📋 Release Summary:`, 'bold');
	log(`   Version: ${version}`, 'blue');
	log(`   Package: ${packageFile}`, 'blue');
	log(`   Build: build/`, 'blue');

	log(`\n📁 Generated Files:`, 'bold');
	log(`   • ${packageFile}`, 'green');
	log(`   • RELEASE_NOTES_v${version}.md`, 'green');
	log(`   • build/ directory`, 'green');

	log(`\n🚀 Next Steps:`, 'bold');
	log(`   1. Test the packaged extension locally`, 'yellow');
	log(`   2. Upload to Chrome Web Store (if applicable)`, 'yellow');
	log(`   3. Push git tags: git push --follow-tags`, 'yellow');
	log(`   4. Create GitHub release with ${packageFile}`, 'yellow');

	log(`\n✨ Happy releasing!`, 'magenta');
}

// Main execution
async function main() {
	const args = process.argv.slice(2);
	const versionType = args[0] || 'patch';

	if (!['patch', 'minor', 'major'].includes(versionType)) {
		logError('Invalid version type. Use: patch, minor, or major');
		process.exit(1);
	}

	log('🚀 PayTracker Extension Release Script', 'bold');
	log(`Version bump type: ${versionType}`, 'blue');

	try {
		validateEnvironment();
		validateCodebase();
		const version = updateVersions(versionType);
		buildForProduction();
		const packageFile = packageExtension(version);
		generateReleaseNotes(version);
		createGitTag(version);
		printSummary(version, packageFile);
	} catch (error) {
		logError('Release failed!');
		logError(error.message);
		process.exit(1);
	}
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
