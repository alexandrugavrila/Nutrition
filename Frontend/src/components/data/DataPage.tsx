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
        <Tab label="Foods" disableRipple id="data-tab-0" aria-controls="data-tabpanel-0" />
        <Tab label="Ingredients" disableRipple id="data-tab-1" aria-controls="data-tabpanel-1" />
        <Tab label="Plans" disableRipple id="data-tab-2" aria-controls="data-tabpanel-2" />
      </Tabs>
      <Box sx={{ width: "100%", mt: 2 }}>
        <Box
          role="tabpanel"
          id="data-tabpanel-0"
          aria-labelledby="data-tab-0"
          hidden={dataTab !== 0}
          sx={{ width: "100%", display: dataTab === 0 ? "flex" : "none", justifyContent: "center", alignItems: "flex-start" }}
        >
          <FoodData />
        </Box>
        <Box
          role="tabpanel"
          id="data-tabpanel-1"
          aria-labelledby="data-tab-1"
          hidden={dataTab !== 1}
          sx={{ width: "100%", display: dataTab === 1 ? "flex" : "none", justifyContent: "center", alignItems: "flex-start" }}
        >
          <IngredientData />
        </Box>
        <Box
          role="tabpanel"
          id="data-tabpanel-2"
          aria-labelledby="data-tab-2"
          hidden={dataTab !== 2}
          sx={{ width: "100%", display: dataTab === 2 ? "flex" : "none", justifyContent: "center", alignItems: "flex-start" }}
        >
          <PlanManager />
        </Box>
      </Box>
    </Box>
  );
}

export default DataPage;
