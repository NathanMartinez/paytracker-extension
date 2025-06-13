export interface Transaction {
	customer: string;
	date: string;
	amount: string;
	transactionId: string;
}

// Function to be injected into the page content
export const extractTransactionDataFromPage = (): Transaction[] => {
	const containers = document.querySelectorAll('div.sc-bMEPZl.fcfTGk');

	return Array.from(containers).map((container) => {
		const customerElements = container.querySelectorAll("p.sc-kAFUCS.kxJkvp[type='subtitle']");
		const customer = customerElements[0]?.textContent?.trim() || 'No customer selected';
		const date = customerElements[1]?.textContent?.trim() || 'N/A';
		const amount =
			container.querySelector("p.sc-dibcMh.bnjRCI[type='success']")?.textContent?.trim() || 'N/A';
		const transactionId =
			container
				.querySelector('a.sc-goYhtw.bhMCZg[href^="https://clover.com/transactions/"]')
				?.textContent?.trim() || 'N/A';

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
