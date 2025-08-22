"""Generate OpenAPI specification for the Nutrition API."""
import json
from backend import spec

if __name__ == "__main__":
    with open("Backend/openapi.json", "w") as f:
        json.dump(spec.to_dict(), f, indent=2)
