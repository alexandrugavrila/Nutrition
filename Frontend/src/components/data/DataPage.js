import React, { useState } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import MealData from "./meal/MealData";
import IngredientData from "./ingredient/IngredientData";

function DataPage() {
  const [dataTab, setDataTab] = useState(0);
  const handleDataTabChange = (event, newValue) => {
    setDataTab(newValue);
  };

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Tabs value={dataTab} onChange={handleDataTabChange} aria-label="data tabs" centered>
        <Tab label="Meals" />
        <Tab label="Ingredients" />
      </Tabs>
      {dataTab === 0 && <MealData />}
      {dataTab === 1 && <IngredientData handleAddIngredientToPlan={() => {}} />}
    </Box>
  );
}

export default DataPage;

