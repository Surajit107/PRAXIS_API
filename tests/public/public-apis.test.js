import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../helpers/app.js";
import { clearDb } from "../helpers/db.js";
import { seedPublicJsonForTests } from "../helpers/public-json.js";

/**
 * Happy-path smoke for every Postgres-backed public mount.
 * Requires the same data as `npm run db:seed:public` (seeded here after clearDb).
 */
describe("Public JSON APIs (Postgres)", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    await seedPublicJsonForTests();
  }, 180_000);

  afterAll(async () => {
    await clearDb();
  });

  /**
   * @param {string} path
   * @param {(body: Record<string, unknown>) => void} [assertData]
   */
  const expectListOk = async (path, assertData) => {
    const res = await agent.get(path).query({ page: 1, limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 5,
        totalItems: expect.any(Number),
        data: expect.any(Array),
      })
    );
    expect(res.body.data.totalItems).toBeGreaterThan(0);
    expect(res.body.data.data.length).toBeGreaterThan(0);
    expect(res.body.data.data.length).toBeLessThanOrEqual(5);
    assertData?.(res.body.data);
  };

  test("GET /api/v1/public/randomusers", async () => {
    await expectListOk("/api/v1/public/randomusers", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.anything(),
          email: expect.any(String),
          name: expect.any(Object),
        })
      );
    });
  });

  test("GET /api/v1/public/randomproducts", async () => {
    await expectListOk("/api/v1/public/randomproducts", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.anything(),
        })
      );
    });
  });

  test("GET /api/v1/public/randomjokes", async () => {
    await expectListOk("/api/v1/public/randomjokes", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.anything(),
        })
      );
    });
  });

  test("GET /api/v1/public/books", async () => {
    await expectListOk("/api/v1/public/books", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.anything(),
          volumeInfo: expect.any(Object),
        })
      );
    });
  });

  test("GET /api/v1/public/quotes", async () => {
    await expectListOk("/api/v1/public/quotes", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.anything(),
        })
      );
    });
  });

  test("GET /api/v1/public/meals", async () => {
    await expectListOk("/api/v1/public/meals", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.anything(),
        })
      );
    });
  });

  test("GET /api/v1/public/dogs", async () => {
    await expectListOk("/api/v1/public/dogs", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.anything(),
        })
      );
    });
  });

  test("GET /api/v1/public/cats", async () => {
    await expectListOk("/api/v1/public/cats", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.anything(),
        })
      );
    });
  });

  test("GET /api/v1/public/stocks", async () => {
    await expectListOk("/api/v1/public/stocks", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          Symbol: expect.any(String),
          Name: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/companies", async () => {
    await expectListOk("/api/v1/public/companies", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/customers", async () => {
    await expectListOk("/api/v1/public/customers", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/employees", async () => {
    await expectListOk("/api/v1/public/employees", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          employeeNumber: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/inventory", async () => {
    await expectListOk("/api/v1/public/inventory", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          sku: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/orders", async () => {
    await expectListOk("/api/v1/public/orders", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          number: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/tickets", async () => {
    await expectListOk("/api/v1/public/tickets", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          subject: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/invoices", async () => {
    await expectListOk("/api/v1/public/invoices", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          number: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/shipments", async () => {
    await expectListOk("/api/v1/public/shipments", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          trackingNumber: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/transactions", async () => {
    await expectListOk("/api/v1/public/transactions", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          type: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/projects", async () => {
    await expectListOk("/api/v1/public/projects", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          key: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/subscriptions", async () => {
    await expectListOk("/api/v1/public/subscriptions", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          status: expect.any(String),
        })
      );
    });
  });

  test("GET /api/v1/public/appointments", async () => {
    await expectListOk("/api/v1/public/appointments", (payload) => {
      expect(payload.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
        })
      );
    });
  });
});
