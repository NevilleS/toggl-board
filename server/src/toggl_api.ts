import "isomorphic-fetch"
import { isEqual } from "lodash"
declare const fetch: any // NOTE: this offends my sensibilities

interface TogglApiSettings {
  apiToken: string
}

interface TogglApiState {
  entry: string | null
  project: string | null
  projectId: number | null
}

interface TogglApiCurrentUser {
  projects: TogglApiProject[]
  time_entries: TogglApiTimeEntry[]
}

interface TogglApiProject {
  id: number
  name: string
}

interface TogglApiTimeEntry {
  id: number
  pid?: number
  start?: string
  stop?: string
  duration: number
  description: string
}

const TogglApi = {
  test: async function(settings: TogglApiSettings): Promise<Object> {
    const response = await TogglApi.fetch("https://www.toggl.com/api/v8/me", settings)
    return response
  },

  current: async function(settings: TogglApiSettings): Promise<TogglApiState> {
    // Get the current user data from Toggl
    const response = await TogglApi.fetch(
      "https://www.toggl.com/api/v8/me?with_related_data=true",
      settings
    ) as { data: TogglApiCurrentUser }

    // Ensure it has all the data we expect...
    if (!response.data || !response.data.projects || !response.data.time_entries) {
      throw new Error("Unexpected Toggl response!")
    }
    const projects = response.data.projects
    const timeEntries = response.data.time_entries
    if (!Array.isArray(projects) || !Array.isArray(timeEntries)) {
      throw new Error("Unexpected Toggl response!")
    }

    // Find a running time entry
    const currentEntry = timeEntries.find(entry => entry.duration < 0)
    if (!currentEntry) {
      return {
        entry: null,
        project: null,
        projectId: null,
      }
    }

    // Join against a matching project, if found
    const currentProject = projects.find(project => project.id == currentEntry.pid) || { name: null, id: null }
    return {
      entry: currentEntry.description,
      project: currentProject.name,
      projectId: currentProject.id,
    }
  },

  setCurrentState: async function(state: TogglApiState, settings: TogglApiSettings): Promise<TogglApiState> {
    // Ensure the new state is valid
    if (!state) {
      throw new Error("Invalid new TogglApiState specified!")
    }

    // Get the current state from Toggl
    const currentState = await TogglApi.current(settings)

    // Early exit if state matches
    if (isEqual(state, currentState)) {
      return currentState
    }

    // Find a matching project, if specified
    if (state.project) {
      throw new Error("Not implemented!")
    }

    // TODO: Actually set state
    return state
  },

  fetch: async function(url: string, settings: TogglApiSettings): Promise<Object> {
    const response = await fetch(url, {
      method: "GET",
      headers: TogglApi.getHeaders(settings),
    })
    if (response.ok) {
      const json = await response.json()
      return json
    } else {
      throw new Error("Connection to Toggl API failed!")
    }
  },

  getHeaders: function(settings: TogglApiSettings): Object {
    const hash = Buffer.from(settings.apiToken + ":api_token").toString('base64')
    return {
      "Authorization": `Basic ${hash}`,
      "Content-Type": "application/json",
    }
  },
}

export default TogglApi
