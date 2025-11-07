import { debug } from "./debug.ts";
import type { Storage } from "./storage.ts";

export type CachedItem<T = unknown> = {
	content: T;
	meta: {
		createdAt: number;
		ttl: number | null;
		isLazy: boolean;
	};
};

export type CachingOptions = {
	/** Number of milliseconds to expire the cachte item - defaults to forever */
	ttl: number | null;
	/** (Default: true) If true, expired cache entries will be deleted on touch and returned anyway. If false, entries will be deleted after the given ttl. */
	isLazy: boolean;
	/** (Default: JSON.stringify combination of className, methodName and call args) */
	calculateKey: (data: {
		/** The class name for the method being decorated */
		className: string;
		/** The method name being decorated */
		methodName: string;
		/** The arguments passed to the method when called */
		args: unknown[];
	}) => string;
};

export class CacheContainer {
	constructor(private storage: Storage) {}

	public async getItem<T>(
		key: string,
	): Promise<
		{ content: T; meta: { expired: boolean; createdAt: number } } | undefined
	> {
		const item = await this.storage.getItem(key);

		if (!item) return;

		const result = {
			content: item.content as T,
			meta: {
				createdAt: item.meta.createdAt,
				expired: this.isItemExpired(item),
			},
		};

		if (result.meta.expired) await this.unsetKey(key);

		if (result.meta.expired && !item.meta.isLazy) return undefined;

		return result;
	}

	public async setItem(
		key: string,
		content: unknown,
		options?: Partial<CachingOptions>,
	): Promise<void> {
		const finalOptions = {
			ttl: null,
			isLazy: true,
			...options,
		};

		const meta: CachedItem<typeof content>["meta"] = {
			createdAt: Date.now(),
			isLazy: finalOptions.isLazy,
			ttl: finalOptions.ttl,
		};

		await this.storage.setItem(key, { meta, content });
	}

	public async clear(): Promise<void> {
		await this.storage.clear();

		debug("Cleared cache");
	}

	private isItemExpired(item: CachedItem): boolean {
		if (item.meta.ttl === null) return false;
		return Date.now() > item.meta.createdAt + item.meta.ttl;
	}

	public async unsetKey(key: string): Promise<void> {
		await this.storage.removeItem(key);
	}
}
