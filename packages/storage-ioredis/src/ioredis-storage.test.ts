import type { default as IORedis } from "ioredis";
import { IoRedisStorage } from ".";
import { storageTestFactory } from "../../core/src/utils/storageTestFactory";
import { decoratorTestFactory } from "../../core/src/utils/decoratorTestFactory";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IoRedisMock: typeof IORedis = require("ioredis-mock");

describe("ioredis-storage", () => {
  const ioRedis = new IoRedisMock();
  const storage = new IoRedisStorage(ioRedis);

  storageTestFactory(storage);
  decoratorTestFactory(storage);
});
