import os

from flask import Flask
from flask_cors import CORS

from pprint import pprint

from db import db
from routes.ingredients import ingredient_blueprint
from routes.meals import meal_blueprint

app = Flask(__name__)

# Prefix all API routes with /api so the frontend can proxy requests
app.register_blueprint(ingredient_blueprint, url_prefix="/api")
app.register_blueprint(meal_blueprint, url_prefix="/api")

CORS(app)
# Configure the database connection string. Historically the application
# looked for `SQLALCHEMY_DATABASE_URI`, but docker-compose provides the
# URL via the more conventional `DATABASE_URL`.  Attempt to read either
# environment variable and fall back to the default connection string
# used by the development stack.
app.config['SQLALCHEMY_DATABASE_URI'] = (
    os.getenv('SQLALCHEMY_DATABASE_URI')
    or os.getenv('DATABASE_URL', 'postgresql://nutrition_user:nutrition_pass@db:5432/nutrition')
)
db.init_app(app)

if os.getenv('DB_AUTO_CREATE', '').lower() in ('1', 'true', 't'):
    with app.app_context():
        db.create_all()

if __name__ == '__main__':
    app.run(debug = True, host='0.0.0.0')
