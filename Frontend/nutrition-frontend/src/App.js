import React, { useState } from "react";
// import Grid from "@mui/material/Grid";

import { DataProvider } from "./contexts/DataContext";

import IngredientData from "./components/data/ingredient/IngredientData";
import MealData from "./components/data/meal/MealData";
// import MealTable from "./MealTable";
// import PlanningTable from "./PlanningTable";
// import MacrosTable from "./MacrosTable";

// import MealForm from "./MealForm";

import "./styles/App.css";

function App() {
  const [selectedIngredients, setSelectedIngredients] = useState([]);

  const handleAddIngredientToPlan = (ingredient) => {
    setSelectedIngredients([...selectedIngredients, { ...ingredient, quantity: 1 }]);
  };

  // const handleRemoveIngredientFromPlan = (ingredientToRemove) => {
  //   const updatedIngredients = selectedIngredients.filter((ingredient) => ingredient !== ingredientToRemove);
  //   setSelectedIngredients(updatedIngredients);
  // };

  // const handleAddMeal = (newMeal) => {
  //   console.log(newMeal);
  // };

  return (
    <div className="App">
      <DataProvider>
        <MealData />
        <IngredientData handleAddIngredientToPlan={handleAddIngredientToPlan} />
      </DataProvider>

      {/* <MacrosTable ingredients={selectedIngredients} />
      <PlanningTable ingredients={selectedIngredients} onIngredientRemove={handleRemoveIngredientFromPlan} /> */}

      {/* Add to Table Grid */}
      {/* <Grid container spacing={2} style={{ alignItems: "flex-start" }}>
        <Grid item xs={6}> */}
      {/* </Grid>
        <Grid item xs={6}>
          <MealForm onAddMeal={handleAddMeal} />
        </Grid> */}
      {/* </Grid> */}

      {/* Table Grid */}
      {/* <Grid container spacing={2} style={{ alignItems: "flex-start" }}>
        <Grid item xs={6}> */}
      {/* </Grid>
        <Grid item xs={6}>
          <MealTable />
        </Grid>
      </Grid> */}
    </div>
  );
}

export default App;
