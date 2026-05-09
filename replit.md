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
- **Auth**: Clerk (Replit-managed) via `@clerk/react` + `@clerk/express`

## Application: Task Manager

A Jira-style Task Management Web App at `/`.

### Features
- Full task CRUD (create, read, update, soft delete) — scoped per authenticated user
- Jira-style time logging (e.g. "1d 2h 30m") stored as minutes
- Filter by priority, search by title/number/description, sort by any column
- Stats dashboard with priority breakdown and recent activity
- Soft deletes (`deleted_at` column)
- Rich text editor (TipTap) with full toolbar: headings, bold/italic/underline/strike/code, lists, alignment, horizontal rule, image upload
- Image upload via Replit Object Storage (presigned PUT URLs, served at `/api/storage/objects/*`)
- In-app notifications for task creation and status changes (per-user)
- User login/signup via Clerk (email + Google/GitHub/Apple)

### Auth Architecture
- **Clerk provisioned**: `setupClerkWhitelabelAuth()` — keys stored in `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- **API proxy**: `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — mounts at `/api/__clerk`, forwards to `frontend-api.clerk.dev` (active in dev+prod)
- **Auth middleware**: `artifacts/api-server/src/middlewares/requireAuth.ts` — extracts `userId` from Clerk session, attaches to `req.userId`
- **All API routes protected** with `requireAuth` — queries are scoped by `user_id`
- **Frontend**: `ClerkProvider` in `App.tsx` with `proxyUrl` pointing to `/api/__clerk`
- **Routes**: `/sign-in/*?` and `/sign-up/*?` use Clerk's embedded `<SignIn>` / `<SignUp>`
- **Landing page** at `/` for unauthenticated visitors; authenticated users see the task list
- **User dropdown** in header: shows name/email, sign-out button

### Object Storage
- Bucket: `replit-objstore-fab00690-035a-4aea-94d0-8fcdd56ec381`
- Server lib: `artifacts/api-server/src/lib/objectStorage.ts` + `objectAcl.ts`
- Routes: `GET/POST /api/storage/...` via `artifacts/api-server/src/routes/storage.ts`
- Client lib: `lib/object-storage-web/` (exports `useUpload`, `ObjectUploader`)
- Upload flow: POST `/api/storage/uploads/request-url` → PUT presigned URL → image served at `/api/storage/objects/<uuid>`

### Data Model
- `tasks` table: id, **user_id**, task_number (unique), task_title, task_description, priority (enum), status, production_live_date, time_spent_minutes, due_date, reminder_at, created_at, updated_at, deleted_at
- `task_notifications` table: id, **user_id**, task_id, type, message, read, created_at

### Time Utilities
- `parseTimeToMinutes(input)` — parses "1d 2h 30m" → minutes (1d = 8h)
- `formatMinutesToReadable(minutes)` — formats minutes → "1 day 2 hours 15 minutes"
- Located at `artifacts/api-server/src/lib/time.ts`

### Pages
- `/` — Landing page (unauthenticated) or Tasks list (authenticated)
- `/sign-in/*?` — Clerk sign-in (email + OAuth)
- `/sign-up/*?` — Clerk sign-up
- `/tasks/new` — Create task form (auth required)
- `/tasks/:id` — Task detail with inline edit and time logging (auth required)
- `/stats` — Dashboard with priority breakdown and totals (auth required)
- `/settings` — App settings (auth required)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
