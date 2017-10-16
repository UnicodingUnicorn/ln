# accounts

Accounts API for accessing and modifying user accounts. Depends on couchdb as its database.

The default port for this service is ```10206```.

## Database dependencies

| Name | Description |
| ---- | ----------- |
| users | Database containing user information. |
| permissions | Database containing user permissions. |
| channels | Database containing channel information. |

## API

### Ping API

```
GET /
```

Just returns a simple received message. Helpful for finding if the API is up.

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Received at Accounts API|

### Get a user by ID

```
GET /user/:id
```

Get a user based on ID.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | String | User's ID.|

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Success|
| user | Object | User object|

#### Error 500

The database has encountered some form of error.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Error message pertaining to the error involved.|

### Get the users in a channel.

```
GET /users/:channel
```

Get all the users in a channel. Requires the request to be first passed through the ```/verify``` call of the *openid* service.

#### Headers

| Name | Type | Description |
| ---- | ---- | ----------- |
| User | String | User id passed from the *openid* service|

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| channel | String | Channel to query. Pass as stringified json: ```{group : <group>, channel : <channel>}```|


#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Success|
| users | Object | Object containing users in channel: ```{<user_id> : <rest of basic user information>, ...}```|

#### Error 500

The database has encountered some form of error.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Error message pertaining to the error involved.|

#### Error 404

The query is missing either the user, from an improper auth attempt, or the channel.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Foo not found, where foo is either 'Channel' or 'User'|
