# @boredland/node-ts-cache

Simple and extensible caching module with Stale-While-Revalidate (SWR) strategy support.

[![CI](https://github.com/boredland/node-ts-cache/actions/workflows/ci.yml/badge.svg)](https://github.com/boredland/node-ts-cache/actions/workflows/ci.yml)
[![The MIT License](https://img.shields.io/npm/l/node-ts-cache.svg)](http://opensource.org/licenses/MIT)

## Install

```bash
npm i @boredland/node-ts-cache
```

## Usage

### Wrap your function calls with `withCacheFactory`

Function wrapper factory for arbitrary async functions. The cache key is calculated based on the parameters passed to the function.

```ts
import {
  withCacheFactory,
  CacheContainer,
  LRUStorage,
} from "@boredland/node-ts-cache";

const cache = new CacheContainer(new LRUStorage());

const someFn = (input: { a: string; b: number }) => Promise.resolve("result");

const wrappedFn = withCacheFactory(cache)(someFn, {
  prefix: "my-function",
  cacheTimeMs: 60000,
  staleTimeMs: 120000,
});

const result = await wrappedFn({ a: "hello", b: 123 });
```

### Caching Strategy: Stale-While-Revalidate (SWR)

The `withCache` wrapper implements the Stale-While-Revalidate (SWR) caching strategy:

- **Fresh content** (within `cacheTimeMs`): returned immediately without revalidation
- **Stale content** (within `staleTimeMs` after expiration): returned immediately while revalidating in the background
- **Expired content** (beyond `staleTimeMs`): waits for fresh revalidation
- **No caching** (when `cacheTimeMs=0` and `staleTimeMs=0`): function executes every time

This strategy is ideal for scenarios where:

- You want fast response times even with slightly outdated data
- Background revalidation is acceptable
- You want to minimize the number of cache misses

### Options

```ts
const wrappedFn = withCacheFactory(cacheContainer)(someFn, {
  // Cache key prefix for namespacing
  prefix?: string;

  // Time in milliseconds after which cached content is considered "expired"
  // During this period, cached content is returned immediately without revalidation
  // Default: 0 (no caching)
  cacheTimeMs?: number;

  // Time in milliseconds after which cached content is considered "stale"
  // Used for Stale-While-Revalidate: stale content is returned immediately while revalidation happens in the background
  // Must be greater than cacheTimeMs to be effective
  // Default: 0 (no stale caching)
  staleTimeMs?: number;

  // Custom cache key calculation function
  // Default: hash-based on parameters
  calculateKey?: (params: Parameters) => string;

  // Conditional caching predicate
  // Return true to cache the result, false to skip caching
  shouldStore?: (result: Awaited<Result>) => boolean;

  // Concurrency limit for background revalidation tasks
  // Default: 1
  revalidationConcurrency?: number;
});
```

### Example: Different Cache Configurations

#### No Caching (Pass-through)

```ts
const wrappedFn = withCacheFactory(cache)(someFn, {
  cacheTimeMs: 0,
  staleTimeMs: 0,
});
```

#### Fresh-only Caching (60 seconds)

```ts
const wrappedFn = withCacheFactory(cache)(someFn, {
  cacheTimeMs: 60000,
  staleTimeMs: 0,
});
```

#### Stale-While-Revalidate (Fresh for 60s, stale for 120s)

```ts
const wrappedFn = withCacheFactory(cache)(someFn, {
  cacheTimeMs: 60000,
  staleTimeMs: 120000,
  revalidationConcurrency: 5,
});
```

### Using `getItem` and `setItem` directly

```ts
import { CacheContainer, LRUStorage } from "@boredland/node-ts-cache";

const myCache = new CacheContainer(new LRUStorage({ max: 1000 }));

class MyService {
  public async getUsers(): Promise<string[]> {
    const cachedUsers = await myCache.getItem<string[]>("users");

    if (cachedUsers?.content) {
      return cachedUsers.content;
    }

    const newUsers = ["Alice", "Bob"];

    await myCache.setItem("users", newUsers, {
      ttl: 60000, // Content expires after 60 seconds
      staleTtl: 120000, // Content is stale after 120 seconds
    });

    return newUsers;
  }
}
```

## Storage Adapters

### LRUStorage

In-memory LRU (Least Recently Used) cache with automatic eviction:

```ts
import { LRUStorage } from "@boredland/node-ts-cache";

const storage = new LRUStorage({ max: 10000 });
const container = new CacheContainer(storage);
```

**Features:**

- In-memory caching with automatic eviction
- LRU eviction policy when capacity is reached
- Configurable maximum size
- Perfect for testing and single-process applications

### FallbackStorage

Cascading storage that tries multiple storages in order:

```ts
import {
  FallbackStorage,
  LRUStorage,
  RedisStorage,
} from "@boredland/node-ts-cache";

// Try Redis first, fall back to LRU if Redis is unavailable
const storage = new FallbackStorage([
  new RedisStorage(),
  new LRUStorage({ max: 5000 }),
]);

const container = new CacheContainer(storage);
```

**Behavior:**

- On `getItem`: tries each storage in order until finding a hit
- If found in a lower-priority storage: writes it back to all higher-priority storages
- On `setItem`: always writes to the primary storage, attempts to write to others in the background
- Ensures data consistency across multiple storage layers

## Logging

This project uses `debug` to log useful information.
Set environment variable **DEBUG=node-ts-cache** to enable logging.

### Running Tests

```bash
npm test
```

## Development & Testing

### Setup

```bash
cd node-ts-cache
npm i
npm run build
npm test
npm run lint
```

### Commands

- `npm test` - Run test suite with Vitest
- `npm run lint` - Run TypeScript and Biome linting
- `npm run build` - Build the project

## LICENSE

Distributed under the MIT License. See LICENSE.md for more information.

## Credits

As this is a fork of the original [node-ts-cache](https://github.com/havsar/node-ts-cache), all credit goes to the upstream project by [havsar](https://github.com/havsar).

Structural changes have been made by [boredland](https://github.com/boredland) in order to align more with their use-case.

Project Link: [https://github.com/boredland/node-ts-cache](https://github.com/boredland/node-ts-cache)
