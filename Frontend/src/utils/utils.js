//utils.js
export const formatCellNumber = (number) => {
  return parseFloat(parseFloat(number).toPrecision(3));
};

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
