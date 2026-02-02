# Phase 9.2: Amazon connection API – curl verification

Base URL when running via Docker (Caddy on port 80): `http://localhost`.  
Replace with your API host if different. All endpoints require **owner** role (403 if partner).

## 1. Get a JWT (owner)

```bash
# Login (use an owner account; first registered user is typically owner)
TOKEN=$(curl -s -X POST "http://localhost/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"yourpassword"}' \
  | jq -r '.access_token')
```

## 2. GET /api/amazon/connection

Returns the single connection or `null`.

```bash
curl -s -X GET "http://localhost/api/amazon/connection" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 3. PUT /api/amazon/connection

Upsert connection (optional: status, seller_identifier, marketplaces_json).

```bash
curl -s -X PUT "http://localhost/api/amazon/connection" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"pending","seller_identifier":"SELLER123","marketplaces_json":{"NA":"ATVPDKIKX0DER"}}' | jq
```

## 4. GET /api/amazon/credential

Returns the single credential (safe: id, created_at, updated_at, connection_id, note, has_refresh_token). Never returns token. Returns `null` if no connection or no credential.

```bash
curl -s -X GET "http://localhost/api/amazon/credential" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 5. PUT /api/amazon/credential

Upsert credential for the connection. Token is never returned; response includes `has_refresh_token`.

```bash
curl -s -X PUT "http://localhost/api/amazon/credential" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lwa_refresh_token_encrypted":"encrypted_value_here","note":"Production LWA"}' | jq
```

## 6. POST /api/amazon/connection/check

Placeholder health check: sets connection status from credential token presence.

```bash
curl -s -X POST "http://localhost/api/amazon/connection/check" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected: `{"status":"active"}` if credential has token; `{"status":"error"}` if missing.

## 7. 403 as partner

If the token belongs to a **partner** user, all of the above (except login) return 403:

```bash
# Login as partner, then call Amazon API
curl -s -X GET "http://localhost/api/amazon/connection" \
  -H "Authorization: Bearer $PARTNER_TOKEN"
# Expected: 403 Forbidden
```
