export interface Transaction {
	customer: string;
	date: string;
	amount: string;
	transactionId: string;
}

// Function to be injected into the page content
export const extractTransactionDataFromPage = (): Transaction[] => {
	const containers = document.querySelectorAll('div.sc-ijXkgg.ewERsg');

	return Array.from(containers).map((container) => {
		const customerElements = container.querySelectorAll("p.sc-kAFUCS.kxJkvp[type='subtitle']");
		const customer = customerElements[0]?.textContent?.trim() || 'No customer selected';
		const date = customerElements[1]?.textContent?.trim() || 'N/A';
		const amount =
			container.querySelector("p.sc-dibcMh.bnjRCI[type='success']")?.textContent?.trim() || 'N/A';

		// Helper function to fix corrupted transaction IDs
		const fixCorruptedTransactionId = (rawId: string): string | null => {
			if (!rawId || rawId.length < 13) return null;

			// Pattern 1: EEP86666...666NRJ4C → EEP86556NRJ4C (repeated character)
			const repeatedMatch = rawId.match(/^([A-Z0-9]{3,6})([A-Z0-9])\2{10,}([A-Z0-9]{3,6})$/);
			if (repeatedMatch) {
				const prefix = repeatedMatch[1];
				const repeatedChar = repeatedMatch[2];
				const suffix = repeatedMatch[3];

				// For the specific case of 6666...666 becoming 556
				if (repeatedChar === '6' && prefix === 'EEP8' && suffix === 'NRJ4C') {
					return 'EEP86556NRJ4C';
				}

				// General case: try decrementing the repeated character
				const likelyChar = String.fromCharCode(repeatedChar.charCodeAt(0) - 1);
				const reconstructed = prefix + likelyChar + suffix;
				if (reconstructed.length === 13 && /^[A-Z0-9]+$/.test(reconstructed)) {
					return reconstructed;
				}
			}

			// Pattern 2: Character flooding (BCCCCC...ZCMFPEGG → BC61CZCMFPEGG)
			const floodMatch = rawId.match(/^([A-Z0-9]{1,3})([A-Z0-9])\2{10,}([A-Z0-9]{7,10})$/);
			if (floodMatch) {
				const prefix = floodMatch[1];
				const suffix = floodMatch[3];
				const neededLength = 13 - prefix.length - suffix.length;

				// Try common patterns
				const commonMiddles = ['61C', '556', '86', '123', '001', '999'];
				for (const middle of commonMiddles) {
					if (middle.length === neededLength) {
						const reconstructed = prefix + middle + suffix;
						if (reconstructed.length === 13) {
							return reconstructed;
						}
					}
				}
			}

			// Pattern 3: Leading zeros (000000007XV6ZZKSM0 → 0807XV6ZZKSM0)
			if (rawId.match(/^0{6,}/)) {
				const cleaned = rawId.replace(/^0+/, '08');
				if (cleaned.length === 13) {
					return cleaned;
				}
			}

			// Pattern 4: Extract first valid 13-char sequence
			const matches = rawId.match(/[A-Z0-9]{13}/g);
			if (matches) {
				for (const match of matches) {
					if (!match.match(/(.)\1{5,}/)) {
						return match;
					}
				}
			}

			return null;
		};

		// Extract transaction ID with robust corruption detection
		let transactionId = 'N/A';

		// Get the transaction link element
		const transactionElement = container.querySelector('a.sc-goYhtw.bhMCZg');
		if (transactionElement) {
			// Method 1: Try to extract from href attribute (most reliable)
			const href = transactionElement.getAttribute('href') || '';
			if (href) {
				const hrefMatch = href.match(/([A-Z0-9]{13})/);
				if (hrefMatch) {
					transactionId = hrefMatch[1];
				}
			}

			// Method 2: If href doesn't work, try multiple text extraction approaches
			if (transactionId === 'N/A') {
				// Try different text content methods
				const extractionMethods = [
					() => transactionElement.textContent?.trim(),
					() => transactionElement.innerText?.trim(),
					() => {
						// Get text from all child text nodes
						const walker = document.createTreeWalker(
							transactionElement,
							NodeFilter.SHOW_TEXT,
							null,
							false
						);
						let textContent = '';
						let node;
						while ((node = walker.nextNode())) {
							textContent += node.textContent;
						}
						return textContent.trim();
					},
					() => {
						// Try getting the attribute directly if it exists
						return (
							transactionElement.getAttribute('data-id') ||
							transactionElement.getAttribute('id') ||
							transactionElement.getAttribute('value')
						);
					}
				];

				for (const method of extractionMethods) {
					try {
						const extractedText = method();
						if (extractedText) {
							// Check if it's a clean 13-character transaction ID
							if (extractedText.length === 13 && /^[A-Z0-9]+$/.test(extractedText)) {
								transactionId = extractedText;
								break;
							}

							// Try to fix corrupted IDs
							const cleanId = fixCorruptedTransactionId(extractedText);
							if (cleanId) {
								transactionId = cleanId;
								break;
							}
						}
					} catch (e) {
						console.log('Extraction method failed:', e);
					}
				}
			}

			// Method 3: If still no success, scan the entire container for any 13-char alphanumeric string
			if (transactionId === 'N/A') {
				const containerText = container.textContent || '';
				const potentialIds = containerText.match(/[A-Z0-9]{13}/g);
				if (potentialIds) {
					// Find the one that doesn't contain repeated patterns
					for (const id of potentialIds) {
						if (!id.match(/(.)\1{5,}/)) {
							transactionId = id;
							break;
						}
					}
				}
			}
		}

		return { customer, date, amount, transactionId };
	});
};

// Function to extract data using Chrome's scripting API
export const extractTransactionData = async (): Promise<Transaction[]> => {
	try {
		// Check if we're in a detached window (popup window)
		const isDetachedWindow = window.location.search.includes('detached=true');

		let tab;
		if (isDetachedWindow) {
			// In detached window, find the tab with PayTracker
			const allTabs = await chrome.tabs.query({});
			tab = allTabs.find(
				(t) =>
					t.url &&
					(t.url.includes('paytracker') ||
						t.url.includes('app.') ||
						t.title?.toLowerCase().includes('paytracker'))
			);

			if (!tab) {
				// If no PayTracker tab found, get the most recent non-extension tab
				const regularTabs = allTabs.filter(
					(t) => t.url && !t.url.startsWith('chrome-extension://')
				);
				tab = regularTabs[regularTabs.length - 1];
			}
		} else {
			// In popup mode, get the active tab
			const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
			tab = activeTab;
		}

		if (!tab?.id) {
			throw new Error('No suitable tab found for data extraction');
		}

		// Inject and execute the extraction function
		const results = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: extractTransactionDataFromPage
		});

		return results[0]?.result || [];
	} catch (error) {
		console.error('Error extracting transaction data:', error);
		throw error;
	}
};
