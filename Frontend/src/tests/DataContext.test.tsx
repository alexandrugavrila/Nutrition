import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { DataProvider, useData } from '../contexts/DataContext';

const ingredientTags = [
  { id: 1, name: 'Whole Food', group: 'Processing' },
  { id: 2, name: 'Vegetable', group: 'Group' },
];
const mealTags = [
  { id: 1, name: 'Breakfast', group: 'Type' },
  { id: 2, name: 'Vegan', group: 'Diet' },
];

function TestComponent() {
  const { ingredientTagsByGroup, mealTagsByGroup } = useData();
  return (
    <>
      <div data-testid="ingredient-groups">{JSON.stringify(ingredientTagsByGroup)}</div>
      <div data-testid="meal-groups">{JSON.stringify(mealTagsByGroup)}</div>
    </>
  );
}

test('groups tags by their group property', async () => {
  const responses = [[], ingredientTags, [], mealTags];
  global.fetch = vi.fn(
    () =>
      Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => responses.shift(),
      }) as unknown as Promise<Response>,
  );

  render(
    <DataProvider>
      <TestComponent />
    </DataProvider>,
  );

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledTimes(4);
    const ingredientGroups = JSON.parse(
      screen.getByTestId('ingredient-groups').textContent || '{}',
    );
    expect(Object.keys(ingredientGroups)).toEqual(['Processing', 'Group']);
    const mealGroups = JSON.parse(screen.getByTestId('meal-groups').textContent || '{}');
    expect(Object.keys(mealGroups)).toEqual(['Type', 'Diet']);
  });
});
