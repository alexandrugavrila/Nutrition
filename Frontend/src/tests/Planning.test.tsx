import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { vi, type Mock } from "vitest";

import Planning from "@/components/planning/Planning";
import { useData } from "@/contexts/DataContext";

// Mock DataContext hook and any heavy children used inside Planning
vi.mock("@/contexts/DataContext");
vi.mock("@/components/common/IngredientModal", () => ({
  __esModule: true,
  default: () => null,
}));

const mockIngredient = {
  id: 1,
  name: "Oats",
  nutrition: {
    calories: 2,
    protein: 0.1,
    fat: 0.05,
    carbohydrates: 0.5,
    fiber: 0.02,
  },
  units: [
    { id: 10, ingredient_id: 1, name: "g", grams: 1 },
    { id: 11, ingredient_id: 1, name: "cup", grams: 100 },
  ],
  tags: [],
  shoppingUnitId: 10,
};

const mockFood = {
  id: 100,
  name: "Sample Food",
  ingredients: [
    { ingredient_id: 1, food_id: 100, unit_id: 10, unit_quantity: 50 },
  ],
  tags: [],
};

const mockFridgeItem = {
  id: 500,
  label: "Stored oats",
  user_id: "user-1",
  food_id: null,
  ingredient_id: 1,
  prepared_portions: 4,
  remaining_portions: 2,
  per_portion_calories: 50,
  per_portion_protein: 5,
  per_portion_carbohydrates: 10,
  per_portion_fat: 2,
  per_portion_fiber: 1,
  is_finished: false,
  prepared_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-02T00:00:00Z",
  completed_at: null,
};

vi.mock("@/components/data/ingredient/IngredientTable", () => ({
  __esModule: true,
  default: ({ onIngredientDoubleClick }) => (
    <button type="button" onClick={() => onIngredientDoubleClick?.(mockIngredient)}>
      Select Oats
    </button>
  ),
}));

vi.mock("@/components/data/food/FoodTable", () => ({
  __esModule: true,
  default: () => <div>Food table mock</div>,
}));

// Small helpers to locate the summary row and its numeric cells
const getSummaryRow = (label: string) => {
  const cell = screen.getByText(label);
  const row = cell.closest("tr");
  if (!row) throw new Error(`Row not found for label ${label}`);
  return row as HTMLTableRowElement;
};

const getSummaryNumbers = (label: string) => {
  const row = getSummaryRow(label);
  const cells = within(row).getAllByRole("cell");
  // [0] is the label cell; the rest are numeric columns
  return cells.slice(1).map((td) => td.textContent?.trim() ?? "");
};

