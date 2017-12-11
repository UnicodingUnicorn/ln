# accounts

Accounts API for accessing and modifying user accounts. Depends on ```couchdb``` as its database and ```redis``` as its cache.

The default port for this service is ```10206```.

## Database dependencies

| Name | Description |
| ---- | ----------- |
| users | Database containing user information. |
| permissions | Database containing user permissions. |
| channels | Database containing channel information. |

The service also uses redis databases 0 and 1 for its cache.

## Environment variables

| Name | Description |
| ---- | ----------- |
| ACCOUNTS_PORT | Port at which the service is exposed. Defaults to ```10206``` |
| COUCHDB_USER | Username with which to access couchdb instance |
| COUCHDB_PASSWORD | Password accompanying above username |

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

---

### Get a user (By ID or Name)

```
GET /user
```

Get a user based on ID or name, depending on the parameters supplied.

#### Query Parameters

Both these parameters are mutually exclusive, with id taking precedence.

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | String | User's ID. |
| name | String | User's name. |

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Success |
| user | Object | User object. Returned if ```id``` was specified |
| ids | Array | Array of user objects matching the name. Returned if ```name``` was specified |

#### Error 500

The database has encountered some form of error.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Error message pertaining to the error involved.|

---

### Get the users in a channel.

```
GET /users
```

Get all the users in a channel. Requires the request to be first passed through the ```/verify``` call of the *openid* service.

#### Headers

| Name | Type | Description |
| ---- | ---- | ----------- |
| User | String | User ID passed from the *openid* service. |

#### Query Parameters

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

#### Error 400

The query is missing either the user, from an improper auth attempt, or the channel.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Foo not found, where foo is either 'Channel' or 'User' |

#### Error 404

The gc specified in channel could not be found.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Group-Channel not found |

---

### Get all usernames

```
GET /usernames
```

Get all the usernames of all the users in the database.

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Success |
| usernames | Array | Array of username strings |

---

### Add (user to) channel

```
POST /channel
```

Add a channel or a user to one, depending on the presence of the ```user``` field.

#### Body

The ```user``` field is optional. If not present, a new channel is added. If present, the user specified is added to the channel specified.

| Name | Type | Description |
| ---- | ---- | ----------- |
| group | String | Name of group channel belongs to. Will be created if it didn't exist prior. |
| channel | String | Name of channel to be added/to add a user to. |
| user | String | ID of user to be added, if so desired. (OPTIONAL) |

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Success |

#### Error 400

There is a missing parameter in the body.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Group/Channel not found |

#### Error 403

The permission to perform the action (adding a channel/adding a user) cannot be found.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | No permission |

#### Error 404

The user or the channel the user was to be added to cannot be found. Happens only when ```user``` is specified.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | User/Channel not found |

#### Error 500

The database has encountered some form of error.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Error message pertaining to the error involved. |
