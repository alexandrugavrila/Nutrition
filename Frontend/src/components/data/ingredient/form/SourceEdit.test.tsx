import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import SourceEdit from "./SourceEdit";

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SourceEdit", () => {
  it("imports normalized USDA detail results as per-gram nutrition", async () => {
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
    expect(await screen.findByText(/Per gram/i)).toBeInTheDocument();

    await userEvent.click(bananaRow);

    await waitFor(() => {
      expect(applyUsdaResult).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "123",
          name: "Banana",
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
});
