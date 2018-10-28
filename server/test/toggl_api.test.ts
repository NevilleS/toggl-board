import TogglApi from "../src/toggl_api"
declare var fetch: any; // TODO: unsure why this is needed only for tests

describe("TogglApi", () => {
  beforeEach(() => {
    fetch.resetMocks()
  })

  describe("when given valid credentials", () => {
    const settings = {
      apiToken: "abc123",
    }

    describe("test()", () => {
      it("should connect to Toggl API", async () => {
        const mockResponseData = { data: "test" }
        fetch.mockResponse(JSON.stringify(mockResponseData))

        const response = await TogglApi.test(settings)
        expect(fetch.mock.calls.length).toEqual(1)
        expect(fetch.mock.calls[0][0]).toEqual("https://www.toggl.com/api/v8/me")
        expect(fetch.mock.calls[0][1]).toEqual({
          method: "GET",
          headers: {
            "Authorization": "Basic YWJjMTIzOmFwaV90b2tlbg==",
            "Content-Type": "application/json",
          },
        })
        expect(response).toEqual(mockResponseData)
      })
    })

    describe("current()", () => {
      // Some fixture data to use.
      const projectsFixture = [
        { "id": 1, "name": "Project One" },
        { "id": 2, "name": "Project Two" },
        { "id": 3, "name": "Project Three" },
      ]

      const timeEntriesFixture = [
          {
            "id": 10,
            "pid": 1,
            "start": "2018-10-26T13:02:26+00:00",
            "stop": "2018-10-26T14:18:03+00:00",
            "duration": 4537,
            "description": "Example Entry 1",
          },
          {
            "id": 11,
            "pid": 2,
            "start": "2018-10-26T14:18:12+00:00",
            "stop": "2018-10-26T14:40:25+00:00",
            "duration": 1333,
            "description": "Example Entry 2",
          },
          {
            "id": 12,
            "start": "2018-10-26T14:40:39+00:00",
            "stop": "2018-10-26T16:51:43+00:00",
            "duration": 7864,
            "description": "Example Entry 3",
          }
      ]

      describe("when no current time entry", () => {
        it("should return a null time entry", async () => {
          fetch.mockResponse(JSON.stringify({
            "data": {
              "projects": projectsFixture,
              "time_entries": timeEntriesFixture,
            }
          }))

          const response = await TogglApi.current(settings)
          expect(fetch.mock.calls.length).toEqual(1)
          expect(fetch.mock.calls[0][0]).toEqual("https://www.toggl.com/api/v8/me?with_related_data=true")
          expect(response).toEqual({
            data: {
              entry: null,
              project: null,
            }
          })
        })
      })

      describe("when current time entry is running", () => {
        it("should return the current time entry", async () => {
          fetch.mockResponse(JSON.stringify({
            "data": {
              "projects": projectsFixture,
              "time_entries": [
                ...timeEntriesFixture,
                {
                  "id": 13,
                  "pid": 3,
                  "start": "2018-10-28T00:42:23+00:00",
                  "duration": -1540687343,
                  "description": "Example Running Time Entry",
                }

              ]
            }
          }))

          const response = await TogglApi.current(settings)
          expect(fetch.mock.calls.length).toEqual(1)
          expect(fetch.mock.calls[0][0]).toEqual("https://www.toggl.com/api/v8/me?with_related_data=true")
          expect(response).toEqual({
            data: {
              entry: "Example Running Time Entry",
              project: "Project Three",
            }
          })
        })
      })

      describe("when receiving an unexpected response", () => {
        it("should throw an error", async () => {
          fetch.mockResponse(JSON.stringify({
            "data": {
              "projects": projectsFixture,
              "time_entries": "surprise!"
            }
          }))

          await expect(TogglApi.current(settings)).rejects.toThrow("Unexpected Toggl response!")
        })
      })
    })
  })

  describe("when given invalid credentials", () => {
    describe("test()", () => {
      it("should return an error", async () => {
        fetch.mockResponse(null, { status: 403 })

        await expect(TogglApi.test({
          apiToken: "invalidkey",
        })).rejects.toThrow("Connection to Toggl API failed!")
      })
    })
  })
})
