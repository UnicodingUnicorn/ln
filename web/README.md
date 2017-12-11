# web

Web frontend for ln, utilising the [vue](https://vuejs.org) framework and [vue-loader](https://vue-loader.vuejs.org/en/) with browserify.

All the work is done in the ```Home``` component. The modals for adding users and channels are in seperate files for readability.

## Build Setup

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build

# build for production and view the bundle analyzer report
npm run build --report
```

## Options

These options can be found in the file ```options.js``` in ```/src```.

Option | Description
------ | -----------
CLIENT_ID | The client id of this frontend as negotiated with the *openid* service.
HISTORY_COUNT | The number of past messages each call to the *messages* service retrieves.
SELF_URL | The url at which this frontend is located, used for *openid* redirects. Make sure it is entered as a valid redirect_uri with the *openid* service.
OPENID_URL | The url of the *openid* service.
MESSAGES_URL | The url of the *messages* service.
FILES_URL | The url of the *files* service.
SOCKETCLUSTER_HOST | The url, excluding port, of the *chat* service.
SOCKETCLUSTER_PORT | The port of the *chat* service.
