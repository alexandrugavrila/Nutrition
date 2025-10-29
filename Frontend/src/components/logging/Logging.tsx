import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import apiClient from "@/apiClient";
import { useData } from "@/contexts/DataContext";
import type { CookedBatch } from "@/api-extra-types";
import type { components } from "@/api-types";
import FeedbackSnackbar, {
  SnackbarMessage,
} from "@/components/common/FeedbackSnackbar";
import {
  createIngredientLookup,
  findIngredientInLookup,
  MacroTotals,
  sumMacroTotals,
} from "@/utils/nutrition";
import { formatCellNumber } from "@/utils/utils";

type LoggedEntry = {
  id: number;
  sourceId: number;
  label: string;
  portions: number;
  macros: MacroTotals;
};

type DailyLogEntry = {
  id: number;
  user_id: string;
  log_date: string;
  stored_food_id: number | null;
  ingredient_id: number | null;
  food_id: number | null;
  portions_consumed: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  created_at: string;
};

type DailyLogEntryMap = Record<string, DailyLogEntry[]>;

const formatIsoDate = (value: string): string => {
  try {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString();
  } catch (error) {
    console.error("Unable to format date", error);
    return value;
  }
};

const computePortionMacros = (item: CookedBatch, portions: number): MacroTotals => ({
  calories: item.per_portion_calories * portions,
  protein: item.per_portion_protein * portions,
  fat: item.per_portion_fat * portions,
  carbs: item.per_portion_carbohydrates * portions,
  fiber: item.per_portion_fiber * portions,
});

