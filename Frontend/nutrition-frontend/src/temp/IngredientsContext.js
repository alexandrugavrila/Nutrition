// IngredientsContext.js
import React, { createContext, useContext, useState, useEffect } from "react";

const IngredientsContext = createContext();

export const useIngredients = () => useContext(IngredientsContext);

export const IngredientsProvider = ({ children }) => {
  const [ingredients, setIngredients] = useState([]);
  const [needsRefetch, setNeedsRefetch] = useState(false);

  const fetchData = () => {
    fetch("http://localhost:5000/ingredients")
      .then((response) => response.json())
      .then((data) => {
        const ingredientsWith1gUnit = data.map((ingredient) => {
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
        console.log("Fetched ingredients", ingredientsWith1gUnit);
        setIngredients(ingredientsWith1gUnit);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (needsRefetch) {
      console.log("Refetching ingredients");
      fetchData();
      setNeedsRefetch(false);
    }
  }, [needsRefetch]);

  return <IngredientsContext.Provider value={{ ingredients, setNeedsRefetch }}>{children}</IngredientsContext.Provider>;
};
