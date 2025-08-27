import {SchemaClassViewer} from "../ui/schema_class";

import {Button, TabItem, Tabs} from "flowbite-react";
import {PiListPlus} from "react-icons/pi";
import {Schema} from "@/lib/definitions";


export function SchemaViewer({schemas}: { schemas: Array<Schema> }) {
    return <Tabs>
        {schemas.map(schema => <TabItem key={schema.name} title={schema.name}>
            <Button outline className="h-6 mr-1, ml-1"><PiListPlus/>Add new class</Button>
            <ul>
                {schema.classes.map(sc => <SchemaClassViewer key={sc.name} schema_class={sc}/>)}
            </ul>
        </TabItem>)}
    </Tabs>
}