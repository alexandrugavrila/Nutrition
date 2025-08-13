// MealsContext.js
import React, { createContext, useState, useEffect } from "react";
import { useIngredients } from "./IngredientsContext";

const MealsContext = createContext();

export const useMeals = () => React.useContext(MealsContext);

export const MealsProvider = ({ children }) => {
  const { ingredients } = useIngredients();
  const [meals, setMeals] = useState([]);
  const [needsRefetch, setNeedsRefetch] = useState(false);

  const fetchData = () => {
    fetch("/api/meals")
      .then((response) => response.json())
      .then((data) => {
        const formattedData = data.map((meal) => ({
          ...meal,
        }));
        setMeals(formattedData);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (needsRefetch) {
      fetchData();
      setNeedsRefetch(false);
    }
  }, [ingredients, needsRefetch]);

  return <MealsContext.Provider value={{ meals, setNeedsRefetch }}>{children}</MealsContext.Provider>;
};
