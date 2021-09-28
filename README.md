# Onboarding Server
The onboarding server allows makers to manage their hotspot production and permit hotspot customers to onboard them to the blockchain.

## Development

TODO

## Production

TODO

## Onboarding Server Admin API

TODO

## Onboarding Server Maker API

- Base route: `/api/v2`

### Authentication
With all requests, include an `authorization` header where the value is your public token and private token joined with a colon (`:`). For example:

```
curl --location --request GET 'https://onboarding.example.com/api/v2/hotspots' \
--header 'authorization: pk_INSERT_REST_OF_PUBLIC_TOKEN:sk_INSERT_REST_OF_SECRET_TOKEN'
```

### Other Headers
With all POST and PUT requests that contain a body, include the `Content-Type: application/json` header. For example:

```
curl --location --request POST 'https://onboarding.example.com/api/v2/hotspots' \
--header 'Authorization: auth_tokens_here' \
--header 'Content-Type: application/json' \
--data-raw '{
    "macWlan0": "example mac"
}'
```

### Hotspots
This API allows a Maker to create and manage their Hotspots.

#### Index
Returns all Hotspots that a Maker has created in a paginated fashion. Page number and size can be controlled by optional url params.

##### Route:
`GET /hotspots`

#### Params:
| Param    | Required | Default Value | Description                                    |
|----------|----------|---------------|------------------------------------------------|
| page     | no       | 0             | Page number used to paginate index of Hotspots |
| pageSize | no       | 100           | Number of Hotspots returned per page           |

##### Example Request:
`GET /hotspots?page=5&pageSize=100`

#### Show
Returns an individual Hotspot identified by its ID.

##### Route:
`GET /hotspots/:id`

##### Example Request:
`GET /hotspots/123`

#### Search
Searches for a Hotspot based on any of its attributes.

##### Route:
`GET /hotspots/search`

##### Params:
| Param         | Required | Default Value | Description                                                    |
|---------------|----------|---------------|----------------------------------------------------------------|
| onboardingKey | no       | NULL          | A unique key that is used to identify a Hotspot for onboarding |
| macWlan0      | no       | NULL          | Mac address of the wifi component                              |
| macEth0       | no       | NULL          | Mac address of the ethernet component                          |
| rpiSerial     | no       | NULL          | Serial number of the Raspberry Pi unit                         |
| heliumSerial  | no       | NULL          | Serial of the Helium unit                                      |
| batch         | no       | NULL          | A string used to identify manufacturing batches                |
| publicAddress | no       | NULL          | The b58 public address of the Hotspot that was onboarded       |

##### Example Request
`GET /hotspots/search?macWlan0=examplemac`

#### Create
Creates a new Hotspot entry. Hotspot details should be provided as a json object in the body of the POST request.

##### Route:
`POST /hotspots`

##### Params:

| Param         | Required | Default Value | Description                                                    |
|---------------|----------|---------------|----------------------------------------------------------------|
| onboardingKey | no       | NULL          | A unique key that is used to identify a Hotspot for onboarding |
| macWlan0      | no       | NULL          | Mac address of the wifi component                              |
| macEth0       | no       | NULL          | Mac address of the ethernet component                          |
| rpiSerial     | no       | NULL          | Serial number of the Raspberry Pi unit                         |
| heliumSerial  | no       | NULL          | Serial of the Helium unit                                      |
| batch         | no       | NULL          | A string used to identify manufacturing batches                |

##### Example Request

`POST /hotspots`

request body:
```json
{
  "onboardingKey": "example-onboarding-key",
  "macWlan0": "22:98:17:a3:03:90",
  "macEth0": "e4:0b:59:88:27:5f",
  "rpiSerial": "example-rpi-serial",
  "heliumSerial": "example-helium-serial",
  "batch": "example-batch"
}
```

#### Update
Updates attributes of a Hotspot. **NOTE:** once a Hotspot has been onboarded and the `publicAddress` field set, it becomes immutable and cannot be changed or deleted by the Maker.

##### Route:
`PUT /hotspots`

##### Params:

| Param         | Required | Default Value | Description                                                    |
|---------------|----------|---------------|----------------------------------------------------------------|
| onboardingKey | no       | NULL          | A unique key that is used to identify a Hotspot for onboarding |
| macWlan0      | no       | NULL          | Mac address of the wifi component                              |
| macEth0       | no       | NULL          | Mac address of the ethernet component                          |
| rpiSerial     | no       | NULL          | Serial number of the Raspberry Pi unit                         |
| heliumSerial  | no       | NULL          | Serial of the Helium unit                                      |
| batch         | no       | NULL          | A string used to identify manufacturing batches                |

##### Example Request:
`PUT /hotspots/123`

request body:
```json
{
  "rpiSerial": "updated-rpi-serial",
  "heliumSerial": "updated-helium-serial",
}
```

#### Destroy
Deletes a Hotspot record identified by ID. **NOTE:** once a Hotspot has been onboarded and the `publicAddress` field set, it becomes immutable and cannot be changed or deleted by the Maker.

##### Route:
`DELETE /hotspots/:id`

##### Params:

| Param         | Required | Default Value | Description                                                    |
|---------------|----------|---------------|----------------------------------------------------------------|
| onboardingKey | no       | NULL          | A unique key that is used to identify a Hotspot for onboarding |
| macWlan0      | no       | NULL          | Mac address of the wifi component                              |
| macEth0       | no       | NULL          | Mac address of the ethernet component                          |
| rpiSerial     | no       | NULL          | Serial number of the Raspberry Pi unit                         |
| heliumSerial  | no       | NULL          | Serial of the Helium unit                                      |
| batch         | no       | NULL          | A string used to identify manufacturing batches                |

##### Example Request:
`DELETE /hotspots/123`
