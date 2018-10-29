import "isomorphic-fetch"
import { isEqual } from "lodash"
declare const fetch: any // NOTE: this offends my sensibilities

const APP_NAME = "TogglBoard"

interface TogglApiSettings {
  apiToken: string
}

interface TogglBoardState {
  entry: string | null
  entryId: number | null
  project: string | null
  projectId: number | null
}

interface TogglBoardNewState {
  entry: string | null
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
  created_with?: string
  description?: string
  duration?: number
  id?: number
  pid?: number
  start?: string
  stop?: string
}

const TogglApi = {
  test: async function(settings: TogglApiSettings): Promise<Object> {
    const response = await TogglApi.fetch("https://www.toggl.com/api/v8/me", settings)
    return response
  },

  getCurrentUser: async function(settings: TogglApiSettings): Promise<TogglApiCurrentUser> {
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
    return response.data
  },

  extractCurrentState(currentUser: TogglApiCurrentUser): TogglBoardState {
    // Extract the current entry & project from the TogglApi data
    const currentEntry = currentUser.time_entries.find(entry => !!(entry.duration && entry.duration < 0))
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

  getCurrentState: async function(settings: TogglApiSettings): Promise<TogglBoardState> {
    const currentUser = await TogglApi.getCurrentUser(settings)
    return TogglApi.extractCurrentState(currentUser)
  },

  setCurrentState: async function(state: TogglBoardNewState, settings: TogglApiSettings): Promise<TogglBoardState> {
    // Ensure the new state is valid
    if (!state) {
      throw new Error("Invalid TogglBoardNewState specified!")
    }

    // Get the current state from Toggl
    const currentUser = await TogglApi.getCurrentUser(settings)
    const currentState = TogglApi.extractCurrentState(currentUser)

    // Early exit if state matches
    // NOTE: Ignore entryId (assigned by Toggl) and projectName (only for display)
    if (state.entry == currentState.entry && state.projectId == currentState.projectId) {
      return currentState
    }

    // If the state is null, stop the current entry
    if (!state.entry && !state.projectId) {
      const response = await TogglApi.fetch(
        `https://www.toggl.com/api/v8/time_entries/${currentState.entryId}/stop`,
        settings,
        {
          method: "PUT",
        }
      ) as { data: TogglApiTimeEntry }
      if (!response || !response.data) {
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
    let timeEntry: TogglApiTimeEntry = { created_with: APP_NAME }
    if (state.entry) {
      timeEntry.description = state.entry
    }
    if (state.projectId) {
      timeEntry.pid = state.projectId
    }

    // Start a new time entry
    const response = await TogglApi.fetch(
      "https://www.toggl.com/api/v8/time_entries/start",
      settings,
      {
        method: "POST",
        body: { "time_entry": timeEntry },
      }
    ) as { data: TogglApiTimeEntry }
    if (!response || !response.data) {
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

  fetch: async function(url: string, settings: TogglApiSettings, opts = {}): Promise<Object> {
    const response = await fetch(url, Object.assign({
      method: "GET",
      headers: TogglApi.getHeaders(settings),
    }, opts))
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
