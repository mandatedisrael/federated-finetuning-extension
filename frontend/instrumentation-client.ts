const CHROME_EXTENSION_URL = "chrome-extension://";
const EXTENSION_SCRIPT_NAMES = [
  "contentScript.js",
  "inpage.js",
  "lockdown-install.js",
  "requestProvider.js",
];

function getStringProperty(value: unknown, key: "message" | "stack") {
  if (typeof value !== "object" || value === null || !(key in value)) return "";
  const property = value[key as keyof typeof value];
  return typeof property === "string" ? property : "";
}

function isFromBrowserExtension(filename: string, stack: string) {
  return (
    filename.startsWith(CHROME_EXTENSION_URL) ||
    stack.includes(CHROME_EXTENSION_URL) ||
    EXTENSION_SCRIPT_NAMES.some(
      (scriptName) => filename.includes(scriptName) || stack.includes(scriptName),
    )
  );
}

function isWalletProviderCollisionMessage(message: string) {
  return [
    "Cannot redefine property: StacksProvider",
    "Cannot redefine property: ethereum",
    "Cannot redefine property: isZerion",
    "Cannot set property ethereum",
    "Failed to set window.ethereum",
    "global Ethereum provider",
    "Unable to set StacksProvider",
    "Failed setting Xverse Stacks default provider",
  ].some((needle) => message.includes(needle));
}

function isExtensionOnlyReactMessage(message: string) {
  return message.includes("Element type is invalid");
}

function isExtensionConsoleNoise(message: string) {
  return (
    isWalletProviderCollisionMessage(message) ||
    message.includes("SES Removing unpermitted intrinsics") ||
    message.includes("State loaded from storage couldn't be migrated")
  );
}

function isBrowserExtensionRuntimeNoise(event: ErrorEvent | PromiseRejectionEvent) {
  const reason =
    "reason" in event
      ? event.reason
      : "error" in event
        ? event.error
        : undefined;

  const message =
    "message" in event && event.message
      ? event.message
      : getStringProperty(reason, "message");
  const filename = "filename" in event ? event.filename : "";
  const stack = getStringProperty(reason, "stack");

  if (isWalletProviderCollisionMessage(message)) return true;

  return isFromBrowserExtension(filename, stack) && isExtensionOnlyReactMessage(message);
}

function installConsoleExtensionFilter() {
  const currentConsoleError = window.console.error;
  if ("__ffeExtensionFilter" in currentConsoleError) return;

  const filteredConsoleError = (...args: unknown[]) => {
    const stack = new Error().stack ?? "";
    const message = args
      .map((arg) => (typeof arg === "string" ? arg : getStringProperty(arg, "message")))
      .join(" ");

    if (isExtensionConsoleNoise(message) || isFromBrowserExtension("", stack)) return;

    currentConsoleError(...args);
  };

  Object.defineProperty(filteredConsoleError, "__ffeExtensionFilter", {
    value: true,
  });

  window.console.error = filteredConsoleError;
}

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (event) => {
      if (!isBrowserExtensionRuntimeNoise(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (!isBrowserExtensionRuntimeNoise(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  installConsoleExtensionFilter();
  queueMicrotask(installConsoleExtensionFilter);
  window.setTimeout(installConsoleExtensionFilter, 0);
}
