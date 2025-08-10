import React, { useState } from "react";
// import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

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
  const [tabIndex, setTabIndex] = useState(0);

  const handleAddIngredientToPlan = (ingredient) => {
    setSelectedIngredients([...selectedIngredients, { ...ingredient, quantity: 1 }]);
  };

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
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
        <Tabs value={tabIndex} onChange={handleTabChange} aria-label="data tabs">
          <Tab label="Meals" id="tab-0" aria-controls="tabpanel-0" />
          <Tab label="Ingredients" id="tab-1" aria-controls="tabpanel-1" />
        </Tabs>
        {tabIndex === 0 && (
          <Box role="tabpanel" id="tabpanel-0" aria-labelledby="tab-0">
            <MealData />
          </Box>
        )}
        {tabIndex === 1 && (
          <Box role="tabpanel" id="tabpanel-1" aria-labelledby="tab-1">
            <IngredientData handleAddIngredientToPlan={handleAddIngredientToPlan} />
          </Box>
        )}
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
