import {ConfirmedHighlightSignpost} from "@/components/ConfirmedHighlightSignpost.tsx";
import {Signpost} from "@/lib/definitions.ts";

interface InstanceNavigatorProps {
    signposts: Signpost[],
}

export function InstanceNavigator({signposts}: InstanceNavigatorProps) {
    return <>
        {signposts.map(sp => <ConfirmedHighlightSignpost key={sp.id} {...sp} />)}
    </>
}