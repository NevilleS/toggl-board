# TogglBoard Server

This folder contains the source code for the TogglBoard Server that connects the device to the Toggl API.

## Usage: Without Docker

### Setup
1. `npm install`
2. Configure your API keys, etc. (see 'Configuration') below
3. `npm start`

### Running
`npm start`

### Testing
Use `npm test` to run the test suite.
Use `npm run watch-test` to continuously run the test suite when developing.

### Configuration
Config variables are set via a `.env` file in this directory, e.g.:
```
echo "TOGGL_API_TOKEN='myapitokengoeshere'" > .env
```

Use the `DEBUG` variable to see debug logs for the various components, e.g.:
```
DEBUG=app,server,toggl-api,particle-api npm start
```

Importantly, configure the `TOGGL_PROJECT_IDS` to match the 7 Toggl projects you want to track. To get these IDs, run the server and hit the `/toggl/user` endpoint to get the IDs:
```
npm start

# In another terminal...
curl http://localhost:9292/toggl/user | json_pp | grep -e \"id\" -e \"name\"
            "id" : 123456789,
            "name" : "Your Project Name",
            "id" : 234567890,
            "name" : "Another Project Name",
            "id" : 345678901,
            "name" : "A Third Project Name",
```
In this example, we could use `TOGGL_PROJECT_IDS=123456789,234567890,345678901` to track these three projects.

The order of `TOGGL_PROJECT_IDS` corresponds to the order of positions on the device, starting from the bottom and incrementing.

For example, `TOGGL_PROJECT_IDS=1,2,3,4,5,6,7` would map to the device as:
```
(LED array)
[x] : Project ID = 7
[x] : Project ID = 6
[x] : Project ID = 5
[x] : Project ID = 4
[x] : Project ID = 3
[x] : Project ID = 2
[x] : Project ID = 1
[x] : Off
```

## Usage: With Docker

### Setup
`docker build -t <tag> .`
OR
`npm run docker-build`

### List Images
`docker images`

### Running
`docker run -p 9292:8080 <tag>`
OR
`npm run docker-run`
