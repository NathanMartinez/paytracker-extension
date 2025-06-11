// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
// and what to do when importing types
declare namespace App {
	// interface Locals {}
	// interface PageData {}
	// interface Error {}
	// interface Platform {}
}

// Chrome extension API types
declare namespace chrome {
	namespace tabs {
		interface Tab {
			id?: number;
			url?: string;
			title?: string;
			active?: boolean;
		}

		function query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
		function sendMessage(tabId: number, message: any): Promise<any>;
	}

	namespace runtime {
		interface MessageSender {
			tab?: Tab;
		}

		function onMessage(
			callback: (
				message: any,
				sender: MessageSender,
				sendResponse: (response: any) => void
			) => boolean | void
		): void;
	}

	namespace scripting {
		interface InjectionTarget {
			tabId: number;
			frameIds?: number[];
			documentIds?: string[];
			allFrames?: boolean;
		}

		interface ScriptInjection<Args extends any[], Return> {
			target: InjectionTarget;
			func: (...args: Args) => Return;
			args?: Args;
			world?: 'ISOLATED' | 'MAIN';
			injectImmediately?: boolean;
		}

		interface InjectionResult<T> {
			result: T;
			frameId: number;
		}

		function executeScript<Args extends any[], Return>(
			injection: ScriptInjection<Args, Return>
		): Promise<InjectionResult<Return>[]>;
	}

	namespace storage {
		interface StorageArea {
			get(
				keys?: string | string[] | { [key: string]: any } | null
			): Promise<{ [key: string]: any }>;
			set(items: { [key: string]: any }): Promise<void>;
			remove(keys: string | string[]): Promise<void>;
			clear(): Promise<void>;
			getBytesInUse(keys?: string | string[] | null): Promise<number>;
		}

		const local: StorageArea;
		const sync: StorageArea;
		const session: StorageArea;

		interface StorageChange {
			oldValue?: any;
			newValue?: any;
		}

		interface StorageChanges {
			[key: string]: StorageChange;
		}

		function onChanged(callback: (changes: StorageChanges, areaName: string) => void): void;
	}
}
