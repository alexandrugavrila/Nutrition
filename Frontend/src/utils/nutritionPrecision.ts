export const roundNutritionValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const formatNutritionValue = (value: number): string => `${roundNutritionValue(value)}`;
