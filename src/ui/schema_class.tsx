import {SchemaClass} from "@/lib/definitions";
import {Button} from "flowbite-react";
import {PiCrop, PiHighlighterCircle} from "react-icons/pi";


export function SchemaClassViewer({schema_class}: { schema_class: SchemaClass }) {
    return (
        <div className="border-2 border-blue-500 rounded-lg m-4 p-4">
            <h1 className="size-6 mb-2 overflow-scroll w-fit">{schema_class.name}</h1>
            <label className="block text-sm">Class
                Description:
                <textarea
                    className="block p-0.5 w-4/5 border-2 border-blue-500 rounded-lg"
                    autoFocus={false}
                    rows={4}
                    defaultValue={schema_class.description}/>
            </label>
            <div className="w-1/5 mt-2 flex justify-end ">
                <p className="pr-1">Annotate: </p>
                <Button outline className="h-6 mr-1, ml-1"><PiCrop/></Button>
                <Button outline className="h-6 mr-1 ml-1"><PiHighlighterCircle/></Button>
            </div>

        </div>
    )
}