import "isomorphic-fetch"
import { isEqual } from "lodash"
declare const fetch: any // NOTE: this offends my sensibilities

const APP_NAME = "TogglBoard"

interface TogglAPISettings {
  apiToken: string
}

interface TogglAPIState {
  entry: string | null
  entryId: number | null
  project: string | null
  projectId: number | null
}

interface TogglAPINewState {
  entry: string | null
  projectId: number | null
}

interface TogglAPICurrentUser {
  projects: TogglAPIProject[]
  time_entries: TogglAPITimeEntry[]
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
}

const TogglAPI = {
  test: async function(settings: TogglAPISettings): Promise<Object> {
    const response = await TogglAPI.fetch("https://www.toggl.com/api/v8/me", settings)
    return response
  },

  getCurrentUser: async function(settings: TogglAPISettings): Promise<TogglAPICurrentUser> {
    // Get the current user data from Toggl
    const response = await TogglAPI.fetch(
      "https://www.toggl.com/api/v8/me?with_related_data=true",
      settings
    ) as { data: TogglAPICurrentUser }

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

  extractCurrentState(currentUser: TogglAPICurrentUser): TogglAPIState {
    // Extract the current entry & project from the TogglAPI data
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
    let timeEntry: TogglAPITimeEntry = { created_with: APP_NAME }
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
        body: { "time_entry": timeEntry },
      }
    ) as { data: TogglAPITimeEntry }
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

  fetch: async function(url: string, settings: TogglAPISettings, opts = {}): Promise<Object> {
    const response = await fetch(url, Object.assign({
      method: "GET",
      headers: TogglAPI.getHeaders(settings),
    }, opts))
    if (response.ok) {
      const json = await response.json()
      return json
    } else {
      throw new Error("Connection to Toggl API failed!")
    }
  },

  getHeaders: function(settings: TogglAPISettings): Object {
    const hash = Buffer.from(settings.apiToken + ":api_token").toString('base64')
    return {
      "Authorization": `Basic ${hash}`,
      "Content-Type": "application/json",
    }
  },
}

export default TogglAPI
