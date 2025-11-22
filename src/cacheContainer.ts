import { debug } from "./debug.ts";
import type { Storage } from "./storage.ts";

export type CachedItem<T = unknown> = {
	content: T;
	meta: {
		createdAt: number;
		ttl: number | null;
		staleTtl?: number | null;
	};
};

export type CachingOptions = {
	/** Number of milliseconds to expire the cached item - defaults to forever */
	ttl: number | null;
	/** 
	 * Number of milliseconds to mark the cached item stale - defaults to the ttl.
	 * If staleTtl is less than ttl, it will be adjusted to ttl + staleTtl.
	 */
	staleTtl: number | null;
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
	constructor(private storage: Storage) { }

	public async getItem<T>(key: string): Promise<
		| {
			content: T;
			meta: { state: 'fresh' | 'stale' | 'expired'; createdAt: number };
		}
		| undefined
	> {
		const item = await this.storage.getItem(key);

		if (!item) return;

		const isStale = this.isStaleItem(item);
		const isExpired = this.isItemExpired(item);

		let state: "fresh" | "stale" | "expired";

		if (isStale) {
			state = "stale";
		} else if (isExpired) {
			state = "expired";
		} else {
			state = "fresh";
		}

		const result = {
			content: item.content as T,
			meta: {
				...item.meta,
				state,
			},
		};

		if (result.meta.state === "expired") {
			await this.unsetKey(key);
			return undefined;
		}

		return result;
	}

	public async setItem(
		key: string,
		content: unknown,
		options?: Partial<CachingOptions>,
	): Promise<void> {
		const finalOptions = {
			ttl: null,
			staleTtl: null,
			...options,
		};

		if (
			finalOptions.staleTtl &&
			finalOptions.ttl &&
			finalOptions.staleTtl < finalOptions.ttl
		) {
			debug(
				`staleTtl (${finalOptions.staleTtl}ms) is less than ttl (${finalOptions.ttl}ms); adjusting staleTtl to be ttl+staleTtl`,
			);
			finalOptions.staleTtl = finalOptions.ttl + finalOptions.staleTtl;
		}

		const meta: CachedItem<typeof content>["meta"] = {
			createdAt: Date.now(),
			ttl: finalOptions.ttl,
			staleTtl: finalOptions.staleTtl,
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

	private isStaleItem(item: CachedItem): boolean {
		if (!this.isItemExpired(item)) return false;
		if (item.meta.staleTtl == null) return false;
		return Date.now() <= item.meta.createdAt + item.meta.staleTtl;
	}

	public async unsetKey(key: string): Promise<void> {
		await this.storage.removeItem(key);
	}
}
