// @ts-check
import React from "react";
import { Dialog, DialogTitle, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import SaveStatusChip from "./SaveStatusChip";
import IngredientEditor from "@/components/data/ingredient/form/IngredientEditor";
import type { components } from "@/api-types";

type IngredientRead = components["schemas"]["IngredientRead"];

interface Props {
  open: boolean;
  ingredient: IngredientRead | null;
  onClose: () => void;
}

function IngredientEditModal({ open, ingredient, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { position: "relative" } }}>
      <SaveStatusChip />
      <DialogTitle sx={{ pr: 6 }}>
        Edit Ingredient
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <IngredientEditor mode="edit" initial={ingredient ?? undefined} onSaved={onClose} onDeleted={onClose} />
      </DialogContent>
    </Dialog>
  );
}

export default IngredientEditModal;

