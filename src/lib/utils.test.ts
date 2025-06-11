import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	formatCustomerName,
	escapeCSVValue,
	copyToClipboard,
	generateCSV,
	downloadCSV,
	filterTransactions,
	getSystemTheme,
	applyTheme,
	getSetting,
	setSetting,
	setInstanceMarker,
	clearInstanceMarker,
	checkInstanceExists,
	findExistingDetachedWindow,
	isValidTransactionData,
	sanitizeTransactionData,
	createToastMessage,
	formatCacheAge,
	handleError,
	STORAGE_KEYS,
	isDetachedWindow,
	createDetachedURL,
	debounce,
	throttle
} from './utils.js';
import { testUtils } from '../test-setup.js';

describe('Customer Name Formatting', () => {
	it('should handle privacy mode correctly', () => {
		expect(formatCustomerName('John Smith', true, false, false)).toBe('John S.');
		expect(formatCustomerName('Mary Jane Watson', true, false, false)).toBe('Mary W.');
		expect(formatCustomerName('Bob', true, false, false)).toBe('Bob');
		expect(formatCustomerName('John Smith', false, false, false)).toBe('John Smith');
	});

	it('should handle clover mode for export', () => {
		expect(formatCustomerName('Clover Customer', false, true, true)).toBe('Member, Individual');
		expect(formatCustomerName('Clover C.', false, true, true)).toBe('Member, Individual');
		expect(formatCustomerName('Regular Customer', false, true, true)).toBe('Regular Customer');
	});

	it('should handle both privacy and clover modes', () => {
		expect(formatCustomerName('Clover Customer', true, true, true)).toBe('Member, Individual');
		expect(formatCustomerName('John Smith', true, true, true)).toBe('John S.');
	});

	it('should handle member/individual names', () => {
		expect(formatCustomerName('Member Account', true, false, false)).toBe('Member, Individual');
		expect(formatCustomerName('Individual Customer', true, false, false)).toBe(
			'Member, Individual'
		);
	});
});

describe('CSV Utilities', () => {
	it('should escape CSV values correctly', () => {
		expect(escapeCSVValue('simple')).toBe('simple');
		expect(escapeCSVValue('has,comma')).toBe('"has,comma"');
		expect(escapeCSVValue('has"quote')).toBe('"has""quote"');
		expect(escapeCSVValue('has\nNewline')).toBe('"has\nNewline"');
		expect(escapeCSVValue('has,comma"and"quotes')).toBe('"has,comma""and""quotes"');
	});

	it('should generate CSV correctly', () => {
		const transactions = [
			{ customer: 'John Doe', date: '2024-01-15', amount: '$100.00', transactionId: 'TXN001' },
			{ customer: 'Jane Smith', date: '2024-01-16', amount: '$200.00', transactionId: 'TXN002' }
		];

		const formatFunction = (name: string) => name;
		const csv = generateCSV(transactions, formatFunction);

		expect(csv).toContain('Customer,Date,Amount,ID');
		expect(csv).toContain('John Doe,2024-01-15,$100.00,TXN001');
		expect(csv).toContain('Jane Smith,2024-01-16,$200.00,TXN002');
	});

	it('should handle CSV with special characters', () => {
		const transactions = [
			{
				customer: 'John "Johnny" Doe',
				date: '2024-01-15',
				amount: '$1,000.00',
				transactionId: 'TXN,001'
			}
		];

		const formatFunction = (name: string) => name;
		const csv = generateCSV(transactions, formatFunction);

		expect(csv).toContain('"John ""Johnny"" Doe"');
		expect(csv).toContain('"$1,000.00"');
		expect(csv).toContain('"TXN,001"');
	});
});

describe('Clipboard Operations', () => {
	it('should copy to clipboard successfully', async () => {
		// Mock the clipboard API
		const mockWriteText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: mockWriteText },
			writable: true
		});

		const result = await copyToClipboard('test text');
		expect(result).toBe(true);
		expect(mockWriteText).toHaveBeenCalledWith('test text');
	});

	it('should handle clipboard errors', async () => {
		// Mock clipboard API to fail
		const mockWriteText = vi.fn().mockRejectedValue(new Error('Clipboard error'));
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: mockWriteText },
			writable: true
		});

		const result = await copyToClipboard('test text');
		expect(result).toBe(false);
	});
});

