# chat

[Socketcluster](http://socketcluster.io) service handling chat and PM functionality as well as the dissemination of updates. Depends on ```pg``` for message logging and reads permissions from the ```redis``` cache.

The default port for this service is ```10203```.

## Running Standalone.

Requires ```npm``` and ```node```.

1. Make sure there are running instances of ```postgres``` and ```redis```. Make sure the ```postgres``` instance is populated with the tables described in ["Tables used"](#Tables-used). Run the ```cache``` as specified in its README to populate the ```redis``` cache.
2. Edit the environment variables specified in ["Environment variables"](#Environment-variables) to requirements.
3. Run ```npm install```.
4. Run ```npm start```.

## Tables used

| Name | Description |
| ---- | ----------- |
| messages | Message logs. |
| pms | Private messaging logs. |

The service also uses redis databases 0 and 1 for its cache.

## Environment variables

| Name | Description |
| ---- | ----------- |
| SOCKETCLUSTER_PORT | Port at which the service is exposed. Defaults to ```10203``` |
| CLIENT_SECRET | Client secret with the *openid* service |
| PG_HOST | Hostname of the *pg* instance. |
| PG_PORT | Port *pg* instance is exposed on. |
| PG_USER | Username with which to access *pg* instance |
| PG_PASSWORD | Password accompanying above username |
| REDIS_HOST | Hostname of the *redis* instance. |
| REDIS_PORT | Port *redis* instance is on. |
