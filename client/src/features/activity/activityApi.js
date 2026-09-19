import { apiRequest } from "../../services/api";
import { withQuery } from "../../utils/withQuery";

// What happened in a workspace, newest first. params : { limit, before (the id of the last one the page has) }
export const getActivity = (workspaceId, params, signal)=>
    apiRequest(withQuery(`/workspace/${workspaceId}/activity`, params), { signal });
