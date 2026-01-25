import dotenv from "dotenv";
import { loadConfig } from "./config";

// Placeholder worker entrypoint (BullMQ etc. will be added later).
dotenv.config();
loadConfig();
console.log("worker: boot");
