import { vi } from 'vitest';
import { beforeAll, afterEach } from 'vitest';

// Mock Chrome APIs for testing
const mockChrome = {
	runtime: {
		id: 'test-extension-id',
		onMessage: {
			addListener: vi.fn(),
			removeListener: vi.fn(),
		},
		sendMessage: vi.fn(),
		getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
		getManifest: vi.fn(() => ({
			name: 'PayTracker Transaction Extractor',
			version: '1.0.0',
			manifest_version: 3
		}))
	},
	storage: {
		local: {
			get: vi.fn(() => Promise.resolve({})),
			set: vi.fn(() => Promise.resolve()),
			remove: vi.fn(() => Promise.resolve()),
			clear: vi.fn(() => Promise.resolve())
		},
		sync: {
			get: vi.fn(() => Promise.resolve({})),
			set: vi.fn(() => Promise.resolve()),
			remove: vi.fn(() => Promise.resolve()),
			clear: vi.fn(() => Promise.resolve())
		}
	},
	tabs: {
		query: vi.fn(() => Promise.resolve([{
			id: 1,
			url: 'https://example.com',
			active: true,
			windowId: 1
		}])),
		executeScript: vi.fn(() => Promise.resolve()),
		sendMessage: vi.fn(() => Promise.resolve())
	},
	scripting: {
		executeScript: vi.fn(() => Promise.resolve([{ result: null }])),
		insertCSS: vi.fn(() => Promise.resolve()),
		removeCSS: vi.fn(() => Promise.resolve())
	},
	windows: {
		create: vi.fn(() => Promise.resolve({
			id: 1,
			focused: true,
			type: 'popup'
		})),
		update: vi.fn(() => Promise.resolve()),
		remove: vi.fn(() => Promise.resolve())
	},
	action: {
		setPopup: vi.fn(),
		setBadgeText: vi.fn(),
		setBadgeBackgroundColor: vi.fn()
	}
};

// Global setup
beforeAll(() => {
	// Mock global Chrome API
	Object.defineProperty(globalThis, 'chrome', {
		value: mockChrome,
		writable: true
	});

	// Mock DOM APIs that might be used
	Object.defineProperty(window, 'location', {
		value: {
			href: 'https://test.paytracker.com',
			hostname: 'test.paytracker.com',
			pathname: '/transactions',
			search: '?page=1'
		},
		writable: true
	});

	// Mock fetch for API calls
	global.fetch = vi.fn();

	// Mock console methods to reduce noise in tests
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks();
});

// Export commonly used mocks for tests
export { mockChrome };

// Helper function to create mock DOM elements
export function createMockElement(tagName: string, attributes: Record<string, string> = {}, textContent = '') {
	const element = document.createElement(tagName);
	
	Object.entries(attributes).forEach(([key, value]) => {
		element.setAttribute(key, value);
	});
	
	if (textContent) {
		element.textContent = textContent;
	}
	
	return element;
}

// Helper function to create mock transaction elements
export function createMockTransactionRow(data: {
	id?: string;
	customer?: string;
	amount?: string;
	date?: string;
} = {}) {
	const row = createMockElement('tr', { class: 'transaction-row' });
	
	// Transaction ID cell
	const idCell = createMockElement('td', { class: 'transaction-id' });
	const idLink = createMockElement('a', { 
		href: `/transaction/${data.id || 'TEST123'}` 
	}, data.id || 'TEST123');
	idCell.appendChild(idLink);
	row.appendChild(idCell);
	
	// Customer cell
	const customerCell = createMockElement('td', { class: 'customer-name' }, data.customer || 'Test Customer');
	row.appendChild(customerCell);
	
	// Amount cell
	const amountCell = createMockElement('td', { class: 'amount' }, data.amount || '$100.00');
	row.appendChild(amountCell);
	
	// Date cell
	const dateCell = createMockElement('td', { class: 'date' }, data.date || '2024-01-01');
	row.appendChild(dateCell);
	
	return row;
}

// Helper function to create mock PayTracker page structure
export function createMockPayTrackerPage(transactions: any[] = []) {
	// Clear existing DOM
	document.body.innerHTML = '';
	
	// Create main container
	const container = createMockElement('div', { class: 'main-content' });
	
	// Create transactions table
	const table = createMockElement('table', { class: 'transactions-table' });
	const tbody = createMockElement('tbody');
	
	// Add transaction rows
	transactions.forEach(transaction => {
		const row = createMockTransactionRow(transaction);
		tbody.appendChild(row);
	});
	
	table.appendChild(tbody);
	container.appendChild(table);
	document.body.appendChild(container);
	
	return container;
}

// Mock local storage
export const mockLocalStorage = {
	store: new Map<string, string>(),
	getItem: vi.fn((key: string) => mockLocalStorage.store.get(key) || null),
	setItem: vi.fn((key: string, value: string) => {
		mockLocalStorage.store.set(key, value);
	}),
	removeItem: vi.fn((key: string) => {
		mockLocalStorage.store.delete(key);
	}),
	clear: vi.fn(() => {
		mockLocalStorage.store.clear();
	}),
	key: vi.fn((index: number) => {
		const keys = Array.from(mockLocalStorage.store.keys());
		return keys[index] || null;
	}),
	get length() {
		return mockLocalStorage.store.size;
	}
};

// Apply localStorage mock
Object.defineProperty(window, 'localStorage', {
	value: mockLocalStorage,
	writable: true
});

// Export test utilities
export const testUtils = {
	mockChrome,
	createMockElement,
	createMockTransactionRow,
	createMockPayTrackerPage,
	mockLocalStorage,
	
	// Helper to wait for async operations
	async waitFor(condition: () => boolean, timeout = 1000): Promise<void> {
		const start = Date.now();
		while (!condition() && Date.now() - start < timeout) {
			await new Promise(resolve => setTimeout(resolve, 10));
		}
		if (!condition()) {
			throw new Error('Condition not met within timeout');
		}
	},
	
	// Helper to simulate user events
	simulateClick(element: Element) {
		const event = new MouseEvent('click', {
			bubbles: true,
			cancelable: true,
			view: window
		});
		element.dispatchEvent(event);
	},
	
	// Helper to simulate input changes
	simulateInput(element: HTMLInputElement, value: string) {
		element.value = value;
		const event = new Event('input', {
			bubbles: true,
			cancelable: true
		});
		element.dispatchEvent(event);
	}
};