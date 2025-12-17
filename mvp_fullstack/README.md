# Environmental compensation calculator

This small application aims to facilitate/simulate environmental compensation for the Sao Paulo state, more specifically the compensation needed in case of patches or isolated trees supression.

The possible inputs for the application are:
Isolated trees:
- Quantity
- Exotic/Native
- Municipality

Patches:
- Municipality
- Patch size (squared meters)

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
Finally open the index.html file contained into the mvp_fullstack_front folder in your browser.