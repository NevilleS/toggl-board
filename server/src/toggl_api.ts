import * as Debug from "debug"
import { has, pick } from "lodash"
import "isomorphic-fetch"
declare const fetch: any // NOTE: this offends my sensibilities
const debug = Debug("toggl-api")

const APP_NAME = "TogglBoard"

export interface TogglAPISettings {
  token: string
}

export interface TogglAPIState {
  entry: string | null
  entryId: number | null
  project: string | null
  projectId: number | null
}

export interface TogglAPINewState {
  entry?: string | null
  projectId: number | null
}

interface TogglAPICurrentUser {
  projects: TogglAPIProject[]
  time_entries?: TogglAPITimeEntry[]
}

interface TogglAPIProject {
  id: number
  name: string
}

interface TogglAPITimeEntry {
  created_with?: string
  description?: string
  duration?: number
  id?: number
  pid?: number
  start?: string
  stop?: string
  tags?: string[]
}

const TogglAPI = {
  test: async function(settings: TogglAPISettings): Promise<boolean> {
    const response = await TogglAPI.fetch(
      "https://www.toggl.com/api/v8/me",
      settings
    ) as { data: TogglAPICurrentUser }
    if (response && has(response, "data")) {
      return true
    }
    return false
  },

  getCurrentState: async function(settings: TogglAPISettings): Promise<TogglAPIState> {
    const currentUser = await TogglAPI.getCurrentUser(settings)
    return TogglAPI.extractCurrentState(currentUser)
  },

  setCurrentState: async function(state: TogglAPINewState, settings: TogglAPISettings): Promise<TogglAPIState> {
    // Ensure the new state is valid
    if (!state) {
      throw new Error("Invalid TogglAPINewState specified!")
    }

    // Get the current state from Toggl
    const currentUser = await TogglAPI.getCurrentUser(settings)
    const currentState = TogglAPI.extractCurrentState(currentUser)

    // Early exit if state matches
    // NOTE: Ignore entryId (assigned by Toggl) and projectName (only for display)
    if (state.entry == currentState.entry && state.projectId == currentState.projectId) {
      return currentState
    }

    // If the state is null, stop the current entry
    if (!state.entry && !state.projectId) {
      const response = await TogglAPI.fetch(
        `https://www.toggl.com/api/v8/time_entries/${currentState.entryId}/stop`,
        settings,
        {
          method: "PUT",
        }
      ) as { data: TogglAPITimeEntry }
      if (!response || !has(response, "data")) {
        throw new Error("Unexpected Toggl response!")
      }
      return {
        entry: null,
        entryId: null,
        project: null,
        projectId: null,
      }
    }

    // Build a new entry
    let timeEntry: TogglAPITimeEntry = { created_with: APP_NAME, tags: ["togglboard"] }
    if (state.entry) {
      timeEntry.description = state.entry
    }
    if (state.projectId) {
      timeEntry.pid = state.projectId
    }

    // Start a new time entry
    const response = await TogglAPI.fetch(
      "https://www.toggl.com/api/v8/time_entries/start",
      settings,
      {
        method: "POST",
        body: JSON.stringify({ "time_entry": timeEntry }),
      }
    ) as { data: TogglAPITimeEntry }
    if (!response || !has(response, "data")) {
      throw new Error("Unexpected Toggl response!")
    }

    // Join the new entry against the current user data to return the new state
    const newEntry = response.data
    if (newEntry.pid) {
      var newProject = currentUser.projects.find(project => project.id == newEntry.pid)
    }
    return {
      entry: newEntry.description || null,
      entryId: newEntry.id || null,
      project: (newProject && newProject.name) || null,
      projectId: (newProject && newProject.id) || null,
    }
  },

  getCurrentUser: async function(settings: TogglAPISettings): Promise<TogglAPICurrentUser> {
    // Get the current user data from Toggl
    const response = await TogglAPI.fetch(
      "https://www.toggl.com/api/v8/me?with_related_data=true",
      settings
    ) as { data: TogglAPICurrentUser }

    // Ensure it has all the data we expect...
    if (!has(response, "data") || !has(response.data, "projects")) {
      throw new Error("Unexpected Toggl response!")
    }
    if (!has(response.data, "projects") || !Array.isArray(response.data.projects)) {
      throw new Error("Unexpected Toggl response!")
    }
    // NOTE: time_entries is optional, but if it's defined ensure it's an array
    if (has(response.data, "time_entries") && !Array.isArray(response.data.time_entries)) {
      throw new Error("Unexpected Toggl response!")
    }
    return pick(response.data, ["projects", "time_entries"])
  },

  extractCurrentState(currentUser: TogglAPICurrentUser): TogglAPIState {
    // Extract the current entry & project from the TogglAPI data
    const entries = currentUser.time_entries || []
    const currentEntry = entries.find(entry => !!(entry.duration && entry.duration < 0))
    if (!currentEntry) {
      return {
        entry: null,
        entryId: null,
        project: null,
        projectId: null,
      }
    }

    // Join against a matching project, if found
    const currentProject = currentUser.projects.find(project => project.id == currentEntry.pid)
    return {
      entry: currentEntry.description || null,
      entryId: currentEntry.id || null,
      project: (currentProject && currentProject.name) || null,
      projectId: (currentProject && currentProject.id) || null,
    }
  },

  // TODO: extract into shared API helpers
  fetch: async function(url: string, settings: TogglAPISettings, opts = {}): Promise<Object> {
    const fetchOpts: any = Object.assign({
      method: "GET",
      headers: TogglAPI.getHeaders(settings)
    }, opts)
    debug("fetch request: %s %s (%o)", fetchOpts.method, url, fetchOpts.body)
    const response = await fetch(url, fetchOpts)
    if (response && response.ok) {
      const json = await response.json()
      debug("fetch response: HTTP %s (%o)", response.status, json)
      return json
    } else {
      if (response && response.hasBody) {
        var text = await response.text()
      }
      debug("fetch error: HTTP %s (%s)", response.status, text)
      throw new Error("Connection to Toggl API failed!")
    }
  },

  getHeaders: function(settings: TogglAPISettings): Object {
    const hash = Buffer.from(settings.token + ":api_token").toString('base64')
    return {
      "Authorization": `Basic ${hash}`,
      "Content-Type": "application/json",
    }
  },
}

export default TogglAPI
