import request from "supertest";
import app from "../src/app";

describe("Demo API", () => {
  it("creates an order", async () => {
    const response = await request(app)
      .post("/api/demo/orders")
      .send({ item: "laptop" });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("created");
    expect(response.body.order.item).toBe("laptop");
  });

  it("returns success for a normal payment", async () => {
    const response = await request(app)
      .post("/api/demo/payment")
      .send({ amount: 100 });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("payment_successful");
  });

  it("detects the intentional payment failure", async () => {
    const response = await request(app)
      .post("/api/demo/payment")
      .send({ amount: 9999 });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe(
      "Payment service unavailable"
    );
  });

  it("rejects an empty item", async () => {
    const response = await request(app)
      .post("/api/demo/orders")
      .send({ item: "" });

    expect(response.status).toBe(400);
  });

  it("returns 404 for an unknown order", async () => {
    const response = await request(app)
      .get("/api/demo/orders/does-not-exist");

    expect(response.status).toBe(404);
  });
});