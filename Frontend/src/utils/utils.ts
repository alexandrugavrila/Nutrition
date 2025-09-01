/**
 * Format a numeric value to three significant digits.
 */
export const formatCellNumber = (value: number): number => {
  return parseFloat(parseFloat(String(value)).toPrecision(3));
};

const API_BASE_URL: string = (import.meta as any).env?.VITE_API_BASE_URL || '';

/**
 * Minimal fetch wrapper.
 */
export const handleFetchRequest = async (
  url: string,
  method: string,
  data: unknown,
): Promise<void> => {
  const endpoint = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to make request');
  }
};

