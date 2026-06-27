import type { TabId } from "@/components/ops/app-config";

export const APP_ROUTE_PREFIX = "/app";

export function isAppRoute(pathname: string) {
  return pathname === APP_ROUTE_PREFIX || pathname.startsWith(`${APP_ROUTE_PREFIX}/`);
}

export function stripAppRoutePrefix(pathname: string) {
  if (pathname === APP_ROUTE_PREFIX) return "/";
  if (pathname.startsWith(`${APP_ROUTE_PREFIX}/`)) return pathname.slice(APP_ROUTE_PREFIX.length);
  return pathname;
}

export function routePath(section: TabId | string, appMode: boolean) {
  const path = section.startsWith("/") ? section : `/${section}`;
  if (isAppRoute(path)) return path;
  return appMode ? `${APP_ROUTE_PREFIX}${path}` : path;
}
