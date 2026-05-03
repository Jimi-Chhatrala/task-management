# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Application: Task Manager

A Jira-style Task Management Web App at `/`.

### Features
- Full task CRUD (create, read, update, soft delete)
- Jira-style time logging (e.g. "1d 2h 30m") stored as minutes
- Filter by priority, search by title/number/description, sort by any column
- Stats dashboard with priority breakdown and recent activity
- Soft deletes (`deleted_at` column)

### Data Model
- `tasks` table: id, task_number (unique), task_title, task_description, priority (enum), production_live_date, time_spent_minutes, created_at, updated_at, deleted_at

### Time Utilities
- `parseTimeToMinutes(input)` — parses "1d 2h 30m" → minutes (1d = 8h)
- `formatMinutesToReadable(minutes)` — formats minutes → "1 day 2 hours 15 minutes"
- Located at `artifacts/api-server/src/lib/time.ts`

### Pages
- `/` — Tasks list with search, filter, sort
- `/tasks/new` — Create task form
- `/tasks/:id` — Task detail with inline edit and time logging
- `/stats` — Dashboard with priority breakdown and totals

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
