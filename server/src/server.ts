// Load environment variables from .env
import * as dotenv from "dotenv"
dotenv.config({ path: ".env" });

import app from "./app"
import * as dedent from "dedent"

/**
 * Start Express server.
 */
const server = app.listen(app.get("port"), () => {
  console.log(
    "***********************************************************\n" +
    " _____ ___   ____  ____ _     ____   ___    _    ____  ____\n" +
    "|_   _/ _ \\ / ___|/ ___| |   | __ ) / _ \\  / \\  |  _ \\|  _ \\\n" +
    "  | || | | | |  _| |  _| |   |  _ \\| | | |/ _ \\ | |_) | | | |\n" +
    "  | || |_| | |_| | |_| | |___| |_) | |_| / ___ \\|  _ <| |_| |\n" +
    "  |_| \\___/ \\____|\\____|_____|____/ \\___/_/   \\_\\_| \\_\\____/\n" +
    "***********************************************************\n"
  )
  console.log(dedent`
    Current configuration (edit '.env' file to modify):
      NODE_ENV=${process.env.NODE_ENV}
      DEBUG=${process.env.DEBUG}
      PORT=${process.env.PORT}
      TOGGL_API_TOKEN=${process.env.TOGGL_API_TOKEN}
      PARTICLE_API_TOKEN=${process.env.PARTICLE_API_TOKEN}
      PARTICLE_DEVICE_NAME=${process.env.PARTICLE_DEVICE_NAME}
  `)
  console.log(
    "\nTogglBoard is running at http://localhost:%d in '%s' mode",
    app.get("port"),
    app.get("env")
  )
  console.log("Press CTRL-C to stop\n")
})

export default server
