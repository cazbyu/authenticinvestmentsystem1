const APP_VERSION = '1.0.0';

export function getAppVersion(): string {
  return APP_VERSION;
}

export function getAppVersionDisplay(): string {
  return `v ${getAppVersion()}`;
}
