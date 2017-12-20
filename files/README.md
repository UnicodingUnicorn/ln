# files

Files API for handling user file uploads and storing them. Depends on ```minio``` for its filestore.

The default port for this service is ```10207```.

## Environment variables

| Name | Description |
| ---- | ----------- |
| FILES_PORT | Port at which the service is exposed. Defaults to ```10207``` |
| MAX_SIZE | Maximum size accepted for file uploads, in bytes. Do note that the file is buffered in the server's memory before it is properly stored. |
| MINIO_ACCESS_KEY | Access key for the minio instance |
| MINIO_SECRET_KEY | Secret for the minio instance |
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
| message | String | Received at Files API|

---

### Upload file

```
POST /file
```

Stores a file for a user.

#### Headers

| Name | Type | Description |
| ---- | ---- | ----------- |
| Authorization | Bearer | User token from login. |

#### Body

| Name | Type | Description |
| ---- | ---- | ----------- |
| file | Blob | File to be stored. |

#### Success 200

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Success |
| filename | String | Name of file as stored |
| originalname | String | Original name of the file |

#### Error 400

There is a missing parameter, and since there's only one in the entire body...

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | File not found |

#### Error 403

An improper token was passed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Improper token |

#### Error 500

An error occured with minio.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Error storing file |

---

### Get file

```
GET /:user/:filename
```

Get a file.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | String | User ID of user who posted the file. |
| filename | String | Filename of the file as returned from uploading. |

### Success 200

The file itself will be returned with no extra bells or whistles.

#### Error 404

The file specified by the given parameters does not exist.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | No such file |

#### Error 500

Minio encountered an error.

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | String | Error retrieving file |
