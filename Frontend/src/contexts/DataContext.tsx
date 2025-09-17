// DataContext.tsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import apiClient from "../apiClient";
import type { components } from "../api-types";

type Ingredient = components["schemas"]["IngredientRead"];
type PossibleIngredientTag = components["schemas"]["PossibleIngredientTag"];
type Food = components["schemas"]["FoodRead"];
type PossibleFoodTag = components["schemas"]["PossibleFoodTag"];
type IngredientWithSelection = Ingredient & { selectedUnitId: number | null };

interface DataContextValue {
  ingredients: IngredientWithSelection[];
  setIngredients: React.Dispatch<
    React.SetStateAction<IngredientWithSelection[]>
  >;
  ingredientProcessingTags: PossibleIngredientTag[];
  ingredientGroupTags: PossibleIngredientTag[];
  ingredientOtherTags: PossibleIngredientTag[];
  foods: Food[];
  foodDietTags: PossibleFoodTag[];
  foodTypeTags: PossibleFoodTag[];
  foodOtherTags: PossibleFoodTag[];
  setIngredientsNeedsRefetch: React.Dispatch<React.SetStateAction<boolean>>;
  setFoodsNeedsRefetch: React.Dispatch<React.SetStateAction<boolean>>;
  fetching: boolean;
  startRequest: () => void;
  endRequest: () => void;
  addPossibleIngredientTag: (name: string) => Promise<PossibleIngredientTag | null>;
  addPossibleFoodTag: (name: string) => Promise<PossibleFoodTag | null>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export const useData = () => useContext(DataContext!);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [ingredients, setIngredients] = useState<IngredientWithSelection[]>([]);
  const [ingredientsNeedsRefetch, setIngredientsNeedsRefetch] =
    useState(false);
  const [possibleIngredientTags, setPossibleIngredientTags] = useState<
    PossibleIngredientTag[]
  >([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [possibleFoodTags, setPossibleFoodTags] = useState<PossibleFoodTag[]>(
    [],
  );
  const [foodsNeedsRefetch, setFoodsNeedsRefetch] = useState(false);
  const [activeRequests, setActiveRequests] = useState(0);
  const fetching = activeRequests > 0;

  const startRequest = useCallback(() => {
    setActiveRequests((prev) => prev + 1);
  }, []);

  const endRequest = useCallback(() => {
    setActiveRequests((prev) => Math.max(prev - 1, 0));
  }, []);

  const ingredientProcessingTagNames = [
    "Whole Food",
    "Lightly Processed",
    "Highly Processed",
  ];
  const ingredientGroupTagNames = [
    "Vegetable",
    "Fruit",
    "Meat",
    "Dairy",
    "Grain",
  ];

  const ingredientProcessingTags = possibleIngredientTags
    ? possibleIngredientTags.filter(({ name }) =>
        ingredientProcessingTagNames.includes(name),
      )
    : [];
  const ingredientGroupTags = possibleIngredientTags
    ? possibleIngredientTags.filter(({ name }) =>
        ingredientGroupTagNames.includes(name),
      )
    : [];
  const ingredientOtherTags = possibleIngredientTags
    ? possibleIngredientTags.filter(
        ({ name }) =>
          !ingredientProcessingTagNames.includes(name) &&
          !ingredientGroupTagNames.includes(name),
      )
    : [];

  const foodDietTagNames = ["Vegetarian", "Vegan", "Carnivore"];
  const foodTypeTagNames = ["Breakfast", "Lunch", "Dinner", "Snack"];

  const foodDietTags = possibleFoodTags
    ? possibleFoodTags.filter(({ name }) => foodDietTagNames.includes(name))
    : [];
  const foodTypeTags = possibleFoodTags
    ? possibleFoodTags.filter(({ name }) => foodTypeTagNames.includes(name))
    : [];
  const foodOtherTags = possibleFoodTags
    ? possibleFoodTags.filter(
        ({ name }) =>
          !foodDietTagNames.includes(name) && !foodTypeTagNames.includes(name),
      )
    : [];

  const fetchIngredients = useCallback(async () => {
    startRequest();
    try {
      const { data } = await apiClient
        .path("/api/ingredients/")
        .method("get")
        .create()({});
      const processed = data.map((ingredient) => {
        const unitsWithFloatGrams =
          ingredient.units?.map((unit) => {
            const normalizedId =
              unit.id === undefined || unit.id === null ? null : Number(unit.id);
            return {
              ...unit,
              id: normalizedId,
              grams: parseFloat(String(unit.grams)),
            };
          }) ?? [];
        const defaultUnit =
          unitsWithFloatGrams.find((unit) => unit.name === "g" && unit.grams === 1) ||
          unitsWithFloatGrams.find((unit) => unit.grams === 1) ||
          unitsWithFloatGrams[0];
        const selectedUnitId =
          defaultUnit && defaultUnit.id !== undefined && defaultUnit.id !== null
            ? defaultUnit.id
            : null;
        return {
          ...ingredient,
          units: unitsWithFloatGrams,
          selectedUnitId,
        };
      });
      setIngredients(processed);
    } catch (error) {
      console.error("Error fetching data:", error);
      setIngredientsNeedsRefetch(true);
    } finally {
      endRequest();
    }
  }, [startRequest, endRequest]);

  const fetchPossibleIngredientTags = useCallback(async () => {
    startRequest();
    try {
      const { data } = await apiClient
        .path("/api/ingredients/possible_tags")
        .method("get")
        .create()({});
      setPossibleIngredientTags(data);
    } catch (error) {
      console.error("Error fetching tags", error);
    } finally {
      endRequest();
    }
  }, [startRequest, endRequest]);

  const addPossibleIngredientTag = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = possibleIngredientTags.find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing;
      startRequest();
      try {
        const { data } = (await apiClient
          .path("/api/ingredients/possible_tags")
          .method("post")
          .create()({ body: { name: trimmed } })) as {
          data: PossibleIngredientTag;
        };
        setPossibleIngredientTags((prev) =>
          prev.some((t) => t.id === data.id) ? prev : [...prev, data],
        );
        return data;
      } catch (error) {
        console.error("Error adding ingredient tag:", error);
        return null;
      } finally {
        endRequest();
      }
    },
    [possibleIngredientTags, startRequest, endRequest],
  );

