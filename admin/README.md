# admin

Admin interface (combined frontend/backend) for the creation and editing of clients, users and channels. Depends on ```pg``` for its database and ```redis``` as a cache. The folder ```./sample_data``` contains sample data to be used with the file upload system. Upload them under the appropriate tabs.

The default port for this service is ```10201```.

## Running Standalone.

Requires ```npm``` and ```node```.

1. Make sure there are running instances of ```postgres``` and ```redis```. Make sure the ```postgres``` instance is populated with the tables described in ["Tables used"](#Tables-used). Run the ```cache``` as specified in its README to populate the ```redis``` cache.
2. Edit the environment variables specified in ["Environment variables"](#Environment-variables) to requirements.
3. Run ```npm install```.
4. Run ```node index.js```.

## Tables used

| Name | Description |
| ---- | ----------- |
| admin | Admin credentials (username/password). Default starting entry "admin"/"password". |
| channels | Channel information. |
| channel_users | Group-Channel each User belongs to. |
| clients | Client information. |
| client_redirect_uris | Redirect URIs possessed by each client. |
| permissions | User permissions. |
| users | User information. |

The service also uses *redis* databases 0 and 1 for its cache.

## Environment variables

| Name | Description |
| ---- | ----------- |
| ADMIN_PORT | Port at which the service is exposed. Defaults to ```10201```. |
| PG_HOST | Hostname of the *pg* instance. |
| PG_PORT | Port *pg* instance is exposed on. |
| PG_USER | Username with which to access *pg* instance |
| PG_PASSWORD | Password accompanying above username |
| REDIS_HOST | Hostname of the *redis* instance. |
| REDIS_PORT | Port *redis* instance is on. |
