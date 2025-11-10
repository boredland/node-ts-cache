import { LRUMapWithDelete } from "mnemonist";
import type { CachedItem } from "./cacheContainer.ts";
import type { Storage } from "./storage.ts";

export class LRUStorage implements Storage {
	private cache: LRUMapWithDelete<string, CachedItem>;

	constructor({ max = 10_000 }: { max?: number } = {}) {
		this.cache = new LRUMapWithDelete<string, CachedItem>(max);
	}

	async clear(): Promise<void> {
		this.cache.clear();
	}

	async getItem(key: string) {
		const item = this.cache.get(key);
		return item;
	}

	async setItem(key: string, content: CachedItem) {
		this.cache.set(key, content);
	}

	async removeItem(key: string) {
		this.cache.delete(key);
	}
}
