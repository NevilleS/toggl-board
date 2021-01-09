APIKEY=$1

curl -v \
  -u $1:api_token \
  -X GET https://www.toggl.com/api/v8/me?with_related_data=true \
| json_pp