describe("Planning - ingredient editing updates macros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useData as unknown as Mock).mockReturnValue({
      ingredients: [mockIngredient],
      foods: [mockFood],
      fridgeInventory: [],
      setFridgeInventory: vi.fn(),
      setFridgeNeedsRefetch: vi.fn(),
    });
  });

  it("recalculates totals when editing an ingredient amount", async () => {
    render(<MemoryRouter><Planning /></MemoryRouter>);

    await userEvent.click(screen.getByRole("button", { name: /Add Ingredient/i }));
    await userEvent.click(await screen.findByRole("button", { name: /Select Oats/i }));

    const ingredientCell = await screen.findByText("Oats");
    const ingredientRow = ingredientCell.closest("tr");
    if (!ingredientRow) throw new Error("Ingredient row not found");
    const amountInput = within(ingredientRow).getByLabelText(
      /portion size quantity/i,
    ) as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "100");

    // Expect summary totals for 100g with the per-gram nutrition above
    // calories: 2*100=200, protein: 0.1*100=10, carbs: 0.5*100=50, fat: 0.05*100=5, fiber: 0.02*100=2
    await waitFor(() => {
      const [cal, pro, carb, fat, fib] = getSummaryNumbers("Total Overall");
      expect(cal).toBe("200");
      expect(pro).toBe("10");
      expect(carb).toBe("50");
      expect(fat).toBe("5");
      expect(fib).toBe("2");
    });

    // Edit the row amount to 150; totals should scale accordingly
    const rowAmountInput = amountInput;
    await userEvent.clear(rowAmountInput);
    await userEvent.type(rowAmountInput, "150");

    await waitFor(() => {
      const [cal, pro, carb, fat, fib] = getSummaryNumbers("Total Overall");
      expect(cal).toBe("300"); // 2*150
      expect(pro).toBe("15"); // 0.1*150
      expect(carb).toBe("75"); // 0.5*150
      expect(fat).toBe("7.5"); // 0.05*150 => 7.5
      expect(fib).toBe("3"); // 0.02*150 => 3
    });
  });

  it("ignores invalid amounts (<= 0) when editing an existing ingredient", async () => {
    render(<MemoryRouter><Planning /></MemoryRouter>);

    await userEvent.click(screen.getByRole("button", { name: /Add Ingredient/i }));
    await userEvent.click(await screen.findByRole("button", { name: /Select Oats/i }));
    const ingredientCell = await screen.findByText("Oats");
    const ingredientRow = ingredientCell.closest("tr");
    if (!ingredientRow) throw new Error("Ingredient row not found");
    const amountInput = within(ingredientRow).getByLabelText(
      /portion size quantity/i,
    ) as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "100");

    // Attempt to set the existing row amount to 0 -> should be ignored
    const rowAmountInput = amountInput as HTMLInputElement;
    await userEvent.clear(rowAmountInput);
    await userEvent.type(rowAmountInput, "0");

    // Value stays at previous (100) and totals unchanged
    await waitFor(() => {
      expect(rowAmountInput).toHaveValue(100);
      const [cal, pro, carb, fat, fib] = getSummaryNumbers("Total Overall");
      expect(cal).toBe("200");
      expect(pro).toBe("10");
      expect(carb).toBe("50");
      expect(fat).toBe("5");
      expect(fib).toBe("2");
    });
  });

  it("shows targets and allows totals to exceed them", async () => {
    render(<MemoryRouter><Planning /></MemoryRouter>);

    await userEvent.click(screen.getByRole("button", { name: /Add Ingredient/i }));
    await userEvent.click(await screen.findByRole("button", { name: /Select Oats/i }));
    const ingredientCell = await screen.findByText("Oats");
    const ingredientRow = ingredientCell.closest("tr");
    if (!ingredientRow) throw new Error("Ingredient row not found");
    const amountInput = within(ingredientRow).getByLabelText(
      /portion size quantity/i,
    ) as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "150");

    // Set relatively low targets so totals exceed them
    await userEvent.clear(screen.getByLabelText(/Target calories/i));
    await userEvent.type(screen.getByLabelText(/Target calories/i), "100");
    await userEvent.clear(screen.getByLabelText(/Target protein/i));
    await userEvent.type(screen.getByLabelText(/Target protein/i), "5");

    // Verify totals vs targets are rendered as entered/calculated
    await waitFor(() => {
      const [tCal, tPro] = getSummaryNumbers("Total Overall");
      expect(tCal).toBe("300"); // Total calories for 150g
      expect(tPro).toBe("15"); // Total protein for 150g

      const targetRow = getSummaryRow("Target");
      const targetCells = within(targetRow).getAllByRole("cell");
      expect(targetCells[1]).toHaveTextContent("100"); // Target calories
      expect(targetCells[2]).toHaveTextContent("5"); // Target protein
    });
  });

  it("optionally includes fridge totals in the overall summary", async () => {
    (useData as unknown as Mock).mockReturnValue({
      ingredients: [mockIngredient],
      foods: [mockFood],
      fridgeInventory: [mockFridgeItem],
      setFridgeInventory: vi.fn(),
      setFridgeNeedsRefetch: vi.fn(),
    });

    render(<MemoryRouter><Planning /></MemoryRouter>);

    await userEvent.click(screen.getByRole("button", { name: /Add Ingredient/i }));
    await userEvent.click(await screen.findByRole("button", { name: /Select Oats/i }));

    const ingredientCell = await screen.findByText("Oats");
    const ingredientRow = ingredientCell.closest("tr");
    if (!ingredientRow) throw new Error("Ingredient row not found");
    const amountInput = within(ingredientRow).getByLabelText(
      /portion size quantity/i,
    ) as HTMLInputElement;
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "100");

    await waitFor(() => {
      const [overallCal, overallPro, overallCarb, overallFat, overallFib] =
        getSummaryNumbers("Total Overall");
      expect(overallCal).toBe("200");
      expect(overallPro).toBe("10");
      expect(overallCarb).toBe("50");
      expect(overallFat).toBe("5");
      expect(overallFib).toBe("2");
    });

    expect(screen.queryByText("Total in Plan")).not.toBeInTheDocument();
    expect(screen.queryByText("Total in Fridge")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/Include fridge inventory/i));

    await waitFor(() => {
      const [cal, pro, carb, fat, fib] = getSummaryNumbers("Total in Plan");
      expect(cal).toBe("200");
      expect(pro).toBe("10");
      expect(carb).toBe("50");
      expect(fat).toBe("5");
      expect(fib).toBe("2");
    });

    await waitFor(() => {
      const [fridgeCal, fridgePro, fridgeCarb, fridgeFat, fridgeFib] = getSummaryNumbers(
        "Total in Fridge",
      );
      expect(fridgeCal).toBe("100");
      expect(fridgePro).toBe("10");
      expect(fridgeCarb).toBe("20");
      expect(fridgeFat).toBe("4");
      expect(fridgeFib).toBe("2");
    });

    await waitFor(() => {
      const [overallCal, overallPro, overallCarb, overallFat, overallFib] =
        getSummaryNumbers("Total Overall");
      expect(overallCal).toBe("300");
      expect(overallPro).toBe("20");
      expect(overallCarb).toBe("70");
      expect(overallFat).toBe("9");
      expect(overallFib).toBe("4");
    });
  });
});

