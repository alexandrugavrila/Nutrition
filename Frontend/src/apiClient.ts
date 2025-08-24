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
            const data = await response.json();
            return { data };
          },
      }),
    };
  }
}

export const apiClient = new ApiClient();
apiClient.configure({ baseUrl: "" });

export default apiClient;