describe('File Download', () => {
	it('should create download link', () => {
		// Mock DOM methods
		const mockClick = vi.fn();
		const mockCreateElement = vi.fn().mockReturnValue({
			click: mockClick,
			href: '',
			download: ''
		});
		const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
		const mockRevokeObjectURL = vi.fn();

		Object.defineProperty(document, 'createElement', {
			value: mockCreateElement,
			writable: true
		});
		Object.defineProperty(URL, 'createObjectURL', {
			value: mockCreateObjectURL,
			writable: true
		});
		Object.defineProperty(URL, 'revokeObjectURL', {
			value: mockRevokeObjectURL,
			writable: true
		});

		downloadCSV('test,csv\ndata,here', 'test.csv');

		expect(mockCreateElement).toHaveBeenCalledWith('a');
		expect(mockClick).toHaveBeenCalled();
		expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
	});
});

describe('Transaction Filtering', () => {
	const sampleTransactions = [
		{ customer: 'John Doe', date: '2024-01-15', amount: '$100.00', transactionId: 'TXN001' },
		{ customer: 'Jane Smith', date: '2024-01-16', amount: '$200.00', transactionId: 'TXN002' },
		{ customer: 'Bob Johnson', date: '2024-01-17', amount: '$50.00', transactionId: 'TXN003' }
	];

	it('should filter by customer name', () => {
		const results = filterTransactions(sampleTransactions, 'John');
		expect(results).toHaveLength(2); // John Doe and Bob Johnson
		expect(results[0].customer).toBe('John Doe');
		expect(results[1].customer).toBe('Bob Johnson');
	});

	it('should filter by amount', () => {
		const results = filterTransactions(sampleTransactions, '$200');
		expect(results).toHaveLength(1);
		expect(results[0].customer).toBe('Jane Smith');
	});

	it('should filter by transaction ID', () => {
		const results = filterTransactions(sampleTransactions, 'TXN002');
		expect(results).toHaveLength(1);
		expect(results[0].customer).toBe('Jane Smith');
	});

	it('should return all transactions for empty search', () => {
		const results = filterTransactions(sampleTransactions, '');
		expect(results).toHaveLength(3);
		expect(results).toEqual(sampleTransactions);
	});

	it('should handle case-insensitive search', () => {
		const results = filterTransactions(sampleTransactions, 'JANE');
		expect(results).toHaveLength(1);
		expect(results[0].customer).toBe('Jane Smith');
	});
});

describe('Theme Utilities', () => {
	it('should detect system theme', () => {
		// Mock matchMedia
		Object.defineProperty(window, 'matchMedia', {
			value: vi.fn().mockReturnValue({ matches: true }),
			writable: true
		});

		expect(getSystemTheme()).toBe('dark');

		window.matchMedia = vi.fn().mockReturnValue({ matches: false });
		expect(getSystemTheme()).toBe('light');
	});

	it('should apply dark theme', () => {
		// Mock document.documentElement
		const mockClassList = {
			add: vi.fn(),
			remove: vi.fn()
		};
		Object.defineProperty(document, 'documentElement', {
			value: { classList: mockClassList },
			writable: true
		});

		applyTheme(true);
		expect(mockClassList.add).toHaveBeenCalledWith('dark');

		applyTheme(false);
		expect(mockClassList.remove).toHaveBeenCalledWith('dark');
	});
});

describe('Storage Utilities', () => {
	beforeEach(() => {
		testUtils.mockLocalStorage.clear();
	});

	it('should get and set settings', async () => {
		setSetting('test-key', { value: 'test' });
		const result = await getSetting('test-key');
		expect(result).toEqual({ value: 'test' });
	});

	it('should return default value for missing setting', async () => {
		const result = await getSetting('missing-key', 'default');
		expect(result).toBe('default');
	});

	it('should handle JSON parse errors', async () => {
		testUtils.mockLocalStorage.setItem('bad-json', 'invalid-json');
		const result = await getSetting('bad-json', 'default');
		expect(result).toBe('default');
	});

	it('should handle storage errors gracefully', () => {
		// Mock localStorage to throw error
		testUtils.mockLocalStorage.setItem = vi.fn().mockImplementation(() => {
			throw new Error('Storage full');
		});

		expect(() => setSetting('test', 'value')).not.toThrow();
	});
});

