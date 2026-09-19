import * as z from "zod";
import formatZodErrors from "../validators/formatZodErrors.js";
import {findActivities} from "../service/activityService.js";

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

// ?limit=20&before=<activityId>
const listActivitySchema = z.object({
    limit : z.coerce.number().int().min(1, "limit must be at least 1").max(50, "limit can be at most 50").default(20),
    before : objectIdSchema.optional()
});

// What happened in this workspace. Always scoped to the workspace of the URL (the membership check already ran),
// so nobody can read another team's feed.
export const listActivity = async (req, res)=>{
    try{
        const result = listActivitySchema.safeParse(req.query);

        if(!result.success){
            return res.status(400).json({
                message : result.error.issues[0].message,
                errors : formatZodErrors(result.error)
            });
        }

        const {limit, before} = result.data;
        const page = await findActivities({workspaceId : req.membership.workspaceId, before, limit});

        // the cursor is not an entry of this workspace
        if(!page){
            return res.status(404).json({
                message : "Activity not found"
            });
        }

        res.status(200).json({
            message : "Activity",
            activities : page.activities,
            hasMore : page.hasMore
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message : "Internal Server Error"
        });
    }
}