function Logging() {
  const {
    fridgeInventory,
    foods,
    ingredients,
    setFridgeNeedsRefetch,
    startRequest,
    endRequest,
    hydrating,
  } = useData();

  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [portionsInput, setPortionsInput] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<SnackbarMessage | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [logsByDate, setLogsByDate] = useState<DailyLogEntryMap>({});
  const handleFeedbackClose = useCallback(() => {
    setFeedback(null);
  }, []);

  const toNumber = useCallback((value: unknown, fallback = 0): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }, []);

  const toNullableNumber = useCallback((value: unknown): number | null => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const numeric = toNumber(value);
    return Number.isFinite(numeric) ? numeric : null;
  }, [toNumber]);

  const toStringValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value);
  }, []);

  const normalizeLogEntry = useCallback(
    (entry: Record<string, unknown>): DailyLogEntry => ({
      id: toNumber(entry.id),
      user_id: toStringValue(entry.user_id),
      log_date: toStringValue(entry.log_date),
      stored_food_id: toNullableNumber(entry.stored_food_id),
      ingredient_id: toNullableNumber(entry.ingredient_id),
      food_id: toNullableNumber(entry.food_id),
      portions_consumed: toNumber(entry.portions_consumed),
      calories: toNumber(entry.calories),
      protein: toNumber(entry.protein),
      carbohydrates: toNumber(entry.carbohydrates),
      fat: toNumber(entry.fat),
      fiber: toNumber(entry.fiber),
      created_at: toStringValue(entry.created_at),
    }),
    [toNumber, toNullableNumber, toStringValue],
  );

  const ingredientLookup = useMemo(
    () => createIngredientLookup(ingredients),
    [ingredients],
  );

  const foodLookup = useMemo(() => {
    const map = new Map<string, components["schemas"]["FoodRead"]>();
    foods.forEach((food) => {
      if (food.id !== null && food.id !== undefined) {
        map.set(String(food.id), food);
      }
    });
    return map;
  }, [foods]);

  useEffect(() => {
    setPortionsInput((prev) => {
      const next = { ...prev };
      fridgeInventory.forEach((item) => {
        if (next[item.id] === undefined) {
          next[item.id] = "1";
        }
      });
      return next;
    });
  }, [fridgeInventory]);

  const fetchLogsForDate = useCallback(
    async (targetDate: string): Promise<DailyLogEntry[] | null> => {
      if (!targetDate) {
        return [];
      }

      startRequest();
      try {
        const request = apiClient
          .path(`/api/logs/${targetDate}`)
          .method("get")
          .create();
        const response = await request({});
        const data = Array.isArray(response.data) ? response.data : [];
        return data.map((entry) =>
          normalizeLogEntry(entry as Record<string, unknown>),
        );
      } catch (error) {
        console.error("Failed to fetch daily logs", error);
        setFeedback({
          severity: "error",
          message: "Failed to load logs for the selected date.",
        });
        return null;
      } finally {
        endRequest();
      }
    },
    [startRequest, endRequest, normalizeLogEntry, setFeedback],
  );

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const entries = await fetchLogsForDate(selectedDate);
      if (!isMounted || entries === null) {
        return;
      }
      setLogsByDate((prev) => ({
        ...prev,
        [selectedDate]: entries,
      }));
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [selectedDate, fetchLogsForDate]);

  const groupedInventory = useMemo(() => {
    const foodItems: CookedBatch[] = [];
    const ingredientItems: CookedBatch[] = [];
    const otherItems: CookedBatch[] = [];

    fridgeInventory.forEach((item) => {
      if (item.food_id != null) {
        foodItems.push(item);
      } else if (item.ingredient_id != null) {
        ingredientItems.push(item);
      } else {
        otherItems.push(item);
      }
    });

    return [
      { key: "food", label: "Prepared Foods", items: foodItems },
      { key: "ingredient", label: "Prepared Ingredients", items: ingredientItems },
      { key: "other", label: "Other Items", items: otherItems },
    ].filter((group) => group.items.length > 0);
  }, [fridgeInventory]);

  const resolveDisplayName = useCallback(
    (item: CookedBatch): string => {
      if (item.label) {
        return item.label;
      }
      if (item.food_id != null) {
        const food = foodLookup.get(String(item.food_id));
        if (food?.name) {
          return food.name;
        }
      }
      if (item.ingredient_id != null) {
        const ingredient = findIngredientInLookup(
          ingredientLookup,
          item.ingredient_id,
        );
        if (ingredient?.name) {
          return ingredient.name;
        }
      }
      return `Stored item #${item.id}`;
    },
    [foodLookup, ingredientLookup],
  );

  const resolveLogLabel = useCallback(
    (entry: DailyLogEntry): string => {
      if (entry.stored_food_id != null) {
        const stored = fridgeInventory.find(
          (item) => item.id === entry.stored_food_id,
        );
        if (stored) {
          return resolveDisplayName(stored);
        }
      }
      if (entry.food_id != null) {
        const food = foodLookup.get(String(entry.food_id));
        if (food?.name) {
          return food.name;
        }
      }
      if (entry.ingredient_id != null) {
        const ingredient = findIngredientInLookup(
          ingredientLookup,
          entry.ingredient_id,
        );
        if (ingredient?.name) {
          return ingredient.name;
        }
      }
      if (entry.log_date) {
        return `Entry from ${formatIsoDate(entry.log_date)}`;
      }
      return `Log entry #${entry.id}`;
    },
    [fridgeInventory, resolveDisplayName, foodLookup, ingredientLookup],
  );

  const handleLogItem = useCallback(
    async (item: CookedBatch) => {
      const rawValue = portionsInput[item.id] ?? "1";
      const portions = Number.parseFloat(rawValue);

      if (!Number.isFinite(portions) || portions <= 0) {
        setFeedback({
          severity: "error",
          message: "Enter a positive number of portions to log.",
        });
        return;
      }

      if (portions > item.remaining_portions) {
        setFeedback({
          severity: "error",
          message: "You cannot log more portions than remain in the fridge.",
        });
        return;
      }

      setFeedback(null);
      setPendingId(item.id);
      startRequest();

      try {
        const request = apiClient
          .path(`/api/stored_food/${item.id}/consume`)
          .method("post")
          .create();
        await request({
          body: { portions },
        });

        const displayName = resolveDisplayName(item);
        const macros = computePortionMacros(item, portions);
        const logRequest = apiClient.path("/api/logs/").method("post").create();
        const { data: rawLog } = (await logRequest({
          body: {
            user_id: item.user_id,
            log_date: selectedDate,
            stored_food_id: item.id,
            portions_consumed: portions,
            calories: macros.calories,
            protein: macros.protein,
            carbohydrates: macros.carbs,
            fat: macros.fat,
            fiber: macros.fiber,
          },
        })) as { data: unknown };

        const normalizedLog = normalizeLogEntry(
          (rawLog ?? {}) as Record<string, unknown>,
        );

        setLogsByDate((prev) => {
          const existing = prev[selectedDate] ?? [];
          return {
            ...prev,
            [selectedDate]: [...existing, normalizedLog],
          };
        });

        setPortionsInput((prev) => ({ ...prev, [item.id]: "1" }));
        setFridgeNeedsRefetch(true);
        setFeedback({
          severity: "success",
          message: `Logged ${formatCellNumber(portions)} portion${
            portions === 1 ? "" : "s"
          } of ${displayName}.`,
        });
      } catch (error) {
        console.error("Failed to log consumption", error);
        setFeedback({
          severity: "error",
          message: "Failed to log consumption. Please try again.",
        });
      } finally {
        setPendingId(null);
        endRequest();
      }
    },
    [
      portionsInput,
      startRequest,
      resolveDisplayName,
      selectedDate,
      setFridgeNeedsRefetch,
      endRequest,
      normalizeLogEntry,
    ],
  );

  const displayLogsByDate = useMemo(() => {
    const mapped: Record<string, LoggedEntry[]> = {};
    Object.entries(logsByDate).forEach(([dateKey, entries]) => {
      mapped[dateKey] = entries.map((entry) => {
        const macros: MacroTotals = {
          calories: entry.calories,
          protein: entry.protein,
          fat: entry.fat,
          carbs: entry.carbohydrates,
          fiber: entry.fiber,
        };
        const sourceId =
          entry.stored_food_id ??
          entry.ingredient_id ??
          entry.food_id ??
          entry.id;
        return {
          id: entry.id,
          sourceId,
          label: resolveLogLabel(entry),
          portions: entry.portions_consumed,
          macros,
        } satisfies LoggedEntry;
      });
    });
    return mapped;
  }, [logsByDate, resolveLogLabel]);

  const sortedLogDates = useMemo(() => {
    return Object.keys(displayLogsByDate).sort((a, b) => (a > b ? -1 : 1));
  }, [displayLogsByDate]);

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <Typography variant="h4" component="h1">
        Food Logging
      </Typography>

      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardHeader
            title="Fridge Inventory"
            subheader="Select items to log against your chosen day"
          />
          <CardContent>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Log date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>

            {hydrating ? (
              <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
                <CircularProgress aria-label="Loading fridge inventory" />
              </Stack>
            ) : groupedInventory.length === 0 ? (
              <Typography color="text.secondary">
                Your fridge is empty. Cook or add items to log consumption.
              </Typography>
            ) : (
              <Stack spacing={3}>
                {groupedInventory.map((group) => (
                  <Box key={group.key}>
                    <Typography variant="h6" component="h2" gutterBottom>
                      {group.label}
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell align="right">Remaining portions</TableCell>
                          <TableCell align="right">Log portions</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {group.items.map((item) => {
                          const displayName = resolveDisplayName(item);
                          const isDepleted = item.remaining_portions <= 0;
                          const value = portionsInput[item.id] ?? "1";
                          const preparedDate = item.prepared_at
                            ? new Date(item.prepared_at).toLocaleDateString()
                            : null;
                          return (
                            <TableRow key={item.id} hover>
                              <TableCell>
                                <Stack spacing={0.5}>
                                  <Typography component="span" fontWeight={600}>
                                    {displayName}
                                  </Typography>
                                  {preparedDate && (
                                    <Typography
                                      component="span"
                                      variant="body2"
                                      color="text.secondary"
                                    >
                                      Prepared {preparedDate}
                                    </Typography>
                                  )}
                                  <Typography component="span" variant="body2" color="text.secondary">
                                    Per portion: {formatCellNumber(item.per_portion_calories)} cal,
                                    {" "}
                                    {formatCellNumber(item.per_portion_protein)} g protein,
                                    {" "}
                                    {formatCellNumber(item.per_portion_carbohydrates)} g carbs,
                                    {" "}
                                    {formatCellNumber(item.per_portion_fat)} g fat,
                                    {" "}
                                    {formatCellNumber(item.per_portion_fiber)} g fiber
                                  </Typography>
                                </Stack>
                              </TableCell>
                              <TableCell align="right">
                                {formatCellNumber(item.remaining_portions)}
                              </TableCell>
                              <TableCell align="right">
                                <TextField
                                  type="text"
                                  size="small"
                                  inputProps={{
                                    inputMode: "decimal",
                                    "aria-label": `Portions to log for ${displayName}`,
                                  }}
                                  value={value}
                                  onChange={(event) =>
                                    setPortionsInput((prev) => ({
                                      ...prev,
                                      [item.id]: event.target.value,
                                    }))
                                  }
                                  disabled={isDepleted || pendingId === item.id}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Button
                                  variant="contained"
                                  size="small"
                                  onClick={() => handleLogItem(item)}
                                  disabled={isDepleted || pendingId === item.id}
                                >
                                  {pendingId === item.id ? "Logging..." : "Add to log"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardHeader
            title="Daily Logs"
            subheader="Review the portions you've logged and macro totals"
          />
          <CardContent>
            {sortedLogDates.length === 0 ? (
              <Typography color="text.secondary">
                No items have been logged yet. Log fridge items to see them here.
              </Typography>
            ) : (
              <Stack spacing={3}>
                {sortedLogDates.map((dateKey) => {
                  const entries = displayLogsByDate[dateKey] ?? [];
                  const totals = sumMacroTotals(entries.map((entry) => entry.macros));
                  return (
                    <Box key={dateKey}>
                      <Typography variant="h6" component="h3" gutterBottom>
                        {formatIsoDate(dateKey)}
                        {dateKey === selectedDate ? " (selected)" : ""}
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Item</TableCell>
                            <TableCell align="right">Portions</TableCell>
                            <TableCell align="right">Calories</TableCell>
                            <TableCell align="right">Protein</TableCell>
                            <TableCell align="right">Carbs</TableCell>
                            <TableCell align="right">Fat</TableCell>
                            <TableCell align="right">Fiber</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {entries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell>{entry.label}</TableCell>
                              <TableCell align="right">
                                {formatCellNumber(entry.portions)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCellNumber(entry.macros.calories)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCellNumber(entry.macros.protein)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCellNumber(entry.macros.carbs)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCellNumber(entry.macros.fat)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCellNumber(entry.macros.fiber)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                              Total
                            </TableCell>
                            <TableCell align="right">
                              {formatCellNumber(
                                entries.reduce(
                                  (total, entry) => total + entry.portions,
                                  0,
                                ),
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {formatCellNumber(totals.calories)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCellNumber(totals.protein)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCellNumber(totals.carbs)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCellNumber(totals.fat)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCellNumber(totals.fiber)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Stack>
      <FeedbackSnackbar
        snackbar={feedback}
        onClose={handleFeedbackClose}
      />
    </Stack>
  );
}

export default Logging;
