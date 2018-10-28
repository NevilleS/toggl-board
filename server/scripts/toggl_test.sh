APIKEY=$1

curl -v \
  -u $1:api_token \
  -X GET https://www.toggl.com/api/v8/me \
| json_pp
