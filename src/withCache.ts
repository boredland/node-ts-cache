import PQueue from "p-queue";
import type { CacheContainer } from "./cacheContainer.ts";
import hash from "./hash.ts";

const revalidationQueues: Record<string, PQueue> = {};

type WithCacheOptions<Parameters, Result> = {
	/** An optional prefix to prepend to the cache key for namespacing purposes */
	prefix?: string;
	/** An optional function to calculate a cache key based on the function parameters. Defaults to hashing the parameters */
	calculateKey?: (input: Parameters) => string;
	/** An optional predicate function to determine whether a result should be cached. Useful for filtering out error responses or invalid data */
	shouldStore?: (result: Awaited<Result>) => boolean;
	/**
	 * Concurrency limit for background revalidation tasks in the queue
	 * @default 1
	 */
	revalidationConcurrency?: number;
	/**
	 * Time in milliseconds after which cached content is considered "expired" and no longer fresh.
	 * During this period, cached content is returned immediately without revalidation.
	 * When set to 0 along with staleTimeMs=0, caching is disabled entirely.
	 * @default 0 (no caching)
	 */
	cacheTimeMs?: number;
	/**
	 * Time in milliseconds after which cached content is considered "stale".
	 * Used for Stale-While-Revalidate: stale content is returned immediately while revalidation happens in the background.
	 * Must be greater than cacheTimeMs to be effective. When both cacheTimeMs and staleTimeMs are 0, caching is disabled.
	 * @default 0 (no stale caching)
	 */
	staleTimeMs?: number;
};

/**
 * Creates a withCache wrapper function for a specific cache container.
 * Implements Stale-While-Revalidate (SWR) caching strategy:
 * - Fresh content (within cacheTimeMs): returned immediately without revalidation
 * - Stale content (within staleTimeMs after expiration): returned immediately while revalidating in background
 * - Expired content (beyond staleTimeMs): waits for fresh revalidation
 * - No caching (when cacheTimeMs=0 and staleTimeMs=0): function executes every time
 *
 * @param container - The cache container instance to store and retrieve cached values
 * @returns A withCache function bound to the provided container
 */
export const withCacheFactory = (container: CacheContainer) => {
	/**
	 * Wraps an async function with caching and Stale-While-Revalidate (SWR) logic.
	 * Multiple concurrent calls with the same parameters share the same cache entry and revalidation queue.
	 *
	 * @param operation - The async function to wrap with caching
	 * @param options - Caching and revalidation options
	 * @returns An async wrapper function that returns cached or freshly computed results
	 */
	const withCache = <
		Parameters extends Array<unknown>,
		Result extends Promise<unknown>,
	>(
		operation: (...parameters: Parameters) => Result,
		{
			cacheTimeMs = 0,
			staleTimeMs = 0,
			calculateKey = hash,
			revalidationConcurrency: concurrency = 1,
			prefix = "default",
			shouldStore = () => true,
		}: WithCacheOptions<Parameters, Result> = {},
	) => {
		return async (...parameters: Parameters): Promise<Result> => {
			const key = `${operation.name}:${prefix}:${
				calculateKey ? calculateKey(parameters) : hash(parameters)
			}` as const;

			const queueName = `${operation.name}:${prefix}` as const;

			revalidationQueues[queueName] =
				revalidationQueues[queueName] ??
				new PQueue({
					concurrency,
				});
			revalidationQueues[queueName].concurrency = concurrency;

			const cachedResponse = await container.getItem<Awaited<Result>>(key);

			const refreshedItem = async () => {
				const result = await operation(...parameters);
				if (shouldStore(result)) {
					await container.setItem(key, result, {
						ttl: cacheTimeMs,
						staleTtl: staleTimeMs,
					});
				}
				return result;
			};

			/**
			 * The easiest case: no caching at all
			 */
			if (cacheTimeMs === 0 && staleTimeMs === 0) {
				return operation(...parameters);
			}

			/**
			 * The easy case: we have a valid cached response
			 */
			if (cachedResponse && !cachedResponse.meta.expired) {
				return cachedResponse.content;
			}

			/**
			 * Stale-While-Revalidate strategy:
			 * If the cached response is expired but stale
			 * we return the stale value immediately and revalidate in the background
			 */
			if (cachedResponse?.meta.expired && cachedResponse?.meta.stale) {
				if (
					!revalidationQueues[queueName].runningTasks.some(
						(t) => t.id === key && t.startTime,
					)
				) {
					revalidationQueues[queueName].add(refreshedItem, {
						id: key,
					});
				}

				return cachedResponse.content;
			}

			const result = await refreshedItem();
			return result;
		};
	};
	return withCache;
};
