import {ConfirmedHighlightSignpost} from "@/components/ConfirmedHighlightSignpost.tsx";
import {Signpost} from "@/lib/definitions.ts";

interface InstanceNavigatorProps {
    signposts: Signpost[],
}

export function InstanceNavigator({confirmedSignposts}: InstanceNavigatorProps) {
    return <>
        <p className={"text-gray-600 text-lg"}>Click on any of the instances to navigate to it in the document.</p>
        {confirmedSignposts.map(sp => <ConfirmedHighlightSignpost key={sp.id} {...sp} />)}
    </>
}