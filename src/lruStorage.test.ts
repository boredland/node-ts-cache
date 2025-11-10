import { beforeEach, describe, expect, it } from "vitest";
import type { CachedItem } from "./cacheContainer.ts";
import { LRUStorage } from "./lruStorage.ts";

describe("LRUStorage", () => {
	let storage: LRUStorage;

	beforeEach(() => {
		storage = new LRUStorage();
	});

	describe("setItem", () => {
		it("should store an item in cache", async () => {
			const key = "test-key";
			const item: CachedItem = {
				content: "test-content",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem(key, item);
			const retrieved = await storage.getItem(key);
			expect(retrieved).toEqual(item);
		});

		it("should overwrite existing item with same key", async () => {
			const key = "test-key";
			const item1: CachedItem = {
				content: "content-1",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item2: CachedItem = {
				content: "content-2",
				meta: {
					createdAt: Date.now(),
					ttl: 5000,
					staleTtl: null,
				},
			};

			await storage.setItem(key, item1);
			await storage.setItem(key, item2);
			const retrieved = await storage.getItem(key);
			expect(retrieved).toEqual(item2);
		});

		it("should store multiple different items", async () => {
			const items = [
				{ key: "key-1", content: "content-1" },
				{ key: "key-2", content: "content-2" },
				{ key: "key-3", content: "content-3" },
			];

			for (const { key, content } of items) {
				const item: CachedItem = {
					content,
					meta: {
						createdAt: Date.now(),
						ttl: null,
						staleTtl: null,
					},
				};
				await storage.setItem(key, item);
			}

			for (const { key, content } of items) {
				const retrieved = await storage.getItem(key);
				expect(retrieved?.content).toBe(content);
			}
		});

		it("should store complex objects as content", async () => {
			const key = "complex-key";
			const complexContent = {
				nested: {
					array: [1, 2, 3],
					object: { foo: "bar" },
				},
				primitive: 42,
			};
			const item: CachedItem = {
				content: complexContent,
				meta: {
					createdAt: Date.now(),
					ttl: 1000,
					staleTtl: 500,
				},
			};

			await storage.setItem(key, item);
			const retrieved = await storage.getItem(key);
			expect(retrieved?.content).toEqual(complexContent);
			expect(retrieved?.meta.ttl).toBe(1000);
			expect(retrieved?.meta.staleTtl).toBe(500);
		});

		it("should handle items with null and undefined content", async () => {
			const nullItem: CachedItem = {
				content: null,
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const undefinedItem: CachedItem = {
				content: undefined,
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem("null-key", nullItem);
			await storage.setItem("undefined-key", undefinedItem);

			expect(await storage.getItem("null-key")).toEqual(nullItem);
			expect(await storage.getItem("undefined-key")).toEqual(undefinedItem);
		});
	});

	describe("getItem", () => {
		it("should retrieve a stored item", async () => {
			const key = "test-key";
			const item: CachedItem = {
				content: "test-content",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem(key, item);
			const retrieved = await storage.getItem(key);
			expect(retrieved).toEqual(item);
		});

		it("should return undefined for non-existent key", async () => {
			const retrieved = await storage.getItem("non-existent-key");
			expect(retrieved).toBeUndefined();
		});

		it("should return undefined after item is removed", async () => {
			const key = "test-key";
			const item: CachedItem = {
				content: "test-content",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem(key, item);
			await storage.removeItem(key);
			const retrieved = await storage.getItem(key);
			expect(retrieved).toBeUndefined();
		});

		it("should not modify the stored item when retrieving", async () => {
			const key = "test-key";
			const item: CachedItem = {
				content: { value: 1 },
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem(key, item);
			const retrieved1 = await storage.getItem(key);
			const retrieved2 = await storage.getItem(key);

			expect(retrieved1).toEqual(retrieved2);
			expect(retrieved1).toEqual(item);
		});

		it("should handle rapid sequential get operations", async () => {
			const key = "test-key";
			const item: CachedItem = {
				content: "test-content",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem(key, item);

			const results = await Promise.all([
				storage.getItem(key),
				storage.getItem(key),
				storage.getItem(key),
			]);

			expect(results).toEqual([item, item, item]);
		});
	});

	describe("removeItem", () => {
		it("should remove an item from cache", async () => {
			const key = "test-key";
			const item: CachedItem = {
				content: "test-content",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem(key, item);
			await storage.removeItem(key);
			const retrieved = await storage.getItem(key);
			expect(retrieved).toBeUndefined();
		});

		it("should not throw when removing non-existent key", async () => {
			await expect(
				storage.removeItem("non-existent-key"),
			).resolves.toBeUndefined();
		});

		it("should allow re-adding item after removal", async () => {
			const key = "test-key";
			const item1: CachedItem = {
				content: "content-1",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item2: CachedItem = {
				content: "content-2",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem(key, item1);
			await storage.removeItem(key);
			await storage.setItem(key, item2);

			const retrieved = await storage.getItem(key);
			expect(retrieved).toEqual(item2);
		});

		it("should remove only the specified key", async () => {
			const key1 = "key-1";
			const key2 = "key-2";
			const item: CachedItem = {
				content: "test-content",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem(key1, item);
			await storage.setItem(key2, item);
			await storage.removeItem(key1);

			expect(await storage.getItem(key1)).toBeUndefined();
			expect(await storage.getItem(key2)).toEqual(item);
		});
	});

	describe("clear", () => {
		it("should clear all items from cache", async () => {
			const items = [
				{ key: "key-1", content: "content-1" },
				{ key: "key-2", content: "content-2" },
				{ key: "key-3", content: "content-3" },
			];

			for (const { key, content } of items) {
				const item: CachedItem = {
					content,
					meta: {
						createdAt: Date.now(),
						ttl: null,
						staleTtl: null,
					},
				};
				await storage.setItem(key, item);
			}

			await storage.clear();

			for (const { key } of items) {
				const retrieved = await storage.getItem(key);
				expect(retrieved).toBeUndefined();
			}
		});

		it("should clear empty cache without error", async () => {
			await expect(storage.clear()).resolves.toBeUndefined();
		});

		it("should allow adding items after clear", async () => {
			const key = "test-key";
			const item1: CachedItem = {
				content: "content-1",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item2: CachedItem = {
				content: "content-2",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem(key, item1);
			await storage.clear();
			await storage.setItem(key, item2);

			const retrieved = await storage.getItem(key);
			expect(retrieved).toEqual(item2);
		});

		it("should handle multiple consecutive clears", async () => {
			const item: CachedItem = {
				content: "test-content",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem("key", item);
			await storage.clear();
			await storage.clear();
			await storage.clear();

			const retrieved = await storage.getItem("key");
			expect(retrieved).toBeUndefined();
		});
	});

	describe("LRU eviction behavior", () => {
		it("should evict least recently used item when max size is reached", async () => {
			const smallStorage = new LRUStorage({ max: 3 });

			const item1: CachedItem = {
				content: "content-1",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item2: CachedItem = {
				content: "content-2",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item3: CachedItem = {
				content: "content-3",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item4: CachedItem = {
				content: "content-4",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await smallStorage.setItem("key-1", item1);
			await smallStorage.setItem("key-2", item2);
			await smallStorage.setItem("key-3", item3);
			await smallStorage.setItem("key-4", item4);

			// key-1 should be evicted as it's the least recently used
			expect(await smallStorage.getItem("key-1")).toBeUndefined();
			expect(await smallStorage.getItem("key-2")).toEqual(item2);
			expect(await smallStorage.getItem("key-3")).toEqual(item3);
			expect(await smallStorage.getItem("key-4")).toEqual(item4);
		});

		it("should update LRU order on get operations", async () => {
			const smallStorage = new LRUStorage({ max: 2 });

			const item1: CachedItem = {
				content: "content-1",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item2: CachedItem = {
				content: "content-2",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item3: CachedItem = {
				content: "content-3",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await smallStorage.setItem("key-1", item1);
			await smallStorage.setItem("key-2", item2);

			// Access key-1 to make it recently used
			await smallStorage.getItem("key-1");

			// Add new item, key-2 should be evicted (least recently used)
			await smallStorage.setItem("key-3", item3);

			expect(await smallStorage.getItem("key-1")).toEqual(item1);
			expect(await smallStorage.getItem("key-2")).toBeUndefined();
			expect(await smallStorage.getItem("key-3")).toEqual(item3);
		});

		it("should maintain LRU order with set operations", async () => {
			const smallStorage = new LRUStorage({ max: 2 });

			const item1: CachedItem = {
				content: "content-1",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item2: CachedItem = {
				content: "content-2",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item3: CachedItem = {
				content: "content-3",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			const item1Updated: CachedItem = {
				content: "content-1-updated",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await smallStorage.setItem("key-1", item1);
			await smallStorage.setItem("key-2", item2);

			// Update key-1 to make it recently used
			await smallStorage.setItem("key-1", item1Updated);

			// Add new item, key-2 should be evicted
			await smallStorage.setItem("key-3", item3);

			expect(await smallStorage.getItem("key-1")).toEqual(item1Updated);
			expect(await smallStorage.getItem("key-2")).toBeUndefined();
			expect(await smallStorage.getItem("key-3")).toEqual(item3);
		});
	});

	describe("concurrent operations", () => {
		it("should handle concurrent setItem operations", async () => {
			const promises = [];
			for (let i = 0; i < 10; i++) {
				const item: CachedItem = {
					content: `content-${i}`,
					meta: {
						createdAt: Date.now(),
						ttl: null,
						staleTtl: null,
					},
				};
				promises.push(storage.setItem(`key-${i}`, item));
			}

			await Promise.all(promises);

			for (let i = 0; i < 10; i++) {
				const retrieved = await storage.getItem(`key-${i}`);
				expect(retrieved?.content).toBe(`content-${i}`);
			}
		});

		it("should handle concurrent getItem operations", async () => {
			const item: CachedItem = {
				content: "test-content",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};
			await storage.setItem("shared-key", item);

			const promises = Array.from({ length: 10 }, () =>
				storage.getItem("shared-key"),
			);

			const results = await Promise.all(promises);
			expect(results).toEqual(Array(10).fill(item));
		});

		it("should handle concurrent mixed operations", async () => {
			const promises: Promise<unknown>[] = [];

			for (let i = 0; i < 5; i++) {
				const item: CachedItem = {
					content: `content-${i}`,
					meta: {
						createdAt: Date.now(),
						ttl: null,
						staleTtl: null,
					},
				};
				promises.push(storage.setItem(`key-${i}`, item));
			}

			for (let i = 0; i < 5; i++) {
				promises.push(storage.getItem(`key-${i}`));
			}

			for (let i = 2; i < 4; i++) {
				promises.push(storage.removeItem(`key-${i}`));
			}

			await expect(Promise.all(promises)).resolves.toBeDefined();

			expect(await storage.getItem("key-0")).toBeDefined();
			expect(await storage.getItem("key-2")).toBeUndefined();
			expect(await storage.getItem("key-4")).toBeDefined();
		});
	});

	describe("edge cases", () => {
		it("should handle empty string keys", async () => {
			const item: CachedItem = {
				content: "content",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem("", item);
			const retrieved = await storage.getItem("");
			expect(retrieved).toEqual(item);
		});

		it("should handle very long keys", async () => {
			const longKey = "k".repeat(10000);
			const item: CachedItem = {
				content: "content",
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem(longKey, item);
			const retrieved = await storage.getItem(longKey);
			expect(retrieved).toEqual(item);
		});

		it("should handle special characters in keys", async () => {
			const specialKeys = [
				"key with spaces",
				"key\twith\ttabs",
				"key\nwith\nnewlines",
				"key-with-dashes",
				"key_with_underscores",
				"key.with.dots",
				"key@with#special$chars%",
				"🔑emoji-key🔑",
			];

			for (const key of specialKeys) {
				const item: CachedItem = {
					content: `content-for-${key}`,
					meta: {
						createdAt: Date.now(),
						ttl: null,
						staleTtl: null,
					},
				};

				await storage.setItem(key, item);
				const retrieved = await storage.getItem(key);
				expect(retrieved).toEqual(item);
			}
		});

		it("should handle very large objects as content", async () => {
			const largeContent = {
				data: Array.from({ length: 1000 }, (_, i) => ({
					id: i,
					value: Math.random(),
					nested: {
						array: Array.from({ length: 10 }, (_, j) => j),
						text: "x".repeat(100),
					},
				})),
			};

			const item: CachedItem = {
				content: largeContent,
				meta: {
					createdAt: Date.now(),
					ttl: null,
					staleTtl: null,
				},
			};

			await storage.setItem("large-key", item);
			const retrieved = await storage.getItem("large-key");
			expect(retrieved?.content).toEqual(largeContent);
		});

		it.each([0, 1, Date.now(), Number.MAX_SAFE_INTEGER])(
			"should handle timestamp value: %s",
			async (timestamp) => {
				const item: CachedItem = {
					content: `content-${timestamp}`,
					meta: {
						createdAt: timestamp,
						ttl: null,
						staleTtl: null,
					},
				};

				const key = `timestamp-key-${timestamp}`;
				await storage.setItem(key, item);
				const retrieved = await storage.getItem(key);
				expect(retrieved?.meta.createdAt).toBe(timestamp);
			},
		);

		it.each([null, 0, 1, 1000, Number.MAX_SAFE_INTEGER])(
			"should handle ttl value: %s",
			async (ttlValue) => {
				const item: CachedItem = {
					content: `content-${ttlValue}`,
					meta: {
						createdAt: Date.now(),
						ttl: ttlValue,
						staleTtl: null,
					},
				};

				const key = `ttl-key-${ttlValue}`;
				await storage.setItem(key, item);
				const retrieved = await storage.getItem(key);
				expect(retrieved?.meta.ttl).toBe(ttlValue);
			},
		);
	});
});
