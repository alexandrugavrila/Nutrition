import React from "react";
import { Chip } from "@mui/material";
import { useData } from "@/contexts/DataContext";

type Props = {
  show?: boolean;
  saving?: boolean;
  savingLabel?: string;
  savedLabel?: string;
};

function SaveStatusChip({ show = true, saving, savingLabel = "Saving…", savedLabel = "All changes saved" }: Props) {
  const { fetching } = useData();
  const isSaving = typeof saving === "boolean" ? saving : fetching;

  if (!show) return null;

  return (
    <Chip
      size="small"
      label={isSaving ? savingLabel : savedLabel}
      color={isSaving ? "warning" : "success"}
      sx={{ position: "absolute", top: 8, right: 8, zIndex: 1300 }}
    />
  );
}

export default SaveStatusChip;
