import { render, screen } from "@testing-library/react";
import App from "../App";

test("renders Add Meal button", () => {
  render(<App />);
  const buttonElement = screen.getByText(/Add Meal/i);
  expect(buttonElement).toBeTruthy();
});
