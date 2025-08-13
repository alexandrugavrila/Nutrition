// FlowTabs.js
import React, { useState } from "react";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Grid from "@mui/material/Grid";

import IngredientTable from "../src/IngredientTable";
import MealTable from "../src/MealTable";

function FlowTabs() {
  const [value, setValue] = useState(0);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    <div>
      <Grid container spacing={2} style={{ alignItems: "flex-start" }}>
        <Grid item xs={2} style={{ justifyContent: "flex-start" }}>
          <Tabs
            value={value}
            onChange={handleChange}
            orientation="vertical"
            aria-label="Vertical tabs example"
            sx={{ paddingLeft: 0 }}
            style={{ width: "200px", float: "left" }}
          >
            <Tab label="Data" />
            <Tab label="Planning" />
            <Tab label="Cooking" />
            <Tab label="Shopping" />
          </Tabs>
        </Grid>

        <Grid item xs={10}>
          {value === 0 && (
            <Grid container spacing={2} style={{ alignItems: "flex-start" }}>
              <Grid item xs={6}>
                <IngredientTable />
              </Grid>
              <Grid item xs={6}>
                <MealTable />
              </Grid>
            </Grid>
          )}
          {value === 1 && <div>Planning Tab</div>}
          {value === 2 && <div>Cooking Tab</div>}
          {value === 2 && <div>Shopping Tab</div>}
        </Grid>
      </Grid>
    </div>
  );
}

export default FlowTabs;
