#!/usr/bin/env node

/**
 * Setup Verification Script
 * Verifies that the PayTracker extension is properly configured for CI/CD and releases
 */

import { readFileSync, existsSync } from 'fs';
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
		return null;
	}
}

function checkFile(filePath, description) {
	const fullPath = join(projectRoot, filePath);
	const exists = existsSync(fullPath);

	if (exists) {
		log(`✅ ${description}`, 'green');
		return true;
	} else {
		log(`❌ ${description}`, 'red');
		return false;
	}
}

function checkJsonFile(filePath, description, requiredFields = []) {
	const fullPath = join(projectRoot, filePath);

	if (!existsSync(fullPath)) {
		log(`❌ ${description} - File not found`, 'red');
		return false;
	}

	try {
		const content = JSON.parse(readFileSync(fullPath, 'utf8'));
		let valid = true;

		for (const field of requiredFields) {
			if (!content[field]) {
				log(`❌ ${description} - Missing field: ${field}`, 'red');
				valid = false;
			}
		}

		if (valid) {
			log(`✅ ${description}`, 'green');
		}

		return valid;
	} catch (error) {
		log(`❌ ${description} - Invalid JSON: ${error.message}`, 'red');
		return false;
	}
}

function checkGitSetup() {
	log('\n📂 Git Repository Setup', 'blue');
	log('─'.repeat(40), 'cyan');

	let score = 0;
	let total = 0;

	// Check if git is initialized
	total++;
	if (exec('git status', { silent: true })) {
		log('✅ Git repository initialized', 'green');
		score++;
	} else {
		log('❌ Git repository not initialized', 'red');
		log('   Run: git init', 'yellow');
	}

	// Check for remote origin
	total++;
	const remotes = exec('git remote -v', { silent: true });
	if (remotes && remotes.includes('origin')) {
		const originLines = remotes.split('\n').filter((line) => line.includes('origin'));
		const originUrl = originLines[0];

		if (originUrl.includes('NathanMartinez/paytracker-extension')) {
			// Check if it's HTTPS or SSH format
			if (originUrl.includes('https://github.com/') || originUrl.includes('git@github.com:')) {
				log('✅ GitHub remote configured correctly', 'green');
				const urlType = originUrl.includes('https://') ? 'HTTPS' : 'SSH';
				log(`   Using ${urlType} URL format`, 'cyan');
				score++;
			} else {
				log('⚠️  GitHub remote URL format unusual', 'yellow');
				log(`   Current: ${originUrl}`, 'yellow');
				score += 0.5;
			}
		} else {
			log('❌ GitHub remote URL incorrect', 'red');
			log(`   Current: ${originUrl}`, 'red');
			log(
				'   Expected HTTPS: https://github.com/NathanMartinez/paytracker-extension.git',
				'yellow'
			);
			log('   Expected SSH: git@github.com:NathanMartinez/paytracker-extension.git', 'yellow');
			log('   Fix with: git remote set-url origin <CORRECT_URL>', 'yellow');
		}
	} else {
		log('❌ GitHub remote not configured', 'red');
		log(
			'   HTTPS: git remote add origin https://github.com/NathanMartinez/paytracker-extension.git',
			'yellow'
		);
		log(
			'   SSH: git remote add origin git@github.com:NathanMartinez/paytracker-extension.git',
			'yellow'
		);
	}

	// Check for uncommitted changes
	total++;
	const status = exec('git status --porcelain', { silent: true });
	if (!status || status.trim() === '') {
		log('✅ No uncommitted changes', 'green');
		score++;
	} else {
		log('⚠️  Uncommitted changes detected', 'yellow');
		log('   Consider committing before release', 'yellow');
		score += 0.5; // Half credit
	}

	// Check current branch
	total++;
	const branch = exec('git branch --show-current', { silent: true });
	if (branch && (branch.trim() === 'main' || branch.trim() === 'master')) {
		log('✅ On main/master branch', 'green');
		score++;
	} else {
		log(`⚠️  On branch: ${branch ? branch.trim() : 'unknown'}`, 'yellow');
		log('   Consider switching to main branch for releases', 'yellow');
		score += 0.5;
	}

	return { score, total };
}

function checkProjectFiles() {
	log('\n📄 Project Files', 'blue');
	log('─'.repeat(40), 'cyan');

	let score = 0;
	let total = 0;

	const files = [
		['package.json', 'Package configuration'],
		['static/manifest.json', 'Chrome extension manifest'],
		['src/app.html', 'Main application template'],
		['src/routes/+page.svelte', 'Main page component'],
		['vite.config.ts', 'Build configuration'],
		['tsconfig.json', 'TypeScript configuration'],
		['tailwind.config.ts', 'Tailwind CSS configuration'],
		['.eslintrc.cjs', 'ESLint configuration'],
		['.prettierrc', 'Prettier configuration'],
		['README.md', 'Documentation'],
		['CHANGELOG.md', 'Version history']
	];

	for (const [file, description] of files) {
		total++;
		if (checkFile(file, description)) {
			score++;
		}
	}

	return { score, total };
}

