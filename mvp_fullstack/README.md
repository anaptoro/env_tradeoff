# Environmental trade-off calculator
Environmental Trade-off Calculator 

This project is a small full-stack web app to help estimate environmental tree compensation required under local(Sao Paulo state) regulations.

The frontend is a simple HTML/CSS/JavaScript single page with tabs for each workflow, calling the Flask endpoints via fetch and rendering tables with the detailed results and totals.

The backend is a Flask API (with Swagger/OpenAPI docs) that reads compensation rules from CSV files and a SQLite database. It supports three main operations:

Isolated trees – given quantity, group (native/exotic), municipality and whether the species is endangered, the API returns the tree-level trade-off and the total trade-off per item and per lot.

Forest patches / area (m²) – given municipality and patch area, it looks up the compensation factor (per m²) and computes the total patch trade-off.

Permanent Preservation Area(PPA) – similar to patches, but using a separate rules table for PPA trade-off.

Species conservation status – query a species (family + scientific name) and return its IUCN-style status (EW, CR, EN, VU, etc.).

For both cases the compensation will be automatically calculated based on individual municipalities environmental rules.

---
## How to run

You need to create a virtual env and install the libraries listed on `requirements.txt`

```
(env)$ pip install -r requirements.txt
```
In order to run the API, inside your virtual env:

(env)$cd mvp_fullstack

(env)$ python -m flask --app app run --host 0.0.0.0 --port 5002

```
In sequence, you can use postman or another tool to make requests for the API, examples of possible requests can be found at:
http://127.0.0.1:5002/apidocs/#/

Otherwise, you can open the index.html file contained into the mvp_fullstack_front repository in your browser.

