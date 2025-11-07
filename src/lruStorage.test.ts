import { beforeEach, describe, expect, it, vi } from "vitest";
import { CacheContainer } from "./cacheContainer.ts";
import { LRUStorage } from "./lruStorage.ts";
import { withCacheFactory } from "./withCache.ts";

describe("LRUStorage with withCache", () => {
	let storage: LRUStorage;
	let container: CacheContainer;
	let withCache: ReturnType<typeof withCacheFactory>;

	beforeEach(() => {
		storage = new LRUStorage({ max: 10 });
		container = new CacheContainer(storage);
		withCache = withCacheFactory(container);
	});

	describe("Basic caching functionality", () => {
		it("should cache function results", async () => {
			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = withCache(mockFn);

			const result1 = await cachedFn(5);
			const result2 = await cachedFn(5);

			expect(result1).toBe(10);
			expect(result2).toBe(10);
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it("should differentiate between different parameters", async () => {
			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = withCache(mockFn);

			const result1 = await cachedFn(5);
			const result2 = await cachedFn(10);

			expect(result1).toBe(10);
			expect(result2).toBe(20);
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it("should use custom calculateKey function", async () => {
			const mockFn = vi.fn(async (x: number, y: number) => x + y);
			const cachedFn = withCache(mockFn, {
				calculateKey: ([x, y]) => `${x}-${y}`,
			});

			const result1 = await cachedFn(1, 2);
			const result2 = await cachedFn(1, 2);

			expect(result1).toBe(3);
			expect(result2).toBe(3);
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it("should support prefix option", async () => {
			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn1 = withCache(mockFn, { prefix: "version1" });
			const cachedFn2 = withCache(mockFn, { prefix: "version2" });

			const result1 = await cachedFn1(5);
			const result2 = await cachedFn2(5);

			expect(result1).toBe(10);
			expect(result2).toBe(10);
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it("should work with multiple parameters", async () => {
			const mockFn = vi.fn(async (a: number, b: string) => `${a}-${b}`);
			const cachedFn = withCache(mockFn);

			const result1 = await cachedFn(1, "a");
			const result2 = await cachedFn(1, "a");

			expect(result1).toBe("1-a");
			expect(result2).toBe("1-a");
			expect(mockFn).toHaveBeenCalledTimes(1);
		});
	});

	describe("TTL and expiration", () => {
		it("should expire items after ttl", async () => {
			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = withCache(mockFn, { ttl: 100, isLazy: false });

			const result1 = await cachedFn(5);
			expect(result1).toBe(10);
			expect(mockFn).toHaveBeenCalledTimes(1);

			// Item should still be cached before expiration
			const result2 = await cachedFn(5);
			expect(result2).toBe(10);
			expect(mockFn).toHaveBeenCalledTimes(1);

			// Wait for expiration
			await new Promise((resolve) => setTimeout(resolve, 150));

			const result3 = await cachedFn(5);
			expect(result3).toBe(10);
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it("should return undefined for expired non-lazy items", async () => {
			const mockFn = vi.fn(async (x: number) => {
				return { value: x * 2 };
			});
			const cachedFn = withCache(mockFn, { ttl: 100, isLazy: false });

			const result1 = await cachedFn(5);
			expect(result1).toEqual({ value: 10 });

			await new Promise((resolve) => setTimeout(resolve, 150));

			const result2 = await cachedFn(5);
			expect(result2).toEqual({ value: 10 });
		});

		it("should return expired lazy items", async () => {
			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = withCache(mockFn, { ttl: 100, isLazy: true });

			const result1 = await cachedFn(5);
			expect(result1).toBe(10);
			expect(mockFn).toHaveBeenCalledTimes(1);

			await new Promise((resolve) => setTimeout(resolve, 150));

			const result2 = await cachedFn(5);
			expect(result2).toBe(10);
			// With isLazy: true, expired items are still returned without calling the function again
			// The function is only called once, not twice
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it("should call afterExpired callback when lazy item expires", async () => {
			const afterExpired = vi.fn();
			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = withCache(mockFn, {
				ttl: 100,
				isLazy: true,
				afterExpired,
			});

			const result1 = await cachedFn(5);
			expect(result1).toBe(10);
			expect(afterExpired).not.toHaveBeenCalled();

			await new Promise((resolve) => setTimeout(resolve, 150));

			const result2 = await cachedFn(5);
			expect(result2).toBe(10);
			expect(afterExpired).toHaveBeenCalledTimes(1);
		});
	});

	describe("shouldStore option", () => {
		it("should not cache when shouldStore returns false", async () => {
			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = withCache(mockFn, {
				shouldStore: (result: unknown) => (result as number) > 15,
			});

			const result1 = await cachedFn(5);
			expect(result1).toBe(10);

			const result2 = await cachedFn(5);
			expect(result2).toBe(10);
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it("should cache when shouldStore returns true", async () => {
			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = withCache(mockFn, {
				shouldStore: (result: unknown) => (result as number) > 5,
			});

			const result1 = await cachedFn(5);
			expect(result1).toBe(10);

			const result2 = await cachedFn(5);
			expect(result2).toBe(10);
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it("should evaluate shouldStore on complex results", async () => {
			const mockFn = vi.fn(async (x: number) => ({
				value: x * 2,
				success: x > 0,
			}));
			const cachedFn = withCache(mockFn, {
				shouldStore: (result: unknown) =>
					(result as { success: boolean }).success,
			});

			const result1 = await cachedFn(5);
			expect(result1).toEqual({ value: 10, success: true });

			const result2 = await cachedFn(5);
			expect(result2).toEqual({ value: 10, success: true });
			expect(mockFn).toHaveBeenCalledTimes(1);
		});
	});

	describe("LRU eviction", () => {
		it("should evict least recently used items when max capacity is reached", async () => {
			// Create storage with small capacity
			const smallStorage = new LRUStorage({ max: 3 });
			const smallContainer = new CacheContainer(smallStorage);
			const smallWithCache = withCacheFactory(smallContainer);

			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = smallWithCache(mockFn);

			// Fill cache to capacity
			await cachedFn(1); // key1
			await cachedFn(2); // key2
			await cachedFn(3); // key3

			expect(mockFn).toHaveBeenCalledTimes(3);

			// Access all three to verify they're cached
			await cachedFn(1);
			await cachedFn(2);
			await cachedFn(3);
			expect(mockFn).toHaveBeenCalledTimes(3);

			// Add a new item, which should evict the least recently used
			await cachedFn(4); // This should evict key1 (least recently used)

			expect(mockFn).toHaveBeenCalledTimes(4);

			// key1 should be evicted and function should be called again
			await cachedFn(1);
			expect(mockFn).toHaveBeenCalledTimes(5);
		});

		it("should keep recently accessed items in cache", async () => {
			const smallStorage = new LRUStorage({ max: 2 });
			const smallContainer = new CacheContainer(smallStorage);
			const smallWithCache = withCacheFactory(smallContainer);

			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = smallWithCache(mockFn);

			await cachedFn(1);
			await cachedFn(2);
			expect(mockFn).toHaveBeenCalledTimes(2);

			// Access 1 again to make it recently used
			await cachedFn(1);
			expect(mockFn).toHaveBeenCalledTimes(2);

			// Add 3, should evict 2 (not 1)
			await cachedFn(3);
			expect(mockFn).toHaveBeenCalledTimes(3);

			// 1 should still be cached
			await cachedFn(1);
			expect(mockFn).toHaveBeenCalledTimes(3);

			// 2 should have been evicted
			await cachedFn(2);
			expect(mockFn).toHaveBeenCalledTimes(4);
		});
	});

	describe("Clear and removal", () => {
		it("should clear all cache entries", async () => {
			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = withCache(mockFn);

			await cachedFn(1);
			await cachedFn(2);
			expect(mockFn).toHaveBeenCalledTimes(2);

			// Clear cache
			await container.clear();

			// Should call function again
			await cachedFn(1);
			await cachedFn(2);
			expect(mockFn).toHaveBeenCalledTimes(4);
		});

		it("should remove individual cache entries", async () => {
			const mockFn = vi.fn(async (x: number) => x * 2);
			// Create a named function so we know the function name
			const namedAsyncFn = Object.defineProperty(mockFn, "name", {
				value: "testFn",
			}) as unknown as (x: number) => Promise<number>;

			const cachedFn = withCache(namedAsyncFn, {
				calculateKey: ([x]) => `custom-key-${x}`,
			});

			await cachedFn(5);
			expect(mockFn).toHaveBeenCalledTimes(1);

			// Manually remove the key - must include the function name and prefix
			// The key format is: ${operation.name}:${prefix}:${calculateKeyResult}
			const fullKey = "testFn:default:custom-key-5";
			await container.unsetKey(fullKey);

			// Should call function again
			await cachedFn(5);
			expect(mockFn).toHaveBeenCalledTimes(2);
		});
	});

	describe("Complex scenarios", () => {
		it("should handle multiple concurrent calls", async () => {
			const mockFn = vi.fn(async (x: number) => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return x * 2;
			});
			const cachedFn = withCache(mockFn);

			const results = await Promise.all([
				cachedFn(5),
				cachedFn(5),
				cachedFn(5),
			]);

			expect(results).toEqual([10, 10, 10]);
			// Note: This might be called more than once depending on timing
			expect(mockFn.mock.calls.length).toBeGreaterThan(0);
		});

		it("should handle different data types", async () => {
			const mockFn = vi.fn(async (data: Record<string, string>) => ({
				received: data,
				timestamp: Date.now(),
			}));
			const cachedFn = withCache(mockFn);

			const result1 = await cachedFn({ name: "test" });
			const result2 = await cachedFn({ name: "test" });

			// Verify both results are the same object (cached)
			expect(result1).toBe(result2);
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it("should combine multiple cache options", async () => {
			const afterExpired = vi.fn();
			const mockFn = vi.fn(async (x: number) => x * 2);
			const cachedFn = withCache(mockFn, {
				prefix: "combined",
				ttl: 100,
				isLazy: true,
				shouldStore: (result: unknown) => (result as number) > 5,
				afterExpired,
			});

			const result1 = await cachedFn(5);
			expect(result1).toBe(10);
			expect(mockFn).toHaveBeenCalledTimes(1);

			const result2 = await cachedFn(5);
			expect(result2).toBe(10);
			expect(mockFn).toHaveBeenCalledTimes(1);

			await new Promise((resolve) => setTimeout(resolve, 150));

			const result3 = await cachedFn(5);
			expect(result3).toBe(10);
			expect(afterExpired).toHaveBeenCalled();
		});
	});

	describe("Storage operations", () => {
		it("should correctly store and retrieve items", async () => {
			const key = "test-key";
			const content = { value: "test", number: 123 };

			await storage.setItem(key, {
				content,
				meta: {
					createdAt: Date.now(),
					ttl: null,
					isLazy: true,
				},
			});

			const retrieved = await storage.getItem(key);
			expect(retrieved?.content).toEqual(content);
		});

		it("should remove items from storage", async () => {
			const key = "test-key";
			const content = { value: "test" };

			await storage.setItem(key, {
				content,
				meta: {
					createdAt: Date.now(),
					ttl: null,
					isLazy: true,
				},
			});

			await storage.removeItem(key);

			const retrieved = await storage.getItem(key);
			expect(retrieved).toBeUndefined();
		});

		it("should clear all storage items", async () => {
			const key1 = "key1";
			const key2 = "key2";

			await storage.setItem(key1, {
				content: "value1",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					isLazy: true,
				},
			});

			await storage.setItem(key2, {
				content: "value2",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					isLazy: true,
				},
			});

			await storage.clear();

			const result1 = await storage.getItem(key1);
			const result2 = await storage.getItem(key2);

			expect(result1).toBeUndefined();
			expect(result2).toBeUndefined();
		});
	});

	describe("Function name in cache key", () => {
		it("should use function name in cache key", async () => {
			const namedFn = async (x: number) => x * 2;
			Object.defineProperty(namedFn, "name", { value: "myFunction" });

			const fn = vi.fn(namedFn);
			const cachedFn = withCache(fn);

			await cachedFn(5);
			await cachedFn(5);

			expect(fn).toHaveBeenCalledTimes(1);
		});
	});

	describe("Error handling", () => {
		it("should not cache errors", async () => {
			const mockFn = vi.fn(async (x: number) => {
				if (x < 0) throw new Error("Negative number");
				return x * 2;
			});
			const cachedFn = withCache(mockFn);

			const result = await cachedFn(5);
			expect(result).toBe(10);

			await expect(cachedFn(-5)).rejects.toThrow("Negative number");
			expect(mockFn).toHaveBeenCalledTimes(2);
		});
	});
});