  const addPossibleFoodTag = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const existing = possibleFoodTags.find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing;
      startRequest();
      try {
        const { data } = (await apiClient
          .path("/api/foods/possible_tags")
          .method("post")
          .create()({ body: { name: trimmed } })) as {
          data: PossibleFoodTag;
        };
        setPossibleFoodTags((prev) =>
          prev.some((t) => t.id === data.id) ? prev : [...prev, data],
        );
        return data;
      } catch (error) {
        console.error("Error adding food tag:", error);
        return null;
      } finally {
        endRequest();
      }
    },
    [possibleFoodTags, startRequest, endRequest],
  );

  const fetchFoods = useCallback(async () => {
    startRequest();
    try {
      const { data } = await apiClient
        .path("/api/foods/")
        .method("get")
        .create()({});
      const processed = data.map((food) => ({
        ...food,
        ingredients:
          food.ingredients?.map((mi) => ({
            ...mi,
            unit_quantity: mi.unit_quantity
              ? parseFloat(String(mi.unit_quantity))
              : 0,
          })) ?? [],
      }));
      setFoods(processed);
    } catch (error) {
      console.error("Error fetching data:", error);
      setFoodsNeedsRefetch(true);
    } finally {
      endRequest();
    }
  }, [startRequest, endRequest]);

  const fetchPossibleFoodTags = useCallback(async () => {
    startRequest();
    try {
      const { data } = await apiClient
        .path("/api/foods/possible_tags")
        .method("get")
        .create()({});
      setPossibleFoodTags(data);
    } catch (error) {
      console.error("Error fetching tags", error);
    } finally {
      endRequest();
    }
  }, [startRequest, endRequest]);

  //#region Effects
  useEffect(() => {
    fetchIngredients();
    fetchPossibleIngredientTags();
    fetchFoods();
    fetchPossibleFoodTags();
  }, [
    fetchIngredients,
    fetchPossibleIngredientTags,
    fetchFoods,
    fetchPossibleFoodTags,
  ]); // Initial fetch

  useEffect(() => {
    if (ingredientsNeedsRefetch) {
      fetchIngredients();
      setIngredientsNeedsRefetch(false);
    }
    if (foodsNeedsRefetch) {
      fetchFoods();
      setFoodsNeedsRefetch(false);
    }
  }, [
    ingredientsNeedsRefetch,
    foodsNeedsRefetch,
    fetchIngredients,
    fetchFoods,
  ]); // Handle needsRefetch
  //#endregion Effects

  const value = {
    ingredients,
    setIngredients,
    ingredientProcessingTags,
    ingredientGroupTags,
    ingredientOtherTags,
    foods,
    foodDietTags,
    foodTypeTags,
    foodOtherTags,
    setIngredientsNeedsRefetch,
    setFoodsNeedsRefetch,
    fetching,
    startRequest,
    endRequest,
    addPossibleIngredientTag,
    addPossibleFoodTag,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

