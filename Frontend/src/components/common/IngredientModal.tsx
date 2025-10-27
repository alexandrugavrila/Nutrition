import React from "react";
import { Dialog, DialogTitle, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import IngredientEditor from "@/components/data/ingredient/form/IngredientEditor";
import type { components } from "@/api-types";

type IngredientRead = components["schemas"]["IngredientRead"];

type IngredientModalProps = {
  open: boolean;
  mode: "add" | "edit";
  ingredient?: IngredientRead | null;
  onClose: () => void;
};

function IngredientModal({ open, mode, ingredient = null, onClose }: IngredientModalProps) {
  const title = mode === "edit" ? "Edit Ingredient" : "Add Ingredient";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { position: "relative" } }}>
      <DialogTitle sx={{ pr: 6 }}>
        {title}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <IngredientEditor mode={mode} initial={ingredient ?? null} onSaved={onClose} onDeleted={onClose} />
      </DialogContent>
    </Dialog>
  );
}

export default IngredientModal;
