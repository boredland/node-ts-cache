# @boredland/node-ts-cache

[![CI](https://github.com/boredland/node-ts-cache/actions/workflows/ci.yml/badge.svg)](https://github.com/boredland/node-ts-cache/actions/workflows/ci.yml)
[![The MIT License](https://img.shields.io/npm/l/node-ts-cache.svg)](http://opensource.org/licenses/MIT)
[![Coverage Status](https://coveralls.io/repos/github/boredland/node-ts-cache/badge.svg?branch=main)](https://coveralls.io/github/ioki/node-ts-cache?branch=main)

Simple and extensible caching module supporting decorators.

## Install

```bash
npm i @boredland/node-ts-cache
```

## Usage

### Wrap your function calls `withCacheFactory`

Function wrapper factory for arbitrary functions. The cache key is caculated based on the parameters passed to the function.

```ts
import { withCacheFactory, CacheContainer } from '@boredland/node-ts-cache'
import { MemoryStorage } from '@boredland/node-ts-cache-storage-memory'

const doThingsCache = new CacheContainer(new MemoryStorage())

const someFn = (input: { a: string, b: number })

const wrappedFn = withCacheFactory(doThingsCache)(someFn);

const result = someFn({ a: "lala", b: 123 })
```

### Using `getItem` and `setItem` directly

```ts
import { CacheContainer } from "@boredland/node-ts-cache";
import { MemoryStorage } from "@boredland/node-ts-cache-storage-memory";

const myCache = new CacheContainer(new MemoryStorage());

class MyService {
  public async getUsers(): Promise<string[]> {
    const { content: cachedUsers } = await myCache.getItem<string[]>("users");

    if (cachedUsers) {
      return cachedUsers;
    }

    const newUsers = ["Max", "User"];

    await myCache.setItem("users", newUsers, { ttl: 60 });

    return newUsers;
  }
}
```

## Logging

This project uses [debug](https://github.com/visionmedia/debug) to log useful caching information.
Set environment variable **DEBUG=node-ts-cache** to enable logging.

## Mocking

Just use the memory storage adapter in your tests.

## LICENSE

Distributed under the MIT License. See LICENSE.md for more information.

## Development & Testing

This project follows the monorepo architecture using yarn workspaces.

To start development and run tests for all the packages, run:

```bash
cd node-ts-cache
npm i
npm run build
npm run test
```

## Credits

As this is a fork of the original [node-ts-cache](https://github.com/havsar/node-ts-cache), all credit goes to the upstream project by [havsar](https://github.com/havsar).

Structural changes have been made by [boredland](https://github.com/boredland) in order to align more with my use-case.

Project Link: [https://github.com/boredland/node-ts-cache](https://github.com/boredland/node-ts-cache)
