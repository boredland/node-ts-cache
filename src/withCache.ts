import type { CacheContainer, CachingOptions } from "./cacheContainer.ts";
import hash from "./hash.ts";

type WithCacheOptions<Parameters, Result> = Partial<
	Omit<CachingOptions, "calculateKey">
> & {
	/** an optional prefix to prepend to the key */
	prefix?: string;
	/** an optional function to calculate a key based on the parameters of the wrapped function */
	calculateKey?: (input: Parameters) => string;
	/** an optional function that is called when a lazy item has expired and thus got removed  */
	afterExpired?: () => Promise<void>;
	/** an optional function that is called just before the result is stored to the storage */
	shouldStore?: (result: Awaited<Result>) => boolean;
};

/**
 * wrapped function factory
 * @param container - cache container to create the fn for
 * @returns wrapping function
 */
export const withCacheFactory = (container: CacheContainer) => {
	/**
	 * function wrapper
	 * @param operation - the function to be wrapped
	 * @param options - caching options
	 * @returns wrapped operation
	 */
	const withCache = <
		Parameters extends Array<unknown>,
		Result extends Promise<unknown>,
	>(
		operation: (...parameters: Parameters) => Result,
		options: WithCacheOptions<Parameters, Result> = {},
	) => {
		return async (...parameters: Parameters): Promise<Result> => {
			const { calculateKey, ...rest } = options;
			const prefix = options.prefix ?? "default";
			const key = `${operation.name}:${prefix}:${
				calculateKey ? calculateKey(parameters) : hash(parameters)
			}`;
			const cachedResponse = await container.getItem<Awaited<Result>>(key);

			if (cachedResponse) {
				if (cachedResponse.meta.expired && options.afterExpired) {
					await options.afterExpired();
				}
				return cachedResponse.content;
			}

			const result = await operation(...parameters);
			if (!options.shouldStore || options.shouldStore(result)) {
				await container.setItem(key, result, rest);
			}
			return result;
		};
	};
	return withCache;
};
