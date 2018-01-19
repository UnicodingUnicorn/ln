# messages

Messages API for accessing messages, private or otherwise, and channel data. Depends on ```couchdb``` as its database and ```redis``` as its cache.

The default port for this service is ```10204```.

## Running Standalone.

Requires ```npm``` and ```node```.

1. Make sure there are running instances of ```postgres``` and ```redis```. Make sure the ```postgres``` instance is populated with the tables described in ["Tables used"](#Tables-used). Run the ```cache``` as specified in its README to populate the ```redis``` cache.
2. Edit the environment variables specified in ["Environment variables"](#Environment-variables) to requirements.
3. Run ```npm install```.
4. Run ```node index.js```.

## Tables used

| Name | Description |
| ---- | ----------- |
| channel_users | Group-Channel per User. |
| messages | Message logs. |
| pms | Private message logs. |
| permissions | User permissions. |

The service also uses redis databases 0 and 1 for its cache.

## Environment variables

| Name | Description |
| ---- | ----------- |
| MESSAGES_PORT | Port at which the service is exposed. Defaults to ```10204``` |
| CLIENT_ID | Client ID of the token provided by *openid* |
| CLIENT_SECRET | Client Secret of the token provided by *openid* |
| PG_HOST | Hostname of the *pg* instance. |
| PG_PORT | Port *pg* instance is exposed on. |
| PG_USER | Username with which to access *pg* instance |
| PG_PASSWORD | Password accompanying above username |
| REDIS_HOST | Hostname of the *redis* instance. |
| REDIS_PORT | Port *redis* instance is on. |

## API

### Ping API

```
GET /
```

Just returns a simple received message. Helpful for finding if the API is up.

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Received at Messages API|

---

### Get channels

```
GET /channels
```

Get the channels a user is in.

#### Headers

| Name | Type | Description |
| ---- | ---- | ----------- |
| Authorization | Bearer | User token from login. |

#### Success 200

An array of channel objects is returned, with the following format:

```
{
  "group" : <group>,
  "channel" : <channel>,
  "users" : [<user>]
}
```

#### Error 403

An improper token was passed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Improper token |

---

### Get messages

```
GET /messages/:group/:channel
```

Get the messages from a channel.

#### Headers

| Name | Type | Description |
| ---- | ---- | ----------- |
| Authorization | Bearer | User token from login. |

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| group | String | Name of group |
| channel | String | Name of channel |

#### Query Parameters

These parameters specify constraints regarding the number of messages retrieved. Both are optional.

| Name | Type | Description |
| ---- | ---- | ----------- |
| count | Number | Number of messages to retrieve. |
| offset | Number | Offset from the latest message at which to start retrieving. |

#### Success 200

An array of message objects is returned, with the following format:

```
{
  "user" : <user id>,
  "datetime" : <Unix epoch time>,
  "message" : String,
  "type" : <m | f>
}
```

#### Error 403

An improper token was passed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Improper token |

#### Error 404

The channel specified could be found.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | No channel found |

#### Error 403

The user has no permission to view the messages there.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | No permission |

---

### Get PMs

```
GET /pms
```

Get the PMs a user is in.

#### Headers

| Name | Type | Description |
| ---- | ---- | ----------- |
| Authorization | Bearer | User token from login. |

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Success |
| pms | Array | Array of user IDs the user has PMs with |

#### Error 403

An improper token was passed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Improper token |

---

### Get PM messages

```
GET /pms/:user
```

Get the PMs with a user.

#### Headers

| Name | Type | Description |
| ---- | ---- | ----------- |
| Authorization | Bearer | User token from login. |

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | String | The ID of the user whose PMs with which one is retrieving. |

#### Query Parameters

These parameters specify constraints regarding the number of messages retrieved. Both are optional.

| Name | Type | Description |
| ---- | ---- | ----------- |
| count | Number | Number of messages to retrieve. |
| offset | Number | Offset from the latest message at which to start retrieving. |

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Success |
| messages | Array | Array of message objects, matches that returned by the other messages call |

#### Error 403

An improper token was passed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Improper token |
