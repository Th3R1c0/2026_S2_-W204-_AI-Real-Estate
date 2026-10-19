import { getCurrentUser, getWorkspace, updateWorkspaceField } from "../../../../lib/account/server";
import { validateWorkspaceChange } from "../../../../lib/account/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
    return Response.json({ user, workspace: await getWorkspace(user.userId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Workspace API GET error]:", error);
    return Response.json({ error: "Account service unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 100_000) return Response.json({ error: "Request is too large." }, { status: 413 });
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
    const change = validateWorkspaceChange(body);
    if ("error" in change) return Response.json({ error: change.error }, { status: 400 });
    const workspace = await updateWorkspaceField(user.userId, change.field, change.value);
    return Response.json({ workspace });
  } catch (error) {
    console.error("[Workspace API PATCH error]:", error);
    return Response.json({ error: "Account service unavailable." }, { status: 503 });
  }
}
