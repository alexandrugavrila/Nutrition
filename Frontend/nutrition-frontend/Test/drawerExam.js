import React, { useState } from "react";
import { makeStyles } from "@mui/styles";
import Drawer from "@mui/material/Drawer";
import Button from "@mui/material/Button";

const drawerWidth = 64; // Width of the mini variant drawer

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
  },
  drawer: {
    width: drawerWidth,
    flexShrink: 0,
  },
  drawerPaper: {
    width: drawerWidth,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing(3),
  },
}));

const MiniVariantDrawer = () => {
  const classes = useStyles();
  const [open, setOpen] = useState(false);

  const toggleDrawer = (isOpen) => () => {
    setOpen(isOpen);
  };

  return (
    <div className={classes.root}>
      {/* Mini variant drawer */}
      <Drawer
        className={classes.drawer}
        variant="permanent"
        classes={{
          paper: classes.drawerPaper,
        }}
      >
        <Button onClick={toggleDrawer(!open)}>Toggle</Button>
        {/* Add your navigation items here */}
      </Drawer>

      {/* Centered content */}
      <main className={classes.content}>
        {/* Your main content goes here */}
        <h1>Centered Content</h1>
        <p>This is where your page content will appear.</p>
      </main>
    </div>
  );
};

export default MiniVariantDrawer;
