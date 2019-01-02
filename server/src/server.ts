// Load environment variables from .env
import * as dotenv from "dotenv"
dotenv.config({ path: ".env" });

import * as Debug from "debug"
import App from "./app"
import * as dedent from "dedent"
const debug = Debug("server")

/**
 * Start Express server.
 */
const app = App()
const server = app.listen(app.get("port"), () => {
  debug(
    "***********************************************************\n" +
    " _____ ___   ____  ____ _     ____   ___    _    ____  ____\n" +
    "|_   _/ _ \\ / ___|/ ___| |   | __ ) / _ \\  / \\  |  _ \\|  _ \\\n" +
    "  | || | | | |  _| |  _| |   |  _ \\| | | |/ _ \\ | |_) | | | |\n" +
    "  | || |_| | |_| | |_| | |___| |_) | |_| / ___ \\|  _ <| |_| |\n" +
    "  |_| \\___/ \\____|\\____|_____|____/ \\___/_/   \\_\\_| \\_\\____/\n" +
    "***********************************************************\n"
  )
  debug(dedent`
    Current configuration (edit '.env' file to modify):
      NODE_ENV=${process.env.NODE_ENV}
      DEBUG=${process.env.DEBUG}
      PORT=${process.env.PORT}
      TOGGL_API_TOKEN=${process.env.TOGGL_API_TOKEN}
      TOGGL_PROJECT_IDS=${process.env.TOGGL_PROJECT_IDS}
      PARTICLE_API_TOKEN=${process.env.PARTICLE_API_TOKEN}
      PARTICLE_DEVICE_NAME=${process.env.PARTICLE_DEVICE_NAME}
      SYNC_PERIOD_MS=${process.env.SYNC_PERIOD_MS}
  `)
  debug(
    "\nTogglBoard is running at http://localhost:%d in '%s' mode",
    app.get("port"),
    app.get("env")
  )
  debug("Press CTRL-C to stop\n")
})

export default server
