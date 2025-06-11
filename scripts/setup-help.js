#!/usr/bin/env node

/**
 * Setup Guide Helper Script
 * Provides guidance on which setup documentation to use
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	magenta: '\x1b[35m'
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
		return null;
	}
}

function checkGitHubCLI() {
	const version = exec('gh --version', { silent: true });
	return version && version.includes('gh version');
}

function checkPrivateGuide() {
	return existsSync(join(projectRoot, 'PRIVATE_SETUP.md'));
}

function showWelcome() {
	log('🚀 PayTracker Extension Setup Helper', 'bright');
	log('═'.repeat(50), 'cyan');
	log('This tool helps you choose the best setup approach for your needs.', 'blue');
	log('');
}

function analyzeUserSituation() {
	const hasGitHubCLI = checkGitHubCLI();
	const hasPrivateGuide = checkPrivateGuide();
	const isMainDeveloper = process.env.USER === 'nathan' || process.env.USERNAME === 'Nathan';

	log('🔍 Analyzing your setup...', 'blue');
	log('');

	// Determine user type and recommend approach
	if (hasPrivateGuide && (isMainDeveloper || hasGitHubCLI)) {
		log('👨‍💻 MAIN DEVELOPER DETECTED', 'green');
		log('You have access to enhanced setup options!', 'green');
		log('');

		log('📖 Recommended Setup Guide:', 'yellow');
		log('• Use: PRIVATE_SETUP.md (enhanced guide with GitHub CLI)', 'cyan');
		log('• Features: One-command setup, automated releases, advanced configs', 'cyan');
		log(
			'• GitHub CLI: ' +
				(hasGitHubCLI ? '✅ Already installed' : '⚠️ Not installed (will be covered)'),
			hasGitHubCLI ? 'green' : 'yellow'
		);
		log('');

		log('🚀 Quick Start Commands:', 'yellow');
		log('• Setup verification: npm run verify-setup', 'cyan');
		log('• GitHub CLI check: npm run check-github', 'cyan');
		log('• Quick setup: Follow PRIVATE_SETUP.md Step 2', 'cyan');
	} else if (hasGitHubCLI) {
		log('🛠️ GITHUB CLI USER DETECTED', 'green');
		log('You can use streamlined setup commands!', 'green');
		log('');

		log('📖 Recommended Setup Guide:', 'yellow');
		log('• Use: GITHUB_SETUP.md (public guide)', 'cyan');
		log('• Focus on: GitHub CLI sections for faster setup', 'cyan');
		log('• Alternative: README.md for basic setup', 'cyan');
		log('');

		log('🚀 Quick Start Commands:', 'yellow');
		log('• Authenticate: gh auth login', 'cyan');
		log('• Create repo: gh repo create paytracker-extension --private --source=. --push', 'cyan');
		log('• Quick release: npm run release:cli', 'cyan');
	} else {
		log('👋 NEW USER / CONTRIBUTOR', 'blue');
		log("Welcome! We'll get you started with the standard approach.", 'blue');
		log('');

		log('📖 Recommended Setup Guide:', 'yellow');
		log('• Primary: README.md (comprehensive public guide)', 'cyan');
		log('• Detailed: GITHUB_SETUP.md (step-by-step instructions)', 'cyan');
		log('• Consider: Installing GitHub CLI for easier workflow', 'cyan');
		log('');

		log('🚀 Quick Start Commands:', 'yellow');
		log('• Setup check: npm run verify-setup', 'cyan');
		log('• Basic release: npm run release:patch', 'cyan');
		log('• Install GitHub CLI: brew install gh (macOS) or visit cli.github.com', 'cyan');
	}
}

function showAvailableGuides() {
	log('');
	log('📚 Available Documentation:', 'yellow');
	log('─'.repeat(40), 'cyan');

	const guides = [
		{
			file: 'README.md',
			title: 'Main Documentation',
			description: 'Complete project overview and basic setup',
			audience: 'All users',
			exists: existsSync(join(projectRoot, 'README.md'))
		},
		{
			file: 'GITHUB_SETUP.md',
			title: 'GitHub Setup Guide',
			description: 'Detailed GitHub repository and CI/CD setup',
			audience: 'Developers and contributors',
			exists: existsSync(join(projectRoot, 'GITHUB_SETUP.md'))
		},
		{
			file: 'PRIVATE_SETUP.md',
			title: 'Private Setup Guide',
			description: 'Enhanced setup with GitHub CLI and advanced options',
			audience: 'Main developers (private)',
			exists: checkPrivateGuide()
		},
		{
			file: 'CHANGELOG.md',
			title: 'Change Log',
			description: 'Version history and release notes',
			audience: 'All users',
			exists: existsSync(join(projectRoot, 'CHANGELOG.md'))
		}
	];

	for (const guide of guides) {
		const status = guide.exists ? '✅' : '❌';
		const color = guide.exists ? 'green' : 'red';
		log(`${status} ${guide.title.padEnd(25)} - ${guide.description}`, color);
		log(`   📁 ${guide.file.padEnd(25)} - For: ${guide.audience}`, 'cyan');
		log('');
	}
}

function showUtilityScripts() {
	log('🛠️ Available Utility Scripts:', 'yellow');
	log('─'.repeat(40), 'cyan');

	const scripts = [
		{
			command: 'npm run verify-setup',
			description: 'Complete setup verification and scoring',
			when: 'Run first to check your configuration'
		},
		{
			command: 'npm run check-github',
			description: 'GitHub CLI installation and authentication check',
			when: 'Run if you want to use GitHub CLI features'
		},
		{
			command: 'node scripts/prepare-release.js --help',
			description: 'Release preparation script help',
			when: 'Before creating your first release'
		},
		{
			command: 'npm run release:cli',
			description: 'Quick release with GitHub CLI',
			when: 'After GitHub CLI is set up'
		},
		{
			command: 'npm run validate:full',
			description: 'Complete validation (lint, test, build)',
			when: 'Before any release'
		}
	];

	for (const script of scripts) {
		log(`• ${script.command}`, 'cyan');
		log(`  ${script.description}`, 'blue');
		log(`  When: ${script.when}`, 'yellow');
		log('');
	}
}

function showRecommendedWorkflow() {
	log('🎯 Recommended Workflow:', 'yellow');
	log('─'.repeat(40), 'cyan');

	const hasPrivate = checkPrivateGuide();
	const hasGitHubCLI = checkGitHubCLI();

	if (hasPrivate) {
		log('1. 📖 Read: PRIVATE_SETUP.md for enhanced setup', 'cyan');
		log('2. 🔧 Run: npm run check-github (setup GitHub CLI)', 'cyan');
		log('3. ✅ Run: npm run verify-setup (verify everything)', 'cyan');
		log('4. 🚀 Create: gh repo create (one-command setup)', 'cyan');
		log('5. 📦 Release: npm run release:auto (automated release)', 'cyan');
	} else if (hasGitHubCLI) {
		log('1. 📖 Read: GITHUB_SETUP.md (focus on GitHub CLI sections)', 'cyan');
		log('2. 🔐 Run: gh auth login (authenticate)', 'cyan');
		log('3. ✅ Run: npm run verify-setup (verify setup)', 'cyan');
		log('4. 🏠 Create: gh repo create paytracker-extension --private --source=. --push', 'cyan');
		log('5. 📦 Release: npm run release:cli (CLI-powered release)', 'cyan');
	} else {
		log('1. 📖 Read: README.md and GITHUB_SETUP.md', 'cyan');
		log('2. ✅ Run: npm run verify-setup (check configuration)', 'cyan');
		log('3. 🌐 Create repository manually on GitHub.com', 'cyan');
		log('4. 🔗 Connect: git remote add origin <url>', 'cyan');
		log('5. 📦 Release: npm run release:patch (traditional release)', 'cyan');
		log('');
		log('💡 Consider installing GitHub CLI for an easier workflow:', 'yellow');
		log('   • macOS: brew install gh', 'cyan');
		log('   • Windows: winget install --id GitHub.cli', 'cyan');
		log('   • Linux: Check GITHUB_SETUP.md for instructions', 'cyan');
	}
}

function main() {
	showWelcome();
	analyzeUserSituation();
	showAvailableGuides();
	showUtilityScripts();
	showRecommendedWorkflow();

	log('');
	log('🎉 Ready to get started?', 'bright');
	log('Choose your preferred approach above and dive in!', 'green');
	log('');
	log('❓ Need help? Check the documentation or run the verification scripts.', 'blue');
	log('═'.repeat(50), 'cyan');
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
	console.log(`
PayTracker Extension Setup Helper

Usage:
  node scripts/setup-help.js [options]

Options:
  --help, -h    Show this help message

This script analyzes your environment and recommends the best
setup approach for the PayTracker Extension development workflow.

It checks for:
  • GitHub CLI installation
  • Available documentation
  • Your user profile
  • Development environment

And provides personalized recommendations for:
  • Which setup guide to use
  • What commands to run
  • Optimal workflow for your situation
`);
	process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
