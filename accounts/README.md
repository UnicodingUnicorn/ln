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

Get all the users in a channel.

#### Headers

| Name | Type | Description |
| ---- | ---- | ----------- |
| Authorization | Bearer | User token from login. |

#### Query Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| group | String | Group to query. |
| channel | String | Channel to query. |

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Success|
| users | Object | Object containing users in channel: ```{<user_id> : <rest of basic user information>, ...}```|

#### Error 400

The query is missing the channel parameters.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Channel not found |

#### Error 403

An improper token was passed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Improper token |

#### Error 404

The channel specified by group and channel could not be found.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Group-Channel not found |

#### Error 500

The database has encountered some form of error.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Error message pertaining to the error involved.|

---

### Update a user's information

```
POST /user
```

Update certain mutable aspects of a user's profile (username and avatar).

#### Headers

| Name | Type | Description |
| ---- | ---- | ----------- |
| Authorization | Bearer | User token from login. |

#### Body

All fields are optional, if not present, the associated value is simply not updated.

| Name | Type | Description |
| ---- | ---- | ----------- |
| username | String | Username of the user. |
| avatar | String | URL to location of avatar picture. |

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Success |

#### Error 403

An improper token was passed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Improper token |

#### Error 404

The user specified in the header cannot be found.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | User not found |

#### Error 500

The database has encountered some form of error.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Error message pertaining to the error involved. |

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

#### Headers

| Name | Type | Description |
| ---- | ---- | ----------- |
| Authorization | Bearer | User token from login. |

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

The permission to perform the action (adding a channel/adding a user) cannot be found. Alternatively, an improper token was passed in the auth header.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | No permission/Improper token |

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
