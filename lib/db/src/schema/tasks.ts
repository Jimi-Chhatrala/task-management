import { pgTable, serial, text, integer, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const priorityEnum = pgEnum("priority", ["lowest", "low", "medium", "high", "highest"]);

export const taskStatusesTable = pgTable("task_statuses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  label: text("label").notNull(),
  color: text("color").notNull().default("#6b7280"),
  position: integer("position").notNull().default(0),
  is_default: boolean("is_default").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskStatusSchema = createInsertSchema(taskStatusesTable).omit({
  id: true,
  created_at: true,
});
export const selectTaskStatusSchema = createSelectSchema(taskStatusesTable);
export type InsertTaskStatus = z.infer<typeof insertTaskStatusSchema>;
export type TaskStatus = typeof taskStatusesTable.$inferSelect;

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  task_number: text("task_number").notNull().unique(),
  task_title: text("task_title").notNull(),
  task_description: text("task_description"),
  priority: priorityEnum("priority").notNull().default("medium"),
  status: text("status").notNull().default("todo"),
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