function checkPackageJson() {
	log('\n📦 Package.json Configuration', 'blue');
	log('─'.repeat(40), 'cyan');

	let score = 0;
	let total = 0;

	const requiredFields = ['name', 'version', 'description', 'repository', 'scripts'];
	const requiredScripts = [
		'build',
		'build:production',
		'test',
		'lint',
		'type-check',
		'release:patch',
		'release:minor',
		'release:major',
		'package'
	];

	total++;
	if (checkJsonFile('package.json', 'Package.json structure', requiredFields)) {
		score++;

		try {
			const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

			// Check repository URL
			total++;
			if (
				pkg.repository &&
				pkg.repository.url &&
				pkg.repository.url.includes('NathanMartinez/paytracker-extension')
			) {
				log('✅ Repository URL correct', 'green');
				score++;
			} else {
				log('❌ Repository URL incorrect or missing', 'red');
			}

			// Check required scripts
			let scriptScore = 0;
			for (const script of requiredScripts) {
				total++;
				if (pkg.scripts && pkg.scripts[script]) {
					log(`✅ Script: ${script}`, 'green');
					score++;
					scriptScore++;
				} else {
					log(`❌ Missing script: ${script}`, 'red');
				}
			}
		} catch (error) {
			log('❌ Error reading package.json', 'red');
		}
	}

	return { score, total };
}

function checkManifest() {
	log('\n🔧 Chrome Extension Manifest', 'blue');
	log('─'.repeat(40), 'cyan');

	let score = 0;
	let total = 0;

	const requiredFields = ['name', 'version', 'manifest_version', 'permissions'];

	total++;
	if (checkJsonFile('static/manifest.json', 'Manifest structure', requiredFields)) {
		score++;

		try {
			const manifest = JSON.parse(readFileSync(join(projectRoot, 'static/manifest.json'), 'utf8'));
			const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

			// Check manifest version
			total++;
			if (manifest.manifest_version === 3) {
				log('✅ Manifest V3 format', 'green');
				score++;
			} else {
				log('❌ Should use Manifest V3', 'red');
			}

			// Check version sync
			total++;
			if (manifest.version === pkg.version) {
				log('✅ Version matches package.json', 'green');
				score++;
			} else {
				log(`❌ Version mismatch: manifest(${manifest.version}) vs package(${pkg.version})`, 'red');
				log('   Run: npm run manifest:version', 'yellow');
			}

			// Check icons
			total++;
			if (manifest.icons && Object.keys(manifest.icons).length > 0) {
				log('✅ Icons configured', 'green');
				score++;
			} else {
				log('⚠️  No icons configured', 'yellow');
				score += 0.5;
			}

			// Check permissions
			total++;
			if (manifest.permissions && manifest.permissions.length > 0) {
				log('✅ Permissions configured', 'green');
				score++;
			} else {
				log('❌ No permissions configured', 'red');
			}
		} catch (error) {
			log('❌ Error reading manifest.json', 'red');
		}
	}

	return { score, total };
}

function checkScripts() {
	log('\n📜 Release Scripts', 'blue');
	log('─'.repeat(40), 'cyan');

	let score = 0;
	let total = 0;

	const scripts = [
		['scripts/update-manifest-version.js', 'Version synchronization script'],
		['scripts/validate-manifest.js', 'Manifest validation script'],
		['scripts/prepare-release.js', 'Release preparation script']
	];

	for (const [script, description] of scripts) {
		total++;
		if (checkFile(script, description)) {
			score++;
		}
	}

	return { score, total };
}

function checkGithubActions() {
	log('\n⚙️  GitHub Actions', 'blue');
	log('─'.repeat(40), 'cyan');

	let score = 0;
	let total = 0;

	total++;
	if (checkFile('.github/workflows/ci-cd.yml', 'CI/CD workflow')) {
		score++;

		try {
			const workflow = readFileSync(join(projectRoot, '.github/workflows/ci-cd.yml'), 'utf8');

			// Check for required jobs
			const requiredJobs = ['validate', 'test', 'build', 'package', 'release'];
			for (const job of requiredJobs) {
				total++;
				if (workflow.includes(`${job}:`)) {
					log(`✅ Job: ${job}`, 'green');
					score++;
				} else {
					log(`❌ Missing job: ${job}`, 'red');
				}
			}

			// Check for triggers
			const triggers = ['push:', 'tags:', 'workflow_dispatch:'];
			let triggerScore = 0;
			for (const trigger of triggers) {
				total++;
				if (workflow.includes(trigger)) {
					log(`✅ Trigger: ${trigger.replace(':', '')}`, 'green');
					score++;
					triggerScore++;
				} else {
					log(`❌ Missing trigger: ${trigger.replace(':', '')}`, 'red');
				}
			}
		} catch (error) {
			log('❌ Error reading workflow file', 'red');
		}
	}

	return { score, total };
}

