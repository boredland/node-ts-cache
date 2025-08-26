# @ioki/node-ts-cache

[![CI](https://github.com/ioki-mobility/node-ts-cache/actions/workflows/ci.yml/badge.svg)](https://github.com/ioki-mobility/node-ts-cache/actions/workflows/ci.yml)
[![The MIT License](https://img.shields.io/npm/l/node-ts-cache.svg)](http://opensource.org/licenses/MIT)
[![Coverage Status](https://coveralls.io/repos/github/ioki-mobility/node-ts-cache/badge.svg?branch=main)](https://coveralls.io/github/ioki/node-ts-cache?branch=main)

Simple and extensible caching module supporting decorators.

## Install

```bash
yarn add @ioki/node-ts-cache
```

_Note: The underlying storage layer must be installed separately._

## Storage

| Storage                                                               | Install                                         |
|-----------------------------------------------------------------------|-------------------------------------------------|
| [memory](https://www.npmjs.com/package/@ioki/node-ts-cache-storage-memory)| ```yarn add @ioki/node-ts-cache-storage-memory```|
| [node-fs](https://www.npmjs.com/package/@ioki/node-ts-cache-storage-node-fs)| ```yarn add @ioki/node-ts-cache-storage-node-fs```|
| [ioredis](https://www.npmjs.com/package/@ioki/node-ts-cache-storage-ioredis)| ```yarn add @ioki/node-ts-cache-storage-ioredis```|
| [postgres](https://www.npmjs.com/package/@ioki/node-ts-cache-storage-pg)| ```yarn add @ioki/node-ts-cache-storage-pg```|
| [elasticsearch](https://www.npmjs.com/package/@ioki/node-ts-cache-storage-elasticsearch)| ```yarn add @ioki/node-ts-cache-storage-elasticsearch```|

## Usage

### Wrap your function calls `withCacheFactory`

Function wrapper factory for arbitrary functions. The cache key is caculated based on the parameters passed to the function.

```ts
import { withCacheFactory, CacheContainer } from '@ioki/node-ts-cache'
import { MemoryStorage } from '@ioki/node-ts-cache-storage-memory'

const doThingsCache = new CacheContainer(new MemoryStorage())

const someFn = (input: { a: string, b: number })

const wrappedFn = withCacheFactory(doThingsCache)(someFn);

const result = someFn({ a: "lala", b: 123 })
```

### `@Cache` decorator

Caches function response using the given options. By default, uses all arguments to build an unique key.

_Note: @Cache will consider the return type of the function. If the return type is a thenable, it will stay that way, otherwise not._

```ts
import { Cache, CacheContainer } from '@ioki/node-ts-cache'
import { MemoryStorage } from '@ioki/node-ts-cache-storage-memory'

const userCache = new CacheContainer(new MemoryStorage())

class MyService {
    @Cache(userCache, {ttl: 60})
    public async getUsers(): Promise<string[]> {
        return ["Max", "User"]
    }
}
```

### Using `getItem` and `setItem` directly

```ts
import { CacheContainer } from '@ioki/node-ts-cache'
import { MemoryStorage } from '@ioki/node-ts-cache-storage-memory'

const myCache = new CacheContainer(new MemoryStorage())

class MyService {
    public async getUsers(): Promise<string[]> {
        const { content: cachedUsers } = await myCache.getItem<string[]>("users")

        if (cachedUsers) {
            return cachedUsers
        }

        const newUsers = ["Max", "User"]

        await myCache.setItem("users", newUsers, {ttl: 60})

        return newUsers
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
yarn
yarn build
yarn test
```

## Release

We're using changeset to automate the release process. The only thing to be done is to [commit a changeset](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md#i-am-in-a-multi-package-repository-a-mono-repo).

## Credits

As this is a fork of the original [node-ts-cache](https://github.com/havsar/node-ts-cache), all credit goes to the upstream project by [havsar](https://github.com/havsar).

Structural changes have been made by [boredland](https://github.com/boredland) in order to align more with our use-case.

## Contributing (complexity, asc)

1. [join us @ioki](https://ioki.com/about-ioki/jobs/) and make this one of your projects
2. create issues and pull requests, we're happy to enhance this

## Contact

<a href="https://ioki.com/ioki-devs/">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/ioki-mobility/transitland-gql-client/blob/main/assets/ioki-light.png?raw=true">
    <img alt="ioki logo" src="https://github.com/ioki-mobility/transitland-gql-client/blob/main/assets/ioki-dark.png?raw=true">
  </picture>
</a>

ioki Mobility - [@ioki_mobility](https://twitter.com/ioki_mobility)

Project Link: [https://github.com/ioki-mobility/node-ts-cache](https://github.com/ioki-mobility/node-ts-cache)
