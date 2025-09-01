import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {},
        outlined: {},
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

