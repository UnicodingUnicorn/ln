# messages

Messages API for accessing  messages. Depends on ```couchdb``` as its database and ```redis``` as its cache.

The default port for this service is ```10204```.

## Database dependencies

| Name | Description |
| ---- | ----------- |
| messages | Database containing messages. |
| pms | Database containing private messages. |
| permissions | Database containing user permissions. |
| channels | Database containing channel information. |

The service also uses redis databases 0 and 1 for its cache.

## Environment variables

| Name | Description |
| ---- | ----------- |
| MESSAGES_PORT | Port at which the service is exposed. Defaults to ```10204``` |
| COUCHDB_USER | Username with which to access couchdb instance |
| COUCHDB_PASSWORD | Password accompanying above username |
| CLIENT_ID | Client ID of the token provided by *openid* |
| CLIENT_SECRET | Client Secret of the token provided by *openid* |

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
