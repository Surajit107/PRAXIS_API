/**
 * Generates OpenAPI path entries for world public JSON APIs and inserts
 * them into src/swagger.yaml (before /public/youtube/channel).
 *
 *   node scripts/inject-world-swagger.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swaggerPath = path.join(__dirname, "..", "src", "swagger.yaml");
const jsonDir = path.join(__dirname, "..", "src", "json");

/** @type {Array<Record<string, string>>} */
const apis = [
  {
    mount: "companies",
    file: "companies.json",
    param: "companyId",
    randomPath: "company/random",
    operationBase: "Companies",
    summaryList: "Get companies",
    summaryOne: "Get company by id",
    summaryRandom: "Get a random company",
    listMsg: "Companies fetched successfully",
    itemMsg: "Company fetched successfully",
    description:
      "Returns a paginated list of company / organization records (CRM-style).",
    queryExample: "software",
    idExample: "org_0001",
    props: `
                            id:
                              type: string
                              example: org_0001
                            name:
                              type: string
                              example: Lovelace Labs
                            industry:
                              type: string
                              example: software
                            status:
                              type: string
                              example: active
                            logo:
                              type: string
                              example: https://placehold.co/200x200/png?text=Logo
                            hq:
                              type: object
                              properties:
                                city:
                                  type: string
                                  example: New York
                                country:
                                  type: string
                                  example: US`,
  },
  {
    mount: "customers",
    file: "customers.json",
    param: "customerId",
    randomPath: "customer/random",
    operationBase: "Customers",
    summaryList: "Get customers",
    summaryOne: "Get customer by id",
    summaryRandom: "Get a random customer",
    listMsg: "Customers fetched successfully",
    itemMsg: "Customer fetched successfully",
    description: "Returns a paginated list of customer records.",
    queryExample: "ada",
    idExample: "cus_0001",
    props: `
                            id:
                              type: string
                              example: cus_0001
                            name:
                              type: string
                              example: Ada Lovelace
                            email:
                              type: string
                              example: ada.lovelace@example.com
                            type:
                              type: string
                              example: individual
                            status:
                              type: string
                              example: active
                            avatar:
                              type: string
                              example: https://placehold.co/128x128/png?text=AL`,
  },
  {
    mount: "employees",
    file: "employees.json",
    param: "employeeId",
    randomPath: "employee/random",
    operationBase: "Employees",
    summaryList: "Get employees",
    summaryOne: "Get employee by id",
    summaryRandom: "Get a random employee",
    listMsg: "Employees fetched successfully",
    itemMsg: "Employee fetched successfully",
    description: "Returns a paginated list of employee / HRIS records.",
    queryExample: "engineer",
    idExample: "emp_0001",
    props: `
                            id:
                              type: string
                              example: emp_0001
                            employeeNumber:
                              type: string
                              example: E-10000
                            firstName:
                              type: string
                              example: Ada
                            lastName:
                              type: string
                              example: Lovelace
                            email:
                              type: string
                              example: ada.lovelace@praxis.dev
                            jobTitle:
                              type: string
                              example: Software Engineer
                            department:
                              type: string
                              example: Engineering
                            status:
                              type: string
                              example: active`,
  },
  {
    mount: "inventory",
    file: "inventory.json",
    param: "inventoryId",
    randomPath: "item/random",
    operationBase: "Inventory",
    summaryList: "Get inventory",
    summaryOne: "Get inventory item by id",
    summaryRandom: "Get a random inventory item",
    listMsg: "Inventory fetched successfully",
    itemMsg: "Inventory item fetched successfully",
    description:
      "Returns paginated warehouse inventory records (SKU, stock levels, images, location).",
    queryExample: "mouse",
    idExample: "inv_0001",
    props: `
                            id:
                              type: string
                              example: inv_0001
                            sku:
                              type: string
                              example: SKU-WLS-1001
                            name:
                              type: string
                              example: Wireless Mouse Pro
                            brand:
                              type: string
                              example: LogiTechie
                            category:
                              type: string
                              example: electronics
                            thumbnail:
                              type: string
                              example: https://placehold.co/200x200/png?text=SKU
                            image:
                              type: string
                              example: https://placehold.co/600x400/png?text=Product
                            quantityOnHand:
                              type: number
                              example: 450
                            quantityAvailable:
                              type: number
                              example: 420
                            status:
                              type: string
                              example: in_stock
                            warehouse:
                              type: object
                              properties:
                                code:
                                  type: string
                                  example: NYC-01
                                name:
                                  type: string
                                  example: New York FC`,
  },
  {
    mount: "orders",
    file: "orders.json",
    param: "orderId",
    randomPath: "order/random",
    operationBase: "PublicOrders",
    summaryList: "Get orders",
    summaryOne: "Get order by id",
    summaryRandom: "Get a random order",
    listMsg: "Orders fetched successfully",
    itemMsg: "Order fetched successfully",
    description:
      "Returns paginated commerce order documents (public sample data, not ecommerce app orders).",
    queryExample: "ORD-2026",
    idExample: "ord_0001",
    props: `
                            id:
                              type: string
                              example: ord_0001
                            number:
                              type: string
                              example: ORD-2026-01000
                            status:
                              type: string
                              example: processing
                            paymentStatus:
                              type: string
                              example: paid
                            currency:
                              type: string
                              example: USD
                            total:
                              type: number
                              example: 129.99
                            customer:
                              type: object
                              properties:
                                id:
                                  type: string
                                  example: cus_0001
                                name:
                                  type: string
                                  example: Ada Lovelace
                                email:
                                  type: string
                                  example: ada.lovelace@example.com
                            lineItems:
                              type: array
                              items:
                                type: object
                                properties:
                                  sku:
                                    type: string
                                    example: SKU-WLS-1001
                                  name:
                                    type: string
                                    example: Wireless Mouse Pro
                                  quantity:
                                    type: number
                                    example: 1
                                  image:
                                    type: string
                                    example: https://placehold.co/600x400/png?text=Product`,
  },
  {
    mount: "tickets",
    file: "support-ticket.json",
    param: "ticketId",
    randomPath: "ticket/random",
    operationBase: "Tickets",
    summaryList: "Get support tickets",
    summaryOne: "Get support ticket by id",
    summaryRandom: "Get a random support ticket",
    listMsg: "Tickets fetched successfully",
    itemMsg: "Ticket fetched successfully",
    description:
      "Returns paginated support ticket records (Zendesk / Freshdesk-style).",
    queryExample: "password",
    idExample: "TCK-1000",
    props: `
                            id:
                              type: string
                              example: TCK-1000
                            subject:
                              type: string
                              example: Unable to reset password
                            status:
                              type: string
                              example: open
                            priority:
                              type: string
                              example: high
                            type:
                              type: string
                              example: incident
                            channel:
                              type: string
                              example: email
                            requester:
                              type: object
                              properties:
                                name:
                                  type: string
                                  example: Ada Lovelace
                                email:
                                  type: string
                                  example: ada.lovelace@example.com
                            assignee:
                              type: object
                              properties:
                                name:
                                  type: string
                                  example: Sam Support
                                email:
                                  type: string
                                  example: sam@praxis.dev`,
  },
  {
    mount: "invoices",
    file: "invoices.json",
    param: "invoiceId",
    randomPath: "invoice/random",
    operationBase: "Invoices",
    summaryList: "Get invoices",
    summaryOne: "Get invoice by id",
    summaryRandom: "Get a random invoice",
    listMsg: "Invoices fetched successfully",
    itemMsg: "Invoice fetched successfully",
    description: "Returns paginated invoice / billing documents.",
    queryExample: "INV-2026",
    idExample: "invc_0001",
    props: `
                            id:
                              type: string
                              example: invc_0001
                            number:
                              type: string
                              example: INV-2026-05000
                            status:
                              type: string
                              example: open
                            currency:
                              type: string
                              example: USD
                            total:
                              type: number
                              example: 249.9
                            amountDue:
                              type: number
                              example: 249.9
                            pdfUrl:
                              type: string
                              example: https://placehold.co/600x800/png?text=INV
                            customer:
                              type: object
                              properties:
                                id:
                                  type: string
                                  example: cus_0001
                                name:
                                  type: string
                                  example: Ada Lovelace`,
  },
  {
    mount: "shipments",
    file: "shipments.json",
    param: "shipmentId",
    randomPath: "shipment/random",
    operationBase: "Shipments",
    summaryList: "Get shipments",
    summaryOne: "Get shipment by id",
    summaryRandom: "Get a random shipment",
    listMsg: "Shipments fetched successfully",
    itemMsg: "Shipment fetched successfully",
    description: "Returns paginated shipment / tracking records.",
    queryExample: "UPS",
    idExample: "shp_0001",
    props: `
                            id:
                              type: string
                              example: shp_0001
                            orderId:
                              type: string
                              example: ord_0001
                            trackingNumber:
                              type: string
                              example: 1Z999999999999
                            carrier:
                              type: string
                              example: UPS
                            status:
                              type: string
                              example: in_transit
                            trackingUrl:
                              type: string
                              example: https://track.example/ups/1Z999999999999
                            labelUrl:
                              type: string
                              example: https://placehold.co/400x600/png?text=LABEL`,
  },
  {
    mount: "transactions",
    file: "transactions.json",
    param: "transactionId",
    randomPath: "transaction/random",
    operationBase: "Transactions",
    summaryList: "Get transactions",
    summaryOne: "Get transaction by id",
    summaryRandom: "Get a random transaction",
    listMsg: "Transactions fetched successfully",
    itemMsg: "Transaction fetched successfully",
    description: "Returns paginated payment transaction records.",
    queryExample: "stripe",
    idExample: "txn_0001",
    props: `
                            id:
                              type: string
                              example: txn_0001
                            type:
                              type: string
                              example: payment
                            status:
                              type: string
                              example: succeeded
                            amount:
                              type: number
                              example: 129.99
                            currency:
                              type: string
                              example: USD
                            provider:
                              type: string
                              example: stripe
                            providerReference:
                              type: string
                              example: pi_00900000
                            orderId:
                              type: string
                              example: ord_0001`,
  },
  {
    mount: "projects",
    file: "projects.json",
    param: "projectId",
    randomPath: "project/random",
    operationBase: "Projects",
    summaryList: "Get projects",
    summaryOne: "Get project by id",
    summaryRandom: "Get a random project",
    listMsg: "Projects fetched successfully",
    itemMsg: "Project fetched successfully",
    description: "Returns paginated project tracker records.",
    queryExample: "Platform",
    idExample: "prj_0001",
    props: `
                            id:
                              type: string
                              example: prj_0001
                            key:
                              type: string
                              example: PRJ-001
                            name:
                              type: string
                              example: Platform Revamp
                            status:
                              type: string
                              example: active
                            priority:
                              type: string
                              example: high
                            progressPercent:
                              type: number
                              example: 42
                            coverImage:
                              type: string
                              example: https://placehold.co/1200x400/png?text=PRJ`,
  },
  {
    mount: "subscriptions",
    file: "subscriptions.json",
    param: "subscriptionId",
    randomPath: "subscription/random",
    operationBase: "Subscriptions",
    summaryList: "Get subscriptions",
    summaryOne: "Get subscription by id",
    summaryRandom: "Get a random subscription",
    listMsg: "Subscriptions fetched successfully",
    itemMsg: "Subscription fetched successfully",
    description: "Returns paginated SaaS subscription records.",
    queryExample: "pro",
    idExample: "sub_0001",
    props: `
                            id:
                              type: string
                              example: sub_0001
                            status:
                              type: string
                              example: active
                            quantity:
                              type: number
                              example: 1
                            plan:
                              type: object
                              properties:
                                id:
                                  type: string
                                  example: plan_pro
                                name:
                                  type: string
                                  example: Pro
                                interval:
                                  type: string
                                  example: month
                                unitAmount:
                                  type: number
                                  example: 29
                            customer:
                              type: object
                              properties:
                                id:
                                  type: string
                                  example: cus_0001
                                email:
                                  type: string
                                  example: ada.lovelace@example.com`,
  },
  {
    mount: "appointments",
    file: "appointments.json",
    param: "appointmentId",
    randomPath: "appointment/random",
    operationBase: "Appointments",
    summaryList: "Get appointments",
    summaryOne: "Get appointment by id",
    summaryRandom: "Get a random appointment",
    listMsg: "Appointments fetched successfully",
    itemMsg: "Appointment fetched successfully",
    description: "Returns paginated appointment / scheduling records.",
    queryExample: "demo",
    idExample: "apt_0001",
    props: `
                            id:
                              type: string
                              example: apt_0001
                            title:
                              type: string
                              example: Product demo
                            status:
                              type: string
                              example: confirmed
                            type:
                              type: string
                              example: video
                            startsAt:
                              type: string
                              example: '2026-01-10T09:00:00.000Z'
                            endsAt:
                              type: string
                              example: '2026-01-10T09:30:00.000Z'
                            meetingUrl:
                              type: string
                              example: https://meet.example/apt_0001
                            customer:
                              type: object
                              properties:
                                name:
                                  type: string
                                  example: Ada Lovelace
                            host:
                              type: object
                              properties:
                                name:
                                  type: string
                                  example: Grace Hopper`,
  },
];

