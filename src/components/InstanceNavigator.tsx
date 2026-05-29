import {ConfirmedHighlightSignpost} from "@/components/ConfirmedHighlightSignpost.tsx";
import {Highlight, MlHighlight} from "@/lib/definitions.ts";

interface InstanceNavigatorProps {
    mlHighlights: MlHighlightL[],
    confirmedHighlights: Highlight[],
}

export function InstanceNavigator({mlHighlights, confirmedHighlights}: InstanceNavigatorProps) {
    return <>
        {confirmedHighlights.map(hl =>{
            console.log(hl);
           return <ConfirmedHighlightSignpost key={hl.id} {...hl} />
        })}
    </>
}