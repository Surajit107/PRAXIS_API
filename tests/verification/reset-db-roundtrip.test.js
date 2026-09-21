import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { count, eq, sql } from "drizzle-orm";
import { UserRolesEnum } from "@/constants.js";
import { dbInstance } from "@/db/index.js";
import { users } from "@/models/apps/auth/user.models.js";
import { chats } from "@/models/apps/chat-app/chat.models.js";
import { products } from "@/models/apps/ecommerce/product.models.js";
import { todos } from "@/models/apps/todo/todo.models.js";
import { geoCountries } from "@/models/public/geo.models.js";
import { publicJsonDocs } from "@/models/public/public-json.models.js";
import { USERS_COUNT } from "@/seeds/_constants.js";
import { getTestAgent } from "../helpers/app.js";
import { clearDb } from "../helpers/db.js";

/**
 * P9 roundtrip gate (test-DB equivalent of):
 *   seed apps → hit APIs → reset-db → re-seed
 *
 * Public JSON / geo must survive reset-db (reference datasets).
 * Full public seed (`db:seed:public`) is covered in tests/public/*;
 * migrate is a CLI precondition, not asserted here.
 */
describe("P9 — reset-db roundtrip", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
  }, 60_000);

  afterAll(async () => {
    await clearDb();
  });

  test(
    "seed → reset-db → re-seed restores domain data",
    async () => {
      // Sentinel reference rows — must survive reset-db
      await dbInstance.insert(publicJsonDocs).values({
        collection: "_reset_db_sentinel",
        docId: "1",
        payload: { ok: true },
      });
      await dbInstance.insert(geoCountries).values({
        id: 900001,
        name: "ResetDb Sentinel",
        iso2: "ZZ",
      });

      const chatSeed = await agent.post("/api/v1/seed/chat-app");
      expect(chatSeed.status).toBe(201);

      const ecomSeed = await agent.post("/api/v1/seed/ecommerce");
      expect(ecomSeed.status).toBe(201);

      const todoSeed = await agent.post("/api/v1/seed/todos");
      expect(todoSeed.status).toBe(201);

      const [usersBefore] = await dbInstance
        .select({ value: count() })
        .from(users);
      const [chatsBefore] = await dbInstance
        .select({ value: count() })
        .from(chats);
      const [productsBefore] = await dbInstance
        .select({ value: count() })
        .from(products);
      const [todosBefore] = await dbInstance
        .select({ value: count() })
        .from(todos);

      expect(Number(usersBefore?.value ?? 0)).toBe(USERS_COUNT);
      expect(Number(chatsBefore?.value ?? 0)).toBeGreaterThan(0);
      expect(Number(productsBefore?.value ?? 0)).toBeGreaterThan(0);
      expect(Number(todosBefore?.value ?? 0)).toBeGreaterThan(0);

      // Public list still works after seed
      const productsRes = await agent.get(
        "/api/v1/ecommerce/products?page=1&limit=1"
      );
      expect(productsRes.status).toBe(200);
      expect(productsRes.body.data.totalProducts).toBeGreaterThan(0);
      expect(productsRes.body.data.products[0]._id).toBeDefined();
      expect(productsRes.body.data.products[0].mainImage).toEqual(
        expect.objectContaining({ url: expect.any(String) })
      );

      const reset = await agent.delete("/api/v1/reset-db");
      expect(reset.status).toBe(200);

      const [usersAfterReset] = await dbInstance
        .select({ value: count() })
        .from(users);
      const [chatsAfterReset] = await dbInstance
        .select({ value: count() })
        .from(chats);
      const [productsAfterReset] = await dbInstance
        .select({ value: count() })
        .from(products);

      expect(Number(usersAfterReset?.value ?? 0)).toBe(0);
      expect(Number(chatsAfterReset?.value ?? 0)).toBe(0);
      expect(Number(productsAfterReset?.value ?? 0)).toBe(0);

      // Reference datasets must not be truncated
      const [publicSentinel] = await dbInstance
        .select({ docId: publicJsonDocs.docId })
        .from(publicJsonDocs)
        .where(eq(publicJsonDocs.collection, "_reset_db_sentinel"))
        .limit(1);
      const [geoSentinel] = await dbInstance
        .select({ id: geoCountries.id })
        .from(geoCountries)
        .where(eq(geoCountries.id, 900001))
        .limit(1);
      expect(publicSentinel?.docId).toBe("1");
      expect(geoSentinel?.id).toBe(900001);

      // Migration journal must survive reset-db (schema history kept)
      const journal = await dbInstance.execute(
        sql.raw(`
          SELECT COUNT(*)::int AS n
          FROM information_schema.tables
          WHERE table_name = '__drizzle_migrations'
        `)
      );
      const journalRow = Array.isArray(journal)
        ? journal[0]
        : journal?.rows?.[0];
      expect(Number(journalRow?.n ?? 0)).toBeGreaterThan(0);

      // Prefer public journal; fall back to drizzle schema if kit uses it
      let migrationRows = 0;
      try {
        const publicJournal = await dbInstance.execute(
          sql.raw(`SELECT COUNT(*)::int AS n FROM "__drizzle_migrations"`)
        );
        const row = Array.isArray(publicJournal)
          ? publicJournal[0]
          : publicJournal?.rows?.[0];
        migrationRows = Number(row?.n ?? 0);
      } catch {
        const schemaJournal = await dbInstance.execute(
          sql.raw(
            `SELECT COUNT(*)::int AS n FROM drizzle."__drizzle_migrations"`
          )
        );
        const row = Array.isArray(schemaJournal)
          ? schemaJournal[0]
          : schemaJournal?.rows?.[0];
        migrationRows = Number(row?.n ?? 0);
      }
      expect(migrationRows).toBeGreaterThan(0);

      const reseed = await agent.post("/api/v1/seed/chat-app");
      expect(reseed.status).toBe(201);

      const [usersReseed] = await dbInstance
        .select({ value: count() })
        .from(users);
      const [chatsReseed] = await dbInstance
        .select({ value: count() })
        .from(chats);
      const [admin] = await dbInstance
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, UserRolesEnum.ADMIN))
        .limit(1);

      expect(Number(usersReseed?.value ?? 0)).toBe(USERS_COUNT);
      expect(Number(chatsReseed?.value ?? 0)).toBeGreaterThan(0);
      expect(admin?.id).toBeDefined();

      const creds = await agent.get("/api/v1/seed/generated-credentials");
      expect(creds.status).toBe(200);
      expect(creds.body.data).toHaveLength(USERS_COUNT);
    },
    300_000
  );
});
