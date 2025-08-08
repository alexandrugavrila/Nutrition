-- Table: ingredients
CREATE TABLE public.ingredients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Table: nutrition
CREATE TABLE public.nutrition (
    id SERIAL PRIMARY KEY,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    calories NUMERIC(10, 4) NOT NULL,
    fat NUMERIC(10, 4) NOT NULL,
    carbohydrates NUMERIC(10, 4) NOT NULL,
    protein NUMERIC(10, 4) NOT NULL,
    fiber NUMERIC(10, 4) NOT NULL
);

-- Table: possible_ingredient_tags
CREATE TABLE public.possible_ingredient_tags (
    id SERIAL PRIMARY KEY,
    tag VARCHAR(50)
);

-- Table: ingredient_tags
CREATE TABLE public.ingredient_tags (
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    tag_id INTEGER NOT NULL REFERENCES possible_ingredient_tags(id),
    PRIMARY KEY (ingredient_id, tag_id)
);

-- Table: ingredient_units
CREATE TABLE public.ingredient_units (
    id SERIAL PRIMARY KEY,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    name VARCHAR(50) NOT NULL,
    grams NUMERIC(10, 4) NOT NULL
);

-- Table: meals
CREATE TABLE public.meals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Table: meal_ingredients
CREATE TABLE public.meal_ingredients (
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    meal_id INTEGER NOT NULL REFERENCES meals(id),
    unit_id INTEGER,
    unit_quantity NUMERIC(10, 4),
    PRIMARY KEY (ingredient_id, meal_id),
    CONSTRAINT fk_unit_id FOREIGN KEY (unit_id) REFERENCES ingredient_units(id)
);

-- Table: possible_meal_tags
CREATE TABLE public.possible_meal_tags (
    id SERIAL PRIMARY KEY,
    tag VARCHAR(50)
);

-- Table: meal_tags
CREATE TABLE public.meal_tags (
    meal_id INTEGER NOT NULL REFERENCES meals(id),
    tag_id INTEGER NOT NULL REFERENCES possible_meal_tags(id),
    PRIMARY KEY (meal_id, tag_id)
);