describe('Instance Management', () => {
	beforeEach(() => {
		// Reset chrome storage mock
		testUtils.mockChrome.storage.local.set.mockClear();
		testUtils.mockChrome.storage.local.remove.mockClear();
		testUtils.mockChrome.storage.local.get.mockClear();
	});

	it('should set instance marker', async () => {
		testUtils.mockChrome.storage.local.set.mockResolvedValue(undefined);

		const instanceId = await setInstanceMarker('popup');
		expect(instanceId).toMatch(/^\d+$/);
		expect(testUtils.mockChrome.storage.local.set).toHaveBeenCalledWith(
			expect.objectContaining({
				instance_popup: instanceId,
				instanceTime_popup: expect.any(Number)
			})
		);
	});

	it('should clear instance marker', async () => {
		testUtils.mockChrome.storage.local.remove.mockResolvedValue(undefined);

		await clearInstanceMarker('detached');
		expect(testUtils.mockChrome.storage.local.remove).toHaveBeenCalledWith([
			'instance_detached',
			'instanceTime_detached'
		]);
	});

	it('should check if instance exists', async () => {
		const now = Date.now();
		testUtils.mockChrome.storage.local.get.mockResolvedValue({
			instance_popup: 'test-id',
			instanceTime_popup: now - 10000 // 10 seconds ago
		});

		const exists = await checkInstanceExists('popup', 30000);
		expect(exists).toBe(true);
	});

	it('should detect expired instance', async () => {
		const now = Date.now();
		testUtils.mockChrome.storage.local.get.mockResolvedValue({
			instance_popup: 'test-id',
			instanceTime_popup: now - 60000 // 1 minute ago
		});

		const exists = await checkInstanceExists('popup', 30000);
		expect(exists).toBe(false);
	});
});

describe('Window Management', () => {
	it('should find existing detached window', async () => {
		const mockWindows = [
			{ id: 1, type: 'normal', width: 800 },
			{ id: 2, type: 'popup', width: 700 },
			{ id: 3, type: 'popup', width: 600 }
		];

		testUtils.mockChrome.windows = {
			...testUtils.mockChrome.windows,
			getAll: vi.fn().mockResolvedValue(mockWindows)
		};

		const result = await findExistingDetachedWindow();
		expect(result).toEqual({ id: 2, type: 'popup', width: 700 });
	});

	it('should return null when no detached window found', async () => {
		const mockWindows = [
			{ id: 1, type: 'normal', width: 800 },
			{ id: 2, type: 'popup', width: 400 }
		];

		testUtils.mockChrome.windows = {
			...testUtils.mockChrome.windows,
			getAll: vi.fn().mockResolvedValue(mockWindows)
		};

		const result = await findExistingDetachedWindow();
		expect(result).toBeNull();
	});
});

describe('Data Validation', () => {
	it('should validate transaction data', () => {
		const validTransaction = {
			customer: 'John Doe',
			date: '2024-01-15',
			amount: '$100.00',
			transactionId: 'TXN001'
		};

		expect(isValidTransactionData(validTransaction)).toBe(true);
	});

	it('should reject invalid transaction data', () => {
		expect(isValidTransactionData(null)).toBeFalsy();
		expect(isValidTransactionData({})).toBe(false);
		expect(isValidTransactionData({ customer: 'John' })).toBe(false);
		expect(
			isValidTransactionData({
				customer: 123,
				date: '2024-01-15',
				amount: '$100',
				transactionId: 'TXN001'
			})
		).toBe(false);
	});

	it('should sanitize transaction data', () => {
		const mixedData = [
			{ customer: '  John Doe  ', date: '2024-01-15', amount: '$100.00', transactionId: 'TXN001' },
			{ customer: 'Invalid' }, // Missing fields
			{ customer: 'Jane Smith', date: '  2024-01-16  ', amount: '$200.00', transactionId: 'TXN002' }
		];

		const sanitized = sanitizeTransactionData(mixedData);
		expect(sanitized).toHaveLength(2);
		expect(sanitized[0].customer).toBe('John Doe');
		expect(sanitized[1].date).toBe('2024-01-16');
	});
});

