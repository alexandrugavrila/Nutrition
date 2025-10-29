import React from "react";
import { Alert, AlertColor, Snackbar } from "@mui/material";
import type { SnackbarCloseReason } from "@mui/material/Snackbar";

export type SnackbarMessage = {
  message: string;
  severity: AlertColor;
};

interface FeedbackSnackbarProps {
  snackbar: SnackbarMessage | null;
  onClose: () => void;
  autoHideDuration?: number;
}

function FeedbackSnackbar({
  snackbar,
  onClose,
  autoHideDuration = 6000,
}: FeedbackSnackbarProps) {
  const handleClose = (
    _event: React.SyntheticEvent | Event,
    reason?: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    onClose();
  };

  return (
    <Snackbar
      open={Boolean(snackbar)}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        onClose={onClose}
        severity={snackbar?.severity ?? "info"}
        variant="filled"
        sx={{ width: "100%" }}
      >
        {snackbar?.message}
      </Alert>
    </Snackbar>
  );
}

export default FeedbackSnackbar;
