import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, type Mock } from "vitest";

import Logging from "@/components/logging/Logging";
import { useData } from "@/contexts/DataContext";

vi.mock("@/contexts/DataContext");

vi.mock("@/apiClient", () => ({
  __esModule: true,
  default: {
    path: vi.fn().mockReturnThis(),
    method: vi.fn().mockReturnThis(),
    create: vi.fn(),
  },
}));

import apiClient from "@/apiClient";
const mockedClient = vi.mocked(apiClient, true);

type RequestHandler = Mock<
  [options?: { body?: unknown }],
  Promise<{ data: unknown }>
>;

describe("Logging component", () => {
  const fridgeItem = {
    id: 1,
    label: "Veg Chili",
    user_id: "tester",
    food_id: 10,
    ingredient_id: null,
    prepared_portions: 4,
    remaining_portions: 3,
    per_portion_calories: 100,
    per_portion_protein: 10,
    per_portion_carbohydrates: 15,
    per_portion_fat: 5,
    per_portion_fiber: 6,
    is_finished: false,
    prepared_at: "2024-01-15T12:00:00Z",
    updated_at: "2024-01-15T12:00:00Z",
    completed_at: null,
  };

  const ingredient = {
    id: 5,
    name: "Beans",
    units: [],
    tags: [],
    nutrition: null,
    shoppingUnitId: null,
  };

  const food = {
    id: 10,
    name: "Veg Chili",
    ingredients: [],
    tags: [],
  };

  let setFridgeNeedsRefetch: Mock;
  let startRequest: Mock;
  let endRequest: Mock;
  let today: string;
  let requestHandlers: Map<string, RequestHandler>;
  let lastPath: string;
  let lastMethod: string;
  let consumeHandler: RequestHandler;
  let logHandler: RequestHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    requestHandlers = new Map();
    lastPath = "";
    lastMethod = "";

    mockedClient.path.mockImplementation((path: string) => {
      lastPath = path;
      return mockedClient;
    });
    mockedClient.method.mockImplementation((method: string) => {
      lastMethod = method;
      return mockedClient;
    });
    mockedClient.create.mockImplementation(() => {
      const key = `${(lastMethod || "").toUpperCase()} ${lastPath}`;
      const handler = requestHandlers.get(key);
      if (!handler) {
        return vi.fn(async () => ({ data: [] }));
      }
      return handler;
    });

    today = new Date().toISOString().slice(0, 10);
    consumeHandler = vi.fn(async (options = {}) => {
      expect(options?.body).toEqual({ portions: 1.5 });
      return { data: {} };
    });
    requestHandlers.set(
      `POST /api/stored_food/${fridgeItem.id}/consume`,
      consumeHandler,
    );
    requestHandlers.set(
      `GET /api/logs/${today}`,
      vi.fn(async () => ({ data: [] })),
    );

    setFridgeNeedsRefetch = vi.fn();
    startRequest = vi.fn();
    endRequest = vi.fn();

    (useData as unknown as Mock).mockReturnValue({
      fridgeInventory: [fridgeItem],
      foods: [food],
      ingredients: [ingredient],
      setFridgeNeedsRefetch,
      startRequest,
      endRequest,
      hydrating: false,
    });
  });

  it("renders fridge items grouped and shows the log date picker", () => {
    render(<Logging />);

    expect(screen.getByText(/Fridge Inventory/i)).toBeInTheDocument();
    expect(screen.getByText(/Prepared Foods/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Log date/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Logs/i)).toBeInTheDocument();
  });

  it("logs consumption and records totals for the selected day", async () => {
    const logResponse = {
      id: 42,
      user_id: fridgeItem.user_id,
      log_date: today,
      stored_food_id: fridgeItem.id,
      ingredient_id: null,
      food_id: fridgeItem.food_id,
      portions_consumed: 1.5,
      calories: 150,
      protein: 15,
      carbohydrates: 22.5,
      fat: 7.5,
      fiber: 9,
      created_at: `${today}T12:00:00Z`,
    };

    logHandler = vi.fn(async (options = {}) => {
      expect(options?.body).toMatchObject({
        user_id: fridgeItem.user_id,
        log_date: today,
        stored_food_id: fridgeItem.id,
        portions_consumed: 1.5,
        calories: 150,
        protein: 15,
        carbohydrates: 22.5,
        fat: 7.5,
        fiber: 9,
      });
      return { data: logResponse };
    });
    requestHandlers.set("POST /api/logs/", logHandler);

    render(<Logging />);

    await waitFor(() => {
      expect(mockedClient.path).toHaveBeenCalledWith(`/api/logs/${today}`);
    });

    const portionsInput = screen.getByLabelText(
      /Portions to log for Veg Chili/i,
    ) as HTMLInputElement;

    await userEvent.type(portionsInput, "{selectall}1.5");

    const logButton = screen.getByRole("button", { name: /Add to log/i });
    await userEvent.click(logButton);

    await waitFor(() => {
      expect(consumeHandler).toHaveBeenCalled();
      expect(logHandler).toHaveBeenCalled();
      expect(setFridgeNeedsRefetch).toHaveBeenCalledWith(true);
      expect(startRequest).toHaveBeenCalled();
      expect(endRequest).toHaveBeenCalled();
    });

    const totalSummary = await screen.findByRole("group", {
      name: /Daily Total/i,
    });
    expect(
      within(totalSummary).getByLabelText(/Total portions/i),
    ).toHaveTextContent("1.5");
    expect(
      within(totalSummary).getByLabelText(/Total calories/i),
    ).toHaveTextContent("150");
    expect(
      within(totalSummary).getByLabelText(/Total protein/i),
    ).toHaveTextContent("15");
    expect(
      within(totalSummary).getByLabelText(/Total carbs/i),
    ).toHaveTextContent("22.5");
    expect(
      within(totalSummary).getByLabelText(/Total fat/i),
    ).toHaveTextContent("7.5");
    expect(
      within(totalSummary).getByLabelText(/Total fiber/i),
    ).toHaveTextContent("9");
  });

  it("removes fridge items when requested", async () => {
    const deleteHandler = vi.fn(async () => ({ data: {} }));
    requestHandlers.set(
      `DELETE /api/stored_food/${fridgeItem.id}`,
      deleteHandler,
    );

    render(<Logging />);

    await waitFor(() => {
      expect(mockedClient.path).toHaveBeenCalledWith(`/api/logs/${today}`);
    });

    const fridgeLabel = screen.getAllByText(fridgeItem.label)[0];
    const fridgeRow = fridgeLabel.closest("tr");
    if (!fridgeRow) {
      throw new Error("Fridge row not found");
    }
    const removeButton = within(fridgeRow).getByRole("button", {
      name: "Remove",
    });

    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(deleteHandler).toHaveBeenCalled();
      expect(setFridgeNeedsRefetch).toHaveBeenCalledWith(true);
      expect(startRequest).toHaveBeenCalled();
      expect(endRequest).toHaveBeenCalled();
    });

    expect(
      await screen.findByText(/Removed Veg Chili from the fridge/i),
    ).toBeInTheDocument();
  });

  it("removes logged entries and updates the table", async () => {
    const logResponse = {
      id: 101,
      user_id: fridgeItem.user_id,
      log_date: today,
      stored_food_id: fridgeItem.id,
      ingredient_id: null,
      food_id: fridgeItem.food_id,
      portions_consumed: 1,
      calories: 100,
      protein: 10,
      carbohydrates: 15,
      fat: 5,
      fiber: 6,
      created_at: `${today}T07:00:00Z`,
    };

    const listLogsHandler = vi.fn(async () => ({ data: [logResponse] }));
    requestHandlers.set(`GET /api/logs/${today}`, listLogsHandler);

    const deleteLogHandler = vi.fn(async () => ({ data: {} }));
    requestHandlers.set(
      `DELETE /api/logs/${logResponse.id}`,
      deleteLogHandler,
    );

    render(<Logging />);

    const logsHeading = screen.getByText(/Daily Logs/i);
    const logsCard = logsHeading.closest(".MuiCard-root") ?? logsHeading.parentElement;
    if (!logsCard) {
      throw new Error("Logs card not found");
    }
    const logsTable = await within(logsCard).findByRole("table");
    const logRow = await within(logsTable).findByRole("row", { name: /Veg Chili/i });
    const removeButton = within(logRow).getByRole("button", { name: "Remove" });

    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(deleteLogHandler).toHaveBeenCalled();
      expect(startRequest).toHaveBeenCalled();
      expect(endRequest).toHaveBeenCalled();
    });

    expect(
      await screen.findByText(/Removed Veg Chili from the log/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(
          /No items have been logged yet\. Log fridge items to see them here\./i,
        ),
      ).toBeInTheDocument();
    });
  });
});
