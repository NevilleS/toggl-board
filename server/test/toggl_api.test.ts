import TogglAPI from "../src/toggl_api"
declare const fetch: any

describe("TogglAPI", () => {
  beforeEach(() => {
    fetch.resetMocks()
  })

  // Some fixture data to use.
  const settings = {
    token: "abc123",
  }

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

  describe("test()", () => {
    it("should connect to Toggl API", async () => {
      fetch.mockResponse(JSON.stringify({ data: "test" }))
      const response = await TogglAPI.test(settings)
      expect(fetch.mock.calls.length).toEqual(1)
      expect(fetch.mock.calls[0][0]).toEqual("https://www.toggl.com/api/v8/me")
      expect(fetch.mock.calls[0][1]).toEqual({
        method: "GET",
        headers: {
          "Authorization": "Basic YWJjMTIzOmFwaV90b2tlbg==",
          "Content-Type": "application/json",
        },
      })
      expect(response).toEqual(true)
    })

    describe("when given invalid credentials", () => {
      it("should return an error", async () => {
        fetch.mockResponse(null, { status: 403 })

        await expect(TogglAPI.test({
          token: "invalidkey",
        })).rejects.toThrow("Connection to Toggl API failed!")
      })
    })
  })

  describe("getCurrentState()", () => {
    describe("when no current time entry", () => {
      it("should return a null time entry", async () => {
        fetch.mockResponse(JSON.stringify({
          "data": {
            "projects": projectsFixture,
            "time_entries": timeEntriesFixture,
          }
        }))

        const response = await TogglAPI.getCurrentState(settings)
        expect(fetch.mock.calls.length).toEqual(1)
        expect(fetch.mock.calls[0][0]).toEqual("https://www.toggl.com/api/v8/me?with_related_data=true")
        expect(response).toEqual({
          entry: null,
          entryId: null,
          project: null,
          projectId: null,
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

        const response = await TogglAPI.getCurrentState(settings)
        expect(fetch.mock.calls.length).toEqual(1)
        expect(fetch.mock.calls[0][0]).toEqual("https://www.toggl.com/api/v8/me?with_related_data=true")
        expect(response).toEqual({
          entry: "Example Running Time Entry",
          entryId: 13,
          project: "Project Three",
          projectId: 3,
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

        await expect(TogglAPI.getCurrentState(settings)).rejects.toThrow("Unexpected Toggl response!")
      })
    })
  })

  describe("setCurrentState()", () => {
    const currentResponseData = {
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
    }

    describe("when it matches the current state", () => {
      it("checks the current state and does nothing", async () => {
        fetch.mockResponse(JSON.stringify(currentResponseData))

        const response = await TogglAPI.setCurrentState({
          entry: "Example Running Time Entry",
          projectId: 3,
        }, settings)

        expect(fetch.mock.calls.length).toEqual(1)
        expect(fetch.mock.calls[0][0]).toEqual("https://www.toggl.com/api/v8/me?with_related_data=true")
        expect(response).toEqual({
          entry: "Example Running Time Entry",
          entryId: 13,
          project: "Project Three",
          projectId: 3,
        })
      })
    }),

    describe("when it does not match the current state", () => {
      it("checks the current state and starts a new entry", async () => {
        fetch.mockResponses(
          [
            JSON.stringify(currentResponseData),
            { status: 200 }
          ],
          [
            JSON.stringify({
              "data": {
                "id": 14,
                "pid": 1,
                "start": "2018-10-29T02:42:18Z",
                "duration": -1540780938,
                "description": "Testing new entry",
              }
            }),
            { status: 200 }
          ],
        )

        const response = await TogglAPI.setCurrentState({
          entry: "Testing new entry",
          projectId: 1,
        }, settings)

        expect(fetch.mock.calls.length).toEqual(2)
        expect(fetch.mock.calls[0][0]).toEqual("https://www.toggl.com/api/v8/me?with_related_data=true")
        expect(fetch.mock.calls[1][0]).toEqual("https://www.toggl.com/api/v8/time_entries/start")
        expect(fetch.mock.calls[1][1]).toMatchObject({
          method: "POST",
          body: expect.objectContaining({
            "time_entry": {
              "description": "Testing new entry",
              "pid": 1,
              "created_with": "TogglBoard",
            }
          })
        })
        expect(response).toEqual({
          entry: "Testing new entry",
          entryId: 14,
          project: "Project One",
          projectId: 1,
        })
      })

      it("stops the current entry when new state is null", async () => {
        fetch.mockResponses(
          [
            JSON.stringify(currentResponseData),
            { status: 200 }
          ],
          [
            JSON.stringify({
              "data": {
                "id": 13,
                "pid": 1,
                "start": "2018-10-29T02:42:18Z",
                "stop": "2018-10-29T02:42:48Z",
                "duration": 30,
                "description": "Example Running Time Entry",
              }
            }),
            { status: 200 }
          ],
        )

        const response = await TogglAPI.setCurrentState({
          entry: null,
          projectId: null,
        }, settings)

        expect(fetch.mock.calls.length).toEqual(2)
        expect(fetch.mock.calls[0][0]).toEqual("https://www.toggl.com/api/v8/me?with_related_data=true")
        expect(fetch.mock.calls[1][0]).toEqual("https://www.toggl.com/api/v8/time_entries/13/stop")
        expect(fetch.mock.calls[1][1]).toMatchObject({ method: "PUT" })
        expect(fetch.mock.calls[1][1]).not.toHaveProperty("body")
        expect(response).toEqual({
          entry: null,
          entryId: null,
          project: null,
          projectId: null,
        })
      })

      it("allows for null projects", async () => {
        fetch.mockResponses(
          [
            JSON.stringify(currentResponseData),
            { status: 200 }
          ],
          [
            JSON.stringify({
              "data": {
                "id": 14,
                "start": "2018-10-29T02:42:18Z",
                "duration": -1540780938,
                "description": "Testing new entry",
              }
            }),
            { status: 200 }
          ],
        )

        const response = await TogglAPI.setCurrentState({
          entry: "Testing new entry",
          projectId: null,
        }, settings)

        expect(fetch.mock.calls.length).toEqual(2)
        expect(fetch.mock.calls[0][0]).toEqual("https://www.toggl.com/api/v8/me?with_related_data=true")
        expect(fetch.mock.calls[1][0]).toEqual("https://www.toggl.com/api/v8/time_entries/start")
        expect(fetch.mock.calls[1][1]).toMatchObject({
          method: "POST",
          body: expect.objectContaining({
            "time_entry": {
              "description": "Testing new entry",
              "created_with": "TogglBoard",
            }
          })
        })
        expect(response).toEqual({
          entry: "Testing new entry",
          entryId: 14,
          project: null,
          projectId: null,
        })
      })
    })
  })
})
