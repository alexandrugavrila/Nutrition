import React, { useState } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import { DataProvider } from "./contexts/DataContext";

import IngredientData from "./components/data/ingredient/IngredientData";
import MealData from "./components/data/meal/MealData";
import Planning from "./components/planning/Planning";
import Shopping from "./components/shopping/Shopping";
import Cooking from "./components/cooking/Cooking";
import Logging from "./components/logging/Logging";

import "./styles/App.css";

function App() {
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [activityTab, setActivityTab] = useState(0);
  const [dataTab, setDataTab] = useState(0);

  const handleAddIngredientToPlan = (ingredient) => {
    setSelectedIngredients([...selectedIngredients, { ...ingredient, quantity: 1 }]);
  };

  const handleActivityTabChange = (event, newValue) => {
    setActivityTab(newValue);
  };

  const handleDataTabChange = (event, newValue) => {
    setDataTab(newValue);
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
        <Box sx={{ display: "flex" }}>
          <Box
            sx={{
              width: 200,
              flexShrink: 0,
              borderRight: 1,
              borderColor: "divider",
              position: "fixed",
              top: 0,
              bottom: 0,
              left: 0,
            }}
          >
            <Tabs
              orientation="vertical"
              value={activityTab}
              onChange={handleActivityTabChange}
              aria-label="activity tabs"
            >
              <Tab label="Data" id="activity-tab-0" aria-controls="activity-panel-0" />
              <Tab label="Planning" id="activity-tab-1" aria-controls="activity-panel-1" />
              <Tab label="Shopping" id="activity-tab-2" aria-controls="activity-panel-2" />
              <Tab label="Cooking" id="activity-tab-3" aria-controls="activity-panel-3" />
              <Tab label="Logging" id="activity-tab-4" aria-controls="activity-panel-4" />
            </Tabs>
          </Box>

          <Box
            sx={{
              marginLeft: "200px",
              flexGrow: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
            <Box sx={{ width: "100%", maxWidth: 800, mx: "auto" }}>
              {activityTab === 0 && (
                <Box
                  role="tabpanel"
                  id="activity-panel-0"
                  aria-labelledby="activity-tab-0"
                  sx={{ p: 3, display: "flex", flexDirection: "column", alignItems: "center" }}
                >
                  <Tabs
                    value={dataTab}
                    onChange={handleDataTabChange}
                    aria-label="data tabs"
                    centered
                  >
                    <Tab label="Meals" id="data-tab-0" aria-controls="data-panel-0" />
                    <Tab label="Ingredients" id="data-tab-1" aria-controls="data-panel-1" />
                  </Tabs>
                  {dataTab === 0 && (
                    <Box
                      role="tabpanel"
                      id="data-panel-0"
                      aria-labelledby="data-tab-0"
                      sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
                    >
                      <MealData />
                    </Box>
                  )}
                  {dataTab === 1 && (
                    <Box
                      role="tabpanel"
                      id="data-panel-1"
                      aria-labelledby="data-tab-1"
                      sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
                    >
                      <IngredientData handleAddIngredientToPlan={handleAddIngredientToPlan} />
                    </Box>
                  )}
                </Box>
              )}

              {activityTab === 1 && (
                <Box
                  role="tabpanel"
                  id="activity-panel-1"
                  aria-labelledby="activity-tab-1"
                  sx={{ p: 3 }}
                >
                  <Planning />
                </Box>
              )}

              {activityTab === 2 && (
                <Box
                  role="tabpanel"
                  id="activity-panel-2"
                  aria-labelledby="activity-tab-2"
                  sx={{ p: 3 }}
                >
                  <Shopping />
                </Box>
              )}

              {activityTab === 3 && (
                <Box
                  role="tabpanel"
                  id="activity-panel-3"
                  aria-labelledby="activity-tab-3"
                  sx={{ p: 3 }}
                >
                  <Cooking />
                </Box>
              )}

              {activityTab === 4 && (
                <Box
                  role="tabpanel"
                  id="activity-panel-4"
                  aria-labelledby="activity-tab-4"
                  sx={{ p: 3 }}
                >
                  <Logging />
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </DataProvider>
    </div>
  );
}

export default App;
