import PQueue from "p-queue";
import type { CacheContainer, CachingOptions } from "./cacheContainer.ts";
import hash from "./hash.ts";

const revalidationQueues: Record<string, PQueue> = {};

type WithCacheOptions<Parameters, Result> = Partial<
  Omit<CachingOptions, "calculateKey" | "isLazy">
> & {
  /** an optional prefix to prepend to the key */
  prefix?: string;
  /** an optional function to calculate a key based on the parameters of the wrapped function */
  calculateKey?: (input: Parameters) => string;
  /** an optional function that is called just before the result is stored to the storage */
  shouldStore?: (result: Awaited<Result>) => boolean;
  /**
   * caching strategy to use
   * - "lazy": cache is populated in the background after returning the result
   * - "swr": stale-while-revalidate, cache is returned if present and updated in the background
   * - "eager": cache is populated before returning the result
   * @default "eager"
   */
  strategy?: "lazy" | "swr" | "eager";
  /**
   * Concurrency for revalidation queue
   * @default 1
   */
  revalidationConcurrency?: number;
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
      const {
        calculateKey,
        strategy = "eager",
        revalidationConcurrency: concurrency = 1,
        ...rest
      } = options;
      const prefix = options.prefix ?? "default";
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
        if (!options.shouldStore || options.shouldStore(result)) {
          await container.setItem(key, result, {
            ...rest,
            isLazy: strategy === "lazy" || strategy === "swr",
          });
        }
        return result;
      };

      /**
       * Stale-While-Revalidate strategy
       * If the cached response is expired, we return it immediately and
       * revalidate in the background
       */
      if (strategy === "swr" && cachedResponse?.meta.expired) {
        if (
          !revalidationQueues[queueName].runningTasks.some(
            (t) => t.id === key && t.startTime,
          )
        ) {
          revalidationQueues[queueName].add(refreshedItem, {
            id: key,
          });
        }
      }

      if (cachedResponse) {
        return cachedResponse.content;
      }

      const result = await refreshedItem();
      return result;
    };
  };
  return withCache;
};
