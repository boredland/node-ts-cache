import Debug from "debug";
import type { CacheContainer, CachingOptions } from "./cacheContainer";

const debug = Debug("node-ts-cache");

const jsonCalculateKey = <Arguments>(data: {
  className: string;
  methodName: string;
  args: Arguments[];
}) => {
  return `${data.className}:${<string>data.methodName}:${JSON.stringify(
    data.args
  )}`;
};

/**
 * Decorator to be used on class methods to be cached
 * @param container - container instance to be used for the method
 * @param options - caching options to be used for the method
 * @returns the return value of the method, cached or otherwise
 */
export function Cache(
  container: CacheContainer,
  options?: Partial<CachingOptions>
): MethodDecorator {
  return function (
    target: unknown & {
      __node_ts_cache_method_run_queue?: {
        [key: string]: Promise<unknown> | undefined;
      };
    },
    methodName: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor: TypedPropertyDescriptor<any>
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = async function (...args: unknown[]) {
      options ??= {};

      const keyOptions = {
        args,
        methodName: <string>methodName,
        className,
      };
      const cacheKey = options.calculateKey
        ? options.calculateKey(keyOptions)
        : jsonCalculateKey(keyOptions);

      const runOriginalMethod = () => {
        const methodCall = originalMethod.apply(this, args);
        return methodCall;
      };

      if (!target.__node_ts_cache_method_run_queue) {
        target.__node_ts_cache_method_run_queue = {};
      }

      if (target.__node_ts_cache_method_run_queue[cacheKey]) {
        debug(`Method is already enqueued ${cacheKey}`);

        return target.__node_ts_cache_method_run_queue[cacheKey];
      }

      target.__node_ts_cache_method_run_queue[cacheKey] = (async () => {
        try {
          const entry = await container.getItem(cacheKey);

          if (entry) {
            debug(`Cache HIT ${cacheKey}`);

            return entry.content;
          }

          debug(`Cache MISS ${cacheKey}`);

          const methodResult = await runOriginalMethod();

          await container.setItem(cacheKey, methodResult, options);

          return methodResult;
        } finally {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          target.__node_ts_cache_method_run_queue![cacheKey] = undefined;
        }
      })();

      return target.__node_ts_cache_method_run_queue[cacheKey];
    };

    debug(`Added caching for method ${className}:${methodName.toString()}`);

    return descriptor;
  };
}
