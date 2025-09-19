import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import FoodData from "@/components/data/food/FoodData";
import IngredientData from "@/components/data/ingredient/IngredientData";
import PlanManager from "@/components/data/plan/PlanManager";

function DataPage() {
  const location = useLocation();
  const [dataTab, setDataTab] = useState(() => {
    if (
      location.state &&
      typeof location.state === "object" &&
      (location.state as { tab?: string }).tab === "plans"
    ) {
      return 2;
    }
    return 0;
  });

  useEffect(() => {
    if (
      location.state &&
      typeof location.state === "object" &&
      (location.state as { tab?: string }).tab === "plans"
    ) {
      setDataTab(2);
    }
  }, [location.state]);

  const handleDataTabChange = (event, newValue) => {
    setDataTab(newValue);
  };

  return (
    <Box
      sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <Tabs value={dataTab} onChange={handleDataTabChange} aria-label="data tabs" centered>
        <Tab label="Foods" disableRipple />
        <Tab label="Ingredients" disableRipple />
        <Tab label="Plans" disableRipple />
      </Tabs>
      {dataTab === 0 && <FoodData />}
      {dataTab === 1 && <IngredientData handleAddIngredientToPlan={() => {}} />}
      {dataTab === 2 && <PlanManager />}
    </Box>
  );
}

export default DataPage;
