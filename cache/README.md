# cache

Script to build up the ```redis``` cache from ```postgres``` tables. Needless to say, relies on ```redis``` and ```postgres```.

## Running Standalone.

Requires ```npm``` and ```node```.

1. Make sure there are running instances of ```postgres``` and ```redis```. Make sure the ```postgres``` instance is populated with the tables described in ["Tables used"](#Tables-used).
2. Edit the environment variables specified in ["Environment variables"](#Environment-variables) to requirements.
3. Run ```npm install```.
4. Run ```node index.js```.

## Tables used

| Name | Description |
| ---- | ----------- |
| channels | Channel information. |
| channel_users | Group-Channel each User belongs to. |
| clients | Client information. |
| permissions | User permissions. |
| users | User information. |

The service also uses *redis* databases 0, 1 and 2 for its cache.

## Environment variables

| Name | Description |
| ---- | ----------- |
| PG_HOST | Hostname of the *pg* instance. |
| PG_PORT | Port *pg* instance is exposed on. |
| PG_USER | Username with which to access *pg* instance |
| PG_PASSWORD | Password accompanying above username |
| REDIS_HOST | Hostname of the *redis* instance. |
| REDIS_PORT | Port *redis* instance is on. |
