# Product Manager: CRUD Training App

A small website (frontend + REST API) for practicing CRUD operations in Postman.

## Project structure

```
client/    Frontend website (HTML/CSS/JS). Runs on port 3000.
  config.js  API URL the website calls (default http://localhost:5050)
  serve.js   Small static file server
server/    Backend REST API (Node + Express). Runs on port 5050.
  server.js
postman/   Postman collection to import
start.js   Starts client and server together
```

## Run it

One-time setup:

```bash
npm run install-all
```

Start both apps with one command:

```bash
npm start
```

Or run them separately in two terminals:

```bash
npm run server     # terminal 1: API on http://localhost:5050
npm run client     # terminal 2: website on http://localhost:3000
```

- Website: http://localhost:3000
- API (use this in Postman): http://localhost:5050/api/products

Data is saved to `server/data/db.json`, so it survives restarts. To restore the sample products, click **Reset sample data** on the website or send `POST /api/reset`.

> **Sharing with interns on the same Wi-Fi:** find your IP (`ipconfig getifaddr en0` on macOS) and have them use `http://<your-ip>:3000` for the website and `http://<your-ip>:5050` in Postman. Also set `window.API_BASE` in `client/config.js` to `http://<your-ip>:5050`. Note that everyone then shares the same data.

## API reference

| Operation | Method | URL | Body | Success |
|---|---|---|---|---|
| List products | GET | `/api/products` | none | 200 |
| Get one | GET | `/api/products/:id` | none | 200 |
| Create | POST | `/api/products` | full product | 201 |
| Replace | PUT | `/api/products/:id` | full product | 200 |
| Partial update | PATCH | `/api/products/:id` | any field(s) | 200 |
| Delete | DELETE | `/api/products/:id` | none | 200 |
| Health | GET | `/api/health` | none | 200 |
| Reset data | POST | `/api/reset` | none | 200 |

**Product fields**

| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `price` | number ≥ 0 | yes |
| `category` | string | yes |
| `inStock` | boolean | no (default `true`) |
| `description` | string | no |

`id`, `createdAt` and `updatedAt` are set by the server.

**Query params for `GET /api/products`:** `search`, `category`, `inStock=true|false`, `sort=id|name|price|category|createdAt`, `order=asc|desc`, `page`, `limit`

Example: `GET /api/products?category=Electronics&sort=price&order=desc`

**Error responses**

- `400` validation failed, malformed JSON, or an invalid id
- `404` product not found or unknown route

## Postman collection

Import `postman/CRUD-Training.postman_collection.json` into Postman (**Import → File**). It contains:

- Requests 0–8, which walk through the full CRUD lifecycle in order. The Create request saves the new id into `{{productId}}`, and later requests reuse it.
- An **Error cases** folder with 400 and 404 examples.
- A test script on every request. Run the whole collection with **Run collection** to see them pass.

The `{{baseUrl}}` variable defaults to `http://localhost:5050`.

## Suggested intern exercises

1. **GET**: List all products, then filter them with query params using the Params tab.
2. **POST**: Create a product with a raw JSON body, and check the `201` status and the `Location` header.
3. **GET by id**: Fetch the product you just created.
4. **PUT vs PATCH**: Send a PUT with only `{"price": 10}` and see the 400. Then send the same body with PATCH. Discuss the difference.
5. **DELETE**: Delete a product, then GET it again and get a 404.
6. **Validation**: Send `"price": "ten"`, an empty name, or broken JSON, and read the error messages.
7. **Variables**: Swap the hard-coded URLs for `{{baseUrl}}` and capture the id with `pm.collectionVariables.set(...)`.
8. **Tests**: Write `pm.test(...)` assertions for status codes and response fields.
9. **Cross-check**: Change data in Postman, then switch back to the browser tab. The website refreshes on focus and shows the change.
