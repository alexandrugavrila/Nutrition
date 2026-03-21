import React from "react";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useData } from "@/contexts/DataContext";

import SourceEdit from "./SourceEdit";
import { useIngredientForm } from "./useIngredientForm";

vi.mock("@/contexts/DataContext", () => ({
  useData: vi.fn(),
}));

const mockedUseData = vi.mocked(useData);

const baseIngredient = {
  id: 1,
  name: "Test Ingredient",
  units: [
    {
      id: "unit-1",
      ingredient_id: 1,
      name: "g",
      grams: "1",
    },
  ],
  shoppingUnitId: "unit-1",
  nutrition: {
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    fiber: 0,
  },
  tags: [],
  source: "usda",
  source_id: null,
  sourceName: null,
};

beforeEach(() => {
  mockedUseData.mockReturnValue({
    setIngredientsNeedsRefetch: vi.fn(),
    startRequest: vi.fn(),
    endRequest: vi.fn(),
  } as never);
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("SourceEdit", () => {
  it("shows the USDA default unit in search results and prefers detail units on selection", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          foods: [
            {
              id: 123,
              name: "Banana",
              nutrition: {
                calories: 0.89,
                protein: 0.0109,
                carbohydrates: 0.2284,
                fat: 0.0033,
                fiber: 0.026,
              },
              normalization: {
                can_normalize: true,
                source_basis: "per_100g",
                normalized_basis: "per_g",
                reason: null,
                data_type: "Foundation",
                serving_size: null,
                serving_size_unit: null,
                household_serving_full_text: null,
              },
              units: [
                { name: "1 g", grams: 1, is_default: false },
                { name: "1 medium", grams: 118, is_default: true },
              ],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          name: "Banana",
          nutrition: {
            calories: 0.89,
            protein: 0.0109,
            carbohydrates: 0.2284,
            fat: 0.0033,
            fiber: 0.026,
          },
          normalization: {
            can_normalize: true,
            source_basis: "per_100g",
            normalized_basis: "per_g",
            reason: null,
            data_type: "Foundation",
            serving_size: null,
            serving_size_unit: null,
            household_serving_full_text: null,
          },
          units: [
            { name: "1 g", grams: 1, is_default: false },
            { name: "1 large", grams: 136, is_default: true },
            { name: "1 cup sliced", grams: 150, is_default: false },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const applyUsdaResult = vi.fn();
    render(
      <SourceEdit
        ingredient={baseIngredient as never}
        dispatch={vi.fn()}
        applyUsdaResult={applyUsdaResult}
      />,
    );

    await userEvent.type(screen.getByLabelText(/search usda/i), "banana");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    const bananaRow = await screen.findByRole("button", { name: /banana/i });
    expect(bananaRow).toBeEnabled();
    expect(await screen.findByText(/1 medium · Calories 0\.89/i)).toBeInTheDocument();
    expect(screen.queryByText(/Per gram/i)).not.toBeInTheDocument();

    await userEvent.click(bananaRow);

    await waitFor(() => {
      expect(applyUsdaResult).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "123",
          name: "Banana",
          units: [
            expect.objectContaining({ name: "1 g", grams: 1, is_default: false }),
            expect.objectContaining({ name: "1 large", grams: 136, is_default: true }),
            expect.objectContaining({ name: "1 cup sliced", grams: 150, is_default: false }),
          ],
          defaultUnitKey: "name:1 large|grams:136",
          nutrition: expect.objectContaining({
            calories: 0.89,
            protein: 0.0109,
          }),
          normalization: expect.objectContaining({
            can_normalize: true,
            source_basis: "per_100g",
          }),
        }),
      );
    });
  });

  it("disables USDA results that cannot be normalized to per-gram nutrition", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        foods: [
          {
            id: 456,
            name: "Orange juice",
            nutrition: null,
            normalization: {
              can_normalize: false,
              source_basis: "per_100ml",
              normalized_basis: null,
              reason: "USDA branded nutrients are standardized to 100 mL for this item, so they cannot be converted to per-gram values without density data.",
              data_type: "Branded",
              serving_size: 240,
              serving_size_unit: "ml",
              household_serving_full_text: "8 fl oz",
            },
            units: [{ name: "1 g", grams: 1, is_default: true }],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const applyUsdaResult = vi.fn();
    render(
      <SourceEdit
        ingredient={baseIngredient as never}
        dispatch={vi.fn()}
        applyUsdaResult={applyUsdaResult}
      />,
    );

    await userEvent.type(screen.getByLabelText(/search usda/i), "juice");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    const resultButton = await screen.findByRole("button", { name: /orange juice/i });
    expect(resultButton).toHaveAttribute("aria-disabled", "true");
    expect(await screen.findByText(/cannot be converted to per-gram values without density data/i)).toBeInTheDocument();
    expect(applyUsdaResult).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retains the USDA default unit in form state and imports gram plus USDA units", () => {
    const { result } = renderHook(() => useIngredientForm());

    act(() => {
      result.current.applyUsdaResult({
        id: "333",
        name: "Apple slices",
        nutrition: {
          calories: 0.52,
          protein: 0.0003,
          carbohydrates: 0.14,
          fat: 0.0002,
          fiber: 0.024,
        },
        normalization: {
          source_basis: "per_100g",
          normalized_basis: "per_g",
          can_normalize: true,
          reason: null,
          data_type: "Foundation",
          serving_size: null,
          serving_size_unit: null,
          household_serving_full_text: null,
        },
        units: [
          { name: "1 g", grams: 1, is_default: false },
          { name: "1 cup sliced", grams: 109, is_default: true },
          { name: "1 tbsp", grams: 8.5, is_default: false },
        ],
        defaultUnitKey: "name:1 cup sliced|grams:109",
      });
    });

    expect(result.current.ingredient.source).toBe("usda");
    expect(result.current.ingredient.source_id).toBe("333");
    expect(result.current.ingredient.sourceName).toBe("Apple slices");
    expect(result.current.ingredient.units).toEqual([
      expect.objectContaining({ name: "g", grams: 1 }),
      expect.objectContaining({ name: "1 cup sliced", grams: 109 }),
      expect.objectContaining({ name: "1 tbsp", grams: 8.5 }),
    ]);

    const selectedUnit = result.current.ingredient.units.find(
      (unit) => String(unit.id) === String(result.current.ingredient.shoppingUnitId),
    );
    expect(selectedUnit).toEqual(expect.objectContaining({ name: "1 cup sliced", grams: 109 }));
  });
});
