import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          // Customize TextField root style here
        },
        outlined: {
          // Customize outlined variant style here
        },
      },
      defaultProps: {
        InputProps: {
          sx: {
            ml: 3,
          },
        },
      },
    },
  },
});

export default theme;
