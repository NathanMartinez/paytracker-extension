#!/usr/bin/env node

/**
 * GitHub CLI Setup Verification Script
 * Checks if GitHub CLI is installed, authenticated, and configured properly
 */

import { execSync } from 'child_process';

// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
	try {
		return execSync(command, {
			encoding: 'utf8',
			stdio: options.silent ? 'pipe' : 'inherit',
			...options
		});
	} catch (error) {
		return null;
	}
}

function checkGitHubCLIInstallation() {
	log('🔍 Checking GitHub CLI Installation...', 'blue');

	const version = exec('gh --version', { silent: true });
	if (version) {
		const versionLine = version.split('\n')[0];
		log(`✅ GitHub CLI installed: ${versionLine}`, 'green');
		return true;
	} else {
		log('❌ GitHub CLI not installed', 'red');
		log('\n📦 Installation Instructions:', 'yellow');
		log('macOS (Homebrew): brew install gh', 'cyan');
		log('Windows (winget): winget install --id GitHub.cli', 'cyan');
		log(
			'Ubuntu/Debian: curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && sudo apt update && sudo apt install gh',
			'cyan'
		);
		log('More info: https://cli.github.com/', 'cyan');
		return false;
	}
}

function checkAuthentication() {
	log('\n🔐 Checking GitHub Authentication...', 'blue');

	const authStatus = exec('gh auth status', { silent: true });
	if (authStatus && authStatus.includes('Logged in to github.com')) {
		log('✅ Authenticated with GitHub', 'green');

		// Extract username if possible
		const userMatch = authStatus.match(/account ([^\s]+)/);
		if (userMatch) {
			log(`   Account: ${userMatch[1]}`, 'cyan');
		}

		// Check token scopes
		if (authStatus.includes('Token scopes:')) {
			const scopesMatch = authStatus.match(/Token scopes: (.+)/);
			if (scopesMatch) {
				log(`   Scopes: ${scopesMatch[1]}`, 'cyan');
			}
		}

		return true;
	} else {
		log('❌ Not authenticated with GitHub', 'red');
		log('\n🔑 Authentication Instructions:', 'yellow');
		log('1. Run: gh auth login', 'cyan');
		log('2. Choose: GitHub.com', 'cyan');
		log('3. Choose: HTTPS', 'cyan');
		log('4. Choose: Yes (authenticate Git with GitHub credentials)', 'cyan');
		log('5. Choose: Login with a web browser', 'cyan');
		log('6. Follow browser prompts to complete authentication', 'cyan');
		return false;
	}
}

function checkRepositoryAccess() {
	log('\n🏠 Checking Repository Access...', 'blue');

	// First check if we can view the repository
	const repoInfo = exec('gh repo view NathanMartinez/paytracker-extension', { silent: true });
	if (repoInfo) {
		log('✅ Can access paytracker-extension repository', 'green');

		// Extract some basic info
		if (repoInfo.includes('name:')) {
			const nameMatch = repoInfo.match(/name:\s+(.+)/);
			if (nameMatch) {
				log(`   Repository: ${nameMatch[1]}`, 'cyan');
			}
		}

		if (repoInfo.includes('visibility:')) {
			const visMatch = repoInfo.match(/visibility:\s+(.+)/);
			if (visMatch) {
				log(`   Visibility: ${visMatch[1]}`, 'cyan');
			}
		}

		return true;
	} else {
		log('❌ Cannot access repository', 'red');
		log('   This could mean:', 'yellow');
		log("   • Repository doesn't exist yet", 'yellow');
		log('   • No access permissions', 'yellow');
		log('   • Authentication issue', 'yellow');
		return false;
	}
}

function checkRequiredScopes() {
	log('\n🔑 Checking Required Token Scopes...', 'blue');

	const authStatus = exec('gh auth status', { silent: true });
	if (!authStatus) {
		log('❌ Cannot check scopes - not authenticated', 'red');
		return false;
	}

	const requiredScopes = ['repo', 'workflow'];
	const optionalScopes = ['write:packages', 'delete:packages'];

	let hasAllRequired = true;

	// Check required scopes
	for (const scope of requiredScopes) {
		if (authStatus.includes(scope)) {
			log(`✅ Required scope: ${scope}`, 'green');
		} else {
			log(`❌ Missing required scope: ${scope}`, 'red');
			hasAllRequired = false;
		}
	}

	// Check optional scopes
	for (const scope of optionalScopes) {
		if (authStatus.includes(scope)) {
			log(`✅ Optional scope: ${scope}`, 'green');
		} else {
			log(`⚠️  Optional scope missing: ${scope}`, 'yellow');
		}
	}

	if (!hasAllRequired) {
		log('\n🔄 To fix scope issues:', 'yellow');
		log('1. Run: gh auth refresh --scopes repo,workflow,write:packages', 'cyan');
		log('2. Or re-authenticate: gh auth login --scopes repo,workflow,write:packages', 'cyan');
	}

	return hasAllRequired;
}

