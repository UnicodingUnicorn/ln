# pg

DDL for the postgres database. Dockerfile is a simple extension of the official docker image, copying in ddl to the entrypoint.

## Tables

Keys are **bolded**.

### clients

Holds the client information for the ```openid service```.

| Column | Type | Description | Required |
| ------ | ---- | ----------- | -------- |
| **id** | Text | Client ID. | &#2713; |
| name | Text | User-friendly name of the client to display in sign-in page. | &#2713; |
| secret | Text | Client Secret. | &#2713; |

| Default entry | id | name | secret |
| ------------- | -- | ---- | ------ |
| 0 | 406jko1jadsm11w | ln | 5b8ead95c34d7b717826533883705cc6efe9971f2345341b8e570d14ba2fdd38 |

### client_redirect_uris

Holds the redirect URIs for each client. Can have multiple entries per client.

| Column | Type | Description | Required |
| ------ | ---- | ----------- | -------- |
| **id** | Serial | Auto-incrementing ID to differentiate entries. Not advised to set this directly. | &#2713; |
| **client_id** | Text | ID of the client URI is for. | &#2713; |
| uri | Text | Client redirect URI. | &#2713; |

| Default entry | client_id | redirect_uri |
| ------------- | --------- | ------------ |
| 0 | 406jko1jadsm11w | 'http://localhost:8080/#/' |
| 1 | 406jko1jadsm11w | 'http://192.168.99.100:8080/#/' |

### users

Holds user information.

| Column | Type | Description | Required |
| ------ | ---- | ----------- | -------- |
| **id** | Text | User ID | &#2713; |
| name | Text | User's name | &#2713; |
| username | Text | User's username. Normally is displayed in chat over *name*. | &#2713; |
| email | Text | User's email. Used for login. | &#2713; |
| password | Text | User's password, hashed. | &#2713; |
| gender | Char | User's gender, 'm' or 'f'. | &#2713; |
| dob | Timestamptz | User's Date of Birth. | &#2713; |
| avatar | Text | URL to fileserver with user's avatar. | &#2717; |

## channels

Holds channel information.

| Column | Type | Description | Required |
| ------ | ---- | ----------- | -------- |
| **group** | Text | Channel's group. Multiple channels can have the same group. | &#2713; |
| **channel** | Text | Channel's name. Multiple channels can have the same name, as long as they are of different groups. | &#2713; |

## channel_users

Holds the references to the channels a user is in.

| Column | Type | Description | Required |
| ------ | ---- | ----------- | -------- |
| **group** | Text | Channel's group. | &#2713; |
| **channel** | Text | Channel's name. | &#2713; |
| **user** | Text | User's ID | &#2713; |

## permissions

Holds the permissions for the permissions system.

| Column | Type | Description | Required |
| ------ | ---- | ----------- | -------- |
| **user** | Text | User allowed to perform action. | &#2713; |
| **scope** | Text | Scope within which user is allowed to perform action. | &#2713; |
| **action** | Text | Action user is allowed to perform. | &#2713; |

## admins

Admin credentials for the admin interface.

| Column | Type | Description | Required |
| ------ | ---- | ----------- | -------- |
| **username** | Text | Admin username. | &#2713; |
| password | Text | Admin password. | &#2713; |

| Default entry | username | password |
| ------------- | --------- | ------------ |
| 0 | admin | password |

## messages

Holds message logs.

| Column | Type | Description | Required |
| ------ | ---- | ----------- | -------- |
| **id** | Text | Message ID. Implemented as <Epoch timestamp>+<User ID>. | &#2713; |
| datetime | Timestamptz | Timestamp of message. | &#2713; |
| user | Text | User ID of message's sender. | &#2713; |
| group | Text | Group of message's channel. | &#2713; |
| channel | Text | Name of message's channel. | &#2713; |
| message | Text | Message content | &#2713; |
| type | Char | Message's type. 'm'essage or 'f'ile. | &#2713; |

## pms

Holds private messaging logs.

| Column | Type | Description | Required |
| ------ | ---- | ----------- | -------- |
| **id** | Text | Message ID. Implemented as <Epoch timestamp>+<Users>. | &#2713; |
| datetime | Timestamptz | Timestamp of message. | &#2713; |
| user | Text | User ID of message's sender. | &#2713; |
| recipient | Text | User ID of message's recipient. | &#2713; |
| users | Text | Ordered string of the two user's string concatenated with a '+'. | &#2713; |
| message | Text | Message content | &#2713; |
| type | Char | Message's type. 'm'essage or 'f'ile. | &#2713; |
