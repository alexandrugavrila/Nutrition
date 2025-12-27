import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";

import type { IngredientSource, UsdaIngredientResult } from "./useIngredientForm";

const normalizeNutritionValue = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const mapUsdaResult = (item: Record<string, unknown>): UsdaIngredientResult | null => {
  const name = String(item.name ?? item.description ?? item.label ?? "").trim();
  if (!name) {
    return null;
  }

  const idValue = item.id ?? item.fdcId ?? item.foodId ?? item.food_id ?? name;
  const nutritionSource = (item.nutrition ?? item.nutrients ?? {}) as Record<string, unknown>;

  return {
    id: String(idValue),
    name,
    nutrition: {
      calories: normalizeNutritionValue(nutritionSource.calories ?? nutritionSource.energy),
      protein: normalizeNutritionValue(nutritionSource.protein),
      carbohydrates: normalizeNutritionValue(nutritionSource.carbohydrates ?? nutritionSource.carbs),
      fat: normalizeNutritionValue(nutritionSource.fat),
      fiber: normalizeNutritionValue(nutritionSource.fiber),
    },
  };
};

const normalizeResults = (data: unknown): UsdaIngredientResult[] => {
  if (Array.isArray(data)) {
    return data
      .map((item) => {
        if (item && typeof item === "object") {
          return mapUsdaResult(item as Record<string, unknown>);
        }
        return null;
      })
      .filter((result): result is UsdaIngredientResult => Boolean(result));
  }

  if (data && typeof data === "object") {
    const possibleResults = (data as { results?: unknown }).results;
    if (possibleResults) {
      return normalizeResults(possibleResults);
    }
  }

  return [];
};

function SourceEdit({ ingredient, dispatch, applyUsdaResult }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UsdaIngredientResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSource: IngredientSource = ingredient.source ?? "manual";
  const disabledSearch = selectedSource !== "usda";

  const hasResults = results.length > 0;

  const statusMessage = useMemo(() => {
    if (isLoading) {
      return "Searching USDA database...";
    }
    if (error) {
      return error;
    }
    if (!query.trim()) {
      return "Enter a name to search the USDA database.";
    }
    if (!hasResults) {
      return "No USDA matches yet. Try a different search.";
    }
    return null;
  }, [error, isLoading, query, hasResults]);

  const handleSourceChange = (event) => {
    const value = event.target.value as IngredientSource;
    dispatch({
      type: "SET_INGREDIENT",
      payload: {
        ...ingredient,
        source: value,
        sourceId: value === "manual" ? null : ingredient.sourceId ?? null,
        sourceName: value === "manual" ? null : ingredient.sourceName ?? null,
      },
    });
  };

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/usda/search?query=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        throw new Error("USDA search failed.");
      }
      const data = await response.json();
      setResults(normalizeResults(data));
    } catch (searchError) {
      setResults([]);
      setError("Unable to load USDA results right now.");
      // eslint-disable-next-line no-console
      console.error(searchError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectResult = (result: UsdaIngredientResult) => {
    applyUsdaResult(result);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel id="ingredient-source-label">Source</InputLabel>
        <Select
          labelId="ingredient-source-label"
          label="Source"
          value={selectedSource}
          onChange={handleSourceChange}>
          <MenuItem value="manual">Manual</MenuItem>
          <MenuItem value="usda">USDA</MenuItem>
        </Select>
      </FormControl>

      {selectedSource === "usda" && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <TextField
              label="Search USDA"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              fullWidth
            />
            <Button variant="outlined" onClick={handleSearch} disabled={disabledSearch || isLoading}>
              Search
            </Button>
          </Box>
          {isLoading && <CircularProgress size={20} />}
          {statusMessage && (
            <Typography variant="body2" color={error ? "error" : "text.secondary"}>
              {statusMessage}
            </Typography>
          )}
          {hasResults && (
            <List dense>
              {results.map((result) => (
                <ListItem key={result.id} disablePadding>
                  <ListItemButton onClick={() => handleSelectResult(result)}>
                    <ListItemText
                      primary={result.name}
                      secondary={`Calories ${result.nutrition.calories} · Protein ${result.nutrition.protein} · Carbs ${result.nutrition.carbohydrates} · Fat ${result.nutrition.fat}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}
    </Box>
  );
}

export default SourceEdit;
