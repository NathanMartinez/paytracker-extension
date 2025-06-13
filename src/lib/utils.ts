// Privacy and formatting utilities
export function formatCustomerName(name: string): string {
	if (name.toLowerCase().includes('member') || name.toLowerCase().includes('individual')) {
		return 'Member, Individual';
	}
	const parts = name.trim().split(' ');
	if (parts.length >= 2) {
		return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
	}

	return name;
}

// CSV escaping utility
export function escapeCSVValue(value: string): string {
	// If value contains comma, quote, or newline, wrap in quotes
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		// Escape any existing quotes by doubling them
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

// Clipboard utilities
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (err) {
		console.error('Failed to copy to clipboard:', err);
		return false;
	}
}

// CSV generation utility
export function generateCSV(transactions: any[], formatFunction: (name: string) => string): string {
	const header = 'Customer,Date,Amount,ID\n';
	const rows = transactions
		.map(
			(tx) =>
				`${escapeCSVValue(formatFunction(tx.customer))},${escapeCSVValue(tx.date)},${escapeCSVValue(tx.amount)},${escapeCSVValue(tx.transactionId)}`
		)
		.join('\n');
	return header + rows;
}

// File download utility
export function downloadCSV(csvContent: string, filename: string = 'transactions.csv'): void {
	const blob = new Blob([csvContent], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

// Search filtering utility
export function filterTransactions(transactions: any[], searchTerm: string): any[] {
	if (!searchTerm.trim()) return transactions;

	const term = searchTerm.toLowerCase();
	return transactions.filter(
		(tx) =>
			tx.customer.toLowerCase().includes(term) ||
			tx.amount.toLowerCase().includes(term) ||
			tx.transactionId.toLowerCase().includes(term) ||
			tx.date.toLowerCase().includes(term)
	);
}

// Theme utilities
export function getSystemTheme(): 'dark' | 'light' {
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(isDark: boolean): void {
	if (isDark) {
		document.documentElement.classList.add('dark');
	} else {
		document.documentElement.classList.remove('dark');
	}
}

// Storage utilities
export async function getSetting(key: string, defaultValue: any = null): Promise<any> {
	try {
		const stored = localStorage.getItem(key);
		return stored !== null ? JSON.parse(stored) : defaultValue;
	} catch {
		return defaultValue;
	}
}

export function setSetting(key: string, value: any): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (error) {
		console.error('Failed to save setting:', key, error);
	}
}

// Instance management utilities
export async function setInstanceMarker(type: 'popup' | 'detached'): Promise<string> {
	const instanceId = Date.now().toString();
	await chrome.storage.local.set({
		[`instance_${type}`]: instanceId,
		[`instanceTime_${type}`]: Date.now()
	});
	return instanceId;
}

export async function clearInstanceMarker(type: 'popup' | 'detached'): Promise<void> {
	await chrome.storage.local.remove([`instance_${type}`, `instanceTime_${type}`]);
}

export async function checkInstanceExists(
	type: 'popup' | 'detached',
	maxAge: number = 30000
): Promise<boolean> {
	const result = await chrome.storage.local.get([`instance_${type}`, `instanceTime_${type}`]);
	const instanceTime = result[`instanceTime_${type}`];
	return instanceTime && Date.now() - instanceTime < maxAge;
}

// Window management utilities
export async function findExistingDetachedWindow(): Promise<chrome.windows.Window | null> {
	const existingWindows = await chrome.windows.getAll();
	return existingWindows.find((w) => w.type === 'popup' && w.width && w.width >= 700) || null;
}

// Validation utilities
export function isValidTransactionData(data: any): boolean {
	return (
		data &&
		typeof data.customer === 'string' &&
		typeof data.date === 'string' &&
		typeof data.amount === 'string' &&
		typeof data.transactionId === 'string'
	);
}

export function sanitizeTransactionData(transactions: any[]): any[] {
	return transactions.filter(isValidTransactionData).map((tx) => ({
		customer: tx.customer.trim(),
		date: tx.date.trim(),
		amount: tx.amount.trim(),
		transactionId: tx.transactionId.trim()
	}));
}

// Toast message utility
export interface ToastMessage {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info' | 'warning';
	duration: number;
}

export function createToastMessage(
	message: string,
	type: ToastMessage['type'] = 'success',
	duration: number = 3000
): ToastMessage {
	return {
		id: Date.now().toString(),
		message,
		type,
		duration
	};
}

// Cache statistics utility
export interface CacheStats {
	hasCache: boolean;
	entryCount: number;
	cacheAge: string;
	lastUpdate: Date | null;
}

export function formatCacheAge(date: Date): string {
	const ageMs = Date.now() - date.getTime();
	const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
	const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));

	if (ageHours > 0) {
		return `${ageHours}h ${ageMinutes}m ago`;
	} else {
		return `${ageMinutes}m ago`;
	}
}

// Error handling utilities
export function handleError(error: any, context: string): string {
	console.error(`Error in ${context}:`, error);

	if (error.message?.includes('tab')) {
		return '❌ No PayTracker tab found. Please open PayTracker first.';
	}

	if (error.message?.includes('permission')) {
		return '❌ Permission denied. Please check extension permissions.';
	}

	if (error.message?.includes('network') || error.message?.includes('fetch')) {
		return '❌ Network error. Please check your connection.';
	}

	return `❌ Error in ${context}. Please try again.`;
}

// Data persistence utilities
export const STORAGE_KEYS = {
	COMPACT_MODE: 'compactMode',
	THEME: 'theme',
	CACHE_DATA: 'transactionCache',
	INSTANCE_POPUP: 'instance_popup',
	INSTANCE_DETACHED: 'instance_detached'
} as const;

// URL and detection utilities
export function isDetachedWindow(): boolean {
	return window.innerWidth > 600 || window.location.search.includes('detached=true');
}

export function createDetachedURL(): string {
	return chrome.runtime.getURL('index.html?detached=true');
}

// Performance utilities
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout;
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}