function listResponse(api, totalItems) {
  return `          description: ${api.listMsg}
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      page:
                        type: number
                        example: 1
                      limit:
                        type: number
                        example: 10
                      totalPages:
                        type: number
                        example: ${Math.max(1, Math.ceil(totalItems / 10))}
                      totalItems:
                        type: number
                        example: ${totalItems}
                      previousPage:
                        type: boolean
                        example: false
                      nextPage:
                        type: boolean
                        example: ${totalItems > 10}
                      currentPageItems:
                        type: number
                        example: 10
                      data:
                        type: array
                        items:
                          type: object
                          properties:${api.props}
                  message:
                    type: string
                    example: ${JSON.stringify(api.listMsg)}
                  statusCode:
                    type: number
                    example: 200
                  success:
                    type: boolean
                    example: true`;
}

function itemResponse(api) {
  return `          description: ${api.itemMsg}
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:${api.props}
                  message:
                    type: string
                    example: ${JSON.stringify(api.itemMsg)}
                  statusCode:
                    type: number
                    example: 200
                  success:
                    type: boolean
                    example: true
        '404':
          description: Not found`;
}

function buildPaths() {
  const chunks = [];
  chunks.push(
    "  # ---------------------------------------------------------------------------"
  );
  chunks.push(
    "  # World / industry public JSON datasets (public_json_docs)"
  );
  chunks.push(
    "  # ---------------------------------------------------------------------------"
  );

  for (const api of apis) {
    const items = JSON.parse(
      fs.readFileSync(path.join(jsonDir, api.file), "utf8")
    );
    const totalItems = items.length;

    chunks.push(`  /public/${api.mount}:`);
    chunks.push(`    get:`);
    chunks.push(`      tags:`);
    chunks.push(`        - 📡 Public APIs`);
    chunks.push(`      summary: ${api.summaryList}`);
    chunks.push(`      description: >-`);
    chunks.push(`        ${api.description}`);
    chunks.push(``);
    chunks.push(
      `        Supports pagination and optional text search via \`query\`.`
    );
    chunks.push(`      operationId: get${api.operationBase}`);
    chunks.push(`      parameters:`);
    chunks.push(`        - name: page`);
    chunks.push(`          in: query`);
    chunks.push(`          schema:`);
    chunks.push(`            type: string`);
    chunks.push(`            example: '1'`);
    chunks.push(`        - name: limit`);
    chunks.push(`          in: query`);
    chunks.push(`          schema:`);
    chunks.push(`            type: string`);
    chunks.push(`            example: '10'`);
    chunks.push(`        - name: query`);
    chunks.push(`          in: query`);
    chunks.push(`          schema:`);
    chunks.push(`            type: string`);
    chunks.push(
      `            example: ${JSON.stringify(api.queryExample)}`
    );
    chunks.push(`        - name: inc`);
    chunks.push(`          in: query`);
    chunks.push(
      `          description: Comma-separated fields to include in each item`
    );
    chunks.push(`          schema:`);
    chunks.push(`            type: string`);
    chunks.push(`            example: id,name,status`);
    chunks.push(`      responses:`);
    chunks.push(`        '200':`);
    chunks.push(listResponse(api, totalItems));

    chunks.push(`  /public/${api.mount}/{${api.param}}:`);
    chunks.push(`    get:`);
    chunks.push(`      tags:`);
    chunks.push(`        - 📡 Public APIs`);
    chunks.push(`      summary: ${api.summaryOne}`);
    chunks.push(`      description: >-`);
    chunks.push(
      `        Fetch a single document from the ${api.mount} collection by id.`
    );
    chunks.push(`      operationId: get${api.operationBase}ById`);
    chunks.push(`      parameters:`);
    chunks.push(`        - name: ${api.param}`);
    chunks.push(`          in: path`);
    chunks.push(`          required: true`);
    chunks.push(`          schema:`);
    chunks.push(`            type: string`);
    chunks.push(
      `            example: ${JSON.stringify(api.idExample)}`
    );
    chunks.push(`      responses:`);
    chunks.push(`        '200':`);
    chunks.push(itemResponse(api));

    chunks.push(`  /public/${api.mount}/${api.randomPath}:`);
    chunks.push(`    get:`);
    chunks.push(`      tags:`);
    chunks.push(`        - 📡 Public APIs`);
    chunks.push(`      summary: ${api.summaryRandom}`);
    chunks.push(`      description: >-`);
    chunks.push(
      `        Returns one randomly selected document from the ${api.mount} collection.`
    );
    chunks.push(`      operationId: getRandom${api.operationBase}`);
    chunks.push(`      responses:`);
    chunks.push(`        '200':`);
    chunks.push(itemResponse(api));
  }

  return `${chunks.join("\n")}\n`;
}

const marker = "  /public/youtube/channel:";
const swagger = fs.readFileSync(swaggerPath, "utf8");

if (!swagger.includes(marker)) {
  console.error("Could not find youtube channel path marker in swagger.yaml");
  process.exit(1);
}

const startMarker =
  "  # ---------------------------------------------------------------------------\n  # World / industry public JSON datasets (public_json_docs)";
let base = swagger;
if (base.includes(startMarker)) {
  const start = base.indexOf(startMarker);
  const end = base.indexOf(marker);
  if (start >= 0 && end > start) {
    base = base.slice(0, start) + base.slice(end);
  }
}

const fragment = buildPaths();
const inserted = base.replace(marker, `${fragment}${marker}`);
fs.writeFileSync(swaggerPath, inserted, "utf8");
console.log(
  `Injected world public API swagger paths (${apis.length} resources × 3).`
);
