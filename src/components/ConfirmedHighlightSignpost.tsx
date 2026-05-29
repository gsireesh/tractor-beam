import {Signpost} from "@/lib/definitions.ts"
import {bodyToBorderColor} from "@/lib/utils.ts";
import {Badge} from "@/components/ui/badge.tsx";
import {Minus, Plus} from "lucide-react";

export function ConfirmedHighlightSignpost({className, text, color, positiveExample}: Signpost) {
    const borderColor = bodyToBorderColor(color);
    return <div className="border-1 rounded-lg my-1" style={{backgroundColor: color, borderColor: borderColor}}>
        <div className="rounded-sm border-l-4 mx-3 my-1 p-2 italic bg-gray-100" style={{borderColor: borderColor}}>{text}</div>
        <div className="mx-3 my-1">
                <Badge className="bg-white" style={{borderColor: borderColor, color:borderColor}}>{className}</Badge>
                {positiveExample ?
                <Badge className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"><Plus />Positive Example</Badge> :
                <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"><Minus/>Negative Example</Badge>
                }
        </div>
        {<div className="rounded-sm mx-3 my-1 p-2 bg-white" style={{borderColor: borderColor}}>lmao</div>}
    </div>
}