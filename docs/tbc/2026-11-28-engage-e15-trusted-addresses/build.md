# BUILD - E15: trusted addresses

### Trusted addresses
write-path: api_keys.allowed_ips (0393) set when an admin makes a key (POST /api/coach/remote/settings/api-keys {allowedIps}), each entry checked (validEntry); never changed after.
read-path: authenticateApiKey reads allowed_ips and refuses a request whose x-real-ip isn't in it (403, recorded in api_usage); the key list shows "only from …".
