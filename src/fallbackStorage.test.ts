import type { Storage } from "./storage.ts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FallbackStorage } from "./fallbackStorage.ts";
import type { CachedItem } from "./cacheContainer.ts";

// Mock Storage implementation for testing
class MockStorage implements Storage {
  private items: Map<string, CachedItem> = new Map();
  public getItemCalls: string[] = [];
  public setItemCalls: Array<{ key: string; content: CachedItem }> = [];
  public removeItemCalls: string[] = [];

  async getItem(key: string): Promise<CachedItem | undefined> {
    this.getItemCalls.push(key);
    return this.items.get(key);
  }

  async setItem(key: string, content: CachedItem): Promise<void> {
    this.setItemCalls.push({ key, content });
    this.items.set(key, content);
  }

  async removeItem(key: string): Promise<void> {
    this.removeItemCalls.push(key);
    this.items.delete(key);
  }

  async clear(): Promise<void> {
    this.items.clear();
    this.getItemCalls = [];
    this.setItemCalls = [];
    this.removeItemCalls = [];
  }
}

describe("FallbackStorage", () => {
  let storage1: MockStorage;
  let storage2: MockStorage;
  let storage3: MockStorage;
  let fallbackStorage: FallbackStorage;

  const createTestItem = (value: string): CachedItem => ({
    content: value,
    meta: {
      createdAt: Date.now(),
      ttl: null,
      isLazy: false,
    },
  });

  beforeEach(() => {
    storage1 = new MockStorage();
    storage2 = new MockStorage();
    storage3 = new MockStorage();
    fallbackStorage = new FallbackStorage([storage1, storage2, storage3]);
  });

  describe("getItem", () => {
    it("should return item from highest priority storage (storage 1)", async () => {
      const testItem = createTestItem("test-value");
      await storage1.setItem("key1", testItem);

      const result = await fallbackStorage.getItem("key1");

      expect(result).toEqual(testItem);
      expect(storage1.getItemCalls).toContain("key1");
      expect(storage2.getItemCalls).not.toContain("key1");
      expect(storage3.getItemCalls).not.toContain("key1");
    });

    it("should return item from second priority storage if not in first", async () => {
      const testItem = createTestItem("test-value");
      await storage2.setItem("key1", testItem);

      const result = await fallbackStorage.getItem("key1");

      expect(result).toEqual(testItem);
      expect(storage1.getItemCalls).toContain("key1");
      expect(storage2.getItemCalls).toContain("key1");
      expect(storage3.getItemCalls).not.toContain("key1");
    });

    it("should return item from lowest priority storage if not in higher ones", async () => {
      const testItem = createTestItem("test-value");
      await storage3.setItem("key1", testItem);

      const result = await fallbackStorage.getItem("key1");

      expect(result).toEqual(testItem);
      expect(storage1.getItemCalls).toContain("key1");
      expect(storage2.getItemCalls).toContain("key1");
      expect(storage3.getItemCalls).toContain("key1");
    });

    it("should populate higher priority storages when item found in lower one", async () => {
      const testItem = createTestItem("test-value");
      await storage3.setItem("key1", testItem);

      await fallbackStorage.getItem("key1");

      // Item should be set in storage1 and storage2
      expect(storage1.setItemCalls).toContainEqual({
        key: "key1",
        content: testItem,
      });
      expect(storage2.setItemCalls).toContainEqual({
        key: "key1",
        content: testItem,
      });
    });

    it("should not populate higher priority storages when item found in first storage", async () => {
      const testItem = createTestItem("test-value");
      await storage1.setItem("key1", testItem);

      await fallbackStorage.getItem("key1");

      // No setItem calls should be made since item was in highest priority storage
      expect(storage1.setItemCalls).toHaveLength(1); // Only the initial setItem
      expect(storage2.setItemCalls).toHaveLength(0);
      expect(storage3.setItemCalls).toHaveLength(0);
    });

    it("should only populate storages above the source storage, not below", async () => {
      const testItem = createTestItem("test-value");
      await storage2.setItem("key1", testItem);

      await fallbackStorage.getItem("key1");

      // Item should be set in storage1 only, not storage3
      expect(storage1.setItemCalls).toContainEqual({
        key: "key1",
        content: testItem,
      });
      expect(storage3.setItemCalls).toHaveLength(0);
    });

    it("should return undefined when item not found in any storage", async () => {
      const result = await fallbackStorage.getItem("non-existent-key");

      expect(result).toBeUndefined();
      expect(storage1.getItemCalls).toContain("non-existent-key");
      expect(storage2.getItemCalls).toContain("non-existent-key");
      expect(storage3.getItemCalls).toContain("non-existent-key");
    });

    it("should stop searching after finding item", async () => {
      const testItem1 = createTestItem("value1");
      const testItem2 = createTestItem("value2");
      const testItem3 = createTestItem("value3");

      await storage1.setItem("key1", testItem1);
      await storage2.setItem("key1", testItem2);
      await storage3.setItem("key1", testItem3);

      const result = await fallbackStorage.getItem("key1");

      // Should return item from highest priority storage
      expect(result).toEqual(testItem1);
      // Should not query storage2 and storage3
      expect(storage2.getItemCalls).not.toContain("key1");
      expect(storage3.getItemCalls).not.toContain("key1");
    });
  });

  describe("setItem", () => {
    it("should set item in all storages", async () => {
      const testItem = createTestItem("test-value");

      await fallbackStorage.setItem("key1", testItem);

      expect(storage1.setItemCalls).toContainEqual({
        key: "key1",
        content: testItem,
      });
      expect(storage2.setItemCalls).toContainEqual({
        key: "key1",
        content: testItem,
      });
      expect(storage3.setItemCalls).toContainEqual({
        key: "key1",
        content: testItem,
      });
    });

    it("should call setItem on all storages even if one fails", async () => {
      const testItem = createTestItem("test-value");
      const storage2Spy = vi
        .spyOn(storage2, "setItem")
        .mockRejectedValue(new Error("Storage2 error"));

      try {
        await fallbackStorage.setItem("key1", testItem);
      } catch {
        // Expected to fail
      }

      // Should still attempt to set in storage1 and storage3
      expect(storage1.setItemCalls.length).toBeGreaterThan(0);
      expect(storage2Spy).toHaveBeenCalled();
    });
  });

  describe("removeItem", () => {
    it("should remove item from all storages", async () => {
      const testItem = createTestItem("test-value");

      await fallbackStorage.setItem("key1", testItem);
      await fallbackStorage.removeItem("key1");

      expect(storage1.removeItemCalls).toContain("key1");
      expect(storage2.removeItemCalls).toContain("key1");
      expect(storage3.removeItemCalls).toContain("key1");
    });

    it("should remove item from all storages even if it doesn't exist in some", async () => {
      const testItem = createTestItem("test-value");
      await storage1.setItem("key1", testItem);

      await fallbackStorage.removeItem("key1");

      expect(storage1.removeItemCalls).toContain("key1");
      expect(storage2.removeItemCalls).toContain("key1");
      expect(storage3.removeItemCalls).toContain("key1");
    });
  });

  describe("clear", () => {
    it("should clear all storages", async () => {
      const testItem = createTestItem("test-value");

      await fallbackStorage.setItem("key1", testItem);
      await fallbackStorage.setItem("key2", testItem);
      await fallbackStorage.clear();

      // All storages should be cleared
      expect(await storage1.getItem("key1")).toBeUndefined();
      expect(await storage2.getItem("key1")).toBeUndefined();
      expect(await storage3.getItem("key1")).toBeUndefined();
      expect(await storage1.getItem("key2")).toBeUndefined();
      expect(await storage2.getItem("key2")).toBeUndefined();
      expect(await storage3.getItem("key2")).toBeUndefined();
    });
  });

  describe("cache hierarchy", () => {
    it("should work as a proper fallback cache with three-tier hierarchy", async () => {
      const testItem = createTestItem("cached-data");

      // Initially, item only exists in storage3 (slow storage)
      await storage3.setItem("data-key", testItem);

      // First access: should retrieve from storage3 and populate storage1 and storage2
      const result1 = await fallbackStorage.getItem("data-key");
      expect(result1).toEqual(testItem);
      expect(storage1.setItemCalls).toContainEqual({
        key: "data-key",
        content: testItem,
      });
      expect(storage2.setItemCalls).toContainEqual({
        key: "data-key",
        content: testItem,
      });

      // Reset call tracking
      storage1.setItemCalls = [];
      storage2.setItemCalls = [];

      // Second access: should retrieve directly from storage1 (highest priority)
      const result2 = await fallbackStorage.getItem("data-key");
      expect(result2).toEqual(testItem);
      // No additional setItem calls should be made
      expect(storage1.setItemCalls).toHaveLength(0);
      expect(storage2.setItemCalls).toHaveLength(0);
    });

    it("should correctly handle multiple keys in fallback scenario", async () => {
      const item1 = createTestItem("value1");
      const item2 = createTestItem("value2");
      const item3 = createTestItem("value3");

      // Distribute items across different storages
      await storage1.setItem("key1", item1);
      await storage2.setItem("key2", item2);
      await storage3.setItem("key3", item3);

      // Retrieve all items
      const result1 = await fallbackStorage.getItem("key1");
      const result2 = await fallbackStorage.getItem("key2");
      const result3 = await fallbackStorage.getItem("key3");

      expect(result1).toEqual(item1);
      expect(result2).toEqual(item2);
      expect(result3).toEqual(item3);

      // Verify key2 was populated in storage1
      expect(storage1.setItemCalls).toContainEqual({
        key: "key2",
        content: item2,
      });
      // Verify key3 was populated in storage1 and storage2
      expect(storage1.setItemCalls).toContainEqual({
        key: "key3",
        content: item3,
      });
      expect(storage2.setItemCalls).toContainEqual({
        key: "key3",
        content: item3,
      });
    });
  });
});
