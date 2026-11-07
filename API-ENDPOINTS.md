# Products API: Endpoints

**Base URL:** `https://postman-training-zkkv.vercel.app`

## Summary

| # | Method | Endpoint | Body | Success | Errors |
|---|---|---|---|---|---|
| 1 | GET | `/api/products` | none | 200 | none |
| 2 | GET | `/api/products/:id` | none | 200 | 400, 404 |
| 3 | POST | `/api/products` | full product | 201 | 400 |
| 4 | PUT | `/api/products/:id` | full product | 200 | 400, 404 |
| 5 | PATCH | `/api/products/:id` | any field(s) | 200 | 400, 404 |
| 6 | DELETE | `/api/products/:id` | none | 200 | 400, 404 |
| 7 | GET | `/api/health` | none | 200 | none |
| 8 | POST | `/api/reset` | none | 200 | none |

## Full URLs

```
GET     https://postman-training-zkkv.vercel.app/api/products
GET     https://postman-training-zkkv.vercel.app/api/products?category=Electronics&sort=price&order=desc
GET     https://postman-training-zkkv.vercel.app/api/products/1
POST    https://postman-training-zkkv.vercel.app/api/products
PUT     https://postman-training-zkkv.vercel.app/api/products/1
PATCH   https://postman-training-zkkv.vercel.app/api/products/1
DELETE  https://postman-training-zkkv.vercel.app/api/products/1
GET     https://postman-training-zkkv.vercel.app/api/health
POST    https://postman-training-zkkv.vercel.app/api/reset
```

## Endpoint details

### 1. Get all products

```
GET /api/products
```

Optional query params:

| Param | Example | What it does |
|---|---|---|
| `search` | `mouse` | Matches text in the name or description |
| `category` | `Electronics` | Filters by category |
| `inStock` | `true` / `false` | Filters by stock |
| `sort` | `id`, `name`, `price`, `category`, `createdAt` | Sort field |
| `order` | `asc` / `desc` | Sort direction |
| `page` | `1` | Page number |
| `limit` | `10` | Items per page (max 100) |

Example: `GET /api/products?category=Electronics&sort=price&order=desc`

Response `200 OK`:

```json
{
  "total": 5,
  "page": 1,
  "limit": 100,
  "count": 5,
  "data": [
    {
      "id": 1,
      "name": "Wireless Mouse",
      "price": 799,
      "category": "Electronics",
      "inStock": true,
      "description": "Ergonomic 2.4GHz mouse",
      "createdAt": "2026-11-07T13:03:14.512Z",
      "updatedAt": "2026-11-07T13:03:14.512Z"
    }
  ]
}
```

### 2. Get one product

```
GET /api/products/1
```

- `200 OK` returns the product.
- `400 Bad Request` if the id is not a number (for example `/api/products/abc`).
- `404 Not Found` if no product has that id.

### 3. Create a product

```
POST /api/products
Content-Type: application/json
```

Body (Body → raw → JSON):

```json
{
  "name": "USB-C Cable",
  "price": 349,
  "category": "Electronics",
  "inStock": true,
  "description": "1 metre, braided"
}
```

- `201 Created` returns the new product, including its `id`.
- `400 Bad Request` if a required field is missing or has the wrong type.

### 4. Replace a product

```
PUT /api/products/1
Content-Type: application/json
```

PUT replaces the whole product, so `name`, `price` and `category` are required:

```json
{
  "name": "Wireless Mouse Pro",
  "price": 999,
  "category": "Electronics",
  "inStock": true,
  "description": "Silent clicks"
}
```

- `200 OK` returns the updated product.
- `400 Bad Request` if a required field is missing.
- `404 Not Found` if no product has that id.

### 5. Update some fields

```
PATCH /api/products/1
Content-Type: application/json
```

Send only the fields you want to change:

```json
{
  "price": 699
}
```

- `200 OK` returns the product. Fields you didn't send stay the same.
- `400 Bad Request` if a field has the wrong type or the body is empty.
- `404 Not Found` if no product has that id.

### 6. Delete a product

```
DELETE /api/products/1
```

Response `200 OK`:

```json
{
  "message": "Product 1 deleted",
  "deleted": { "id": 1, "name": "Wireless Mouse", "...": "..." }
}
```

- `404 Not Found` if the product doesn't exist or was already deleted.

### 7. Health check

```
GET /api/health
```

Response `200 OK`:

```json
{ "status": "ok", "uptimeSeconds": 103, "totalProducts": 5 }
```

### 8. Reset data

```
POST /api/reset
```

Restores the 5 sample products. Response `200 OK`:

```json
{ "message": "Database reset to sample data", "total": 5 }
```

## Product fields

| Field | Type | Required |
|---|---|---|
| `name` | string | yes |
| `price` | number (0 or more) | yes |
| `category` | string | yes |
| `inStock` | `true` / `false` | no (defaults to `true`) |
| `description` | string | no |

The server sets `id`, `createdAt` and `updatedAt` itself.

## Error responses

Validation error (`400`):

```json
{
  "error": "Validation Failed",
  "details": ["\"price\" is required and must be a number >= 0"]
}
```

Malformed JSON (`400`):

```json
{ "error": "Bad Request", "message": "Malformed JSON in request body" }
```

Not found (`404`):

```json
{ "error": "Not Found", "message": "Product with id 99 not found" }
```

## PUT vs PATCH

| | PUT | PATCH |
|---|---|---|
| What it does | Replaces the whole product | Changes only the fields you send |
| Required fields | `name`, `price`, `category` | At least one field |
| Example body `{"price": 10}` | `400` error | `200` OK |

## Status codes used

| Code | Meaning |
|---|---|
| `200 OK` | Request succeeded |
| `201 Created` | New product created (POST) |
| `400 Bad Request` | Invalid body, bad JSON or invalid id |
| `404 Not Found` | Product or route doesn't exist |

## Postman collection

Import `postman/CRUD-Training.postman_collection.json` (Import → File), then set the collection variable `baseUrl` to `https://postman-training-zkkv.vercel.app`. All of the requests above are included, with test scripts.

> **Note:** data on this server may reset to the 5 sample products at any time. Send `POST /api/reset` to start from a clean set.
