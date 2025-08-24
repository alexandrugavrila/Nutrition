import { Fetcher } from "openapi-typescript-fetch";
import type { paths } from "./api-types";

export const apiClient = Fetcher.for<paths>();
apiClient.configure({ baseUrl: "" });

export default apiClient;
