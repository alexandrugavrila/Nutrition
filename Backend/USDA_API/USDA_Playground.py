import requests
import json

test_ID = '2262074'
API_url = "https://api.nal.usda.gov/fdc/v1/food/######?api_key=DEMO_KEY"
USDA_API_Key = 'l6bnSWsBhN0dxwkxinydfdrVKdz8Y0peA9XRxqfc'
request_string = f"https://api.nal.usda.gov/fdc/v1/food/{test_ID}?api_key={USDA_API_Key}"

response = requests.get(request_string)
if response.status_code == 200:
    # Parse the JSON response
    data = response.json()

    # Write the data to a JSON file
    with open("Backend/USDA_API/food_data.json", "w") as json_file:
        json.dump(data, json_file, indent=4)  # Write formatted JSON
    print(f"Data for food ID {test_ID} written to food_data.json")