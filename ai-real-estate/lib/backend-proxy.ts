const backendUrl = (process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

export async function proxyBackendRequest(path: string, requestUrl?: string) {
  const query = requestUrl ? new URL(requestUrl).search : "";

  try {
    const response = await fetch(`${backendUrl}${path}${query}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return Response.json(
      { detail: "The property service is unavailable. Please try again shortly." },
      { status: 503 },
    );
  }
}
