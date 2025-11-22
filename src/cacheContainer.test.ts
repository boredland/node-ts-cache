import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CacheContainer } from "./cacheContainer.ts";
import { LRUStorage } from "./lruStorage.ts";

describe("CacheContainer", () => {
    let storage: LRUStorage;
    let container: CacheContainer;

    beforeEach(() => {
        storage = new LRUStorage({ max: 100 });
        container = new CacheContainer(storage);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should handle ttl and staleTtl correctly when ttl < staleTtl", async () => {
        const key = "test-key-2";
        const content = "test-content-2";

        // Set item with ttl=50ms and staleTtl=100ms
        await container.setItem(key, content, { ttl: 50, staleTtl: 100 });

        // Time 0: Not expired, not stale
        let item = await container.getItem(key);
        expect(item).toBeDefined();
        expect(item?.content).toBe(content);
        expect(item?.meta.state).toBe("fresh");

        // Time 60: Expired, but stale (so treated as stale)
        vi.advanceTimersByTime(60);
        item = await container.getItem(key);
        expect(item).toBeDefined();
        expect(item?.content).toBe(content);
        expect(item?.meta.state).toBe("stale");

        // Time 110: Expired and not stale anymore
        vi.advanceTimersByTime(50); // Total 110
        item = await container.getItem(key);
        expect(item).toBeUndefined();
    });

    it("should handle ttl correctly without staleTtl", async () => {
        const key = "test-key-no-stale";
        const content = "test-content-no-stale";

        // Set item with ttl=100ms and no staleTtl
        await container.setItem(key, content, { ttl: 100 });

        // Time 0: Fresh
        let item = await container.getItem(key);
        expect(item).toBeDefined();
        expect(item?.content).toBe(content);
        expect(item?.meta.state).toBe("fresh");

        // Time 50: Fresh
        vi.advanceTimersByTime(50);
        item = await container.getItem(key);
        expect(item).toBeDefined();
        expect(item?.content).toBe(content);
        expect(item?.meta.state).toBe("fresh");

        // Time 110: Expired
        vi.advanceTimersByTime(60); // Total 110
        item = await container.getItem(key);
        expect(item).toBeUndefined();
    });

    it("should handle ttl and staleTtl correctly when staleTtl < ttl", async () => {
        const key = "test-key-stale-less-than-ttl";
        const content = "test-content";

        // Set item with ttl=100ms and staleTtl=50ms
        // The implementation adjusts staleTtl to be ttl + staleTtl = 150ms
        await container.setItem(key, content, { ttl: 100, staleTtl: 50 });

        // Time 0: Fresh
        let item = await container.getItem(key);
        expect(item).toBeDefined();
        expect(item?.content).toBe(content);
        expect(item?.meta.state).toBe("fresh");

        // Time 60: Fresh (still within ttl)
        vi.advanceTimersByTime(60);
        item = await container.getItem(key);
        expect(item).toBeDefined();
        expect(item?.content).toBe(content);
        expect(item?.meta.state).toBe("fresh");

        // Time 120: Stale (expired > 100, but within staleTtl < 150)
        vi.advanceTimersByTime(60); // Total 120
        item = await container.getItem(key);
        expect(item).toBeDefined();
        expect(item?.content).toBe(content);
        expect(item?.meta.state).toBe("stale");

        // Time 160: Expired ( > 150)
        vi.advanceTimersByTime(40); // Total 160
        item = await container.getItem(key);
        expect(item).toBeUndefined();
    });
});