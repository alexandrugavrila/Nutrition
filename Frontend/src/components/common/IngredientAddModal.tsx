// @ts-check
import React from "react";
import { Dialog, DialogTitle, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import SaveStatusChip from "./SaveStatusChip";
import IngredientEditor from "@/components/data/ingredient/form/IngredientEditor";

interface Props {
  open: boolean;
  onClose: () => void;
}

function IngredientAddModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { position: "relative" } }}>
      <SaveStatusChip />
      <DialogTitle sx={{ pr: 6 }}>
        Add Ingredient
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <IngredientEditor mode="add" onSaved={onClose} />
      </DialogContent>
    </Dialog>
  );
}

export default IngredientAddModal;

