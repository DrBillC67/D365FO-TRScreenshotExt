/**
 * Finance and operations hosts this extension serves. Must stay in sync with
 * the content_scripts matches in manifest.json (checked by tests/hosts.test.js).
 */
const TR_ALLOWED_HOST_SUFFIXES = Object.freeze([
  ".operations.dynamics.com",
  ".operations.eu.dynamics.com",
  ".operations.fr.dynamics.com",
  ".operations.no.dynamics.com",
  ".operations.sa.dynamics.com",
  ".operations.ch.dynamics.com",
  ".operations.uae.dynamics.com",
  ".cloudax.dynamics.com",
  ".operations.gov.microsoftdynamics.us",
  ".operations.high.microsoftdynamics.us",
]);

function isAllowedDynamicsUrl(urlString) {
  if (!urlString) {
    return false;
  }

  let url;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  return TR_ALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}
