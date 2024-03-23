from flask import Flask
from flask_cors import CORS

from pprint import pprint

from db import db
from routes.ingredients import ingredient_blueprint
from routes.meals import meal_blueprint

app = Flask(__name__)

app.register_blueprint(ingredient_blueprint)
app.register_blueprint(meal_blueprint)

CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:Yn*5r-UA5qB0wRQHcsw8@localhost:5432/postgres'
db.init_app(app)

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug = True)
