import * as z from "zod";
import {findContentProblem} from "./documentContentValidator.js";

const titleSchema = z.string()
.trim()
.min(1, "Document title is required")
.max(100, "Length cannot be greater than 100 chars");

export const createDocumentSchema = z.object({
    title : titleSchema
});

export const renameDocumentSchema = z.object({
    title : titleSchema
});

// A save says which version it is based on. The server only accepts it if that is still the current version.
export const saveContentSchema = z.object({
    content : z.any().superRefine((value, ctx)=>{
        const problem = findContentProblem(value);

        if(problem){
            ctx.addIssue({code : "custom", message : problem});
        }
    }),
    version : z.number({error : "version must be a number"}).int("version must be a whole number").min(0, "version cannot be negative")
});
