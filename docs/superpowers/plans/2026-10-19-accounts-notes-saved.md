# Accounts, Notes, and Saved Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Issue #21 by providing persistent accounts, saved properties with property notes on the Account page, search campaign notes, user account deletion, and user-isolated chatbot history with zero data leakage.

**Architecture:** Build on top of existing `users`, `user_sessions`, and `buyer_workspaces` tables; add `chatHistory` field to `BuyerWorkspace`; add account deletion; update `/profile` to show a unified "My Saved Homes" tab alongside "Search Campaign Notes" and "Account Settings"; scope the AI chatbot to the current user's workspace; and provide an `/account` redirect.

**Tech Stack:** Next.js (App Router), TypeScript, React, Drizzle ORM, PostgreSQL, Vitest, Testing Library.

## Global Constraints
- Make changes as minimal and surgical as possible.
- Do not break existing functionality or test suites.
- Maintain data isolation: signed-in users only see their own notes, saved properties, and chat history.

---

### Task 1: Workspace Chat History & Relational `saved_properties` Table Sync

**Files:**
- Modify: `ai-real-estate/lib/account/workspace.ts`
- Modify: `ai-real-estate/lib/account/server.ts`
- Test: `ai-real-estate/tests/account-workspace.test.ts`

**Interfaces:**
- `BuyerWorkspace`: includes `chatHistory: { role: "user" | "model"; text: string; time?: string }[]`.
- `updateWorkspaceField`: when `field === "savedPropertyIds"`, syncs numeric IDs to `saved_properties` table.

- [ ] **Step 1: Write the failing test**

Add tests in `ai-real-estate/tests/account-workspace.test.ts` asserting that `emptyWorkspace` has `chatHistory: []`, `updateWorkspaceField` preserves `chatHistory`, and saving property IDs syncs properly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/account-workspace.test.ts`
Expected: FAIL due to missing `chatHistory` in `emptyWorkspace`.

- [ ] **Step 3: Write minimal implementation**

Update `BuyerWorkspace` and `emptyWorkspace` in `ai-real-estate/lib/account/workspace.ts`.
In `ai-real-estate/lib/account/server.ts`, ensure `chatHistory` is included and `savedPropertyIds` updates also sync to `saved_properties` table when integer IDs match.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/account-workspace.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ai-real-estate/lib/account/workspace.ts ai-real-estate/lib/account/server.ts ai-real-estate/tests/account-workspace.test.ts
git commit -m "feat(account): add chatHistory to workspace and sync saved_properties table"
```

---

### Task 2: Account Deletion Endpoint & `/account` Route

**Files:**
- Modify: `ai-real-estate/lib/account/server.ts`
- Modify: `ai-real-estate/app/api/auth/route.ts`
- Create: `ai-real-estate/app/account/page.tsx`
- Test: `ai-real-estate/tests/account-auth.test.ts`

**Interfaces:**
- `deleteAccount(userId: number): Promise<boolean>` in `lib/account/server.ts`.
- `DELETE /api/auth?action=delete_account`: deletes current signed-in user and clears session cookie.
- `app/account/page.tsx`: redirect to `/profile`.

- [ ] **Step 1: Write the failing test**

Add a test in `ai-real-estate/tests/account-auth.test.ts` verifying that `deleteAccount` deletes the user record and cascades to session and workspace.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/account-auth.test.ts`
Expected: FAIL due to missing `deleteAccount` / deletion action.

- [ ] **Step 3: Write minimal implementation**

Implement `deleteAccount(userId)` in `lib/account/server.ts` and handle `DELETE` with `delete_account` parameter in `/api/auth/route.ts`. Create `app/account/page.tsx` with redirect to `/profile`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/account-auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ai-real-estate/lib/account/server.ts ai-real-estate/app/api/auth/route.ts ai-real-estate/app/account/page.tsx ai-real-estate/tests/account-auth.test.ts
git commit -m "feat(auth): support account deletion and add /account redirect"
```

---

### Task 3: Unified "My Saved Homes" with Property Notes on `/profile`

**Files:**
- Modify: `ai-real-estate/app/profile/page.tsx`
- Modify: `ai-real-estate/app/components/account-panel.tsx`
- Test: `ai-real-estate/tests/profile-saved-homes.test.tsx`

**Interfaces:**
- `/profile` tabs:
  1. `saved`: "My Saved Homes" (lists saved properties from catalog, unsave button, embedded `PropertyNotes`).
  2. `notes`: "Search Campaign Notes" (renders `UserNotes`).
  3. `account`: "Account Settings" (renders `AccountPanel` with delete account option).

- [ ] **Step 1: Write the failing test**

Create `ai-real-estate/tests/profile-saved-homes.test.tsx` testing that `/profile` displays saved homes, allows unsaving a property, and displays inline property notes.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/profile-saved-homes.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Update `app/profile/page.tsx` to include "My Saved Homes" tab displaying saved properties loaded from `AccountWorkspaceContext` (with fallback to local properties for details), inline `PropertyNotes`, and unsave button. Update `AccountPanel` to offer account deletion button.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/profile-saved-homes.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ai-real-estate/app/profile/page.tsx ai-real-estate/app/components/account-panel.tsx ai-real-estate/tests/profile-saved-homes.test.tsx
git commit -m "feat(profile): add saved homes view with inline property notes and account deletion"
```

---

### Task 4: User-Isolated AI Chatbot History & Context

**Files:**
- Modify: `ai-real-estate/app/components/ai-chatbot.tsx`
- Test: `ai-real-estate/tests/ai-chatbot.test.tsx`

**Interfaces:**
- `AIChatbot`: uses `useAccountWorkspace()`.
- When signed in: persists messages to `account.save("chatHistory", ...)`, initializes messages from `account.workspace.chatHistory`.
- On logout / guest: resets messages to initial welcome message; does not access account-linked data.

- [ ] **Step 1: Write the failing test**

Add a test in `ai-real-estate/tests/ai-chatbot.test.tsx` asserting that signed-in user's chat history loads from workspace and resets on sign out.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ai-chatbot.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Update `ai-real-estate/app/components/ai-chatbot.tsx` to read `useAccountWorkspace()` and synchronize `chatHistory` with the account workspace when signed in, while clearing it on logout.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ai-chatbot.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ai-real-estate/app/components/ai-chatbot.tsx ai-real-estate/tests/ai-chatbot.test.tsx
git commit -m "feat(chatbot): isolate chat history to signed-in user workspace"
```

---

### Task 5: Header Navigation Auth Status & Final Verification

**Files:**
- Modify: `ai-real-estate/app/components/property-explorer.tsx`
- Test: Full test suite (`npm test`)
- Build: Production build (`npm run build`)

**Interfaces:**
- Header navigation in `PropertyExplorer` shows username or "Sign in" linking to `/profile`.

- [ ] **Step 1: Write the failing test**

Add test in `tests/property-explorer.test.tsx` checking that header shows user status when signed in vs guest.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/property-explorer.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Update header in `PropertyExplorer` to display signed-in user's name linking to `/profile` (or "Sign in" for guest).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/property-explorer.test.tsx`
Expected: PASS

- [ ] **Step 5: Full verification & Commit**

Run `npm test` across the whole codebase and `npm run build`.
```bash
git add ai-real-estate/app/components/property-explorer.tsx ai-real-estate/tests/property-explorer.test.tsx
git commit -m "feat(nav): show account status in header navigation"
```
