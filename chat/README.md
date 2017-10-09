# chat

The chat service for ln, based on [socketcluster](https://socketcluster.io). This handles the chatting functionality.

## Options

Options are set through environment variables.

Option | Description
------ | -----------
SOCKETCLUSTER_PORT | Port on which the service opens.
SECRET | Client secret as provided by the *openid* service.
COUCHDB_USER | Username for use with *couchdb*. Needs read and write permissions.
COUCHDB_PASSWORD | Password for use with account specified with *COUCHDB_USER*.

## Database dependencies

Name | Permission | Description
---- | ---------- | -----------
messages | R/W | Holds all the messages sent through the sockets.
perms | R | Holds the permissions or lack thereof held by each user for each channels.
