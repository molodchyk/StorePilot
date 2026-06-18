const STOREPILOT_LISTING_STORAGE_KEY = "storePilotListings";
var STOREPILOT_API = globalThis.browser;
const STOREPILOT_PROJECTS_STORAGE_KEY = "storePilotProjects";
const STOREPILOT_ACTIVE_PROJECT_STORAGE_KEY = "storePilotActiveProjectId";
const STOREPILOT_DASHBOARD_PROJECT_BINDINGS_STORAGE_KEY = "storePilotDashboardProjectBindings";
const STOREPILOT_HANDLE_DB_NAME = "storePilotHandles";
const STOREPILOT_HANDLE_DB_VERSION = 2;
const STOREPILOT_HANDLE_STORE_NAME = "handles";
const STOREPILOT_MEDIA_FILE_STORE_NAME = "mediaFiles";
const STOREPILOT_TEXT_LISTING_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".text",
  ".rtf",
  ".html",
  ".htm",
  ".json",
  ".yaml",
  ".yml",
  ".csv",
  ".tsv",
  ".xml",
  ".properties"
]);
const STOREPILOT_BLOCKED_LISTING_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".avif",
  ".ico",
  ".zip",
  ".crx",
  ".xpi",
  ".pdf",
  ".exe",
  ".dll",
  ".bin"
]);
const STOREPILOT_SKIPPED_DIRECTORY_NAMES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".cache",
  ".next",
  "node_modules"
]);
