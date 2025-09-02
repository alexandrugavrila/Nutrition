import React, { useState } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import FoodData from "@/components/data/food/FoodData";
import IngredientData from "@/components/data/ingredient/IngredientData";

function DataPage() {
  const [dataTab, setDataTab] = useState(0);
  const handleDataTabChange = (event, newValue) => {
    setDataTab(newValue);
  };

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Tabs value={dataTab} onChange={handleDataTabChange} aria-label="data tabs" centered>
        <Tab label="Foods" disableRipple />
        <Tab label="Ingredients" disableRipple />
      </Tabs>
      {dataTab === 0 && <FoodData />}
      {dataTab === 1 && <IngredientData handleAddIngredientToPlan={() => {}} />}
    </Box>
  );
}

export default DataPage;

