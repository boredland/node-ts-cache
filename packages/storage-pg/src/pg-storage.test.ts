import { PgStorage } from ".";
import { DataType, IBackup, newDb } from "pg-mem";
import { storageTestFactory } from "../../core/src/utils/storageTestFactory";
import { decoratorTestFactory } from "../../core/src/utils/decoratorTestFactory";

describe("pg-storage", () => {
  const tableName = "abc";
  let backup: IBackup;
  const db = newDb();
  const knex = db.adapters.createKnex();
  const storage = new PgStorage(tableName, async (query, values) => {
    const result = await knex.raw(query, values as string[]);
    return result.rows;
  });

  afterAll(async () => {
    await knex.destroy();
  });

  beforeAll(async () => {
    db.public.declareTable({
      name: tableName,
      fields: [
        {
          name: "key",
          type: DataType.text,
        },
        {
          name: "value",
          type: DataType.jsonb,
        },
      ],
      constraints: [
        {
          type: "primary key",
          constraintName: { name: "primary-key-node-ts-cache" },
          columns: [{ name: "key" }],
        },
      ],
    });
    backup = db.backup();
  });

  beforeEach(() => {
    backup.restore();
  });

  storageTestFactory(storage);
  decoratorTestFactory(storage);
});