function testBasicCommands() {
	log('\n🧪 Testing Basic GitHub CLI Commands...', 'blue');

	const tests = [
		{
			command: 'gh api user',
			description: 'User API access',
			required: true
		},
		{
			command: 'gh repo list --limit 1',
			description: 'Repository listing',
			required: true
		},
		{
			command: 'gh workflow list --repo NathanMartinez/paytracker-extension',
			description: 'Workflow access',
			required: false
		},
		{
			command: 'gh release list --repo NathanMartinez/paytracker-extension --limit 1',
			description: 'Release management',
			required: false
		}
	];

	let passedTests = 0;
	let totalTests = tests.length;

	for (const test of tests) {
		const result = exec(test.command, { silent: true });
		if (result) {
			log(`✅ ${test.description}`, 'green');
			passedTests++;
		} else {
			if (test.required) {
				log(`❌ ${test.description} (required)`, 'red');
			} else {
				log(`⚠️  ${test.description} (optional)`, 'yellow');
				passedTests += 0.5; // Half credit for optional tests
			}
		}
	}

	return { passed: passedTests, total: totalTests };
}

function showQuickCommands() {
	log('\n🚀 Useful GitHub CLI Commands for PayTracker Extension:', 'blue');
	log('─'.repeat(60), 'cyan');

	const commands = [
		['gh repo view', 'View repository information'],
		['gh repo create paytracker-extension --private', 'Create new private repository'],
		['gh release create v1.0.0 --generate-notes', 'Create a new release'],
		['gh release list', 'List all releases'],
		['gh workflow list', 'List repository workflows'],
		['gh run list', 'List workflow runs'],
		['gh run watch', 'Watch current workflow run'],
		['gh issue list', 'List repository issues'],
		['gh pr list', 'List pull requests'],
		['gh secret list', 'List repository secrets']
	];

	for (const [command, description] of commands) {
		log(`• ${command.padEnd(40)} - ${description}`, 'cyan');
	}
}

function printSummary(checks) {
	const totalScore = checks.reduce((sum, check) => sum + (check.passed ? 1 : 0), 0);
	const totalPossible = checks.length;
	const percentage = Math.round((totalScore / totalPossible) * 100);

	log('\n' + '='.repeat(60), 'cyan');
	log('📊 GITHUB CLI VERIFICATION SUMMARY', 'bright');
	log('='.repeat(60), 'cyan');

	log(`\n🎯 Overall Score: ${totalScore}/${totalPossible} (${percentage}%)`, 'bright');

	if (percentage === 100) {
		log('🎉 Perfect! GitHub CLI is fully configured and ready to use.', 'green');
		log('You can now use commands like:', 'green');
		log('• npm run release:cli', 'cyan');
		log('• node scripts/prepare-release.js patch --github-cli', 'cyan');
	} else if (percentage >= 75) {
		log('👍 Good setup! GitHub CLI is mostly ready.', 'yellow');
		log('Address any remaining issues for optimal experience.', 'yellow');
	} else if (percentage >= 50) {
		log('⚠️  Partial setup. GitHub CLI needs more configuration.', 'yellow');
	} else {
		log('❌ GitHub CLI setup incomplete.', 'red');
		log('Please follow the instructions above to set it up properly.', 'red');
	}

	log('\n📋 Next Steps:', 'blue');
	if (percentage < 100) {
		log('1. Fix the issues marked with ❌ above', 'cyan');
		log('2. Re-run this script to verify fixes: npm run check-github', 'cyan');
	}

	if (percentage >= 75) {
		log('3. Try creating a test release:', 'cyan');
		log('   node scripts/prepare-release.js patch --github-cli', 'cyan');
	}

	log('\n🔗 Resources:', 'blue');
	log('• GitHub CLI Manual: https://cli.github.com/manual/', 'cyan');
	log('• Authentication Guide: https://cli.github.com/manual/gh_auth_login', 'cyan');
	log('• Repository Commands: https://cli.github.com/manual/gh_repo', 'cyan');

	log('\n' + '='.repeat(60), 'cyan');
}

function main() {
	log('🔍 GitHub CLI Setup Verification', 'bright');
	log('Checking GitHub CLI installation, authentication, and permissions...', 'cyan');
	log('─'.repeat(60), 'cyan');

	const checks = [];

	// Run all checks
	checks.push({
		name: 'Installation',
		passed: checkGitHubCLIInstallation()
	});

	if (checks[0].passed) {
		checks.push({
			name: 'Authentication',
			passed: checkAuthentication()
		});

		if (checks[1].passed) {
			checks.push({
				name: 'Repository Access',
				passed: checkRepositoryAccess()
			});

			checks.push({
				name: 'Token Scopes',
				passed: checkRequiredScopes()
			});

			const testResults = testBasicCommands();
			checks.push({
				name: 'Command Tests',
				passed: testResults.passed >= testResults.total * 0.8
			});
		}
	}

	// Show useful commands regardless of setup status
	showQuickCommands();

	// Print final summary
	printSummary(checks);
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
	console.log(`
GitHub CLI Setup Verification Script

Usage:
  node scripts/check-github-cli.js [options]

Options:
  --help, -h    Show this help message

This script checks:
  ✅ GitHub CLI installation
  ✅ GitHub authentication status
  ✅ Repository access permissions
  ✅ Required token scopes
  ✅ Basic command functionality

After running this script, you'll know if GitHub CLI is properly
configured for the PayTracker Extension release workflow.
`);
	process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
