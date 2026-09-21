import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getTestAgent } from "../../helpers/app.js";
import { clearDb } from "../../helpers/db.js";
import { registerAndLogin } from "../../helpers/ecommerce.js";

describe("Ecommerce — addresses", () => {
  /** @type {import("supertest").SuperTest<import("supertest").Test>} */
  let agent;
  /** @type {Record<string, string>} */
  let auth;
  /** @type {string} */
  let addressId;

  const addressBody = {
    addressLine1: "12 Test Street",
    addressLine2: "Apt 4",
    city: "Mumbai",
    country: "India",
    pincode: "400001",
    state: "MH",
  };

  beforeAll(async () => {
    agent = await getTestAgent();
    await clearDb();
    const session = await registerAndLogin(agent);
    auth = session.auth;
  });

  afterAll(async () => {
    await clearDb();
  });

  test("POST /api/v1/ecommerce/addresses creates address", async () => {
    const res = await agent
      .post("/api/v1/ecommerce/addresses")
      .set(auth)
      .send(addressBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject(addressBody);
    expect(res.body.data._id).toBeDefined();
    addressId = res.body.data._id;
  });

  test("GET /api/v1/ecommerce/addresses returns paginated shape", async () => {
    const res = await agent
      .get("/api/v1/ecommerce/addresses?page=1&limit=5")
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalAddresses: 1,
      addresses: expect.any(Array),
      page: 1,
      limit: 5,
    });
    expect(res.body.data.addresses[0]._id).toBe(addressId);
  });

  test("GET /api/v1/ecommerce/addresses/:id fetches address", async () => {
    const res = await agent
      .get(`/api/v1/ecommerce/addresses/${addressId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(addressId);
  });

  test("PATCH /api/v1/ecommerce/addresses/:id updates address", async () => {
    const res = await agent
      .patch(`/api/v1/ecommerce/addresses/${addressId}`)
      .set(auth)
      .send({ ...addressBody, city: "Pune" });

    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe("Pune");
  });

  test("DELETE /api/v1/ecommerce/addresses/:id deletes address", async () => {
    const res = await agent
      .delete(`/api/v1/ecommerce/addresses/${addressId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.deletedAddress._id).toBe(addressId);
  });
});
