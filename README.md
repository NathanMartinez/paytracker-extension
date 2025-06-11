# PayTracker Extension 📊

A Chrome extension for extracting transaction data from PayTracker SaaS platform with advanced privacy features.

[![CI/CD Pipeline](https://github.com/NathanMartinez/paytracker-extension/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/NathanMartinez/paytracker-extension/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-brightgreen)](https://chrome.google.com/webstore)

## ✨ Features

- **Transaction Data Extraction**: Seamlessly extract transaction data from PayTracker
- **Privacy First**: All data processing happens locally - no external servers
- **Export Options**: Multiple export formats (CSV, JSON, Excel)
- **Real-time Processing**: Instant data extraction with live preview
- **Secure Storage**: Local browser storage with encryption
- **User-friendly Interface**: Clean, intuitive popup interface

## 📦 Installation

### From Chrome Web Store (Recommended)

_Coming soon - extension pending review_

### Manual Installation (Developer Mode)

1. **Download the latest release**:

   - Go to [Releases](https://github.com/NathanMartinez/paytracker-extension/releases)
   - Download the latest `paytracker-extension-vX.X.X.zip` file

2. **Install in Chrome**:

   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Extract the downloaded ZIP file and select the extracted folder
   - The extension should now appear in your extensions list

3. **Pin the Extension** (Optional):
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "PayTracker Transaction Extractor" and click the pin icon

## 🚀 Usage

1. **Navigate to PayTracker**: Open your PayTracker dashboard in Chrome
2. **Click the Extension Icon**: Click the PayTracker extension icon in your toolbar
3. **Extract Data**: Click "Extract Transactions" to scan the current page
4. **Review & Export**: Review the extracted data and choose your export format
5. **Download**: Your transaction data will be downloaded automatically

### Supported Pages

- Transaction lists and reports
- Individual transaction details
- Batch transaction processing
- Historical data views

## 🛠️ Development

### Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Chrome**: Latest version for testing

### Setup

```bash
# Clone the repository
git clone https://github.com/NathanMartinez/paytracker-extension.git
cd paytracker-extension

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Commands

```bash
# Development with hot reload
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Linting and formatting
npm run lint
npm run lint:fix
npm run format

# Type checking
npm run type-check

# Build for production
npm run build
npm run build:production

# Package for distribution
npm run package

# Setup verification
npm run verify-setup
npm run check-github
```

### Project Structure

```
paytracker-extension/
├── src/                    # Source code
│   ├── lib/               # Shared utilities and components
│   ├── routes/            # SvelteKit routes (popup pages)
│   └── app.html           # Main HTML template
├── static/                # Static assets
│   ├── manifest.json      # Chrome extension manifest
│   └── icons/             # Extension icons
├── build/                 # Built extension (generated)
├── scripts/               # Build and utility scripts
├── .github/               # GitHub Actions workflows
└── tests/                 # Test files
```

## 🚀 Setting Up GitHub Repository & Releases

**Note**: For detailed setup instructions including GitHub CLI usage and advanced configurations, developers should refer to the private setup documentation.

### 1. Create New GitHub Repository

```bash
# Initialize git repository (if not already done)
git init

# Add all files to staging
git add .

# Create initial commit
git commit -m "Initial commit: PayTracker Extension v1.0.0"

# Add remote repository
# HTTPS (recommended for most users):
git remote add origin https://github.com/NathanMartinez/paytracker-extension.git

# Set main branch and push
git branch -M main
git push -u origin main
```

### Quick Setup with GitHub CLI (Optional)

If you have GitHub CLI installed, you can streamline the process:

```bash
# Authenticate with GitHub
gh auth login

# Create repository and push in one command
gh repo create paytracker-extension --private --source=. --remote=origin --push
```

### 2. Configure Repository Settings

1. **Go to your GitHub repository**
2. **Settings > Actions > General**:
   - Enable "Allow all actions and reusable workflows"
   - Set workflow permissions to "Read and write permissions"
3. **Settings > Pages** (optional):
   - Enable GitHub Pages for documentation

### 3. Set Up Automated Releases

The repository includes automated release workflows that will:

- Run tests and build the extension
- Create versioned releases
- Generate release notes
- Upload ZIP files for download

#### Automatic Releases (Recommended)

**Patch Release** (1.0.0 → 1.0.1):

```bash
git commit -m "fix: resolve transaction ID corruption issue"
git push origin main
```

**Minor Release** (1.0.0 → 1.1.0):

```bash
git commit -m "feat: add new export format support"
git push origin main
```

**Major Release** (1.0.0 → 2.0.0):

```bash
git commit -m "feat: redesign UI

BREAKING CHANGE: removed legacy export format"
git push origin main
```

#### GitHub CLI Releases (Fastest)

For developers with GitHub CLI configured:

```bash
# Quick patch release with automatic GitHub release
npm run release:cli

# Minor release
npm run release:cli-minor

# Fully automated release (build, tag, push, create GitHub release)
npm run release:auto
```

#### Manual Releases

**Using npm scripts**:

```bash
# Patch release
npm run release:patch

# Minor release
npm run release:minor

# Major release
npm run release:major

# Push tags to trigger GitHub release
git push --follow-tags
```

**Using GitHub Actions**:

1. Go to **Actions** tab in your repository
2. Select **CI/CD Pipeline** workflow
3. Click **Run workflow**
4. Choose release type (patch/minor/major)
5. Click **Run workflow**

### 4. Release ZIP Files

After a successful release, GitHub will automatically:

1. **Create a Git tag** (e.g., `v1.0.0`)
2. **Build the extension** and run all tests
3. **Package the extension** into a ZIP file
4. **Create a GitHub Release** with:
   - Release notes
   - Installation instructions
   - Downloadable ZIP file
   - Changelog information

Users can then:

- Go to the **Releases** section of your repository
- Download the latest `paytracker-extension-vX.X.X.zip`
- Install manually in Chrome Developer mode

## 📋 Release Checklist

Before creating a release:

- [ ] All tests passing
- [ ] No ESLint errors
- [ ] Version bumped in `package.json`
- [ ] `CHANGELOG.md` updated
- [ ] Icons and manifest validated
- [ ] Extension tested in Chrome
- [ ] Security audit passed

## 🔧 Configuration

### Environment Variables

Create a `.env` file for local development:

```env
# Development settings
NODE_ENV=development
CHROME_EXTENSION_ID=local-development

# Build settings
BUILD_TARGET=chrome
MANIFEST_VERSION=3
```

### Manifest Configuration

The extension manifest is automatically generated from `static/manifest.json`. Key settings:

- **Permissions**: Minimal required permissions for PayTracker access
- **Content Security Policy**: Strict CSP for security
- **Host Permissions**: Limited to necessary domains
- **Icons**: Multiple sizes for different contexts

## 🛡️ Security & Privacy

- **Local Processing**: All data extraction happens locally in your browser
- **No External Servers**: No data is sent to external services
- **Minimal Permissions**: Only requests permissions necessary for functionality
- **Secure Storage**: Uses Chrome's secure storage APIs
- **Content Security Policy**: Strict CSP prevents code injection

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run CI tests (used in GitHub Actions)
npm run test:ci
```

### Test Structure

- **Unit Tests**: Component and utility function tests
- **Integration Tests**: Full workflow testing
- **E2E Tests**: Chrome extension functionality tests
- **Security Tests**: Permission and CSP validation

## 📈 Performance

The extension is optimized for:

- **Fast Loading**: Minimal bundle size with code splitting
- **Memory Efficiency**: Efficient DOM parsing and data extraction
- **Background Processing**: Non-blocking data processing
- **Caching**: Smart caching of extracted data

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and add tests
4. **Run the test suite**: `npm test`
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described
- Ensure all CI checks pass

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed release history.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Issues**: [GitHub Issues](https://github.com/NathanMartinez/paytracker-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/NathanMartinez/paytracker-extension/discussions)
- **Documentation**: [Wiki](https://github.com/NathanMartinez/paytracker-extension/wiki)

## 🗺️ Roadmap

- [ ] Chrome Web Store publication
- [ ] Firefox extension support
- [ ] Advanced filtering options
- [ ] Bulk export improvements
- [ ] Integration with popular accounting software
- [ ] Multi-language support

---

**Made with ❤️ by the PayTracker Development Team**
