# ln
A chat based LMS built on a microservice-framework. Basically LMS Slack.

## Running

The application as a whole is a collection of [Docker](https://www.docker.com/) containers, orchestrated using [docker-compose](https://docs.docker.com/compose/). To run individual [services](#services), refer to the respective service's README.

If need be, go through ```docker-compose.yml``` and edit the fairly self-explanatory environment variables to one's specifications. Further documentation is provided in each service's README if documentation is needed.

Default datasets have been provided in ```admin/sample_data```. Upload ```users.csv``` under the users tab in the admin interface and ```channels.csv``` under the channels interface if needed.

### To run:

1. Go to ```./web``` and run ```npm run build```. This builds the frontend page.
2. In root, run ```docker-compose up --build```. It may be necessary to kill and run it again to build the cache properly.

### To run developmentally (frontend):

1. In root, run ```docker-compose up --build```. It may be necessary to kill and run it again to build the cache properly.
2. Go to ```./web``` and run ```npm run dev```.

## Default values

### Client:

| id | name | secret |
| -- | ---- | ------ |
| 406jko1jadsm11w | ln | 5b8ead95c34d7b717826533883705cc6efe9971f2345341b8e570d14ba2fdd38 |

### Client Redirect URIs:

| client_id | uri |
| --------- | --- |
| 406jko1jadsm11w | 'http://localhost:8080/#/' |
| 406jko1jadsm11w | 'http://192.168.99.100:8080/#/' |

### Admins:

| username | password |
| -------- | -------- |
| admin | password |

## Services

Each service is standalone save for its database dependencies.

| Name | Description | Default Port |
| ---- | ----------- | ------------ |
| [accounts](./accounts/README.md) | Accounts API for managing and retrieving user accounts. | 10206
| [admin](./admin/README.md) | Admin interface for creating and editing clients, users and channels. | 10201 |
| [cache](./cache/README.md) | Script to rebuild cache from database tables. | N/A |
| [chat](./chat/README.md) | Chat socketcluster handling the sending and logging of messages. | 10203 |
| [files](./files/README.md) | Wrapper for minio to handle files on a user-specific basis. | 10207 |
| [messages](./messages/README.md) | API for retrieval of message logs as well as channel information. | 10204 |
| [openid](./openid/README.md) | OpenID Connect service handling login. | 10202 |
| [pg](./pg/README.md) | DDL to generate database tables | N/A |
| [web](./web/README/md) | Web frontend. Served with Apache httpd | 10200 |

## Permissions notes

Permission: Can a user do an action
Keys: [action, user]
Permissions have scope (gc)(g)(etc)(user defined)
Lack of permission => No permission -> 403
Permission -> 200 + value

Actions e.g.: 'send_message', 'view_channel'

Permissions can have a value, which is returned
Alternatively, permissions act like another auth layer

Querying a permission:
User is in header after being passed through auth
Action is in url
scope is in url

Permissions service handles the permissions; whether a user is permitted or not, and adding a permission object itself.
What a permission means is to be handled by the individual services.
