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

  const ingredientProcessingTags = possibleIngredientTags ? possibleIngredientTags.filter((tag) => ingredientProcessingTagNames.includes(tag.name)) : [];
  const ingredientGroupTags = possibleIngredientTags ? possibleIngredientTags.filter((tag) => ingredientGroupTagNames.includes(tag.name)) : [];
  const ingredientOtherTags = possibleIngredientTags ? possibleIngredientTags.filter((tag) => !ingredientProcessingTagNames.includes(tag.name) && !ingredientGroupTagNames.includes(tag.name)) : [];

  const mealDietTagNames = ["Vegetarian", "Vegan", "Carnivore"];
  const mealTypeTagNames = ["Breakfast", "Lunch", "Dinner", "Snack"];

  const mealDietTags = possibleMealTags ? possibleMealTags.filter((tag) => mealDietTagNames.includes(tag.name)) : [];
  const mealTypeTags = possibleMealTags ? possibleMealTags.filter((tag) => mealTypeTagNames.includes(tag.name)) : [];
  const mealOtherTags = possibleMealTags ? possibleMealTags.filter((tag) => !mealDietTagNames.includes(tag.name) && !mealTypeTagNames.includes(tag.name)) : [];

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
    const url = "http://localhost:5000/ingredients";

    const add100gUnit = (data) => {
      return data.map((ingredient) => {
        const ingredientsWithFloatGrams = ingredient.units.map((unit) => ({
          ...unit,
          grams: parseFloat(unit.grams),
        }));
        // Add a default 100g unit to the ingredient
        return {
          ...ingredient,
          units: [...ingredientsWithFloatGrams, { id: 0, ingredient_id: ingredient.id, name: "100g", grams: 100 }],
          selectedUnitId: 0,
        };
      });
    };

    fetchData(url, setIngredients, setFetching, () => setIngredientsNeedsRefetch(true), add100gUnit);
  };

  const fetchPossibleIngredientTags = () => {
    const url = "http://localhost:5000/ingredients/possible_tags";
    fetchData(url, setPossibleIngredientTags, setFetching, () => console.error("Error fetching tags"));
  };

  const fetchMeals = () => {
    const url = "http://localhost:5000/meals";
    fetchData(url, setMeals, setFetching, () => setMealsNeedsRefetch(true));
  };

  const fetchPossibleMealTags = () => {
    const url = "http://localhost:5000/meals/possible_tags";
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
      console.log("Refetching ingredients");
      fetchIngredients();
      setIngredientsNeedsRefetch(false);
    }
    if (mealsNeedsRefetch) {
      console.log("Refetching meals");
      fetchMeals();
      setMealsNeedsRefetch(false);
    }
  }, [ingredientsNeedsRefetch, mealsNeedsRefetch]); // Handle needsRefetch
  //#endregion Effects

  const value = {
    ingredients,
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
