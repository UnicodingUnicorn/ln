<a name="top"></a>
# admin v1.0.0

Admin API for modification of users

- [Client](#client)
	- [Post new client](#post-new-client)
	
- [General](#general)
	- [Ping API](#ping-api)
	
- [User](#user)
	- [Post new user](#post-new-user)
	


# Client

## Post new client
[Back to top](#top)

<p>Adds a new client to the database.</p>

	POST /client





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| name | String | <p>Name of the client (for display in login screen)</p>|
| redirect_uri | Array | <p>Array of client-submitted redirect uris</p>|


### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| message | String | <p>Success!</p>|
| client | json | <p>Client object data</p>|

# General

## Ping API
[Back to top](#top)

<p>Simple ping to make sure the service is up and running.</p>

	GET /





### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| message | String | <p>Received at Admin API</p>|

# User

## Post new user
[Back to top](#top)

<p>Adds a new user to the database.</p>

	POST /user





### Parameter Parameters

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| id | String | <p>User's unique id</p>|
| dob | String | <p>User's DOB, formatted in JS Date style</p>|
| name | String | <p>User's name</p>|
| email | String | <p>User's email</p>|
| gender | String | <p>Single character indicating user's gender (m or f)</p>|
| password | String | <p>User's password</p>|


### Success 200

| Name     | Type       | Description                           |
|:---------|:-----------|:--------------------------------------|
| message | String | <p>Success!</p>|
| user | json | <p>Object defining user</p>|

