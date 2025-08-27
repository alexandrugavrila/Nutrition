import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MealTable from "../components/data/meal/MealTable";
import { useData } from "../contexts/DataContext";

vi.mock("../contexts/DataContext");

const mockMeals = [
  {
    id: 1,
    name: "Veg Breakfast",
    tags: [
      { id: 1, name: "Breakfast" },
      { id: 3, name: "Vegetarian" },
    ],
    ingredients: [],
  },
  {
    id: 2,
    name: "Chicken Dinner",
    tags: [{ id: 2, name: "Dinner" }],
    ingredients: [],
  },
  {
    id: 3,
    name: "Snack",
    tags: [],
    ingredients: [],
  },
  {
    id: 4,
    name: "Mystery Meal",
    ingredients: [],
  },
];

const renderWithData = () => {
  useData.mockReturnValue({
    meals: mockMeals,
    ingredients: [],
    mealDietTags: [{ id: 3, name: "Vegetarian" }],
    mealTypeTags: [
      { id: 1, name: "Breakfast" },
      { id: 2, name: "Dinner" },
    ],
    mealOtherTags: [],
  });
  return render(<MealTable />);
};

describe("MealTable tag filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows all meals when no tags are selected", () => {
    renderWithData();
    expect(screen.getByText("Veg Breakfast")).toBeInTheDocument();
    expect(screen.getByText("Chicken Dinner")).toBeInTheDocument();
    expect(screen.getByText("Snack")).toBeInTheDocument();
    expect(screen.getByText("Mystery Meal")).toBeInTheDocument();
  });

  test("filters meals by a single selected tag and excludes meals without tags", async () => {
    renderWithData();
    await userEvent.click(screen.getByLabelText(/Filter tags/i));
    await userEvent.click(screen.getByRole("option", { name: "Dinner" }));
    expect(await screen.findByText("Chicken Dinner")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Veg Breakfast")).not.toBeInTheDocument();
      expect(screen.queryByText("Snack")).not.toBeInTheDocument();
      expect(screen.queryByText("Mystery Meal")).not.toBeInTheDocument();
    });
  });

  test("filters meals when multiple tags are selected", async () => {
    renderWithData();
    await userEvent.click(screen.getByLabelText(/Filter tags/i));
    await userEvent.click(screen.getByRole("option", { name: "Breakfast" }));
    await userEvent.click(screen.getByLabelText(/Filter tags/i));
    await userEvent.click(screen.getByRole("option", { name: "Dinner" }));
    expect(await screen.findByText("Veg Breakfast")).toBeInTheDocument();
    expect(await screen.findByText("Chicken Dinner")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Snack")).not.toBeInTheDocument();
    });
  });

  test("combines search and tag filters", async () => {
    renderWithData();
    await userEvent.click(screen.getByLabelText(/Filter tags/i));
    await userEvent.click(screen.getByRole("option", { name: "Dinner" }));
    await userEvent.type(screen.getByLabelText(/Search by name/i), "Chicken");
    expect(await screen.findByText("Chicken Dinner")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Veg Breakfast")).not.toBeInTheDocument();
    });
  });
});

