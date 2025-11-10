import type { CachedItem } from "./cacheContainer.ts";
import type { Storage } from "./storage.ts";

/**
 * Fallback Cache Provider that tries multiple storages in order.
 *
 * On getItem, it tries each storage in order until it finds a hit.
 * If a hit is found in a lower-priority storage, it writes it back to all higher-priority storages.
 * **It only guarantees writing to the highest priority storage on setItem.**
 */
export class FallbackStorage implements Storage {
	private storages: [Storage, ...Storage[]];

	constructor(storages: [Storage, ...Storage[]]) {
		this.storages = storages;
	}

	async clear(): Promise<void> {
		await Promise.all([...this.storages.map((storage) => storage.clear())]);
	}

	async getItem(key: string): Promise<CachedItem | undefined> {
		for (let i = 0; i < this.storages.length; i++) {
			const storage = this.storages[i];
			const item = await storage?.getItem(key);
			if (item !== undefined) {
				if (i !== 0) {
					// Only set in higher priority storages (indices 0 to i-1)
					await Promise.all(
						this.storages
							.slice(0, i)
							.map((storage) => storage.setItem(key, item)),
					);
				}
				return item;
			}
		}
		return undefined;
	}

	async setItem(key: string, content: CachedItem): Promise<void> {
		const [primaryStorage, ...moreStorages] = this.storages;
		await primaryStorage.setItem(key, content);
		void Promise.all(
			moreStorages.map((storage) => storage.setItem(key, content)),
		);
	}

	async removeItem(key: string): Promise<void> {
		await Promise.all(this.storages.map((storage) => storage.removeItem(key)));
	}
}
