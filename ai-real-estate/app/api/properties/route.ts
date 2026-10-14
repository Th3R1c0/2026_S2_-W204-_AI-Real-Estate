import { proxyBackendRequest } from "../../../lib/backend-proxy";

export async function GET(request: Request) {
  return proxyBackendRequest("/api/v1/properties", request.url);
}
