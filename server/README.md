# TogglBoard Server

## Without Docker

### Setup
1. `npm install`
2. Configure your API keys, etc. (see 'Configuration') below
3. `npm start`

### Running
`npm start`

### Configuration
Config variables are set via a `.env` file in this directory, e.g.:
```
echo "TOGGL_API_TOKEN='myapitokengoeshere'" > .env
```

### Testing
Use `npm test` to run the test suite.
Use `npm run watch-test` to continuously run the test suite when developing.

## With Docker

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
