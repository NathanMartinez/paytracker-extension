# Changelog

All notable changes to the PayTracker Transaction Extractor extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub Actions CI/CD pipeline for automated testing and releases
- Production build scripts with ZIP packaging
- Automated version synchronization between package.json and manifest.json
- Comprehensive README.md documentation

### Changed

- Updated favicon system with multiple sizes and formats
- Improved customer name display from "N/A" to "No customer selected"

## [1.0.0] - 2024-12-19

### Added

- **Core Features**

  - Smart transaction data extraction from PayTracker pages
  - Comprehensive DOM corruption detection and repair algorithms
  - Multi-method transaction ID extraction (href, TreeWalker, text content)
  - Advanced privacy protection with name anonymization
  - Real-time search and filtering across all transaction fields
  - Intelligent caching system with cross-mode data synchronization

- **User Interface**

  - Popup mode with auto-sizing container (200px-600px height)
  - Detached window mode for full-screen data management
  - Seamless mode switching with data preservation
  - Dark/light theme support with system preference detection
  - Material Design interface with Inter font

- **Data Management**

  - CSV export with proper escaping and formatting
  - Copy to clipboard functionality
  - Multi-layer caching with Chrome storage API
  - Cache management controls (force refresh, clear cache)
  - Privacy-aware export functions

- **Privacy Features**

  - Name privacy mode: "John Smith" → "John S."
  - Clover Customer replacement: "Clover Customer" → "Member, Individual"
  - Member account handling with special privacy rules
  - Instant privacy toggle updates in table display
  - Export privacy applies to both copy and CSV functions

- **Advanced Functionality**
  - Multi-tab PayTracker page detection
  - Instance management preventing duplicate windows
  - Toast notification system for user feedback
  - Excel-like table interaction with text selection
  - Compact/expanded view toggle in popup mode

### Technical Implementation

- **Architecture**

  - SvelteKit framework with TypeScript
  - Tailwind CSS for responsive design
  - Chrome Extensions Manifest V3
  - Vite build system with hot module replacement

- **Corruption Handling**

  - Pattern recognition for repeated character corruption
  - Character flooding detection and repair
  - Leading zero expansion normalization
  - Missing character reconstruction
  - Fallback extraction methods for edge cases

- **Performance Optimizations**
  - Efficient DOM querying with targeted selectors
  - Debounced search to prevent excessive filtering
  - Smart caching to reduce redundant extractions
  - Memory management with proper cleanup
  - Lazy loading and reactive updates

### Security & Privacy

- Local-only data processing (no external API calls)
- Chrome's secure storage APIs for caching
- Minimal permission requests (activeTab, scripting, storage, windows)
- Privacy-first design with user-controlled anonymization

### Browser Compatibility

- Chrome 88+ (primary target)
- Edge (Chromium-based)
- Brave (Chromium-based)
- Other Chromium-based browsers

### Known Issues

- None at release

### Migration Notes

- First release - no migration required

---

## Release Types

### [Major] - Breaking Changes

- Major feature additions that change core functionality
- Breaking changes to existing APIs or user workflows
- Significant architectural changes

### [Minor] - New Features

- New features that don't break existing functionality
- Improvements to existing features
- Performance enhancements

### [Patch] - Bug Fixes

- Bug fixes and minor improvements
- Security patches
- Documentation updates

---

## Versioning Strategy

- **Major (X.0.0)**: Breaking changes, major feature additions
- **Minor (0.X.0)**: New features, improvements, non-breaking changes
- **Patch (0.0.X)**: Bug fixes, security patches, documentation

## Links

- [GitHub Repository](https://github.com/your-org/paytracker-extension)
- [Release Notes](https://github.com/your-org/paytracker-extension/releases)
- [Issue Tracker](https://github.com/your-org/paytracker-extension/issues)
