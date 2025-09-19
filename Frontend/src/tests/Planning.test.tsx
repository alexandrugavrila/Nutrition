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
  const mockIngredients = [
    {
      id: 1,
      name: "Oats",
      nutrition: {
        calories: 2, // per gram
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
    },
  ];

  // Foods are not exercised directly here but are required by the hook
  const mockFoods = [
    {
      id: 100,
      name: "Sample Food",
      ingredients: [
        { ingredient_id: 1, food_id: 100, unit_id: 10, unit_quantity: 50 },
      ],
      tags: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useData as unknown as Mock).mockReturnValue({
      ingredients: mockIngredients,
      foods: mockFoods,
    });
  });

  it("recalculates totals when editing an ingredient amount", async () => {
    render(<MemoryRouter><Planning /></MemoryRouter>);

    // Switch to adding an Ingredient
    await userEvent.click(screen.getByLabelText(/Type/i));
    await userEvent.click(screen.getByRole("option", { name: /Ingredient/i }));

    // Select the ingredient
    // Open the Ingredient select
    const ingredientSelect = screen.getByRole("combobox", { name: /^Ingredient$/i });
    await userEvent.click(ingredientSelect);
    await userEvent.click(screen.getByRole("option", { name: /Oats/i }));

    // Set amount to 100 and add
    const amountInput = screen.getByLabelText(/^Amount$/i);
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "100");
    await userEvent.click(screen.getByRole("button", { name: /Add/i }));

    // Expect summary totals for 100g with the per-gram nutrition above
    // calories: 2*100=200, protein: 0.1*100=10, carbs: 0.5*100=50, fat: 0.05*100=5, fiber: 0.02*100=2
    await waitFor(() => {
      const [cal, pro, carb, fat, fib] = getSummaryNumbers("Total");
      expect(cal).toBe("200");
      expect(pro).toBe("10");
      expect(carb).toBe("50");
      expect(fat).toBe("5");
      expect(fib).toBe("2");
    });

    // Edit the row amount to 150; totals should scale accordingly
    const rowAmountInput = screen.getAllByDisplayValue("100")[0];
    await userEvent.clear(rowAmountInput);
    await userEvent.type(rowAmountInput, "150");

    await waitFor(() => {
      const [cal, pro, carb, fat, fib] = getSummaryNumbers("Total");
      expect(cal).toBe("300"); // 2*150
      expect(pro).toBe("15"); // 0.1*150
      expect(carb).toBe("75"); // 0.5*150
      expect(fat).toBe("7.5"); // 0.05*150 => 7.5
      expect(fib).toBe("3"); // 0.02*150 => 3
    });
  });

  it("ignores invalid amounts (<= 0) when editing an existing ingredient", async () => {
    render(<MemoryRouter><Planning /></MemoryRouter>);

    // Add Oats 100g as above
    await userEvent.click(screen.getByLabelText(/Type/i));
    await userEvent.click(screen.getByRole("option", { name: /Ingredient/i }));
    const ingredientSelect = screen.getByRole("combobox", { name: /^Ingredient$/i });
    await userEvent.click(ingredientSelect);
    await userEvent.click(screen.getByRole("option", { name: /Oats/i }));
    const amountInput = screen.getByLabelText(/^Amount$/i);
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "100");
    await userEvent.click(screen.getByRole("button", { name: /Add/i }));

    // Attempt to set the existing row amount to 0 -> should be ignored
    const rowAmountInput = screen.getAllByDisplayValue("100")[0];
    await userEvent.clear(rowAmountInput);
    await userEvent.type(rowAmountInput, "0");

    // Value stays at previous (100) and totals unchanged
    await waitFor(() => {
      expect(rowAmountInput).toHaveValue(100);
      const [cal, pro, carb, fat, fib] = getSummaryNumbers("Total");
      expect(cal).toBe("200");
      expect(pro).toBe("10");
      expect(carb).toBe("50");
      expect(fat).toBe("5");
      expect(fib).toBe("2");
    });
  });

  it("shows targets and allows totals to exceed them", async () => {
    render(<MemoryRouter><Planning /></MemoryRouter>);

    // Add Oats 150g
    await userEvent.click(screen.getByLabelText(/Type/i));
    await userEvent.click(screen.getByRole("option", { name: /Ingredient/i }));
    const ingredientSelect = screen.getByRole("combobox", { name: /^Ingredient$/i });
    await userEvent.click(ingredientSelect);
    await userEvent.click(screen.getByRole("option", { name: /Oats/i }));
    const amountInput = screen.getByLabelText(/^Amount$/i);
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "150");
    await userEvent.click(screen.getByRole("button", { name: /Add/i }));

    // Set relatively low targets so totals exceed them
    await userEvent.clear(screen.getByLabelText(/Target calories/i));
    await userEvent.type(screen.getByLabelText(/Target calories/i), "100");
    await userEvent.clear(screen.getByLabelText(/Target protein/i));
    await userEvent.type(screen.getByLabelText(/Target protein/i), "5");

    // Verify totals vs targets are rendered as entered/calculated
    await waitFor(() => {
      const [tCal, tPro] = getSummaryNumbers("Total");
      expect(tCal).toBe("300"); // Total calories for 150g
      expect(tPro).toBe("15"); // Total protein for 150g

      const targetRow = getSummaryRow("Target");
      const targetCells = within(targetRow).getAllByRole("cell");
      expect(targetCells[1]).toHaveTextContent("100"); // Target calories
      expect(targetCells[2]).toHaveTextContent("5"); // Target protein
    });
  });
});

