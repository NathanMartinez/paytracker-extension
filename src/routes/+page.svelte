<script lang="ts">
	import { extractTransactionData, type Transaction } from '../lib/transactionScraper';
	import { transactionCache } from '../lib/storage';
	import { onMount } from 'svelte';
	import {
		formatCustomerName,
		escapeCSVValue,
		copyToClipboard as utilCopyToClipboard,
		generateCSV,
		downloadCSV,
		filterTransactions,
		getSetting,
		setSetting,
		setInstanceMarker,
		clearInstanceMarker,
		checkInstanceExists,
		findExistingDetachedWindow,
		isDetachedWindow,
		createDetachedURL,
		handleError,
		formatCacheAge
	} from '../lib/utils';

	let transactions: Transaction[] = [];
	let error = '';
	let loading = false;
	let darkMode = false;
	let showToast = false;
	let toastMessage = '';
	let cacheStatus = { hasCache: false, cacheAge: '', fromCache: false };
	let showCacheControls = false;
	let isDetached = false;
	let compactMode = true;
	let searchTerm = '';
	let filteredTransactions: Transaction[] = [];
	let showSettings = false;
	let privacyMode = false;
	let cloverMode = false;

	// Initialize theme and check cache
	onMount(async () => {
		// Detect if we're in a detached window
		isDetached = isDetachedWindow();

		// Load preferences
		compactMode = await getSetting('compactMode', true);
		cloverMode = await getSetting('cloverMode', false);
		privacyMode = await getSetting('privacyMode', false);

		// Check for cross-mode data sync
		const syncData = await chrome.storage.local.get([
			'lastSyncMode',
			'lastSyncTime',
			'popupModeData',
			'detachedModeData'
		]);

		// If detached, load all settings and data with improved sync
		if (isDetached) {
			// Try to load from the most recent sync first
			let dataLoaded = false;

			if (syncData.lastSyncMode === 'popup' && syncData.popupModeData) {
				const data = syncData.popupModeData;
				if (data.transactions && data.transactions.length > 0) {
					transactions = [...data.transactions];
					searchTerm = data.searchTerm || '';
					privacyMode = data.privacyMode !== undefined ? data.privacyMode : privacyMode;
					cloverMode = data.cloverMode !== undefined ? data.cloverMode : cloverMode;
					cacheStatus.fromCache = true;
					dataLoaded = true;
				}
			}

			// Fallback to detached mode data
			if (!dataLoaded && syncData.detachedModeData) {
				const data = syncData.detachedModeData;
				if (data.transactions && data.transactions.length > 0) {
					transactions = [...data.transactions];
					cacheStatus.fromCache = true;
				}
				if (data.searchTerm) searchTerm = data.searchTerm;
				if (data.privacyMode !== undefined) privacyMode = data.privacyMode;
				if (data.cloverMode !== undefined) cloverMode = data.cloverMode;
			}
		} else {
			// In popup mode, check for data from detached mode
			if (syncData.lastSyncMode === 'detached' && syncData.detachedModeData) {
				const data = syncData.detachedModeData;
				if (data.transactions && data.transactions.length > 0 && transactions.length === 0) {
					transactions = [...data.transactions];
					searchTerm = data.searchTerm || '';
					privacyMode = data.privacyMode !== undefined ? data.privacyMode : privacyMode;
					cloverMode = data.cloverMode !== undefined ? data.cloverMode : cloverMode;
					cacheStatus.fromCache = true;
				}
			}
		}

		const savedTheme = await getSetting('theme', null);
		darkMode =
			savedTheme === 'dark' ||
			(!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
		updateTheme();

		// Load cached data if not already loaded from sync
		if (transactions.length === 0) {
			await loadCachedData();
		}

		// Cleanup expired cache entries
		transactionCache.cleanup();

		// Prevent multiple instances
		await preventMultipleInstances();
	});

	async function loadCachedData() {
		try {
			// First check for popup mode data if not detached
			if (!isDetached) {
				const popupData = await chrome.storage.local.get(['popupModeData']);
				if (popupData.popupModeData && popupData.popupModeData.transactions) {
					const data = popupData.popupModeData;
					transactions = [...data.transactions];
					if (data.searchTerm) searchTerm = data.searchTerm;
					if (data.privacyMode !== undefined) privacyMode = data.privacyMode;
					if (data.cloverMode !== undefined) cloverMode = data.cloverMode;
					cacheStatus.fromCache = true;
					await updateCacheStatus();
					showToastMessage(`✨ ${data.transactions.length} cached transactions loaded`);
					return;
				}
			}

			// Fallback to regular cache
			const cachedData = await transactionCache.get<Transaction[]>();
			if (cachedData && cachedData.length > 0) {
				transactions = [...cachedData]; // Force reactivity
				cacheStatus.fromCache = true;
				await updateCacheStatus();
				// Always show message for cached data
				showToastMessage(`✨ ${cachedData.length} cached transactions loaded`);
			} else {
				await updateCacheStatus();
			}
		} catch (error) {
			console.error('Error loading cached data:', error);
			await updateCacheStatus();
		}
	}

	// Filter transactions based on search term
	$: filteredTransactions = filterTransactions(transactions, searchTerm);

	// Privacy mode name replacement
	function formatName(name: string, forExport: boolean = false): string {
		return formatCustomerName(name, privacyMode, cloverMode, forExport);
	}

	// Format date to standardized MM/DD/YYYY format
	function formatDate(dateStr: string): string {
		try {
			// Handle various date formats
			let date: Date;

			// Try parsing as-is first
			date = new Date(dateStr);

			// If invalid, try other common formats
			if (isNaN(date.getTime())) {
				// Try MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD formats
				const formats = [
					/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY or DD/MM/YYYY
					/^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
					/^(\d{1,2})-(\d{1,2})-(\d{4})$/ // MM-DD-YYYY or DD-MM-YYYY
				];

				for (const format of formats) {
					const match = dateStr.match(format);
					if (match) {
						if (format === formats[1]) {
							// YYYY-MM-DD
							date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
						} else {
							// Assume MM/DD/YYYY for other formats
							date = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
						}
						break;
					}
				}
			}

			// If still invalid, return original
			if (isNaN(date.getTime())) {
				return dateStr;
			}

			// Format as MM/DD/YYYY
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const year = date.getFullYear();

			return `${month}/${day}/${year}`;
		} catch {
			return dateStr; // Return original if parsing fails
		}
	}

	// Format transaction ID to just return the innerText
	function formatTransactionId(id: string): string {
		return id ? id.trim() : '';
	}

	// Update displayed data when privacy settings or search term change
	$: {
		// Force table refresh when privacy settings or search change
		if (transactions.length > 0) {
			filteredTransactions = filterTransactions(transactions, searchTerm);
		}
	}

	// Watch for privacy mode changes and update immediately
	$: if (typeof privacyMode !== 'undefined' && typeof cloverMode !== 'undefined') {
		if (transactions.length > 0) {
			// Force reactivity for privacy changes by creating new array reference
			transactions = [...transactions];
			// Also update filtered transactions immediately
			filteredTransactions = filterTransactions(transactions, searchTerm);
		}
	}

	async function preventMultipleInstances() {
		const windowType = isDetached ? 'detached' : 'popup';
		const instanceId = await setInstanceMarker(windowType);

		// Check periodically if another instance has taken over
		const checkInterval = setInterval(async () => {
			const result = await chrome.storage.local.get([`instance_${windowType}`]);
			const currentId = result[`instance_${windowType}`];

			if (currentId && currentId !== instanceId) {
				clearInterval(checkInterval);
				window.close();
			}
		}, 1000);

		// Cleanup on window close
		window.addEventListener('beforeunload', () => {
			clearInterval(checkInterval);
		});
	}

	function toggleTheme() {
		darkMode = !darkMode;
		updateTheme();
		setSetting('theme', darkMode ? 'dark' : 'light');
	}

	function updateTheme() {
		if (darkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	async function refresh(useCache = true) {
		error = '';
		loading = true;
		cacheStatus.fromCache = false;

		try {
			// Try to get cached data first if requested
			if (useCache) {
				const cachedData = await transactionCache.get<Transaction[]>();
				if (cachedData && cachedData.length > 0) {
					transactions = cachedData;
					cacheStatus.fromCache = true;
					showToastMessage('✨ Loaded from cache');
					await updateCacheStatus();
					loading = false;
					return;
				}
			}

			// Extract fresh data
			const freshData = await extractTransactionData();
			if (freshData.length === 0) {
				error = '⚠️ No transactions found on this page.';
			} else {
				transactions = freshData;
				// Cache the fresh data
				await transactionCache.set(freshData);
				showToastMessage(`🔄 ${freshData.length} transactions extracted and cached`);
			}

			await updateCacheStatus();
		} catch (err) {
			console.error('Error extracting transactions:', err);
			error = '❌ Error extracting transactions. Make sure you are on the PayTracker page.';
			showToastMessage('❌ Extraction failed - check PayTracker page');
		} finally {
			loading = false;
		}
	}

	// CSV formatting helper
	const formatForExport = (name: string) => formatName(name, true);

	const copyAll = async () => {
		const formattedTransactions = filteredTransactions.map((tx) => ({
			...tx,
			date: formatDate(tx.date),
			transactionId: formatTransactionId(tx.transactionId)
		}));
		const csvContent = generateCSV(formattedTransactions, formatForExport);
		const success = await utilCopyToClipboard(csvContent);
		showToastMessage(
			success
				? `📋 ${filteredTransactions.length} transactions copied to clipboard!`
				: '❌ Failed to copy data'
		);
	};

	const exportCSV = () => {
		const formattedTransactions = filteredTransactions.map((tx) => ({
			...tx,
			date: formatDate(tx.date),
			transactionId: formatTransactionId(tx.transactionId)
		}));
		const csvContent = generateCSV(formattedTransactions, formatForExport);
		downloadCSV(csvContent, 'paytracker-transactions.csv');
		showToastMessage(`📄 CSV file with ${filteredTransactions.length} transactions downloaded!`);
	};

	async function checkCache() {
		const hasCache = await transactionCache.has();
		if (hasCache) {
			const cachedData = await transactionCache.get<Transaction[]>();
			if (cachedData && cachedData.length > 0) {
				transactions = cachedData;
				cacheStatus.fromCache = true;
				await updateCacheStatus();
			}
		} else {
			await updateCacheStatus();
		}
	}

	async function updateCacheStatus() {
		cacheStatus.hasCache = await transactionCache.has();
		if (cacheStatus.hasCache) {
			const stats = await transactionCache.getStats();
			if (stats.newestEntry) {
				const ageMs = Date.now() - stats.newestEntry.getTime();
				const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
				const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));

				if (ageHours > 0) {
					cacheStatus.cacheAge = `${ageHours}h ${ageMinutes}m ago`;
				} else {
					cacheStatus.cacheAge = `${ageMinutes}m ago`;
				}
			}
		}
	}

	async function clearCache() {
		await transactionCache.clear();
		cacheStatus.hasCache = false;
		cacheStatus.fromCache = false;
		cacheStatus.cacheAge = '';
		showToastMessage('🗑️ Cache cleared');
	}

	async function forceRefresh() {
		await refresh(false);
	}

	function showToastMessage(message: string) {
		toastMessage = message;
		showToast = true;
		setTimeout(() => {
			showToast = false;
		}, 3000);
	}

	async function copyToClipboard(text: string) {
		const success = await utilCopyToClipboard(text);
		showToastMessage(
			success
				? `📋 Copied: ${text.length > 20 ? text.substring(0, 20) + '...' : text}`
				: '❌ Failed to copy to clipboard'
		);
	}

	function toggleCompactMode() {
		compactMode = !compactMode;
		setSetting('compactMode', compactMode);
	}

	function togglePrivacyMode() {
		privacyMode = !privacyMode;
		setSetting('privacyMode', privacyMode);
		showToastMessage(privacyMode ? '🔒 Privacy mode enabled' : '🔓 Privacy mode disabled');
		// Force immediate table update by triggering reactivity
		transactions = [...transactions];
		filteredTransactions = filterTransactions(transactions, searchTerm);
	}

	function toggleCloverMode() {
		cloverMode = !cloverMode;
		setSetting('cloverMode', cloverMode);
		showToastMessage(
			cloverMode ? '👥 Clover replacement enabled' : '❌ Clover replacement disabled'
		);
		// Force immediate table update by triggering reactivity
		transactions = [...transactions];
		filteredTransactions = filterTransactions(transactions, searchTerm);
	}

	async function detachWindow() {
		// Check for existing detached window
		if (await checkInstanceExists('detached')) {
			const existingWindow = await findExistingDetachedWindow();
			if (existingWindow) {
				chrome.windows.update(existingWindow.id!, { focused: true });
				window.close();
				return;
			}
		}

		// Extract data first if not already available
		if (transactions.length === 0) {
			await refresh();
		}

		// Use improved sync function for data transfer
		if (transactions.length > 0) {
			const syncSuccess = await syncDataBetweenModes('popup');

			// Also store specifically for detached mode
			await chrome.storage.local.set({
				detachedModeData: {
					transactions: transactions,
					searchTerm: searchTerm,
					privacyMode: privacyMode,
					cloverMode: cloverMode
				}
			});

			if (syncSuccess) {
				showToastMessage('💾 Data synchronized for detached window');
			} else {
				showToastMessage('⚠️ Data sync failed, proceeding anyway');
			}
		}

		// Open extension in a new maximized window for better experience
		chrome.windows.create({
			url: createDetachedURL(),
			type: 'popup',
			width: Math.min(1200, Math.round(screen.width * 0.8)),
			height: Math.min(800, Math.round(screen.height * 0.8)),
			focused: true,
			left: Math.round(screen.width * 0.1),
			top: Math.round(screen.height * 0.1),
			state: 'normal'
		});
		// Close current popup
		window.close();
	}

	// Improved data transfer function for consistency between modes
	async function syncDataBetweenModes(sourceMode: 'popup' | 'detached') {
		try {
			const currentData = {
				transactions: transactions,
				searchTerm: searchTerm,
				privacyMode: privacyMode,
				cloverMode: cloverMode,
				timestamp: Date.now()
			};

			// Save to both cache and mode-specific storage
			await transactionCache.set(transactions);
			await chrome.storage.local.set({
				[`${sourceMode}ModeData`]: currentData,
				lastSyncMode: sourceMode,
				lastSyncTime: Date.now()
			});

			return true;
		} catch (error) {
			console.error('Error syncing data between modes:', error);
			return false;
		}
	}

	async function reattachWindow() {
		try {
			// Use improved sync function
			const syncSuccess = await syncDataBetweenModes('detached');

			if (syncSuccess) {
				showToastMessage('💾 Data synchronized, closing window...');
			} else {
				showToastMessage('⚠️ Data sync failed, closing anyway...');
			}

			// Clear detached instance marker and data
			await clearInstanceMarker('detached');
			await chrome.storage.local.remove(['detachedModeData']);

			// Small delay to ensure cache is saved
			setTimeout(() => {
				window.close();
			}, 500);
		} catch (error) {
			console.error('Error in reattach:', error);
			window.close();
		}
	}
</script>

<main
	class="flex flex-col items-center gap-6 bg-white dark:bg-gray-900 p-6 transition-colors duration-200 scrollbar-thin relative"
	class:popup={!isDetached}
	class:detached={isDetached}
	style={isDetached
		? 'height: 100vh; width: 100vw;'
		: 'min-height: 200px; max-height: 600px; height: auto;'}
>
	<!-- Header with theme toggle -->
	<div class="flex items-center justify-between w-full">
		<div class="flex items-center gap-2">
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
				PayTracker Transaction Extractor
			</h2>
			{#if isDetached}
				<span
					class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full"
				>
					Detached
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<!-- Reattach button (only show in detached mode) -->
			{#if isDetached}
				<button
					on:click={reattachWindow}
					class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
					title="Close detached window"
				>
					<svg
						class="w-5 h-5 text-gray-600 dark:text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</button>
			{/if}

			<!-- Settings button -->
			<button
				on:click={() => (showSettings = !showSettings)}
				class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
				title="Settings"
			>
				<svg
					class="w-5 h-5 text-gray-600 dark:text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					></path>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					></path>
				</svg>
			</button>
			<!-- Compact/Expand toggle (only show in popup mode) -->
			{#if !isDetached}
				<button
					on:click={toggleCompactMode}
					class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
					title={compactMode ? 'Expand view' : 'Compact view'}
				>
					<svg
						class="w-5 h-5 text-gray-600 dark:text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						{#if compactMode}
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
							></path>
						{:else}
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
							></path>
						{/if}
					</svg>
				</button>
			{/if}

			<!-- Detach window button (only show in popup mode) -->
			{#if !isDetached}
				<button
					on:click={detachWindow}
					class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
					title="Open in resizable window"
				>
					<svg
						class="w-5 h-5 text-gray-600 dark:text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
						></path>
					</svg>
				</button>
			{/if}

			<!-- Cache controls toggle -->
			<button
				on:click={() => (showCacheControls = !showCacheControls)}
				class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
				title="Cache controls"
			>
				<svg
					class="w-5 h-5 text-gray-600 dark:text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7M4 7c0-2.21 1.79-4 4-4h8c2.21 0 4 1.79 4 4M4 7h16m-4 4h.01M8 11h.01"
					></path>
				</svg>
			</button>

			<!-- Theme toggle -->
			<button
				on:click={toggleTheme}
				class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
				title="Toggle theme"
			>
				{#if darkMode}
					<!-- Sun icon -->
					<svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
							clip-rule="evenodd"
						></path>
					</svg>
				{:else}
					<!-- Moon icon -->
					<svg class="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
						<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
					</svg>
				{/if}
			</button>
		</div>
	</div>

	<!-- Settings panel -->
	{#if showSettings}
		<div
			class="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
		>
			<div class="flex items-center justify-between mb-3">
				<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Settings</p>
			</div>

			<div class="space-y-3">
				<!-- Privacy Mode Toggle -->
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-700 dark:text-gray-300">Privacy Mode</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Replace full names with "Firstname L."
						</p>
					</div>
					<button
						on:click={togglePrivacyMode}
						class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						class:bg-blue-600={privacyMode}
						class:bg-gray-200={!privacyMode}
					>
						<span
							class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
							class:translate-x-6={privacyMode}
							class:translate-x-1={!privacyMode}
						></span>
					</button>
				</div>

				<!-- Clover Customer Members Toggle -->
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm text-gray-700 dark:text-gray-300">
							Replace "Clover Customer" with "Member, Individual"
						</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Replaces "Clover Customer" entries on export/copy
						</p>
					</div>
					<button
						on:click={() => {
							cloverMode = !cloverMode;
							localStorage.setItem('cloverMode', cloverMode.toString());
						}}
						class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						class:bg-blue-600={cloverMode}
						class:bg-gray-200={!cloverMode}
					>
						<span
							class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
							class:translate-x-6={cloverMode}
							class:translate-x-1={!cloverMode}
						></span>
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Cache controls panel -->
	{#if showCacheControls}
		<div
			class="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
		>
			<div class="flex items-center justify-between mb-3">
				<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Cache Status</p>
				{#if cacheStatus.fromCache}
					<span
						class="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full"
						>From Cache</span
					>
				{/if}
			</div>

			{#if cacheStatus.hasCache}
				<p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
					Data cached {cacheStatus.cacheAge} • {transactions.length} transactions
				</p>
				<div class="flex gap-2">
					<button
						on:click={forceRefresh}
						class="flex-1 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
					>
						Force Refresh
					</button>
					<button
						on:click={clearCache}
						class="flex-1 px-3 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
					>
						Clear Cache
					</button>
				</div>
			{:else}
				<p class="text-xs text-gray-500 dark:text-gray-500">No cached data available</p>
			{/if}
		</div>
	{/if}

	<!-- Search input -->
	{#if transactions.length > 0}
		<div class="w-full">
			<div class="relative">
				<input
					type="text"
					bind:value={searchTerm}
					placeholder="Search transactions, customers, amounts..."
					class="w-full px-4 py-2 pl-10 pr-4 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				<svg
					class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					></path>
				</svg>
			</div>
		</div>
	{/if}

	<!-- Extract button -->
	<button
		on:click={() => refresh()}
		disabled={loading}
		class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
	>
		{#if loading}
			<div class="flex items-center justify-center gap-2">
				<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				{isDetached ? 'Extracting from page...' : 'Extracting...'}
			</div>
		{:else}
			{isDetached ? 'Extract from Active Tab' : 'Extract Transactions'}
		{/if}
	</button>

	<!-- Error message -->
	{#if error}
		<div
			class="w-full p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
		>
			<p class="text-red-800 dark:text-red-200 text-sm">{error}</p>
		</div>
	{/if}

	<!-- Transactions table -->
	{#if filteredTransactions.length > 0}
		<div
			class="w-full flex-1 overflow-auto rounded-lg shadow border border-gray-200 dark:border-gray-700 scrollbar-thin"
			class:max-h-48={!isDetached && compactMode}
			class:max-h-80={!isDetached && !compactMode}
			class:h-auto={isDetached}
			style="min-height: 120px;"
		>
			<table class="w-full bg-white dark:bg-gray-800">
				<thead class="bg-gray-50 dark:bg-gray-700">
					<tr>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
							>Customer</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
							>Date</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
							>Amount</th
						>
						<th
							class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
							>ID</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each filteredTransactions as tx, i}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
							<td
								class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 break-words font-semibold select-text cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
								on:click={() => copyToClipboard(formatName(tx.customer))}
								title="Click to copy">{formatName(tx.customer)}</td
							>
							<td
								class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-semibold select-text cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
								on:click={() => copyToClipboard(formatDate(tx.date))}
								title="Click to copy">{formatDate(tx.date)}</td
							>
							<td
								class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-semibold select-text cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
								on:click={() => copyToClipboard(tx.amount)}
								title="Click to copy">{tx.amount}</td
							>
							<td
								class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-mono font-semibold select-text cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
								on:click={() => copyToClipboard(formatTransactionId(tx.transactionId))}
								title="Click to copy">{formatTransactionId(tx.transactionId)}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Search results indicator -->
		{#if searchTerm && filteredTransactions.length !== transactions.length}
			<div class="w-full text-center">
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Showing {filteredTransactions.length} of {transactions.length} transactions
				</p>
			</div>
		{/if}

		<!-- Action buttons -->
		<div class="flex gap-4 w-full">
			<button
				on:click={copyAll}
				class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
					></path>
				</svg>
				Copy All ({filteredTransactions.length})
			</button>
			<button
				on:click={exportCSV}
				class="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					></path>
				</svg>
				Export CSV ({filteredTransactions.length})
			</button>
		</div>
	{:else if transactions.length > 0 && filteredTransactions.length === 0}
		<div class="w-full text-center py-8">
			<p class="text-gray-500 dark:text-gray-400">No transactions match your search criteria</p>
			<button
				on:click={() => (searchTerm = '')}
				class="mt-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
			>
				Clear search
			</button>
		</div>
	{/if}

	<!-- Toast notification -->
	{#if showToast}
		<div class="fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out">
			<div class="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"
					></path>
				</svg>
				{toastMessage}
			</div>
		</div>
	{/if}

	<!-- Resize handle indicator (only shown in detached mode) -->
</main>

<style>
	/* Global styles for proper font rendering */
	:global(body) {
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			'Roboto',
			sans-serif;
	}

	/* Popup mode styling */
	main.popup {
		width: 32rem;
		max-width: 32rem;
		min-height: 200px;
		max-height: 600px; /* Chrome popup size limit */
		height: auto;
		border-radius: 8px;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 4px 6px -2px rgba(0, 0, 0, 0.05);
		overflow-y: auto;
		resize: vertical;
	}

	/* Detached window styling */
	main.detached {
		width: 100vw;
		height: 100vh;
		max-width: 100vw;
		max-height: 100vh;
		border-radius: 0;
		box-shadow: none;
		padding: 24px;
		overflow-y: auto;
	}

	/* Enable text selection like Excel */
	.select-text {
		-webkit-user-select: text;
		-moz-user-select: text;
		-ms-user-select: text;
		user-select: text;
	}

	/* Table styling for better selection */
	table {
		border-collapse: separate;
		border-spacing: 0;
	}

	td.select-text:hover {
		background-color: rgba(59, 130, 246, 0.1);
	}
</style>
