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
export const handleFetchRequest = (url, method, data) => {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => {
        if (response.ok) {
          resolve();
        } else {
          console.error("Failed to make request");
          reject();
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        reject();
      });
  });
};
