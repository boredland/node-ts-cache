import { LRUCache } from "lru-cache";
import type { CachedItem } from "./cacheContainer.ts";
import type { Storage } from "./storage.ts";

export class LRUStorage implements Storage {
	private cache: LRUCache<string, CachedItem, unknown>;

	constructor({
		max = 10_000,
	}: Partial<LRUCache<string, CachedItem, unknown>> = {}) {
		this.cache = new LRUCache<string, CachedItem, unknown>({
			max,
		});
	}

	async clear(): Promise<void> {
		this.cache.clear();
	}

	async getItem(key: string) {
		const item = this.cache.get(key);
		return item as CachedItem | undefined;
	}

	async setItem(key: string, content: CachedItem) {
		this.cache.set(key, content);
	}

	async removeItem(key: string) {
		this.cache.delete(key);
	}
}
