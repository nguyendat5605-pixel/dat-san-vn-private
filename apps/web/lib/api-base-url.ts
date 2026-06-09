const DEFAULT_API_ORIGIN = "http://localhost:3000";

function getConfiguredApiUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_API_ORIGIN
  ).replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const configuredUrl = getConfiguredApiUrl();
  return configuredUrl.endsWith("/api") ? configuredUrl : `${configuredUrl}/api`;
}

export function getApiOrigin() {
  const baseUrl = getApiBaseUrl();
  return baseUrl.endsWith("/api") ? baseUrl.slice(0, -4) : baseUrl;
}
