import { getCurrentUser, loginAccount, logoutAccount, registerAccount, setSessionCookie } from "../../../lib/account/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Account service unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!trustedOrigin(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 4096) return Response.json({ error: "Request is too large." }, { status: 413 });
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  try {
    const result = input.action === "register" ? await registerAccount(input) :
      input.action === "login" ? await loginAccount(input) : { error: "Unknown action.", status: 400 };
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    await setSessionCookie(result.token);
    return Response.json({ user: result.user }, { status: input.action === "register" ? 201 : 200 });
  } catch {
    return Response.json({ error: "Account service unavailable." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!trustedOrigin(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  try {
    await logoutAccount();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Account service unavailable." }, { status: 503 });
  }
}
