// DataContext.tsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import apiClient from '../apiClient';
import type { components } from '../api-types';

type Ingredient = components['schemas']['IngredientRead'];
type PossibleIngredientTag = components['schemas']['PossibleIngredientTagRead'];
type Meal = components['schemas']['MealRead'];
type PossibleMealTag = components['schemas']['PossibleMealTagRead'];
type IngredientWithSelection = Ingredient & { selectedUnitId: number | null };

interface DataContextValue {
  ingredients: IngredientWithSelection[];
  setIngredients: React.Dispatch<React.SetStateAction<IngredientWithSelection[]>>;
  ingredientTagsByGroup: Record<string, PossibleIngredientTag[]>;
  meals: Meal[];
  mealTagsByGroup: Record<string, PossibleMealTag[]>;
  setIngredientsNeedsRefetch: React.Dispatch<React.SetStateAction<boolean>>;
  setMealsNeedsRefetch: React.Dispatch<React.SetStateAction<boolean>>;
  fetching: boolean;
  startRequest: () => void;
  endRequest: () => void;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export const useData = () => useContext(DataContext!);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [ingredients, setIngredients] = useState<IngredientWithSelection[]>([]);
  const [ingredientsNeedsRefetch, setIngredientsNeedsRefetch] = useState(false);
  const [possibleIngredientTags, setPossibleIngredientTags] = useState<PossibleIngredientTag[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [possibleMealTags, setPossibleMealTags] = useState<PossibleMealTag[]>([]);
  const [mealsNeedsRefetch, setMealsNeedsRefetch] = useState(false);
  const [activeRequests, setActiveRequests] = useState(0);
  const fetching = activeRequests > 0;

  const startRequest = useCallback(() => {
    setActiveRequests((prev) => prev + 1);
  }, []);

  const endRequest = useCallback(() => {
    setActiveRequests((prev) => Math.max(prev - 1, 0));
  }, []);

  const groupTags = useCallback(<T extends { group: string }>(tags: T[]) => {
    return tags.reduce<Record<string, T[]>>((acc, tag) => {
      (acc[tag.group] ||= []).push(tag);
      return acc;
    }, {});
  }, []);

  const ingredientTagsByGroup = useMemo(
    () => groupTags(possibleIngredientTags),
    [possibleIngredientTags, groupTags],
  );
  const mealTagsByGroup = useMemo(() => groupTags(possibleMealTags), [possibleMealTags, groupTags]);

  const fetchIngredients = useCallback(async () => {
    startRequest();
    try {
      const { data } = await apiClient.path('/api/ingredients/').method('get').create()({});
      const processed = data.map((ingredient) => {
        const unitsWithFloatGrams =
          ingredient.units?.map((unit) => ({
            ...unit,
            grams: parseFloat(String(unit.grams)),
          })) ?? [];
        const defaultUnit =
          unitsWithFloatGrams.find((unit) => unit.name === '1g') ||
          unitsWithFloatGrams.find((unit) => unit.grams === 1) ||
          unitsWithFloatGrams[0];
        return {
          ...ingredient,
          units: unitsWithFloatGrams,
          selectedUnitId: defaultUnit ? defaultUnit.id : null,
        };
      });
      setIngredients(processed);
    } catch (error) {
      console.error('Error fetching data:', error);
      setIngredientsNeedsRefetch(true);
    } finally {
      endRequest();
    }
  }, [startRequest, endRequest]);

  const fetchPossibleIngredientTags = useCallback(async () => {
    startRequest();
    try {
      const { data } = await apiClient
        .path('/api/ingredients/possible_tags')
        .method('get')
        .create()({});
      setPossibleIngredientTags(data);
    } catch (error) {
      console.error('Error fetching tags', error);
    } finally {
      endRequest();
    }
  }, [startRequest, endRequest]);

  const fetchMeals = useCallback(async () => {
    startRequest();
    try {
      const { data } = await apiClient.path('/api/meals/').method('get').create()({});
      const processed = data.map((meal) => ({
        ...meal,
        ingredients:
          meal.ingredients?.map((mi) => ({
            ...mi,
            unit_quantity: mi.unit_quantity ? parseFloat(String(mi.unit_quantity)) : 0,
          })) ?? [],
      }));
      setMeals(processed);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMealsNeedsRefetch(true);
    } finally {
      endRequest();
    }
  }, [startRequest, endRequest]);

  const fetchPossibleMealTags = useCallback(async () => {
    startRequest();
    try {
      const { data } = await apiClient.path('/api/meals/possible_tags').method('get').create()({});
      setPossibleMealTags(data);
    } catch (error) {
      console.error('Error fetching tags', error);
    } finally {
      endRequest();
    }
  }, [startRequest, endRequest]);

  //#region Effects
  useEffect(() => {
    fetchIngredients();
    fetchPossibleIngredientTags();
    fetchMeals();
    fetchPossibleMealTags();
  }, [fetchIngredients, fetchPossibleIngredientTags, fetchMeals, fetchPossibleMealTags]); // Initial fetch

  useEffect(() => {
    if (ingredientsNeedsRefetch) {
      fetchIngredients();
      setIngredientsNeedsRefetch(false);
    }
    if (mealsNeedsRefetch) {
      fetchMeals();
      setMealsNeedsRefetch(false);
    }
  }, [ingredientsNeedsRefetch, mealsNeedsRefetch, fetchIngredients, fetchMeals]); // Handle needsRefetch
  //#endregion Effects

  const value = {
    ingredients,
    setIngredients,
    ingredientTagsByGroup,
    meals,
    mealTagsByGroup,
    setIngredientsNeedsRefetch,
    setMealsNeedsRefetch,
    fetching,
    startRequest,
    endRequest,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
