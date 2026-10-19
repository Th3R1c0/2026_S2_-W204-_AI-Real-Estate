# Design Spec: Accounts, Notes, and Saved Properties (Issue #21)

## Context & Objectives
Issue #21 requires:
1. Real account functionality connecting with backend and database for persistent accounts.
2. Account page, sign in / sign up, and sign out.
3. Save and unsave properties, connecting to backend and database (`saved_properties` table).
4. View saved properties on the account page, with unsave capability.
5. Property-specific notes viewable and editable on the account page.
6. Search campaign notes viewable and editable on the account page.
7. Full CRUD for accounts, notes, and saved properties.
8. Data isolation avoiding data leakage between accounts.
9. AI chatbot chat history scoped to user and isolated from other accounts, only accessing user's saved data when signed in.

Per user instruction: **Keep changes as minimal as possible**.

## Existing Foundation (from PR #25)
- `users`, `user_sessions`, and `buyer_workspaces` tables already exist in Drizzle schema.
- `/api/auth` handles register, login, logout.
- `/api/account/workspace` handles fetching and updating buyer workspace data (`savedPropertyIds`, `generalNotes`, `propertyNotes`, `destinations`).
- `AccountWorkspaceProvider` and `useAccountWorkspace()` provide reactive account state.

## Minimal Targeted Changes

### 1. Database & Server (`lib/account/server.ts`, `lib/account/workspace.ts`)
- Add `chatHistory` field (`{ role: "user" | "model", text: string, time?: string }[]`) to `BuyerWorkspace`.
- In `updateWorkspaceField`, when `field === "savedPropertyIds"`, also sync to `saved_properties` table (insert/delete rows for numeric property IDs when present).
- Add account deletion: `DELETE /api/auth` or `DELETE /api/account` endpoint to delete the user account (cascades to sessions, workspace, saved properties).

### 2. Account Page (`app/profile/page.tsx`)
Update tabs to 3 focused tabs:
1. **Saved Homes & Notes ("My Saved Homes")**:
   - Lists saved properties.
   - For each saved home, displays property preview, "Unsave" button, and inline `<PropertyNotes propertyId={id} propertyTitle={title} />`.
2. **Search Campaign Notes**:
   - The existing `<UserNotes />` component with title updated to "Search Campaign Notes".
3. **Account Settings**:
   - The existing `<AccountPanel />` with added "Delete Account" button.

### 3. Header Auth Indicator (`app/components/property-explorer.tsx`)
- Read `account` from `useAccountWorkspace()`.
- If signed in: Show user display name linking to `/profile`.
- If guest: Show "Sign in" linking to `/profile`.

### 4. AI Chatbot Isolation & History (`app/components/ai-chatbot.tsx`)
- When `account?.status === "signedIn"`:
  - Load and save `chatHistory` via `account.workspace.chatHistory` and `account.save("chatHistory", ...)`.
  - Pass signed-in user's saved property summaries to the chatbot context.
- When guest / signed out:
  - Keep chat history purely in-memory; do not load or persist to account workspace.
  - Clear chat messages on logout event.

### 5. Routing
- Add `app/account/page.tsx` redirecting to `/profile` so both `/account` and `/profile` URLs work as expected in Issue #21.

## Testing & Verification
- Unit test for saved properties list on `/profile`.
- Unit test for property notes on `/profile`.
- Unit test for account deletion.
- Unit test for chatbot user-specific history isolation.
- Full regression check via `npm test` and `npm run build`.
