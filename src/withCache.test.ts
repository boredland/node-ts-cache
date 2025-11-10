import { beforeEach, describe, expect, it } from "vitest";
import { CacheContainer } from "./cacheContainer.ts";
import { LRUStorage } from "./lruStorage.ts";
import { withCacheFactory } from "./withCache.ts";

describe("withCache", () => {
  let storage: LRUStorage;
  let container: CacheContainer;
  let withCache: ReturnType<typeof withCacheFactory>;

  beforeEach(() => {
    storage = new LRUStorage({ max: 100 });
    container = new CacheContainer(storage);
    withCache = withCacheFactory(container);
  });

  describe("Basic caching", () => {
    it("should cache function results", async () => {
      let callCount = 0;
      const testFn = async (x: number) => {
        callCount++;
        return x * 2;
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
      });

      const result1 = await cachedFn(5);
      const result2 = await cachedFn(5);

      expect(result1).toBe(10);
      expect(result2).toBe(10);
      expect(callCount).toBe(1);
    });

    it("should treat different parameters as different cache entries", async () => {
      let callCount = 0;
      const testFn = async (x: number) => {
        callCount++;
        return x * 2;
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
      });

      const result1 = await cachedFn(5);
      const result2 = await cachedFn(10);
      const result3 = await cachedFn(5); // Uses cache

      expect(result1).toBe(10);
      expect(result2).toBe(20);
      expect(result3).toBe(10);
      expect(callCount).toBe(2);
    });

    it("should handle multiple parameters", async () => {
      let callCount = 0;
      const testFn = async (x: number, y: number) => {
        callCount++;
        return x + y;
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
      });

      const result1 = await cachedFn(5, 10);
      const result2 = await cachedFn(5, 10);
      const result3 = await cachedFn(5, 20);

      expect(result1).toBe(15);
      expect(result2).toBe(15);
      expect(result3).toBe(25);
      expect(callCount).toBe(2);
    });

    it("should use custom calculateKey function", async () => {
      let callCount = 0;
      const testFn = async (obj: { id: number; name: string }) => {
        callCount++;
        return `${obj.id}:${obj.name}`;
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
        calculateKey: (params) => {
          const obj = params[0] as { id: number; name: string };
          return `${obj.id}`;
        },
      });

      const result1 = await cachedFn({ id: 1, name: "Alice" });
      const result2 = await cachedFn({ id: 1, name: "Bob" });

      expect(result1).toBe("1:Alice");
      expect(result2).toBe("1:Alice");
      expect(callCount).toBe(1);
    });

    it("should respect shouldStore predicate", async () => {
      let callCount = 0;
      const testFn = async (x: number) => {
        callCount++;
        return x > 5 ? x * 2 : null;
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
        shouldStore: (result) => result !== null,
      });

      const result1 = await cachedFn(3);
      const result2 = await cachedFn(3);
      const result3 = await cachedFn(10);
      const result4 = await cachedFn(10);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBe(20);
      expect(result4).toBe(20);
      expect(callCount).toBe(3); // Not cached: 3, 3, 10 - cached: 10
    });

    it("should use prefix to namespace cache keys", async () => {
      let callCount = 0;
      const testFn = async (x: number) => {
        callCount++;
        return x * 2;
      };

      const cachedFn1 = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "prefix1",
      });

      const cachedFn2 = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "prefix2",
      });

      await cachedFn1(5);
      await cachedFn2(5);

      expect(callCount).toBe(2);
    });
  });

  describe("Fresh cache behavior", () => {
    it("should return cached value when within cacheTimeMs", async () => {
      let callCount = 0;
      const testFn = async () => {
        callCount++;
        return "result";
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 500,
        staleTimeMs: 1000,
        prefix: "test",
      });

      const result1 = await cachedFn();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const result2 = await cachedFn();

      expect(result1).toBe("result");
      expect(result2).toBe("result");
      expect(callCount).toBe(1);
    });

    it("should not revalidate within fresh cache time", async () => {
      let callCount = 0;
      const testFn = async () => {
        callCount++;
        return `result-${callCount}`;
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 500,
        staleTimeMs: 1000,
        prefix: "test",
      });

      const result1 = await cachedFn();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const result2 = await cachedFn();

      expect(result1).toBe("result-1");
      expect(result2).toBe("result-1");
      expect(callCount).toBe(1);
    });
  });

  describe("Error handling", () => {
    it("should not cache errors by default", async () => {
      let callCount = 0;
      const testFn = async () => {
        callCount++;
        throw new Error("Test error");
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
      });

      let error1: Error | null = null;
      try {
        await cachedFn();
      } catch (e) {
        error1 = e as Error;
      }

      let error2: Error | null = null;
      try {
        await cachedFn();
      } catch (e) {
        error2 = e as Error;
      }

      expect(error1?.message).toBe("Test error");
      expect(error2?.message).toBe("Test error");
      expect(callCount).toBe(2);
    });

    it("should allow error results with shouldStore", async () => {
      let callCount = 0;
      const testFn = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Temporary error");
        }
        return "result";
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
        shouldStore: () => true,
      });

      let error1: Error | null = null;
      try {
        await cachedFn();
      } catch (e) {
        error1 = e as Error;
      }

      expect(error1?.message).toBe("Temporary error");
      expect(callCount).toBe(1);
    });
  });

  describe("Complex scenarios", () => {
    it("should handle different data types as cached values", async () => {
      let callCount = 0;
      const testFn = async (type: string) => {
        callCount++;
        switch (type) {
          case "string":
            return "hello";
          case "number":
            return 42;
          case "object":
            return { key: "value" };
          case "array":
            return [1, 2, 3];
          case "null":
            return null;
          default:
            return undefined;
        }
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
      });

      expect(await cachedFn("string")).toBe("hello");
      expect(await cachedFn("number")).toBe(42);
      expect(await cachedFn("object")).toEqual({ key: "value" });
      expect(await cachedFn("array")).toEqual([1, 2, 3]);
      expect(await cachedFn("null")).toBeNull();
      expect(await cachedFn("undefined")).toBeUndefined();

      expect(callCount).toBe(6);

      // All should be cached now
      expect(await cachedFn("string")).toBe("hello");
      expect(callCount).toBe(6);
    });

    it("should work with complex objects as parameters", async () => {
      let callCount = 0;
      const testFn = async (config: {
        id: number;
        name: string;
        nested: { value: number };
      }) => {
        callCount++;
        return `${config.id}-${config.name}-${config.nested.value}`;
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
      });

      const config = { id: 1, name: "test", nested: { value: 42 } };

      const result1 = await cachedFn(config);
      const result2 = await cachedFn(config);

      expect(result1).toBe("1-test-42");
      expect(result2).toBe("1-test-42");
      expect(callCount).toBe(1);
    });

    it("should handle cache clearing", async () => {
      let callCount = 0;
      const testFn = async () => {
        callCount++;
        return `result-${callCount}`;
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
      });

      const result1 = await cachedFn();
      expect(result1).toBe("result-1");
      expect(callCount).toBe(1);

      await container.clear();

      const result2 = await cachedFn();
      expect(result2).toBe("result-2");
      expect(callCount).toBe(2);
    });

    it("should isolate caches between different functions", async () => {
      let call1Count = 0;
      let call2Count = 0;

      const testFn1 = async () => {
        call1Count++;
        return "fn1";
      };

      const testFn2 = async () => {
        call2Count++;
        return "fn2";
      };

      const cachedFn1 = withCache(testFn1, {
        cacheTimeMs: 1000,
        prefix: "test",
      });

      const cachedFn2 = withCache(testFn2, {
        cacheTimeMs: 1000,
        prefix: "test",
      });

      await cachedFn1();
      await cachedFn1();
      await cachedFn2();
      await cachedFn2();

      expect(call1Count).toBe(1);
      expect(call2Count).toBe(1);
    });

    it("should handle sequential calls with same parameters", async () => {
      let callCount = 0;
      const testFn = async (x: number) => {
        callCount++;
        return x * 2;
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "test",
      });

      const result1 = await cachedFn(5);
      const result2 = await cachedFn(5);
      const result3 = await cachedFn(5);
      const result4 = await cachedFn(10);
      const result5 = await cachedFn(10);

      expect(result1).toBe(10);
      expect(result2).toBe(10);
      expect(result3).toBe(10);
      expect(result4).toBe(20);
      expect(result5).toBe(20);
      expect(callCount).toBe(2);
    });
  });

  describe("Default options", () => {
    it("should not cache when cacheTimeMs is 0 and staleTimeMs is 0", async () => {
      let callCount = 0;
      const testFn = async () => {
        callCount++;
        return "result";
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 0,
        staleTimeMs: 0,
      }); // No cacheTimeMs or staleTimeMs specified (both default to 0)

      const result1 = await cachedFn();
      const result2 = await cachedFn();

      // With cacheTimeMs=0 and staleTimeMs=0, no caching occurs
      expect(result1).toBe("result");
      expect(result2).toBe("result");
      expect(callCount).toBe(2);
    });

    it("should use 'default' prefix when not specified", async () => {
      let callCount = 0;
      const testFn = async () => {
        callCount++;
        return "result";
      };

      // With caching enabled, should work with default prefix
      const cachedFn = withCache(testFn, { cacheTimeMs: 1000 });
      const result1 = await cachedFn();
      const result2 = await cachedFn();

      // Both should return the same cached value
      expect(result1).toBe("result");
      expect(result2).toBe("result");
      expect(callCount).toBe(1);
    });
  });

  describe("Type preservation", () => {
    it("should preserve return type through wrapping", async () => {
      const testFn = async (x: number): Promise<{ value: number }> => {
        return { value: x * 2 };
      };

      const cached = withCache(testFn, { cacheTimeMs: 1000, prefix: "types" });

      const result = await cached(5);
      expect(result.value).toBe(10);
    });
  });

  describe("Concurrent requests with same cache entry", () => {
    it("should share cache across multiple sequential calls when caching is enabled", async () => {
      let callCount = 0;
      const testFn = async () => {
        callCount++;
        return "result";
      };

      const cachedFn = withCache(testFn, {
        cacheTimeMs: 1000,
        prefix: "concurrent",
      });

      // Sequential calls should use cache
      await cachedFn();
      await cachedFn();
      await cachedFn();

      expect(callCount).toBe(1);
    });

    it("should not cache when both cacheTimeMs and staleTimeMs are 0", async () => {
      let callCount = 0;
      const testFn = async () => {
        callCount++;
        return "result";
      };

      const cachedFn = withCache(testFn, {
        prefix: "no-cache",
        cacheTimeMs: 0,
        staleTimeMs: 0,
      });

      // Each call should execute the function
      await cachedFn();
      await cachedFn();
      await cachedFn();

      expect(callCount).toBe(3);
    });
  });
});
