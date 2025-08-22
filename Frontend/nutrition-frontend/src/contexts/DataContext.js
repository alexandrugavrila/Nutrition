// DataContext.js
import React, { createContext, useState, useEffect, useContext } from "react";

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [ingredients, setIngredients] = useState([]);
  const [ingredientsNeedsRefetch, setIngredientsNeedsRefetch] = useState(false);
  const [possibleIngredientTags, setPossibleIngredientTags] = useState([]);
  const [meals, setMeals] = useState([]);
  const [possibleMealTags, setPossibleMealTags] = useState([]);
  const [mealsNeedsRefetch, setMealsNeedsRefetch] = useState(false);

  const [fetching, setFetching] = useState(false);

  const ingredientProcessingTagNames = ["Whole Food", "Lightly Processed", "Highly Processed"];
  const ingredientGroupTagNames = ["Vegetable", "Fruit", "Meat", "Dairy", "Grain"];

  const ingredientProcessingTags = possibleIngredientTags
    ? possibleIngredientTags.filter(({ name }) => ingredientProcessingTagNames.includes(name))
    : [];
  const ingredientGroupTags = possibleIngredientTags
    ? possibleIngredientTags.filter(({ name }) => ingredientGroupTagNames.includes(name))
    : [];
  const ingredientOtherTags = possibleIngredientTags
    ? possibleIngredientTags.filter(
        ({ name }) =>
          !ingredientProcessingTagNames.includes(name) &&
          !ingredientGroupTagNames.includes(name)
      )
    : [];

  const mealDietTagNames = ["Vegetarian", "Vegan", "Carnivore"];
  const mealTypeTagNames = ["Breakfast", "Lunch", "Dinner", "Snack"];

  const mealDietTags = possibleMealTags
    ? possibleMealTags.filter(({ name }) => mealDietTagNames.includes(name))
    : [];
  const mealTypeTags = possibleMealTags
    ? possibleMealTags.filter(({ name }) => mealTypeTagNames.includes(name))
    : [];
  const mealOtherTags = possibleMealTags
    ? possibleMealTags.filter(
        ({ name }) =>
          !mealDietTagNames.includes(name) &&
          !mealTypeTagNames.includes(name)
      )
    : [];

  const fetchData = async (url, setData, setLoading, errorHandler, processData) => {
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      const processedData = processData ? processData(data) : data;
      setData(processedData);
    } catch (error) {
      console.error("Error fetching data:", error);
      errorHandler(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIngredients = () => {
    const url = "/api/ingredients";

    const add1gUnit = (data) => {
      return data.map((ingredient) => {
        const ingredientsWithFloatGrams = ingredient.units.map((unit) => ({
          ...unit,
          grams: parseFloat(unit.grams),
        }));
        // Add a default 1g unit to the ingredient
        return {
          ...ingredient,
          units: [...ingredientsWithFloatGrams, { id: 0, ingredient_id: ingredient.id, name: "1g", grams: 1 }],
          selectedUnitId: 0,
        };
      });
    };

    fetchData(url, setIngredients, setFetching, () => setIngredientsNeedsRefetch(true), add1gUnit);
  };

  const fetchPossibleIngredientTags = () => {
    const url = "/api/ingredients/possible_tags";
    fetchData(url, setPossibleIngredientTags, setFetching, () => console.error("Error fetching tags"));
  };

  const fetchMeals = () => {
    const url = "/api/meals";
    const processData = (data) =>
      data.map((meal) => ({
        ...meal,
        ingredients: meal.ingredients
          ? meal.ingredients.map((mi) => ({
              ...mi,
              unit_quantity: mi.unit_quantity
                ? parseFloat(mi.unit_quantity)
                : 0,
            }))
          : [],
      }));

    fetchData(
      url,
      setMeals,
      setFetching,
      () => setMealsNeedsRefetch(true),
      processData
    );
  };

  const fetchPossibleMealTags = () => {
    const url = "/api/meals/possible_tags";
    fetchData(url, setPossibleMealTags, setFetching, () => console.error("Error fetching tags"));
  };

  //#region Effects
  useEffect(() => {
    fetchIngredients();
    fetchPossibleIngredientTags();
    fetchMeals();
    fetchPossibleMealTags();
  }, []); // Initial fetch

  useEffect(() => {
    if (ingredientsNeedsRefetch) {
      fetchIngredients();
      setIngredientsNeedsRefetch(false);
    }
    if (mealsNeedsRefetch) {
      fetchMeals();
      setMealsNeedsRefetch(false);
    }
  }, [ingredientsNeedsRefetch, mealsNeedsRefetch]); // Handle needsRefetch
  //#endregion Effects

  const value = {
    ingredients,
    setIngredients,
    ingredientProcessingTags,
    ingredientGroupTags,
    ingredientOtherTags,
    meals,
    mealDietTags,
    mealTypeTags,
    mealOtherTags,
    setIngredientsNeedsRefetch,
    setMealsNeedsRefetch,
    fetching,
    setFetching,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
