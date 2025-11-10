import { beforeEach, describe, expect, it } from "vitest";
import type { CachedItem } from "./cacheContainer.ts";
import { FallbackStorage } from "./fallbackStorage.ts";
import type { Storage } from "./storage.ts";

// Mock storage implementation
class MockStorage implements Storage {
	private items: Map<string, CachedItem> = new Map();
	public callCounts = {
		getItem: 0,
		setItem: 0,
		removeItem: 0,
		clear: 0,
	};

	async getItem(key: string): Promise<CachedItem | undefined> {
		this.callCounts.getItem++;
		return this.items.get(key);
	}

	async setItem(key: string, content: CachedItem): Promise<void> {
		this.callCounts.setItem++;
		this.items.set(key, content);
	}

	async removeItem(key: string): Promise<void> {
		this.callCounts.removeItem++;
		this.items.delete(key);
	}

	async clear(): Promise<void> {
		this.callCounts.clear++;
		this.items.clear();
	}

	getStoredItems(): Map<string, CachedItem> {
		return new Map(this.items);
	}

	reset(): void {
		this.items.clear();
		this.callCounts = {
			getItem: 0,
			setItem: 0,
			removeItem: 0,
			clear: 0,
		};
	}
}

describe("FallbackStorage", () => {
	let primaryStorage: MockStorage;
	let secondaryStorage: MockStorage;
	let tertiaryStorage: MockStorage;
	let fallbackStorage: FallbackStorage;

	const createItem = (content: unknown): CachedItem => ({
		content,
		meta: {
			createdAt: Date.now(),
			ttl: null,
			staleTtl: null,
		},
	});

	beforeEach(() => {
		primaryStorage = new MockStorage();
		secondaryStorage = new MockStorage();
		tertiaryStorage = new MockStorage();
		fallbackStorage = new FallbackStorage([
			primaryStorage,
			secondaryStorage,
			tertiaryStorage,
		]);
	});

	describe("setItem", () => {
		it("should write to primary storage", async () => {
			const key = "test-key";
			const item = createItem("test-content");

			await fallbackStorage.setItem(key, item);

			expect(primaryStorage.getStoredItems().get(key)).toEqual(item);
		});

		it("should attempt to write to all storages (fire and forget for non-primary)", async () => {
			const key = "test-key";
			const item = createItem("test-content");

			await fallbackStorage.setItem(key, item);

			// Wait a bit for the background promises to settle
			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(primaryStorage.callCounts.setItem).toBe(1);
			expect(secondaryStorage.callCounts.setItem).toBe(1);
			expect(tertiaryStorage.callCounts.setItem).toBe(1);
		});

		it("should store multiple items in primary storage", async () => {
			const item1 = createItem("content-1");
			const item2 = createItem("content-2");
			const item3 = createItem("content-3");

			await fallbackStorage.setItem("key-1", item1);
			await fallbackStorage.setItem("key-2", item2);
			await fallbackStorage.setItem("key-3", item3);

			expect(primaryStorage.getStoredItems().get("key-1")).toEqual(item1);
			expect(primaryStorage.getStoredItems().get("key-2")).toEqual(item2);
			expect(primaryStorage.getStoredItems().get("key-3")).toEqual(item3);
		});

		it("should overwrite existing item in primary storage", async () => {
			const key = "test-key";
			const item1 = createItem("content-1");
			const item2 = createItem("content-2");

			await fallbackStorage.setItem(key, item1);
			await fallbackStorage.setItem(key, item2);

			expect(primaryStorage.getStoredItems().get(key)).toEqual(item2);
		});

		it("should handle complex objects as content", async () => {
			const key = "complex-key";
			const complexContent = {
				nested: {
					array: [1, 2, 3],
					object: { foo: "bar" },
				},
				primitive: 42,
			};
			const item = createItem(complexContent);

			await fallbackStorage.setItem(key, item);

			expect(primaryStorage.getStoredItems().get(key)).toEqual(item);
		});
	});

	describe("getItem", () => {
		it("should retrieve item from primary storage", async () => {
			const key = "test-key";
			const item = createItem("test-content");
			await primaryStorage.setItem(key, item);

			const retrieved = await fallbackStorage.getItem(key);

			expect(retrieved).toEqual(item);
			expect(primaryStorage.callCounts.getItem).toBe(1);
			expect(secondaryStorage.callCounts.getItem).toBe(0);
		});

		it("should retrieve item from secondary storage if not in primary", async () => {
			const key = "test-key";
			const item = createItem("test-content");
			await secondaryStorage.setItem(key, item);

			const retrieved = await fallbackStorage.getItem(key);

			expect(retrieved).toEqual(item);
			expect(primaryStorage.callCounts.getItem).toBe(1);
			expect(secondaryStorage.callCounts.getItem).toBe(1);
		});

		it("should retrieve item from tertiary storage if not in primary or secondary", async () => {
			const key = "test-key";
			const item = createItem("test-content");
			await tertiaryStorage.setItem(key, item);

			const retrieved = await fallbackStorage.getItem(key);

			expect(retrieved).toEqual(item);
			expect(primaryStorage.callCounts.getItem).toBe(1);
			expect(secondaryStorage.callCounts.getItem).toBe(1);
			expect(tertiaryStorage.callCounts.getItem).toBe(1);
		});

		it("should return undefined if item not found in any storage", async () => {
			const retrieved = await fallbackStorage.getItem("non-existent-key");

			expect(retrieved).toBeUndefined();
			expect(primaryStorage.callCounts.getItem).toBe(1);
			expect(secondaryStorage.callCounts.getItem).toBe(1);
			expect(tertiaryStorage.callCounts.getItem).toBe(1);
		});

		it("should write back item from secondary to primary on get", async () => {
			const key = "test-key";
			const item = createItem("test-content");
			await secondaryStorage.setItem(key, item);

			const retrieved = await fallbackStorage.getItem(key);

			expect(retrieved).toEqual(item);
			expect(primaryStorage.getStoredItems().get(key)).toEqual(item);
		});

		it("should write back item from tertiary to primary and secondary on get", async () => {
			const key = "test-key";
			const item = createItem("test-content");
			await tertiaryStorage.setItem(key, item);

			const retrieved = await fallbackStorage.getItem(key);

			expect(retrieved).toEqual(item);
			expect(primaryStorage.getStoredItems().get(key)).toEqual(item);
			expect(secondaryStorage.getStoredItems().get(key)).toEqual(item);
		});

		it("should prefer primary storage over secondary even if both have the item", async () => {
			const key = "test-key";
			const primaryItem = createItem("primary-content");
			const secondaryItem = createItem("secondary-content");

			await primaryStorage.setItem(key, primaryItem);
			await secondaryStorage.setItem(key, secondaryItem);

			const retrieved = await fallbackStorage.getItem(key);

			expect(retrieved).toEqual(primaryItem);
			expect(primaryStorage.callCounts.getItem).toBe(1);
			expect(secondaryStorage.callCounts.getItem).toBe(0);
		});

		it("should handle rapid sequential get operations", async () => {
			const key = "test-key";
			const item = createItem("test-content");
			await primaryStorage.setItem(key, item);

			const results = await Promise.all([
				fallbackStorage.getItem(key),
				fallbackStorage.getItem(key),
				fallbackStorage.getItem(key),
			]);

			expect(results).toEqual([item, item, item]);
		});
	});

	describe("removeItem", () => {
		it("should remove item from all storages", async () => {
			const key = "test-key";
			const item = createItem("test-content");

			await primaryStorage.setItem(key, item);
			await secondaryStorage.setItem(key, item);
			await tertiaryStorage.setItem(key, item);

			await fallbackStorage.removeItem(key);

			expect(primaryStorage.getStoredItems().get(key)).toBeUndefined();
			expect(secondaryStorage.getStoredItems().get(key)).toBeUndefined();
			expect(tertiaryStorage.getStoredItems().get(key)).toBeUndefined();
		});

		it("should call removeItem on all storages", async () => {
			const key = "test-key";

			await fallbackStorage.removeItem(key);

			expect(primaryStorage.callCounts.removeItem).toBe(1);
			expect(secondaryStorage.callCounts.removeItem).toBe(1);
			expect(tertiaryStorage.callCounts.removeItem).toBe(1);
		});

		it("should not throw when removing non-existent key", async () => {
			await expect(
				fallbackStorage.removeItem("non-existent-key"),
			).resolves.toBeUndefined();
		});

		it("should remove only the specified key", async () => {
			const key1 = "key-1";
			const key2 = "key-2";
			const item = createItem("test-content");

			await primaryStorage.setItem(key1, item);
			await primaryStorage.setItem(key2, item);

			await fallbackStorage.removeItem(key1);

			expect(primaryStorage.getStoredItems().get(key1)).toBeUndefined();
			expect(primaryStorage.getStoredItems().get(key2)).toEqual(item);
		});

		it("should allow re-adding item after removal", async () => {
			const key = "test-key";
			const item1 = createItem("content-1");
			const item2 = createItem("content-2");

			await fallbackStorage.setItem(key, item1);
			await fallbackStorage.removeItem(key);
			await fallbackStorage.setItem(key, item2);

			const retrieved = await fallbackStorage.getItem(key);
			expect(retrieved).toEqual(item2);
		});
	});

	describe("clear", () => {
		it("should clear all storages", async () => {
			const item = createItem("test-content");

			await primaryStorage.setItem("key-1", item);
			await secondaryStorage.setItem("key-2", item);
			await tertiaryStorage.setItem("key-3", item);

			await fallbackStorage.clear();

			expect(primaryStorage.getStoredItems().size).toBe(0);
			expect(secondaryStorage.getStoredItems().size).toBe(0);
			expect(tertiaryStorage.getStoredItems().size).toBe(0);
		});

		it("should call clear on all storages", async () => {
			await fallbackStorage.clear();

			expect(primaryStorage.callCounts.clear).toBe(1);
			expect(secondaryStorage.callCounts.clear).toBe(1);
			expect(tertiaryStorage.callCounts.clear).toBe(1);
		});

		it("should clear empty cache without error", async () => {
			await expect(fallbackStorage.clear()).resolves.toBeUndefined();
		});

		it("should allow adding items after clear", async () => {
			const item1 = createItem("content-1");
			const item2 = createItem("content-2");

			await fallbackStorage.setItem("key-1", item1);
			await fallbackStorage.clear();
			await fallbackStorage.setItem("key-2", item2);

			const retrieved = await fallbackStorage.getItem("key-2");
			expect(retrieved).toEqual(item2);
		});

		it("should handle multiple consecutive clears", async () => {
			const item = createItem("test-content");

			await fallbackStorage.setItem("key-1", item);
			await fallbackStorage.clear();
			await fallbackStorage.clear();

			const retrieved = await fallbackStorage.getItem("key-1");
			expect(retrieved).toBeUndefined();
		});
	});

	describe("with two storages", () => {
		beforeEach(() => {
			fallbackStorage = new FallbackStorage([primaryStorage, secondaryStorage]);
		});

		it("should work with minimal storage setup", async () => {
			const key = "test-key";
			const item = createItem("test-content");

			await fallbackStorage.setItem(key, item);
			const retrieved = await fallbackStorage.getItem(key);

			expect(retrieved).toEqual(item);
		});

		it("should fallback to secondary storage", async () => {
			const key = "test-key";
			const item = createItem("test-content");

			await secondaryStorage.setItem(key, item);

			const retrieved = await fallbackStorage.getItem(key);

			expect(retrieved).toEqual(item);
			expect(primaryStorage.getStoredItems().get(key)).toEqual(item);
		});
	});

	describe("edge cases", () => {
		it("should handle empty string keys", async () => {
			const item = createItem("content");
			const emptyKey = "";

			await fallbackStorage.setItem(emptyKey, item);
			const retrieved = await fallbackStorage.getItem(emptyKey);

			expect(retrieved).toEqual(item);
		});

		it("should handle very long keys", async () => {
			const longKey = "k".repeat(10000);
			const item = createItem("content");

			await fallbackStorage.setItem(longKey, item);
			const retrieved = await fallbackStorage.getItem(longKey);

			expect(retrieved).toEqual(item);
		});

		it("should handle special characters in keys", async () => {
			const specialKeys = [
				"key-with-dashes",
				"key_with_underscores",
				"key.with.dots",
				"key/with/slashes",
				"key:with:colons",
				"key with spaces",
				"key\twith\ttabs",
				"key\nwith\nnewlines",
			];

			const item = createItem("content");

			for (const key of specialKeys) {
				await fallbackStorage.setItem(key, item);
			}

			for (const key of specialKeys) {
				const retrieved = await fallbackStorage.getItem(key);
				expect(retrieved).toEqual(item);
			}
		});

		it("should handle very large objects as content", async () => {
			const largeArray = Array.from({ length: 1000 }, (_, i) => ({
				id: i,
				value: `item-${i}`,
				nested: {
					array: Array(10).fill(i),
					text: "x".repeat(1000),
				},
			}));

			const item = createItem(largeArray);

			await fallbackStorage.setItem("large-key", item);
			const retrieved = await fallbackStorage.getItem("large-key");

			expect(retrieved).toEqual(item);
		});

		it("should handle null and undefined content", async () => {
			const nullItem = createItem(null);
			const undefinedItem = createItem(undefined);

			await fallbackStorage.setItem("null-key", nullItem);
			await fallbackStorage.setItem("undefined-key", undefinedItem);

			const nullRetrieved = await fallbackStorage.getItem("null-key");
			const undefinedRetrieved = await fallbackStorage.getItem("undefined-key");

			expect(nullRetrieved).toEqual(nullItem);
			expect(undefinedRetrieved).toEqual(undefinedItem);
		});

		it.each([
			{ content: "a", ttl: null, staleTtl: null },
			{ content: "b", ttl: 5000, staleTtl: null },
			{ content: "c", ttl: 5000, staleTtl: 3000 },
			{ content: "d", ttl: 0, staleTtl: 0 },
		])(
			"should handle metadata with ttl=$ttl, staleTtl=$staleTtl",
			async ({ content, ttl, staleTtl }) => {
				const item: CachedItem = {
					content,
					meta: {
						createdAt: Date.now(),
						ttl,
						staleTtl,
					},
				};

				const key = `metadata-${content}-${ttl}-${staleTtl}`;
				await fallbackStorage.setItem(key, item);
				const retrieved = await fallbackStorage.getItem(key);

				expect(retrieved).toBeDefined();
				expect(retrieved?.content).toBe(content);
				expect(retrieved?.meta.ttl).toBe(ttl);
				expect(retrieved?.meta.staleTtl).toBe(staleTtl);
			},
		);
	});

	describe("concurrent operations", () => {
		it("should handle concurrent setItem operations", async () => {
			const item = createItem("concurrent-content");

			const promises = Array.from({ length: 10 }, (_, i) =>
				fallbackStorage.setItem(`key-${i}`, item),
			);

			await Promise.all(promises);

			expect(primaryStorage.callCounts.setItem).toBe(10);
		});

		it("should handle concurrent getItem operations", async () => {
			const item = createItem("test-content");
			await primaryStorage.setItem("shared-key", item);

			const promises = Array.from({ length: 10 }, () =>
				fallbackStorage.getItem("shared-key"),
			);

			const results = await Promise.all(promises);

			expect(results).toHaveLength(10);
			expect(results.every((r) => r === item)).toBe(true);
		});

		it("should handle concurrent mixed operations", async () => {
			const promises: Promise<unknown>[] = [];

			for (let i = 0; i < 5; i++) {
				const item = createItem(`content-${i}`);
				promises.push(fallbackStorage.setItem(`key-${i}`, item));
			}

			for (let i = 0; i < 5; i++) {
				promises.push(fallbackStorage.getItem(`key-${i}`));
			}

			for (let i = 0; i < 5; i++) {
				promises.push(fallbackStorage.removeItem(`key-${i}`));
			}

			await expect(Promise.all(promises)).resolves.toBeDefined();
		});

		it("should handle concurrent clear and other operations", async () => {
			const item = createItem("test-content");
			await fallbackStorage.setItem("key-1", item);

			const promises = [
				fallbackStorage.clear(),
				fallbackStorage.setItem("key-2", item),
				fallbackStorage.getItem("key-1"),
			];

			await expect(Promise.all(promises)).resolves.toBeDefined();
		});
	});

	describe("write-back behavior", () => {
		it("should write back items from lower-priority storages to higher-priority ones", async () => {
			const key = "test-key";
			const item = createItem("test-content");

			// Put item only in tertiary storage
			await tertiaryStorage.setItem(key, item);

			// Get item through fallback storage
			await fallbackStorage.getItem(key);

			// Verify it was written back to primary and secondary
			expect(primaryStorage.getStoredItems().get(key)).toEqual(item);
			expect(secondaryStorage.getStoredItems().get(key)).toEqual(item);
			expect(tertiaryStorage.getStoredItems().get(key)).toEqual(item);
		});

		it("should not write back when item is found in primary storage", async () => {
			const key = "test-key";
			const item = createItem("test-content");

			await primaryStorage.setItem(key, item);
			const initialSecondarySetCalls = secondaryStorage.callCounts.setItem;
			const initialTertiarySetCalls = tertiaryStorage.callCounts.setItem;

			await fallbackStorage.getItem(key);

			// Verify secondary and tertiary weren't written to
			expect(secondaryStorage.callCounts.setItem).toBe(
				initialSecondarySetCalls,
			);
			expect(tertiaryStorage.callCounts.setItem).toBe(initialTertiarySetCalls);
		});

		it("should write back to secondary but not tertiary when found in secondary", async () => {
			const key = "test-key";
			const item = createItem("test-content");

			await secondaryStorage.setItem(key, item);
			const initialTertiarySetCalls = tertiaryStorage.callCounts.setItem;

			await fallbackStorage.getItem(key);

			// Verify it was written to primary
			expect(primaryStorage.getStoredItems().get(key)).toEqual(item);
			// Verify tertiary wasn't accessed for write
			expect(tertiaryStorage.callCounts.setItem).toBe(initialTertiarySetCalls);
		});
	});
});