function checkDependencies() {
	log('\n📚 Dependencies', 'blue');
	log('─'.repeat(40), 'cyan');

	let score = 0;
	let total = 0;

	// Check if node_modules exists
	total++;
	if (checkFile('node_modules', 'Dependencies installed')) {
		score++;
	} else {
		log('   Run: npm install', 'yellow');
	}

	// Check Node.js version
	total++;
	const nodeVersion = process.version;
	const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
	if (majorVersion >= 18) {
		log(`✅ Node.js version: ${nodeVersion}`, 'green');
		score++;
	} else {
		log(`❌ Node.js version too old: ${nodeVersion} (requires 18+)`, 'red');
	}

	// Check npm version
	total++;
	const npmVersion = exec('npm --version', { silent: true });
	if (npmVersion) {
		const npmMajor = parseInt(npmVersion.trim().split('.')[0]);
		if (npmMajor >= 8) {
			log(`✅ npm version: ${npmVersion.trim()}`, 'green');
			score++;
		} else {
			log(`❌ npm version too old: ${npmVersion.trim()} (requires 8+)`, 'red');
		}
	} else {
		log('❌ npm not found', 'red');
	}

	return { score, total };
}

function checkBuildProcess() {
	log('\n🏗️  Build Process', 'blue');
	log('─'.repeat(40), 'cyan');

	let score = 0;
	let total = 0;

	// Test build command
	total++;
	log('Testing build process...', 'cyan');
	const buildResult = exec('npm run build', { silent: true });
	if (buildResult !== null) {
		log('✅ Build command works', 'green');
		score++;

		// Check if build directory was created
		total++;
		if (checkFile('build', 'Build directory created')) {
			score++;

			// Check build contents
			total++;
			if (checkFile('build/manifest.json', 'Build contains manifest.json')) {
				score++;
			}
		}
	} else {
		log('❌ Build command failed', 'red');
		log('   Try: npm install && npm run build', 'yellow');
	}

	return { score, total };
}

function printSummary(results) {
	const totalScore = results.reduce((sum, result) => sum + result.score, 0);
	const totalPossible = results.reduce((sum, result) => sum + result.total, 0);
	const percentage = Math.round((totalScore / totalPossible) * 100);

	log('\n' + '='.repeat(60), 'cyan');
	log('📊 SETUP VERIFICATION SUMMARY', 'bright');
	log('='.repeat(60), 'cyan');

	log(`\n🎯 Overall Score: ${totalScore}/${totalPossible} (${percentage}%)`, 'bright');

	if (percentage >= 90) {
		log('🎉 Excellent! Your setup is ready for production releases.', 'green');
	} else if (percentage >= 75) {
		log('👍 Good setup! Address the remaining issues for optimal results.', 'yellow');
	} else if (percentage >= 50) {
		log('⚠️  Setup needs work. Please fix the identified issues.', 'yellow');
	} else {
		log('❌ Setup incomplete. Please follow the setup guide carefully.', 'red');
	}

	log('\n📋 Next Steps:', 'blue');

	if (percentage < 100) {
		log('1. Fix the issues marked with ❌ above', 'cyan');
		log('2. Re-run this script to verify fixes', 'cyan');
	}

	if (percentage >= 75) {
		log('3. Create your first release:', 'cyan');
		log('   npm run release:patch', 'cyan');
		log('4. Push to GitHub:', 'cyan');
		log('   git push --follow-tags', 'cyan');
		log('5. Check GitHub Actions for automated release', 'cyan');
	}

	log('\n🔗 Useful Commands:', 'blue');
	log('• Test everything: npm run validate:full', 'cyan');
	log('• Prepare release: node scripts/prepare-release.js patch', 'cyan');
	log('• View help: node scripts/prepare-release.js --help', 'cyan');
	log('• Setup guide: cat GITHUB_SETUP.md', 'cyan');
	log('• Check remotes: git remote -v', 'cyan');
	log('• Fix remote URL: git remote set-url origin <URL>', 'cyan');

	log('\n' + '='.repeat(60), 'cyan');
}

function main() {
	log('🔍 PayTracker Extension Setup Verification', 'bright');
	log('Checking configuration for CI/CD and automated releases...', 'cyan');

	const results = [
		checkGitSetup(),
		checkProjectFiles(),
		checkPackageJson(),
		checkManifest(),
		checkScripts(),
		checkGithubActions(),
		checkDependencies(),
		checkBuildProcess()
	];

	printSummary(results);
}

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
	console.log(`
PayTracker Extension Setup Verification

Usage:
  node scripts/verify-setup.js [options]

Options:
  --help, -h    Show this help message

This script checks:
  ✅ Git repository configuration
  ✅ Project files and structure
  ✅ Package.json configuration
  ✅ Chrome extension manifest
  ✅ Release scripts
  ✅ GitHub Actions workflow
  ✅ Dependencies and versions
  ✅ Build process functionality

After running this script, you'll know exactly what needs to be fixed
before creating your first automated release.
`);
	process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
