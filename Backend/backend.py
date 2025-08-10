import os

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
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'SQLALCHEMY_DATABASE_URI',
    'postgresql://nutrition_user:nutrition_pass@nutrition-db:5432/nutrition'
)
db.init_app(app)

if os.getenv('DB_AUTO_CREATE', '').lower() in ('1', 'true', 't'):
    with app.app_context():
        db.create_all()

if __name__ == '__main__':
    app.run(debug = True, host='0.0.0.0')
