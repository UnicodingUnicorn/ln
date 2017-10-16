# ln
A chat based LMS built on a service-framework. Basically Slack.

## Running

The application as a whole is a collection of Docker containers, put together by docker-compose. As such, they are needed in order to run the thing as-is.

Build the frontend
```
cd web
npm run build
```

Run the thing
```
docker-compose up --build
```

On the other hand, if one is so inclined to run a service individually manually, then what one needs to do is check the ```docker-compose.yml``` file for the appropriate service, whose name will always correspond with the name of the folder the service is in. Check what database the service depends on, and make sure to run those manually too,

## Services
