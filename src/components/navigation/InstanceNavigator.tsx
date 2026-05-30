import {Signpost} from "@/lib/definitions.ts";
import {ConfirmedHighlightSignpost} from "@/components/navigation/ConfirmedHighlightSignpost.tsx";
import {ProvisionalHighlightSignpost} from "@/components/navigation/ProvisionalHighlightSignpost.tsx";


interface InstanceNavigatorProps {
    mlSignposts: Signpost[]
    confirmedSignposts: Signpost[],
}

export function InstanceNavigator({confirmedSignposts, mlSignposts}: InstanceNavigatorProps) {

    const confirmedInstances = confirmedSignposts.map(sp => <ConfirmedHighlightSignpost key={sp.id} {...sp} />);
    const mlInstances = mlSignposts.map(sp => <ProvisionalHighlightSignpost key={sp.id} {...sp} />);
    return <>
        <p className={"text-gray-600 text-lg"}>Click on any of the instances to navigate to it in the document.</p>
        {[...confirmedInstances, ...mlInstances]}
    </>
}