describe('Toast Messages', () => {
	it('should create toast message', () => {
		const toast = createToastMessage('Test message', 'success', 5000);

		expect(toast.message).toBe('Test message');
		expect(toast.type).toBe('success');
		expect(toast.duration).toBe(5000);
		expect(toast.id).toMatch(/^\d+$/);
	});

	it('should use default values', () => {
		const toast = createToastMessage('Test message');

		expect(toast.type).toBe('success');
		expect(toast.duration).toBe(3000);
	});
});

describe('Cache Age Formatting', () => {
	it('should format cache age correctly', () => {
		const now = new Date();
		const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
		const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
		const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

		expect(formatCacheAge(twoHoursAgo)).toBe('2h 0m ago');
		expect(formatCacheAge(thirtyMinutesAgo)).toBe('30m ago');
		expect(formatCacheAge(fiveMinutesAgo)).toBe('5m ago');
	});
});

describe('Error Handling', () => {
	it('should handle tab-related errors', () => {
		const error = new Error('No tab found');
		const message = handleError(error, 'test context');
		expect(message).toContain('No PayTracker tab found');
	});

	it('should handle permission errors', () => {
		const error = new Error('permission denied for this action');
		const message = handleError(error, 'test context');
		expect(message).toContain('Permission denied');
	});

	it('should handle network errors', () => {
		const error = new Error('network connection failed');
		const message = handleError(error, 'test context');
		expect(message).toContain('Network error');
	});

	it('should handle generic errors', () => {
		const error = new Error('Something went wrong');
		const message = handleError(error, 'test context');
		expect(message).toContain('Error in test context');
	});
});

describe('Window Detection', () => {
	it('should detect detached window by size', () => {
		Object.defineProperty(window, 'innerWidth', {
			value: 800,
			writable: true
		});

		expect(isDetachedWindow()).toBe(true);

		window.innerWidth = 400;
		expect(isDetachedWindow()).toBe(false);
	});

	it('should detect detached window by URL parameter', () => {
		Object.defineProperty(window, 'location', {
			value: { search: '?detached=true' },
			writable: true
		});

		expect(isDetachedWindow()).toBe(true);
	});

	it('should create detached URL', () => {
		testUtils.mockChrome.runtime.getURL.mockReturnValue(
			'chrome-extension://test-id/index.html?detached=true'
		);

		const url = createDetachedURL();
		expect(url).toBe('chrome-extension://test-id/index.html?detached=true');
		expect(testUtils.mockChrome.runtime.getURL).toHaveBeenCalledWith('index.html?detached=true');
	});
});

describe('Performance Utilities', () => {
	it('should debounce function calls', async () => {
		let callCount = 0;
		const testFunction = () => callCount++;
		const debouncedFunction = debounce(testFunction, 100);

		debouncedFunction();
		debouncedFunction();
		debouncedFunction();

		expect(callCount).toBe(0);

		await new Promise((resolve) => setTimeout(resolve, 150));
		expect(callCount).toBe(1);
	});

	it('should throttle function calls', async () => {
		let callCount = 0;
		const testFunction = () => callCount++;
		const throttledFunction = throttle(testFunction, 100);

		throttledFunction();
		throttledFunction();
		throttledFunction();

		expect(callCount).toBe(1);

		await new Promise((resolve) => setTimeout(resolve, 150));
		throttledFunction();
		expect(callCount).toBe(2);
	});
});

describe('Storage Keys', () => {
	it('should have correct storage keys', () => {
		expect(STORAGE_KEYS.PRIVACY_MODE).toBe('privacyMode');
		expect(STORAGE_KEYS.CLOVER_MODE).toBe('cloverMode');
		expect(STORAGE_KEYS.COMPACT_MODE).toBe('compactMode');
		expect(STORAGE_KEYS.THEME).toBe('theme');
		expect(STORAGE_KEYS.CACHE_DATA).toBe('transactionCache');
		expect(STORAGE_KEYS.INSTANCE_POPUP).toBe('instance_popup');
		expect(STORAGE_KEYS.INSTANCE_DETACHED).toBe('instance_detached');
	});
});
