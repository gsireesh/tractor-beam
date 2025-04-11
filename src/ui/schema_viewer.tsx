import {SchemaClassViewer} from "../ui/schema_class";

import {TabItem, Tabs} from "flowbite-react";
import {Schema} from "../lib/definitions";


export function SchemaViewer({schemas}: { schemas: Array<Schema> }) {
    return <Tabs>
        {schemas.map(schema => <TabItem key={schema.name} title={schema.name}>
            <ul>
                {schema.classes.map(sc => <SchemaClassViewer key={sc.name} schema_class={sc}/>)}
            </ul>
        </TabItem>)}
    </Tabs>
}