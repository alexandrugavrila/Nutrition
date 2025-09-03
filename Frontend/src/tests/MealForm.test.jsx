import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import MealForm from "../components/data/meal/form/MealForm";
import { useData } from "../contexts/DataContext";
import { handleFetchRequest } from "../utils/utils";

vi.mock("../contexts/DataContext");
vi.mock("../utils/utils", async () => {
  const actual = await vi.importActual("../utils/utils");
  return {
    ...actual,
    handleFetchRequest: vi.fn(() => Promise.resolve()),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  // Provide crypto.randomUUID for components
  if (!global.crypto) {
    global.crypto = { randomUUID: vi.fn(() => "uuid") };
  } else {
    global.crypto.randomUUID = vi.fn(() => "uuid");
  }
});

describe("MealForm tag selection", () => {
  test("submits selected tags when creating a meal", async () => {
    useData.mockReturnValue({
      setMealsNeedsRefetch: vi.fn(),
      startRequest: vi.fn(),
      endRequest: vi.fn(),
      mealDietTags: [{ id: 1, name: "Vegetarian" }],
      mealTypeTags: [{ id: 2, name: "Dinner" }],
      mealOtherTags: [{ id: 3, name: "Quick" }],
    });

    render(<MealForm />);

    await userEvent.click(screen.getByText(/Add Meal/i));

    await userEvent.click(screen.getByLabelText(/Tags/i));
    await userEvent.click(screen.getByRole("option", { name: "Vegetarian" }));
    await userEvent.click(screen.getByLabelText(/Tags/i));
    await userEvent.click(screen.getByRole("option", { name: "Dinner" }));
    await userEvent.click(screen.getByLabelText(/Tags/i));
    await userEvent.click(screen.getByRole("option", { name: "Quick" }));

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(handleFetchRequest).toHaveBeenCalled());
    const data = handleFetchRequest.mock.calls[0][2];
    expect(data.tags).toHaveLength(3);
    expect(data.tags).toEqual(
      expect.arrayContaining([{ id: 1 }, { id: 2 }, { id: 3 }])
    );
  });

  test("retains selected tags when updating a meal", async () => {
    useData.mockReturnValue({
      setMealsNeedsRefetch: vi.fn(),
      startRequest: vi.fn(),
      endRequest: vi.fn(),
      mealDietTags: [{ id: 1, name: "Vegetarian" }],
      mealTypeTags: [{ id: 2, name: "Dinner" }],
      mealOtherTags: [{ id: 3, name: "Quick" }],
    });

    const meal = {
      id: 10,
      name: "Existing",
      tags: [
        { id: 1, name: "Vegetarian" },
        { id: 2, name: "Dinner" },
      ],
      ingredients: [],
    };

    const { rerender } = render(<MealForm mealToEditData={null} />);

    rerender(<MealForm mealToEditData={meal} />);

    await screen.findByRole("button", { name: "Update" });

    await userEvent.click(screen.getByLabelText(/Tags/i));
    await userEvent.click(screen.getByRole("option", { name: "Quick" }));

    await userEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => expect(handleFetchRequest).toHaveBeenCalled());
    const data = handleFetchRequest.mock.calls[0][2];
    expect(data.tags).toHaveLength(3);
    expect(data.tags).toEqual(
      expect.arrayContaining([{ id: 1 }, { id: 2 }, { id: 3 }])
    );

    expect(screen.getByRole("button", { name: "Quick" })).toBeInTheDocument();
  });
});
