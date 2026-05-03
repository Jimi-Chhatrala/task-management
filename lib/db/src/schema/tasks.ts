import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const priorityEnum = pgEnum("priority", ["lowest", "low", "medium", "high", "highest"]);

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  task_number: text("task_number").notNull().unique(),
  task_title: text("task_title").notNull(),
  task_description: text("task_description"),
  priority: priorityEnum("priority").notNull().default("medium"),
  production_live_date: text("production_live_date"),
  time_spent_minutes: integer("time_spent_minutes").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  deleted_at: timestamp("deleted_at"),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
});

export const selectTaskSchema = createSelectSchema(tasksTable);

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
