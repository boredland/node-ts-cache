import type { CachedItem } from "./cacheContainer.ts";

export interface Storage {
	/**
	 * returns a cached item from the storage layer
	 * @param key - key to look up
	 */
	getItem(key: string): Promise<CachedItem | undefined>;

	/**
	 * sets a cached item on the storage layer
	 * @param key - key to store
	 * @param content - content to store, including some meta data
	 */
	setItem(key: string, content: CachedItem): Promise<void>;

	/**
	 * removes item from the storage layer
	 * @param key - key to remove
	 */
	removeItem(key: string): Promise<void>;

	/**
	 * remove all keys from the storage layer
	 */
	clear(): Promise<void>;
}
