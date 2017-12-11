# chat

[Socketcluster](http://socketcluster.io) service handling chat and pm functionality as well as the dissemination of updates. Depends on ```couchdb``` for message logging and reads permissions from the ```redis``` cache.

The default port for this service is ```10203```.

## Database dependencies

| Name | Description |
| ---- | ----------- |
| messages | Database containing message logs. |
| pms | Database containing private messaging logs. |
| permissions | Database from which the permissions cache is built. |

The service also uses redis databases 0 and 1 for its cache.

## Environment variables

| Name | Description |
| ---- | ----------- |
| SOCKETCLUSTER_PORT | Port at which the service is exposed. Defaults to ```10203``` |
| COUCHDB_USER | Username with which to access couchdb instance |
| COUCHDB_PASSWORD | Password accompanying above username |
| SECRET | Client secret with the *openid* service |
