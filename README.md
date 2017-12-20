# ln
A chat based LMS built on a service-framework. Basically Slack.

## Running

The application as a whole is a collection of Docker containers, put together by docker-compose. As such, they are needed in order to run the thing as-is.

### Build the frontend (web):

```
cd web
npm run build
```

### Run the thing

Prior to running, edit the ```docker-compose.yml``` file to change the environment variables to use-specific values. In particular, for the interest of security, it is advised to update the access credentials for couchdb and minio to something more secure.

```
docker-compose up --build
```

On the other hand, if one is so inclined to run a service individually manually, then what one needs to do is check the ```docker-compose.yml``` file for the appropriate service, whose name will always correspond with the name of the folder the service is in. Check what database the service depends on, and make sure to run those manually too.

## Services

| Name | Description | Default Port |
| ---- | ----------- | ------------ |
| [accounts](./accounts/README.md) | Accounts API for managing and retrieving user accounts. | 10206
| [admin](./admin/README.md) | Admin interface for creating and editing clients, users and channels. | 10201 |
| [chat](./chat/README.md) | Chat socketcluster handling the sending and logging of messages. | 10203 |
| [files](./files/README.md) | Wrapper for minio to handle files on a user-specific basis. | 10207 |
| [messages](./messages/README.md) | API for retrieval of message logs as well as channel information. | 10204 |
| [openid](./openid/README.md) | OpenID Connect service handling login. | 10202 |
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
