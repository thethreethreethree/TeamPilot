/** Appends `team=<manager id>` (F10.9 / F16.6) to a coaching API URL when a team is chosen; otherwise the URL is unchanged. */
export const withTeam = (url: string, team?: string) => (team ? `${url}${url.includes("?") ? "&" : "?"}team=${encodeURIComponent(team)}` : url);
