export const USDA_DATA_TYPES = [
  'Foundation',
  'SR Legacy',
  'Survey (FNDDS)',
  'Branded',
  'Experimental',
] as const;

export type USDADataType = (typeof USDA_DATA_TYPES)[number];
export type UsdaNormalizationDataType = USDADataType | (string & {});

const USDA_DATA_TYPE_LABELS: Record<
  USDADataType,
  {
    filter: string;
    result: string;
  }
> = {
  Foundation: {
    filter: 'Foundation (primary / most current USDA data)',
    result: 'Foundation (primary)',
  },
  'SR Legacy': {
    filter: 'SR Legacy',
    result: 'SR Legacy',
  },
  'Survey (FNDDS)': {
    filter: 'Survey (FNDDS)',
    result: 'Survey (FNDDS)',
  },
  Branded: {
    filter: 'Branded',
    result: 'Branded',
  },
  Experimental: {
    filter: 'Experimental',
    result: 'Experimental',
  },
};

export const USDA_DATA_TYPE_OPTIONS: Array<{ value: USDADataType; label: string }> =
  USDA_DATA_TYPES.map((value) => ({
    value,
    label: USDA_DATA_TYPE_LABELS[value].filter,
  }));

export const DEFAULT_USDA_DATA_TYPES: USDADataType[] = ['Foundation'];

export const getUsdaDataTypeLabel = (
  dataType: string | null | undefined,
  variant: 'filter' | 'result' = 'result',
): string | null => {
  const normalized = dataType?.trim();
  if (!normalized) {
    return null;
  }

  if (normalized in USDA_DATA_TYPE_LABELS) {
    return USDA_DATA_TYPE_LABELS[normalized as USDADataType][variant];
  }

  return normalized;
};
