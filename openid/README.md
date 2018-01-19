# openid

Standalone OpenID Connect authentication service. Supports implicit and authentication code flows, as per the specification. Relies on ```pg``` as its database and ```redis``` as its cache.

The default port for this service is ```10202```.

## Running Standalone.

Requires ```npm``` and ```node```.

1. Make sure there are running instances of ```postgres``` and ```redis```. Make sure the ```postgres``` instance is populated with the tables described in ["Tables used"](#Tables-used). Run the ```cache``` as specified in its README to populate the ```redis``` cache.
2. Edit the environment variables specified in ["Environment variables"](#Environment-variables) to requirements.
3. Run ```npm install```.
4. Run ```node index.js```.

## Tables used

| Name | Description |
| ---- | ----------- |
| clients | Client information. |
| client_redirect_uris | Redirect URIs possessed by each client. |
| users | User information. |

The service also uses *redis* database 2 for its cache.

## Environment variables

| Name | Description |
| ---- | ----------- |
| OPENID_PORT | Port at which the service is exposed. Defaults to ```10206```. |
| ISS | Host to put as the *iss* field of the OpenID Connect token. |
| PG_HOST | Hostname of the *pg* instance. |
| PG_PORT | Port *pg* instance is exposed on. |
| PG_USER | Username with which to access *pg* instance |
| PG_PASSWORD | Password accompanying above username |
| REDIS_HOST | Hostname of the *redis* instance. |
| REDIS_PORT | Port *redis* instance is on. |
