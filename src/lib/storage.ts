export interface CacheEntry<T> {
	data: T;
	timestamp: number;
	url?: string;
	hash?: string;
}

export interface StorageOptions {
	ttl?: number; // Time to live in milliseconds
	maxEntries?: number; // Maximum number of cached entries
	enableCompression?: boolean;
}

export class TransactionCache {
	private memoryCache = new Map<string, CacheEntry<any>>();
	private readonly defaultTTL = 10 * 60 * 1000; // 10 mins
	private readonly maxMemoryEntries = 50;
	private readonly storageKey = 'paytracker_cache';

	constructor(private options: StorageOptions = {}) {
		this.options.ttl = options.ttl || this.defaultTTL;
		this.options.maxEntries = options.maxEntries || this.maxMemoryEntries;
		this.options.enableCompression = options.enableCompression || false;
	}

	/**
	 * Generate a cache key based on URL and content hash
	 */
	private generateKey(url: string, contentHash?: string): string {
		try {
			const urlKey = new URL(url).pathname + new URL(url).search;
			return contentHash ? `${urlKey}_${contentHash}` : urlKey;
		} catch {
			// Fallback for invalid URLs
			const sanitized = url.replace(/[^a-zA-Z0-9]/g, '_');
			return contentHash ? `${sanitized}_${contentHash}` : sanitized;
		}
	}

	/**
	 * Generate a simple hash of the page content for cache invalidation
	 */
	private generateContentHash(data: any): string {
		const str = JSON.stringify(data);
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}

	/**
	 * Check if a cache entry is expired
	 */
	private isExpired(entry: CacheEntry<any>): boolean {
		return Date.now() - entry.timestamp > (this.options.ttl || this.defaultTTL);
	}

	/**
	 * Compress data using simple string compression
	 */
	private compress(data: string): string {
		if (!this.options.enableCompression) return data;

		// Simple RLE compression for JSON data
		return data.replace(/(.)\1+/g, (match, char) => {
			if (match.length > 3) {
				return `${char}${match.length}${char}`;
			}
			return match;
		});
	}

	/**
	 * Decompress data
	 */
	private decompress(data: string): string {
		if (!this.options.enableCompression) return data;

		return data.replace(/(.)\d+\1/g, (match, char) => {
			const count = parseInt(match.slice(1, -1));
			return char.repeat(count);
		});
	}

	/**
	 * Get current tab URL
	 */
	private async getCurrentUrl(): Promise<string> {
		try {
			if (typeof chrome !== 'undefined' && chrome.tabs) {
				const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
				return tab.url || 'default';
			}
			return window.location.href || 'default';
		} catch {
			return 'default';
		}
	}

	/**
	 * Clean up expired entries from memory cache
	 */
	private cleanupMemoryCache(): void {
		for (const [key, entry] of this.memoryCache.entries()) {
			if (this.isExpired(entry)) {
				this.memoryCache.delete(key);
			}
		}

		// Limit memory cache size
		if (this.memoryCache.size > (this.options.maxEntries || this.maxMemoryEntries)) {
			const entries = Array.from(this.memoryCache.entries());
			entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

			const toDelete = entries.slice(
				0,
				entries.length - (this.options.maxEntries || this.maxMemoryEntries)
			);
			toDelete.forEach(([key]) => this.memoryCache.delete(key));
		}
	}

	/**
	 * Store data in Chrome storage
	 */
	private async setStorage(key: string, data: any): Promise<void> {
		try {
			if (typeof chrome !== 'undefined' && chrome.storage) {
				await chrome.storage.local.set({ [key]: data });
			} else {
				// Fallback to localStorage
				localStorage.setItem(key, JSON.stringify(data));
			}
		} catch (error) {
			console.warn('Failed to save to storage:', error);
		}
	}

	/**
	 * Retrieve data from Chrome storage
	 */
	private async getStorage(key: string): Promise<any> {
		try {
			if (typeof chrome !== 'undefined' && chrome.storage) {
				const result = await chrome.storage.local.get(key);
				return result[key];
			} else {
				// Fallback to localStorage
				const data = localStorage.getItem(key);
				return data ? JSON.parse(data) : null;
			}
		} catch (error) {
			console.warn('Failed to retrieve from storage:', error);
			return null;
		}
	}

	/**
	 * Cache transaction data
	 */
	async set<T>(data: T, url?: string): Promise<void> {
		const currentUrl = url || (await this.getCurrentUrl()) || 'default';
		const contentHash = this.generateContentHash(data);
		const key = this.generateKey(currentUrl, contentHash);

		const entry: CacheEntry<T> = {
			data: JSON.parse(JSON.stringify(data)), // Deep clone to prevent mutation
			timestamp: Date.now(),
			url: currentUrl,
			hash: contentHash
		};

		// Store in memory cache
		this.memoryCache.set(key, entry);
		this.cleanupMemoryCache();

		// Store in persistent storage with multiple keys for reliability
		try {
			const compressedData = this.compress(JSON.stringify(entry));
			await this.setStorage(`${this.storageKey}_${key}`, compressedData);
			// Also store with a simple key for easy retrieval
			await this.setStorage(`${this.storageKey}_latest`, compressedData);
		} catch (error) {
			console.error('Failed to cache data:', error);
		}
	}

