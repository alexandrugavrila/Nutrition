import React, { useMemo } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { useData } from "@/contexts/DataContext";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";
import type { PlanItem } from "@/utils/planningTypes";
import { aggregateShoppingList } from "@/utils/shopping";
import type { ShoppingListItem } from "@/utils/shopping";
import { formatCellNumber } from "@/utils/utils";

type ActivePlanState = {
  id: number | null;
  label: string | null;
  updatedAt: string | null;
};

const formatUnitLabel = (
  units: ShoppingListItem["unitTotals"],
  divisor = 1,
): string => {
  if (!units || units.length === 0) {
    return "-";
  }
  const safeDivisor = divisor > 0 ? divisor : 1;
  const labels = units
    .map((unit) => {
      const quantity = unit.quantity / safeDivisor;
      if (quantity <= 0) return null;
      const formatted = formatCellNumber(quantity);
      const name = unit.unitName || "units";
      return `${formatted} ${name}`;
    })
    .filter(Boolean) as string[];

  if (labels.length === 0) {
    return "-";
  }

  return labels.join(" + ");
};

function Shopping() {
  const { foods, ingredients, fetching } = useData();
  const [plan] = useSessionStorageState<PlanItem[]>("planning-plan", () => []);
  const [days] = useSessionStorageState<number>("planning-days", 1);
  const [activePlan] = useSessionStorageState<ActivePlanState>(
    "planning-active-plan",
    () => ({ id: null, label: null, updatedAt: null }),
  );

  const { items, issues } = useMemo(
    () => aggregateShoppingList({ plan, foods, ingredients }),
    [plan, foods, ingredients],
  );

  const planIsEmpty = !plan || plan.length === 0;
  const totalWeight = useMemo(
    () => items.reduce((sum, item) => sum + item.totalGrams, 0),
    [items],
  );
  const normalizedDays = Number.isFinite(days) && days > 0 ? days : 1;
  const perDayWeight = totalWeight / normalizedDays;
  const planLabel = activePlan.label?.trim()
    ? `Based on plan "${activePlan.label}"`
    : "Based on current plan";

  let content: React.ReactNode;
  if (fetching) {
    content = (
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 3 }}>
        <CircularProgress />
        <Typography>Loading data needed for your shopping list…</Typography>
      </Box>
    );
  } else if (planIsEmpty) {
    content = (
      <Alert severity="info" sx={{ mt: 3 }}>
        Build a plan in the Planning tab to see the combined shopping list here.
      </Alert>
    );
  } else if (items.length === 0) {
    content = (
      <Alert severity="warning" sx={{ mt: 3 }}>
        We could not build a shopping list because some ingredients or foods are
        missing required data.
        {issues.length > 0 && (
          <Box component="ul" sx={{ mt: 1, pl: 3 }}>
            {issues.map((issue, index) => (
              <li key={`${issue.type}-${index}`}>{issue.message}</li>
            ))}
          </Box>
        )}
      </Alert>
    );
  } else {
    content = (
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
          {items.length} unique ingredients • {normalizedDays} day
          {normalizedDays !== 1 ? "s" : ""} • {formatCellNumber(totalWeight)} g total
          {normalizedDays > 1
            ? ` (${formatCellNumber(perDayWeight)} g per day)`
            : ""}
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ingredient</TableCell>
                <TableCell>Quantity Needed</TableCell>
                <TableCell align="right">Weight (g)</TableCell>
                {normalizedDays > 1 && (
                  <TableCell align="right">Per Day (g)</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.ingredientId ?? item.name}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    <Typography>{formatUnitLabel(item.unitTotals)}</Typography>
                    {normalizedDays > 1 && (
                      <Typography variant="body2" color="text.secondary">
                        {formatUnitLabel(item.unitTotals, normalizedDays)} per day
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {formatCellNumber(item.totalGrams)}
                  </TableCell>
                  {normalizedDays > 1 && (
                    <TableCell align="right">
                      {formatCellNumber(item.totalGrams / normalizedDays)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1">
        Shopping List
      </Typography>
      <Typography variant="subtitle1" sx={{ mt: 1 }}>
        {planLabel}
        {normalizedDays > 1 ? ` • ${normalizedDays} days` : ""}
      </Typography>
      {content}
      {!fetching && !planIsEmpty && items.length > 0 && issues.length > 0 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          Some items could not be combined:
          <Box component="ul" sx={{ mt: 1, pl: 3, mb: 0 }}>
            {issues.map((issue, index) => (
              <li key={`${issue.type}-${index}`}>{issue.message}</li>
            ))}
          </Box>
        </Alert>
      )}
    </Box>
  );
}

export default Shopping;
