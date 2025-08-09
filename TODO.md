## Features

## Refactor
Drop the link between ingredient and ingredient unit at the ingredient level, store everything per 1 gram
    Everything else in the display can work by being rendered from the 1 gram value
    The ingredient units table will be used to store how the ingredients can be displayed, or how they are used in a meal

## Bugfixes
Input floats to macro's in add ingredients

The frontend displays a blank screen when test data is loaded into each table in the database. It displays properly if data is only loaded into the nutrition and ingredients tables. 

## Housekeeping