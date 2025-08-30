// Simplified API client to avoid reliance on external fetch library.
// Supports the minimal `path().method().create()` interface used by the app.

type HTTPMethod = "get" | "post" | "put" | "patch" | "delete";

class ApiClient {
  private baseUrl = "";

  configure({ baseUrl }: { baseUrl: string }) {
    this.baseUrl = baseUrl;
  }

  path(path: string) {
    const url = `${this.baseUrl}${path}`;
    return {
      method: (method: HTTPMethod) => ({
        create: () =>
          async (options: { body?: unknown } = {}) => {
            const { body } = options;
            const response = await fetch(url, {
              method: method.toUpperCase(),
              headers: body
                ? { "Content-Type": "application/json" }
                : undefined,
              body: body ? JSON.stringify(body) : undefined,
            });

            // Try to parse JSON only when present; fall back to text
            const contentType = response.headers.get("content-type") || "";
            let parsed: unknown = null;
            try {
              if (contentType.includes("application/json")) {
                parsed = await response.json();
              } else {
                const text = await response.text();
                parsed = text.length ? text : null;
              }
            } catch (e) {
              // Ignore JSON parse errors for empty/error responses
              parsed = null;
            }

            if (!response.ok) {
              const statusText = response.statusText || "Request failed";
              const detail =
                typeof parsed === "object" && parsed && "detail" in (parsed as any)
                  ? (parsed as any).detail
                  : parsed;
              const error = new Error(
                `${response.status} ${statusText}${detail ? `: ${detail}` : ""}`,
              );
              throw error;
            }

            return { data: parsed } as { data: any };
          },
      }),
    };
  }
}

export const apiClient = new ApiClient();
apiClient.configure({ baseUrl: "" });

export default apiClient;