	/**
	 * Retrieve cached transaction data
	 */
	async get<T>(url?: string): Promise<T | null> {
		const currentUrl = url || (await this.getCurrentUrl());

		// First check memory cache
		for (const [key, entry] of this.memoryCache.entries()) {
			if ((entry.url === currentUrl || !url) && !this.isExpired(entry)) {
				return entry.data as T;
			}
		}

		// Check persistent storage - look for any valid cache entry if no URL specified
		try {
			const keys = await this.getStorageKeys();
			for (const key of keys) {
				const shouldCheck = url
					? key.includes(currentUrl.split('?')[0])
					: key.startsWith(this.storageKey);

				if (shouldCheck) {
					const compressedData = await this.getStorage(key);
					if (compressedData) {
						const entry: CacheEntry<T> = JSON.parse(this.decompress(compressedData));

						if (!this.isExpired(entry) && (entry.url === currentUrl || !url)) {
							// Add back to memory cache
							this.memoryCache.set(key.replace(`${this.storageKey}_`, ''), entry);
							return entry.data;
						}
					}
				}
			}
		} catch (error) {
			console.error('Failed to retrieve cached data:', error);
		}

		return null;
	}

	/**
	 * Check if data exists and is valid for current URL
	 */
	async has(url?: string): Promise<boolean> {
		const data = await this.get(url);
		return data !== null;
	}

	/**
	 * Clear cache for specific URL or all cache
	 */
	async clear(url?: string): Promise<void> {
		if (url) {
			// Clear specific URL
			const keys = Array.from(this.memoryCache.keys()).filter((key) => {
				const entry = this.memoryCache.get(key);
				return entry?.url === url;
			});

			keys.forEach((key) => this.memoryCache.delete(key));

			// Clear from persistent storage
			const storageKeys = await this.getStorageKeys();
			for (const key of storageKeys) {
				if (key.includes(url.split('?')[0])) {
					await this.removeStorage(key);
				}
			}
		} else {
			// Clear all cache
			this.memoryCache.clear();

			const keys = await this.getStorageKeys();
			for (const key of keys) {
				await this.removeStorage(key);
			}
		}
	}

	/**
	 * Get cache statistics
	 */
	async getStats(): Promise<{
		memoryEntries: number;
		persistentEntries: number;
		totalSize: number;
		oldestEntry?: Date;
		newestEntry?: Date;
	}> {
		const storageKeys = await this.getStorageKeys();
		let totalSize = 0;
		let oldestTimestamp = Infinity;
		let newestTimestamp = 0;

		// Calculate memory cache size
		for (const entry of this.memoryCache.values()) {
			totalSize += JSON.stringify(entry).length;
			oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
			newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
		}

		return {
			memoryEntries: this.memoryCache.size,
			persistentEntries: storageKeys.length,
			totalSize,
			oldestEntry: oldestTimestamp !== Infinity ? new Date(oldestTimestamp) : undefined,
			newestEntry: newestTimestamp > 0 ? new Date(newestTimestamp) : undefined
		};
	}

	/**
	 * Get all storage keys for this cache
	 */
	private async getStorageKeys(): Promise<string[]> {
		try {
			if (typeof chrome !== 'undefined' && chrome.storage) {
				const items = await chrome.storage.local.get(null);
				return Object.keys(items).filter((key) => key.startsWith(this.storageKey));
			} else {
				// Fallback to localStorage
				const keys: string[] = [];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key?.startsWith(this.storageKey)) {
						keys.push(key);
					}
				}
				return keys;
			}
		} catch (error) {
			console.error('Failed to get storage keys:', error);
			return [];
		}
	}

	/**
	 * Remove item from storage
	 */
	private async removeStorage(key: string): Promise<void> {
		try {
			if (typeof chrome !== 'undefined' && chrome.storage) {
				await chrome.storage.local.remove(key);
			} else {
				localStorage.removeItem(key);
			}
		} catch (error) {
			console.warn('Failed to remove from storage:', error);
		}
	}

	/**
	 * Cleanup expired entries from both memory and persistent storage
	 */
	async cleanup(): Promise<void> {
		this.cleanupMemoryCache();

		const keys = await this.getStorageKeys();
		for (const key of keys) {
			try {
				const compressedData = await this.getStorage(key);
				if (compressedData) {
					const entry = JSON.parse(this.decompress(compressedData));
					if (this.isExpired(entry)) {
						await this.removeStorage(key);
					}
				}
			} catch (error) {
				// If we can't parse the entry, remove it
				await this.removeStorage(key);
			}
		}
	}
}

// Create and export a default instance
export const transactionCache = new TransactionCache({
	maxEntries: 100,
	enableCompression: true
});
