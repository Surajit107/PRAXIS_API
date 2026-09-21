import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** `Todo` */
export const todos = pgTable(
  "todos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    isComplete: boolean("is_complete").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    // getAllTodos sorts by updatedAt; title uses leading-wildcard ilike (btree useless)
    index("todos_updated_at_idx").on(table.updatedAt),
  ]
);

export const Todo = todos;
