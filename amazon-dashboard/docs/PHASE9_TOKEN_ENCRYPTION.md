# LWA refresh token encryption at rest (Fernet)

The LWA refresh token is stored encrypted in `amazon_credential.lwa_refresh_token_encrypted`. The UI sends **plaintext**; the backend encrypts it with Fernet before saving. The API never returns plaintext or ciphertext.

## Environment

Set `TOKEN_ENCRYPTION_KEY` (base64 urlsafe Fernet key). If missing, PUT credential with a token returns 503.

**Generate a key:**
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Add to `.env`:
```
TOKEN_ENCRYPTION_KEY=<paste the generated key>
```

## Curl verification

1. **Set the key** in `.env` and restart the backend.

2. **Create connection and credential** (send plaintext; backend encrypts):
```bash
TOKEN=$(curl -s -X POST "http://localhost/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"yourpassword"}' | jq -r '.access_token')

curl -s -X PUT "http://localhost/api/amazon/connection" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"seller_identifier":"SELLER1"}' | jq

curl -s -X PUT "http://localhost/api/amazon/credential" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lwa_refresh_token_encrypted":"my-plaintext-lwa-token","note":"Prod"}' | jq
```

3. **Response must not contain the token** — only `has_refresh_token: true`, `note`, etc.

4. **Without TOKEN_ENCRYPTION_KEY** (unset or empty), the same PUT credential returns **503** with a message that the key is not set.

## Verify ciphertext in DB (not equal to input)

After saving a credential with plaintext `my-plaintext-lwa-token`, the stored value must be Fernet ciphertext, not the raw input:

```bash
# One-liner: select stored value; it must NOT equal the plaintext you sent
psql "$DATABASE_URL" -t -c "SELECT lwa_refresh_token_encrypted FROM amazon_credential LIMIT 1;"
```

You should see a long base64 string (e.g. `gAAAAA...`), **not** `my-plaintext-lwa-token`. Example check:

```bash
# If you sent "my-plaintext-lwa-token", this should return no rows (stored value is encrypted, not literal)
psql "$DATABASE_URL" -t -c "SELECT id FROM amazon_credential WHERE lwa_refresh_token_encrypted = 'my-plaintext-lwa-token';"
```

Empty result confirms the column does not contain the plaintext.

## Clearing the token

Send empty string or null to clear the stored token:

```bash
curl -s -X PUT "http://localhost/api/amazon/credential" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lwa_refresh_token_encrypted":""}' | jq
```

Then GET credential or connection/check should show `has_refresh_token: false`.
