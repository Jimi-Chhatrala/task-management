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
  user_id: text("user_id").notNull().default(""),
  task_number: text("task_number").notNull().unique(),
  task_title: text("task_title").notNull(),
  task_description: text("task_description"),
  priority: priorityEnum("priority").notNull().default("medium"),
  status: text("status").notNull().default("todo"),
  production_live_date: text("production_live_date"),
  due_date: timestamp("due_date"),
  reminder_at: timestamp("reminder_at"),
  time_spent_minutes: integer("time_spent_minutes").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  deleted_at: timestamp("deleted_at"),
});

export const taskAttachmentsTable = pgTable("task_attachments", {
  id: serial("id").primaryKey(),
  task_id: integer("task_id").notNull(),
  file_name: text("file_name").notNull(),
  file_size: integer("file_size").notNull().default(0),
  content_type: text("content_type").notNull().default("application/octet-stream"),
  object_path: text("object_path").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type TaskAttachment = typeof taskAttachmentsTable.$inferSelect;

export const taskSubtasksTable = pgTable("task_subtasks", {
  id: serial("id").primaryKey(),
  task_id: integer("task_id").notNull(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  position: integer("position").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export type TaskSubtask = typeof taskSubtasksTable.$inferSelect;

export const taskRelationsTable = pgTable("task_relations", {
  id: serial("id").primaryKey(),
  task_id: integer("task_id").notNull(),
  related_task_id: integer("related_task_id").notNull(),
  relation_type: text("relation_type").notNull().default("related"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type TaskRelation = typeof taskRelationsTable.$inferSelect;

export const taskNotificationsTable = pgTable("task_notifications", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().default(""),
  task_id: integer("task_id").notNull(),
  type: text("type").notNull(), // "task_created" | "status_changed"
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type TaskNotification = typeof taskNotificationsTable.$inferSelect;

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
});

export const selectTaskSchema = createSelectSchema(tasksTable);

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
