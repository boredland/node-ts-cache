# @boredland/node-ts-cache

Simple and extensible caching module supporting multiple caching strategies.

[![CI](https://github.com/boredland/node-ts-cache/actions/workflows/ci.yml/badge.svg)](https://github.com/boredland/node-ts-cache/actions/workflows/ci.yml)
[![The MIT License](https://img.shields.io/npm/l/node-ts-cache.svg)](http://opensource.org/licenses/MIT)

## Install

```bash
npm i @boredland/node-ts-cache
```

## Usage

### Wrap your function calls with `withCacheFactory`

Function wrapper factory for arbitrary functions. The cache key is calculated based on the parameters passed to the function.

```ts
import {
  withCacheFactory,
  CacheContainer,
  LRUStorage,
} from "@boredland/node-ts-cache";

const doThingsCache = new CacheContainer(new LRUStorage());

const someFn = (input: { a: string; b: number }) => Promise.resolve("result");

const wrappedFn = withCacheFactory(doThingsCache)(someFn, {
  prefix: "my-function",
  strategy: "eager", // or "lazy" or "swr"
});

const result = await wrappedFn({ a: "lala", b: 123 });
```

### Caching Strategies

The `withCache` wrapper supports three different caching strategies:

#### Eager (Default)

```ts
const wrappedFn = withCacheFactory(cacheContainer)(someFn, {
  strategy: "eager",
});
```

- Cache is populated before returning the result
- Expired items are removed and the function is called again

#### Lazy

```ts
const wrappedFn = withCacheFactory(cacheContainer)(someFn, {
  strategy: "lazy",
});
```

- Cache is populated in the background after returning the result
- Expired items are invalidated on touch (when accessed)

#### Stale-While-Revalidate (SWR)

```ts
const wrappedFn = withCacheFactory(cacheContainer)(someFn, {
  strategy: "swr",
});
```

- Returns expired cache immediately while revalidating in the background
- Revalidation is queued with configurable concurrency
- Perfect for scenarios where stale data is acceptable
- Only one concurrent revalidation is enqueued per cache-key

### Advanced Options

```ts
const wrappedFn = withCacheFactory(cacheContainer)(someFn, {
  prefix: "my-function", // Cache key prefix
  strategy: "swr", // Caching strategy
  ttl: 60000, // Time-to-live in milliseconds (null = forever)
  revalidationConcurrency: 5, // Max concurrent background revalidations (default: 1)
  calculateKey: (params) => {
    // Custom key calculation
    return `${params[0]}-${params[1]}`;
  },
  shouldStore: (result) => {
    // Conditional caching
    return result && result.success;
  },
});
```

### Using `getItem` and `setItem` directly

```ts
import { CacheContainer, LRUStorage } from "@boredland/node-ts-cache";

const myCache = new CacheContainer(new LRUStorage({ max: 1000 }));

class MyService {
  public async getUsers(): Promise<string[]> {
    const cachedUsers = await myCache.getItem<string[]>("users");

    if (cachedUsers) {
      return cachedUsers.content;
    }

    const newUsers = ["Max", "User"];

    await myCache.setItem("users", newUsers, { ttl: 60000 });

    return newUsers;
  }
}
```

### LRUStorage

The `LRUStorage` adapter uses an in-memory LRU (Least Recently Used) cache with configurable capacity:

```ts
import { LRUStorage } from "@boredland/node-ts-cache";

// Create an LRU cache with max 10,000 items
const storage = new LRUStorage({ max: 10000 });

const container = new CacheContainer(storage);
```

**Features:**

- In-memory caching with automatic eviction
- LRU eviction policy when capacity is reached
- Configurable maximum size
- Perfect for testing and single-process applications

## Logging

This project uses `debug` to log useful information.
Set environment variable **DEBUG=node-ts-cache** to enable logging.

### Running Tests

```bash
npm test
```

### Example Test Usage

For a complete example of how to test with `LRUStorage`, see the [comprehensive test suite](./src/lruStorage.test.ts):

## LICENSE

Distributed under the MIT License. See LICENSE.md for more information.

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

## Credits

As this is a fork of the original [node-ts-cache](https://github.com/havsar/node-ts-cache), all credit goes to the upstream project by [havsar](https://github.com/havsar).

Structural changes have been made by [boredland](https://github.com/boredland) in order to align more with their use-case.

Project Link: [https://github.com/boredland/node-ts-cache](https://github.com/boredland/node-ts-cache)
