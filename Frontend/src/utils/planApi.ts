import apiClient from "@/apiClient";
import type { components } from "@/api-types";
import type { PlanPayload } from "@/utils/planningTypes";

type PlanRead = components["schemas"]["PlanRead"];
type PlanCreate = components["schemas"]["PlanCreate"];
type PlanUpdate = components["schemas"]["PlanUpdate"];

export async function fetchPlans(): Promise<PlanRead[]> {
  const { data } = (await apiClient
    .path("/api/plans/")
    .method("get")
    .create()({})) as { data: PlanRead[] };
  return data;
}

export async function fetchPlan(planId: number): Promise<PlanRead> {
  const { data } = (await apiClient
    .path(`/api/plans/${planId}`)
    .method("get")
    .create()({})) as { data: PlanRead };
  return data;
}

export async function createPlan(label: string, payload: PlanPayload): Promise<PlanRead> {
  const body: PlanCreate = { label, payload };
  const { data } = (await apiClient
    .path("/api/plans/")
    .method("post")
    .create()({ body })) as { data: PlanRead };
  return data;
}

export async function updatePlan(
  planId: number,
  { label, payload }: { label?: string; payload?: PlanPayload }
): Promise<PlanRead> {
  const body: PlanUpdate = {};
  if (label !== undefined) {
    body.label = label;
  }
  if (payload !== undefined) {
    body.payload = payload;
  }
  const { data } = (await apiClient
    .path(`/api/plans/${planId}`)
    .method("put")
    .create()({ body })) as { data: PlanRead };
  return data;
}

export async function deletePlan(planId: number): Promise<void> {
  await apiClient
    .path(`/api/plans/${planId}`)
    .method("delete")
    .create()({});
}

export type { PlanRead };

