// @ts-check
// utils.js

/**
 * Format a numeric value to three significant digits.
 * @param {number} number
 * @returns {number}
 */
export const formatCellNumber = (number) => {
  return parseFloat(parseFloat(number).toPrecision(3));
};

/**
 * Minimal fetch wrapper with OpenAPI-generated types.
 * @param {keyof import("../api-types").paths} url The API endpoint.
 * @param {string} method HTTP method.
 * @param {unknown} data Request payload typed against the schema.
 * @returns {Promise<void>}
 */
export const handleFetchRequest = async (url, method, data) => {
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to make request");
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};
